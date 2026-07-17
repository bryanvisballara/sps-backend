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

const COL_CATEGORIES = ["SECOS", "REFRIGERADOS"];

function extractArubaCategory(quickbooksName) {
  const raw = String(quickbooksName ?? "").trim();
  if (!raw.includes(":")) {
    return "";
  }
  return raw.split(":")[0].trim();
}

function readExcelCategoryBySku(path) {
  if (!existsSync(path)) {
    return new Map();
  }

  const workbook = XLSX.read(readFileSync(path));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const bySku = new Map();

  for (const row of rows) {
    const sku = String(row["Unidad de mantenimiento de existencias (SKU)"] ?? "").trim().toUpperCase();
    const qbName = String(row["Nombre de producto/servicio"] ?? "").trim();
    const arubaCategory = extractArubaCategory(qbName);
    if (sku && arubaCategory) {
      bySku.set(sku, { arubaCategory, quickbooksName: qbName });
    }
  }

  return bySku;
}

async function ensureCategory(collection, name, market) {
  const existing = await collection.findOne({
    name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    market,
  });

  if (existing) {
    await collection.updateOne(
      { _id: existing._id },
      { $set: { name, market, active: true, updatedAt: new Date() } },
    );
    return existing._id;
  }

  // Also reclaim same-name category without market / wrong market
  const sameName = await collection.findOne({
    name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
  });

  if (sameName && market === "colombia") {
    await collection.updateOne(
      { _id: sameName._id },
      { $set: { name, market: "colombia", active: true, updatedAt: new Date() } },
    );
    return sameName._id;
  }

  if (sameName && market === "aruba" && !COL_CATEGORIES.includes(String(sameName.name).toUpperCase())) {
    await collection.updateOne(
      { _id: sameName._id },
      { $set: { name, market: "aruba", active: true, updatedAt: new Date() } },
    );
    return sameName._id;
  }

  const now = new Date();
  const result = await collection.insertOne({
    code: `CAT-${market.slice(0, 3).toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name,
    description: market === "aruba" ? "Categoria QuickBooks Aruba" : "Categoria operaciones Colombia / exportacion",
    market,
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  return result.insertedId;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Falta MONGODB_URI en .env.local");
  }

  const excelBySku = readExcelCategoryBySku(excelPath);
  await mongoose.connect(process.env.MONGODB_URI);

  const Category = mongoose.connection.collection("categories");
  const Product = mongoose.connection.collection("products");

  for (const name of COL_CATEGORIES) {
    if (!dryRun) {
      await ensureCategory(Category, name, "colombia");
    }
  }

  const arubaNames = new Set();
  for (const row of excelBySku.values()) {
    arubaNames.add(row.arubaCategory);
  }

  const products = await Product.find({}).project({
    sku: 1,
    name: 1,
    category: 1,
    arubaCategory: 1,
    quickbooksName: 1,
    containerType: 1,
  }).toArray();

  for (const product of products) {
    const fromQb = extractArubaCategory(product.quickbooksName);
    const fromExcel = excelBySku.get(String(product.sku ?? "").trim().toUpperCase());
    const arubaCategory = fromQb || fromExcel?.arubaCategory || "";
    if (arubaCategory) {
      arubaNames.add(arubaCategory);
    }
  }

  console.log(`Excel path: ${excelPath}`);
  console.log(`Modo: ${dryRun ? "dry-run" : "aplicar"}`);
  console.log(`Categorias Aruba a asegurar: ${arubaNames.size}`);

  if (!dryRun) {
    for (const name of [...arubaNames].sort()) {
      await ensureCategory(Category, name, "aruba");
    }
  }

  let productUpdated = 0;
  let colCategoryFixed = 0;

  for (const product of products) {
    const fromQb = extractArubaCategory(product.quickbooksName);
    const fromExcel = excelBySku.get(String(product.sku ?? "").trim().toUpperCase());
    const nextArubaCategory = fromQb || fromExcel?.arubaCategory || String(product.arubaCategory ?? "").trim();
    const nextQuickbooksName = String(product.quickbooksName ?? "").trim() || fromExcel?.quickbooksName || "";

    let nextColCategory = String(product.category ?? "").trim().toUpperCase();
    if (nextColCategory !== "SECOS" && nextColCategory !== "REFRIGERADOS") {
      nextColCategory = product.containerType === "refrigerado" ? "REFRIGERADOS" : "SECOS";
      colCategoryFixed += 1;
    } else if (nextColCategory === "SECOS" || nextColCategory === "REFRIGERADOS") {
      // keep canonical casing
      nextColCategory = nextColCategory === "REFRIGERADOS" ? "REFRIGERADOS" : "SECOS";
    }

    const update = {};
    if (nextArubaCategory && nextArubaCategory !== String(product.arubaCategory ?? "").trim()) {
      update.arubaCategory = nextArubaCategory;
    }
    if (nextQuickbooksName && nextQuickbooksName !== String(product.quickbooksName ?? "").trim()) {
      update.quickbooksName = nextQuickbooksName;
    }
    if (nextColCategory !== String(product.category ?? "").trim()) {
      update.category = nextColCategory;
    }

    if (Object.keys(update).length === 0) {
      continue;
    }

    update.updatedAt = new Date();
    productUpdated += 1;

    if (productUpdated <= 8) {
      console.log(`- ${product.sku}: COL ${product.category} -> ${update.category ?? product.category}; Aruba ${product.arubaCategory || "(vacio)"} -> ${update.arubaCategory ?? product.arubaCategory}; QB name set=${Boolean(update.quickbooksName)}`);
    }

    if (!dryRun) {
      await Product.updateOne({ _id: product._id }, { $set: update });
    }
  }

  // Mark remaining non-COL categories without market as aruba if they look like QB groups
  if (!dryRun) {
    await Category.updateMany(
      {
        market: { $exists: false },
        name: { $nin: COL_CATEGORIES },
      },
      { $set: { market: "aruba", updatedAt: new Date() } },
    );
    await Category.updateMany(
      {
        market: { $exists: false },
        name: { $in: COL_CATEGORIES },
      },
      { $set: { market: "colombia", updatedAt: new Date() } },
    );
  }

  console.log(`Productos actualizados: ${productUpdated}`);
  console.log(`Categorias COL corregidas (aprox): ${colCategoryFixed}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
