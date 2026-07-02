import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import XLSX from "xlsx";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
dotenv.config({ path: resolve(repoRoot, ".env.local") });

const defaultExcelPath = "/Users/usuario/Downloads/inventario 30 jun 2026 sps aruba.xlsx";
const excelPath = process.argv.find((arg) => !arg.startsWith("-") && arg.endsWith(".xlsx")) ?? defaultExcelPath;
const dryRun = process.argv.includes("--dry-run");

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function readInventoryRows(path) {
  const workbook = XLSX.readFile(path);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  return rawRows
    .slice(4)
    .map((row) => ({
      name: String(row[0] ?? "").trim(),
      quantity: Number(row[1] ?? 0),
    }))
    .filter((row) => row.name && !row.name.toLowerCase().startsWith("jueves,"));
}

function findBestProductMatch(excelName, products) {
  const normalizedExcelName = normalizeText(excelName);
  let bestProduct = null;
  let bestScore = 0;

  for (const product of products) {
    const normalizedProductName = normalizeText(product.name);

    if (normalizedExcelName === normalizedProductName) {
      return { product, exact: true };
    }

    if (normalizedExcelName.includes(normalizedProductName) || normalizedProductName.includes(normalizedExcelName)) {
      const score = Math.min(normalizedExcelName.length, normalizedProductName.length);

      if (score > bestScore) {
        bestScore = score;
        bestProduct = product;
      }
    }
  }

  if (bestProduct && bestScore >= 10) {
    return { product: bestProduct, exact: false };
  }

  return null;
}

function derivePresentation(name) {
  const normalized = normalizeText(name);

  if (normalized.includes(" KG") || normalized.endsWith(" KG") || normalized.includes("KG ")) {
    return "kg";
  }

  if (normalized.includes("CAJA")) {
    return "caja";
  }

  if (normalized.includes("PACK") || normalized.includes("PAQUETE")) {
    return "paquete";
  }

  return "unidad";
}

function inferCategory(name) {
  const normalized = normalizeText(name);
  const refrigeratedKeywords = [
    "ALQUERIA",
    "LECHE",
    "YOGURT",
    "ACTIGEST",
    "AVENA",
    "AREQUIPE",
    "CREMA DE LECHE",
    "CHOCOL",
    "NATILLA",
    "HUEVO",
    "AGUACATE",
    "QUESO",
    "MARGARINA",
    "MANTEQUILLA",
    "PAPA",
    "TOMATE",
    "CEBOLLA",
    "ZANAHORIA",
    "REPOLLO",
    "LECHUGA",
    "APIO",
    "PEREJIL",
    "CILANTRO",
    "ESPINACA",
    "BROCOLI",
    "COLIFLOR",
    "PEPINO",
    "FRESC",
  ];

  if (refrigeratedKeywords.some((keyword) => normalized.includes(keyword))) {
    return "REFRIGERADOS";
  }

  return "SECOS";
}

function buildProductPayload(name, sku) {
  const category = inferCategory(name);
  const presentation = derivePresentation(name);

  return {
    sku,
    name,
    description: "",
    category,
    supplier: "IMPORTADO SPS ARUBA",
    cost: 0,
    arubaPurchaseCostUsd: 0,
    arubaUsdToAwgRate: 1.79,
    variableSalePrice: false,
    salePrice: 0,
    presentation,
    containerType: category === "REFRIGERADOS" ? "refrigerado" : "seco",
    shareWithAruba: true,
    productWeightKg: 0,
    exportVolumeCubicFeet: 0,
    displaysPerBox: 1,
    expirationDate: null,
    unitsPerBox: 0,
    unitsPerBoxUnit: presentation === "kg" ? "kg" : "unidad",
    inventoryAlert: 0,
    boxLengthCm: 0,
    boxWidthCm: 0,
    boxHeightCm: 0,
    active: true,
  };
}

function resolveWarehouseStockStatus(availableUnits, minUnits) {
  if (availableUnits <= 0) {
    return "critical";
  }

  if (availableUnits <= minUnits) {
    return "low";
  }

  return "healthy";
}

async function ensureCategory(name) {
  const categoriesCollection = mongoose.connection.collection("categories");
  const existing = await categoriesCollection.findOne({ name });

  if (existing) {
    return existing;
  }

  const createdAt = new Date();
  const result = await categoriesCollection.insertOne({
    code: `CAT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    description: "",
    active: true,
    createdAt,
    updatedAt: createdAt,
  });

  return { _id: result.insertedId, name };
}

async function ensureSupplier(name) {
  const suppliersCollection = mongoose.connection.collection("suppliers");
  const existing = await suppliersCollection.findOne({ name });

  if (existing) {
    return existing;
  }

  const createdAt = new Date();
  const result = await suppliersCollection.insertOne({
    code: `SUP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

function getNextInvSku(existingSkus, counter) {
  let nextCounter = counter;

  while (true) {
    nextCounter += 1;
    const candidate = `INV${String(nextCounter).padStart(4, "0")}`;

    if (!existingSkus.has(normalizeText(candidate))) {
      existingSkus.add(normalizeText(candidate));
      return { sku: candidate, nextCounter };
    }
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Falta MONGODB_URI en .env.local");
  }

  const inventoryRows = readInventoryRows(excelPath);

  if (inventoryRows.length === 0) {
    throw new Error(`No se encontraron filas de inventario en ${excelPath}`);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const productsCollection = mongoose.connection.collection("products");
  const warehouseStockCollection = mongoose.connection.collection("warehousestocks");
  const warehousesCollection = mongoose.connection.collection("warehouses");

  const products = await productsCollection.find({ active: { $ne: false } }).toArray();
  const existingSkus = new Set(products.map((product) => normalizeText(product.sku)));
  let invCounter = products.reduce((max, product) => {
    const match = String(product.sku).match(/^INV(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  const warehouse = await warehousesCollection.findOne({ active: { $ne: false } }, { sort: { createdAt: 1 } });

  if (!warehouse?.code) {
    throw new Error("No se encontro una bodega activa.");
  }

  const missingByName = new Map();

  for (const row of inventoryRows) {
    const match = findBestProductMatch(row.name, products);

    if (match) {
      continue;
    }

    const normalizedName = normalizeText(row.name);
    const current = missingByName.get(normalizedName);

    if (current) {
      current.quantity += row.quantity;
      current.excelNames.push(row.name);
      continue;
    }

    missingByName.set(normalizedName, {
      name: row.name,
      quantity: row.quantity,
      excelNames: [row.name],
    });
  }

  let createdCount = 0;
  let stockCreatedCount = 0;
  const createdSamples = [];

  for (const entry of missingByName.values()) {
    const { sku, nextCounter } = getNextInvSku(existingSkus, invCounter);
    invCounter = nextCounter;
    const payload = buildProductPayload(entry.name, sku);
    const createdAt = new Date();

    if (!dryRun) {
      await ensureCategory(payload.category);
      await ensureSupplier(payload.supplier);

      const insertResult = await productsCollection.insertOne({
        ...payload,
        createdAt,
        updatedAt: createdAt,
      });

      const productId = insertResult.insertedId;
      products.push({ _id: productId, ...payload });

      const targetQuantity = Math.max(0, Math.round(Number(entry.quantity) || 0));
      await warehouseStockCollection.insertOne({
        productId,
        warehouseCode: warehouse.code,
        expirationDate: null,
        availableUnits: targetQuantity,
        reservedUnits: 0,
        minUnits: 0,
        status: resolveWarehouseStockStatus(targetQuantity, 0),
        createdAt,
        updatedAt: createdAt,
      });
      stockCreatedCount += 1;
    }

    createdCount += 1;

    if (createdSamples.length < 12) {
      createdSamples.push({
        sku,
        name: entry.name,
        category: payload.category,
        quantity: entry.quantity,
      });
    }
  }

  console.log(`Archivo: ${excelPath}`);
  console.log(`Modo: ${dryRun ? "dry-run" : "aplicar"}`);
  console.log(`Filas Excel: ${inventoryRows.length}`);
  console.log(`Productos faltantes detectados: ${missingByName.size}`);
  console.log(`Productos creados: ${createdCount}`);
  console.log(`Filas de stock creadas: ${stockCreatedCount}`);
  console.log("Ejemplos:", createdSamples);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
