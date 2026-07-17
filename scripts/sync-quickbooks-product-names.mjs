import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import XLSX from "xlsx";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
dotenv.config({ path: resolve(repoRoot, ".env.local") });

const defaultExcelPath = "/Users/usuario/Downloads/ListaDeServiciosProductos__9341452174121559_17_07_2026 (1).xls";
const excelPath = process.argv.find((arg) => !arg.startsWith("-") && (arg.endsWith(".xls") || arg.endsWith(".xlsx")))
  ?? defaultExcelPath;
const dryRun = process.argv.includes("--dry-run");

function normalizeSku(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function readExcelRows(path) {
  if (!existsSync(path)) {
    throw new Error(`No se encontro el archivo Excel en ${path}`);
  }

  const workbook = XLSX.read(readFileSync(path));
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

  return rows
    .map((row) => ({
      quickbooksName: String(row["Nombre de producto/servicio"] ?? "").trim(),
      sku: String(row["Unidad de mantenimiento de existencias (SKU)"] ?? "").trim(),
    }))
    .filter((row) => row.quickbooksName && row.sku);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Falta MONGODB_URI en .env.local");
  }

  const excelRows = readExcelRows(excelPath);
  const bySku = new Map();

  for (const row of excelRows) {
    bySku.set(normalizeSku(row.sku), row.quickbooksName);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const Product = mongoose.connection.collection("products");
  const products = await Product.find({}).project({ sku: 1, name: 1, quickbooksName: 1 }).toArray();

  let updated = 0;
  let unchanged = 0;
  let missingInExcel = 0;
  const samples = [];

  for (const product of products) {
    const sku = normalizeSku(product.sku);
    const nextQuickbooksName = bySku.get(sku);

    if (!nextQuickbooksName) {
      missingInExcel += 1;
      continue;
    }

    const current = String(product.quickbooksName ?? "").trim();

    if (current === nextQuickbooksName) {
      unchanged += 1;
      continue;
    }

    if (samples.length < 20) {
      samples.push({
        sku: product.sku,
        frontendName: product.name,
        previousQuickbooksName: current || "(vacio)",
        nextQuickbooksName,
      });
    }

    if (!dryRun) {
      await Product.updateOne(
        { _id: product._id },
        { $set: { quickbooksName: nextQuickbooksName, updatedAt: new Date() } },
      );
    }

    updated += 1;
  }

  const excelOnly = [...bySku.entries()]
    .filter(([sku]) => !products.some((product) => normalizeSku(product.sku) === sku))
    .map(([sku, name]) => `${sku} · ${name}`);

  console.log(`Archivo: ${excelPath}`);
  console.log(`Modo: ${dryRun ? "dry-run" : "aplicar"}`);
  console.log(`Filas Excel con SKU: ${excelRows.length}`);
  console.log(`SKUs unicos Excel: ${bySku.size}`);
  console.log(`Productos BD: ${products.length}`);
  console.log(`quickbooksName actualizados: ${updated}`);
  console.log(`Sin cambio: ${unchanged}`);
  console.log(`En BD sin match en Excel: ${missingInExcel}`);
  console.log(`En Excel sin match en BD: ${excelOnly.length}`);

  if (samples.length > 0) {
    console.log("\nEjemplos (frontend name se mantiene):");
    samples.forEach((entry) => {
      console.log(`- ${entry.sku}`);
      console.log(`  frontend: ${entry.frontendName}`);
      console.log(`  qb: ${entry.previousQuickbooksName} -> ${entry.nextQuickbooksName}`);
    });
  }

  if (excelOnly.length > 0) {
    console.log("\nSolo en Excel (primeros 15):");
    excelOnly.slice(0, 15).forEach((entry) => console.log(`- ${entry}`));
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
