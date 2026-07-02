import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import XLSX from "xlsx";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
dotenv.config({ path: resolve(repoRoot, ".env.local") });

const excelPath = process.argv.find((arg) => !arg.startsWith("-") && arg.endsWith(".xlsx"))
  ?? "/Users/usuario/Downloads/PRODUCTOS.xlsx";
const shouldCreateMissing = process.argv.includes("--create-missing");

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function roundWeight(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.round(numericValue * 1000) / 1000;
}

function derivePresentation(presentationText) {
  const normalized = normalizeText(presentationText);

  if (normalized === "KG" || normalized.endsWith(" KG")) {
    return "kg";
  }

  if (normalized.includes("CAJA")) {
    return "caja";
  }

  if (normalized.includes("PACK") || normalized.includes("PAQUETE")) {
    return "paquete";
  }

  if (normalized.includes("DISPL")) {
    return "unidad";
  }

  return "unidad";
}

function inferCategory(sku, name) {
  const normalizedSku = normalizeText(sku);
  const normalizedName = normalizeText(name);

  if (normalizedSku.startsWith("B")) {
    return "BEBIDAS";
  }

  if (normalizedSku.startsWith("L")) {
    return "ALQUERIA";
  }

  if (normalizedName.includes("SUNTEA")) {
    return "REFRESCOS";
  }

  return "SECO";
}

function buildProductPayload(row, existingProduct = null) {
  const nextPresentation = derivePresentation(row.presentation);

  return {
    sku: row.sku,
    name: row.name,
    description: row.presentation || String(existingProduct?.description ?? ""),
    category: String(existingProduct?.category ?? inferCategory(row.sku, row.name)),
    supplier: String(existingProduct?.supplier ?? "IMPORTADO SPS ARUBA"),
    cost: Number(existingProduct?.cost ?? 0),
    arubaPurchaseCostUsd: Number(existingProduct?.arubaPurchaseCostUsd ?? 0),
    arubaUsdToAwgRate: Number(existingProduct?.arubaUsdToAwgRate ?? 1.79),
    variableSalePrice: Boolean(existingProduct?.variableSalePrice ?? false),
    salePrice: existingProduct?.variableSalePrice ? null : Number(existingProduct?.salePrice ?? 0),
    presentation: nextPresentation,
    containerType: String(existingProduct?.containerType ?? "seco"),
    shareWithAruba: existingProduct?.shareWithAruba !== false,
    productWeightKg: roundWeight(row.productWeightKg),
    displaysPerBox: row.displaysPerBox > 0 ? row.displaysPerBox : 1,
    unitsPerBox: row.unitsPerDisplay > 0 ? row.unitsPerDisplay : Number(existingProduct?.unitsPerBox ?? 0),
    unitsPerBoxUnit: derivePresentation(row.presentation) === "kg" ? "kg" : "unidad",
    inventoryAlert: Number(existingProduct?.inventoryAlert ?? 0),
    boxLengthCm: Number(existingProduct?.boxLengthCm ?? 0),
    boxWidthCm: Number(existingProduct?.boxWidthCm ?? 0),
    boxHeightCm: Number(existingProduct?.boxHeightCm ?? 0),
    active: true,
  };
}

function readExcelRows(path) {
  if (!existsSync(path)) {
    throw new Error(`No se encontro el archivo Excel en ${path}`);
  }

  const workbook = XLSX.read(readFileSync(path));
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

  return rows.map((row) => ({
    sku: String(row.SKU ?? "").trim(),
    name: String(row.PRODUCTO ?? "").trim(),
    presentation: String(row["PRESENTACION "] ?? row.PRESENTACION ?? "").trim(),
    displaysPerBox: Number(row.DISPLAY ?? 0),
    unitsPerDisplay: Number(row.UNIDADES ?? 0),
    contentKg: Number(row.CONTENIDO ?? 0),
    productWeightKg: roundWeight(row["PESO (KG)"] ?? row.PESO ?? 0),
  }));
}

async function ensureCategory(name) {
  const Category = mongoose.connection.collection("categories");
  const existing = await Category.findOne({ name });

  if (existing) {
    return existing;
  }

  const createdAt = new Date();
  const result = await Category.insertOne({
    code: `CAT-${Date.now()}`,
    name,
    description: "",
    active: true,
    createdAt,
    updatedAt: createdAt,
  });

  return { _id: result.insertedId, name };
}

async function ensureSupplier(name) {
  const Supplier = mongoose.connection.collection("suppliers");
  const existing = await Supplier.findOne({ name });

  if (existing) {
    return existing;
  }

  const createdAt = new Date();
  const result = await Supplier.insertOne({
    code: `SUP-${Date.now()}`,
    name,
    contactName: "",
    email: "",
    phone: "",
    active: true,
    createdAt,
    updatedAt: createdAt,
  });

  return { _id: result.insertedId, name };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Falta MONGODB_URI en .env.local");
  }

  const excelRows = readExcelRows(excelPath);
  await mongoose.connect(process.env.MONGODB_URI);

  const Product = mongoose.connection.collection("products");
  const dbProducts = await Product.find({ active: { $ne: false } }).toArray();
  const productsBySku = new Map(
    dbProducts.map((product) => [normalizeText(product.sku), product]),
  );
  const productsByName = new Map(
    dbProducts.map((product) => [normalizeText(product.name), product]),
  );

  let updatedCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  const unmatched = [];
  const updatedSamples = [];

  for (const row of excelRows) {
    if (!row.sku || !row.name) {
      skippedCount += 1;
      continue;
    }

    let product = productsBySku.get(normalizeText(row.sku))
      ?? productsByName.get(normalizeText(row.name));

    if (!product) {
      if (!shouldCreateMissing) {
        unmatched.push(`${row.sku} - ${row.name}`);
        skippedCount += 1;
        continue;
      }

      const categoryName = inferCategory(row.sku, row.name);
      await ensureCategory(categoryName);
      await ensureSupplier("IMPORTADO SPS ARUBA");

      const payload = buildProductPayload(row);
      payload.category = categoryName;
      payload.supplier = "IMPORTADO SPS ARUBA";
      payload.createdAt = new Date();
      payload.updatedAt = payload.createdAt;

      const insertResult = await Product.insertOne(payload);
      product = { _id: insertResult.insertedId, ...payload };
      productsBySku.set(normalizeText(row.sku), product);
      productsByName.set(normalizeText(row.name), product);
      createdCount += 1;
      updatedCount += 1;

      if (updatedSamples.length < 8) {
        updatedSamples.push({
          action: "created",
          sku: row.sku,
          name: row.name,
          productWeightKg: payload.productWeightKg,
          displaysPerBox: payload.displaysPerBox,
          unitsPerBox: payload.unitsPerBox,
        });
      }

      continue;
    }

    const update = buildProductPayload(row, product);
    await Product.updateOne({ _id: product._id }, { $set: update });
    updatedCount += 1;

    if (updatedSamples.length < 8) {
      updatedSamples.push({
        action: "updated",
        sku: row.sku,
        name: row.name,
        productWeightKg: update.productWeightKg,
        displaysPerBox: update.displaysPerBox,
        unitsPerBox: update.unitsPerBox,
      });
    }
  }

  console.log(`Archivo: ${excelPath}`);
  console.log(`Filas Excel: ${excelRows.length}`);
  console.log(`Productos actualizados: ${updatedCount}`);
  console.log(`Productos creados: ${createdCount}`);
  console.log(`Sin coincidencia / omitidos: ${skippedCount}`);
  console.log("Ejemplos:", updatedSamples);

  if (unmatched.length > 0) {
    console.log("\nSin coincidencia en base de datos:");
    unmatched.forEach((entry) => console.log(`- ${entry}`));
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
