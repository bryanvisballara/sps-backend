import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import XLSX from "xlsx";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
dotenv.config({ path: resolve(repoRoot, ".env.local") });

const defaultExcelPath = "/Users/usuario/Downloads/ListaDeServiciosProductos__9341452174121559_02_07_2026 (2).xls";
const excelPath = process.argv.find((arg) => !arg.startsWith("-") && (arg.endsWith(".xls") || arg.endsWith(".xlsx")))
  ?? defaultExcelPath;
const dryRun = process.argv.includes("--dry-run");

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function roundCurrency(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.round(numericValue * 100) / 100;
}

function parseExcelProductName(rawName) {
  const name = String(rawName ?? "").trim();

  if (!name.includes(":")) {
    return name;
  }

  return name.split(":").slice(1).join(":").trim();
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
      rawName: String(row["Nombre de producto/servicio"] ?? "").trim(),
      name: parseExcelProductName(row["Nombre de producto/servicio"]),
      description: String(row["Descripción de ventas"] ?? row["Descripcion de ventas"] ?? "").trim(),
      sku: String(row["Unidad de mantenimiento de existencias (SKU)"] ?? "").trim(),
      salePrice: roundCurrency(row["Precio/Tasa de ventas"] ?? row["Precio/Tasa de venta"] ?? 0),
      type: String(row.Tipo ?? "").trim(),
    }))
    .filter((row) => row.name && row.sku);
}

function findBestProductMatch(excelRow, products) {
  const normalizedExcelName = normalizeText(excelRow.name);
  let bestProduct = null;
  let bestScore = 0;

  for (const product of products) {
    const normalizedProductName = normalizeText(product.name);

    if (normalizedExcelName === normalizedProductName) {
      return { product, matchType: "name-exact" };
    }

    if (normalizedExcelName.includes(normalizedProductName) || normalizedProductName.includes(normalizedExcelName)) {
      const score = Math.min(normalizedExcelName.length, normalizedProductName.length);

      if (score > bestScore) {
        bestScore = score;
        bestProduct = product;
      }
    }
  }

  if (bestProduct && bestScore >= 8) {
    return { product: bestProduct, matchType: "name-fuzzy" };
  }

  return null;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Falta MONGODB_URI en .env.local");
  }

  const excelRows = readExcelRows(excelPath);
  const duplicateSkusInExcel = [...excelRows.reduce((map, row) => {
    map.set(row.sku, (map.get(row.sku) ?? 0) + 1);
    return map;
  }, new Map()).entries()].filter(([, count]) => count > 1).map(([sku]) => sku);

  await mongoose.connect(process.env.MONGODB_URI);

  const Product = mongoose.connection.collection("products");
  const dbProducts = await Product.find({ active: { $ne: false } }).toArray();
  const productsBySku = new Map(dbProducts.map((product) => [normalizeText(product.sku), product]));
  const productsByName = new Map(dbProducts.map((product) => [normalizeText(product.name), product]));

  let updatedCount = 0;
  let unchangedCount = 0;
  const unmatched = [];
  const skuChanges = [];
  const priceChanges = [];
  const descriptionChanges = [];
  const skuConflicts = [];
  const skuChangesSkippedDuplicates = [];
  const duplicateSkuMatches = [];
  const fuzzyMatches = [];

  for (const row of excelRows) {
    const duplicateSku = duplicateSkusInExcel.includes(row.sku);
    let match = duplicateSku
      ? findBestProductMatch(row, dbProducts)
      : productsBySku.get(normalizeText(row.sku))
        ? { product: productsBySku.get(normalizeText(row.sku)), matchType: "sku" }
        : findBestProductMatch(row, dbProducts);

    if (!match && !duplicateSku) {
      match = findBestProductMatch(row, dbProducts);
    }

    if (!match) {
      unmatched.push(`${row.sku} · ${row.name}`);
      continue;
    }

    const { product, matchType } = match;

    if (duplicateSku) {
      duplicateSkuMatches.push(`${row.sku} · ${row.name} -> ${product.name} (${matchType})`);
    }

    if (matchType === "name-fuzzy") {
      fuzzyMatches.push(`${row.sku} · ${row.name} -> ${product.sku} · ${product.name}`);
    }

    const nextDescription = row.description;
    const nextSalePrice = row.salePrice;
    const nextSku = row.sku;
    const currentSku = String(product.sku ?? "").trim();
    const currentDescription = String(product.description ?? "").trim();
    const currentSalePrice = roundCurrency(product.salePrice ?? 0);

    const update = {};
    let hasChanges = false;

    if (nextDescription && nextDescription !== currentDescription) {
      update.description = nextDescription;
      descriptionChanges.push({
        sku: currentSku,
        name: product.name,
        previous: currentDescription || "(vacio)",
        next: nextDescription,
      });
      hasChanges = true;
    }

    if (nextSalePrice > 0 && nextSalePrice !== currentSalePrice) {
      update.salePrice = nextSalePrice;
      update.variableSalePrice = false;
      priceChanges.push({
        sku: currentSku,
        name: product.name,
        previous: currentSalePrice,
        next: nextSalePrice,
      });
      hasChanges = true;
    }

    if (duplicateSku && normalizeText(nextSku) !== normalizeText(currentSku)) {
      skuChangesSkippedDuplicates.push({
        sku: currentSku,
        excelSku: nextSku,
        name: product.name,
      });
    }

    if (normalizeText(nextSku) !== normalizeText(currentSku) && !duplicateSku && matchType !== "name-fuzzy") {
      const conflictingProduct = productsBySku.get(normalizeText(nextSku));

      if (conflictingProduct && String(conflictingProduct._id) !== String(product._id)) {
        skuConflicts.push({
          excelSku: nextSku,
          excelName: row.name,
          currentSku,
          currentName: product.name,
          conflictSku: conflictingProduct.sku,
          conflictName: conflictingProduct.name,
        });
      } else {
        update.sku = nextSku;
        skuChanges.push({
          name: product.name,
          previous: currentSku,
          next: nextSku,
        });
        hasChanges = true;
      }
    }

    if (!hasChanges) {
      unchangedCount += 1;
      continue;
    }

    update.updatedAt = new Date();

    if (!dryRun) {
      await Product.updateOne({ _id: product._id }, { $set: update });

      if (update.sku) {
        productsBySku.delete(normalizeText(currentSku));
        productsBySku.set(normalizeText(nextSku), { ...product, ...update });
        productsByName.set(normalizeText(product.name), { ...product, ...update });
      }
    }

    updatedCount += 1;
  }

  const matchedProductIds = new Set();
  for (const row of excelRows) {
    const duplicateSku = duplicateSkusInExcel.includes(row.sku);
    const match = duplicateSku
      ? findBestProductMatch(row, dbProducts)
      : productsBySku.get(normalizeText(row.sku))
        ? { product: productsBySku.get(normalizeText(row.sku)) }
        : findBestProductMatch(row, dbProducts);

    if (match?.product?._id) {
      matchedProductIds.add(String(match.product._id));
    }
  }

  const dbNotInExcel = dbProducts
    .filter((product) => !matchedProductIds.has(String(product._id)))
    .map((product) => `${product.sku} · ${product.name}`);

  console.log(`Archivo: ${excelPath}`);
  console.log(`Modo: ${dryRun ? "dry-run" : "aplicar"}`);
  console.log(`Filas Excel: ${excelRows.length}`);
  console.log(`Productos actualizados: ${updatedCount}`);
  console.log(`Sin cambio: ${unchangedCount}`);
  console.log(`Sin coincidencia: ${unmatched.length}`);
  console.log(`Cambios de SKU: ${skuChanges.length}`);
  console.log(`Cambios de precio: ${priceChanges.length}`);
  console.log(`Cambios de descripcion: ${descriptionChanges.length}`);
  console.log(`Conflictos de SKU: ${skuConflicts.length}`);
  console.log(`SKUs omitidos por duplicado en Excel: ${skuChangesSkippedDuplicates.length}`);
  console.log(`Productos en BD no encontrados en Excel: ${dbNotInExcel.length}`);

  if (skuChanges.length > 0) {
    console.log("\nCambios de SKU:");
    skuChanges.forEach((entry) => console.log(`- ${entry.name}: ${entry.previous} -> ${entry.next}`));
  }

  if (priceChanges.length > 0) {
    console.log("\nCambios de precio (primeros 25):");
    priceChanges.slice(0, 25).forEach((entry) => console.log(`- ${entry.sku} · ${entry.name}: ${entry.previous} -> ${entry.next}`));

    if (priceChanges.length > 25) {
      console.log(`... y ${priceChanges.length - 25} mas`);
    }
  }

  if (descriptionChanges.length > 0) {
    console.log("\nCambios de descripcion (primeros 15):");
    descriptionChanges.slice(0, 15).forEach((entry) => console.log(`- ${entry.sku} · ${entry.name}: "${entry.previous}" -> "${entry.next}"`));

    if (descriptionChanges.length > 15) {
      console.log(`... y ${descriptionChanges.length - 15} mas`);
    }
  }

  if (skuChangesSkippedDuplicates.length > 0) {
    console.log("\nSKUs no actualizados por duplicado en Excel (solo precio/descripcion):");
    skuChangesSkippedDuplicates.forEach((entry) => console.log(`- ${entry.name}: mantiene ${entry.sku} (Excel trae ${entry.excelSku})`));
  }

  if (duplicateSkusInExcel.length > 0) {
    console.log("\nSKUs duplicados en Excel (se emparejaron por nombre):");
    duplicateSkusInExcel.forEach((sku) => console.log(`- ${sku}`));
  }

  if (duplicateSkuMatches.length > 0) {
    console.log("\nEmparejamientos por nombre por SKU duplicado:");
    duplicateSkuMatches.forEach((entry) => console.log(`- ${entry}`));
  }

  if (fuzzyMatches.length > 0) {
    console.log("\nEmparejamientos aproximados por nombre:");
    fuzzyMatches.forEach((entry) => console.log(`- ${entry}`));
  }

  if (skuConflicts.length > 0) {
    console.log("\nConflictos de SKU (no se aplicaron):");
    skuConflicts.forEach((entry) => console.log(`- Excel ${entry.excelSku} · ${entry.excelName} | actual ${entry.currentSku} · ${entry.currentName} | conflicto con ${entry.conflictSku} · ${entry.conflictName}`));
  }

  if (unmatched.length > 0) {
    console.log("\nFilas del Excel sin coincidencia:");
    unmatched.forEach((entry) => console.log(`- ${entry}`));
  }

  if (dbNotInExcel.length > 0) {
    console.log("\nProductos en BD no encontrados en Excel (primeros 30):");
    dbNotInExcel.slice(0, 30).forEach((entry) => console.log(`- ${entry}`));

    if (dbNotInExcel.length > 30) {
      console.log(`... y ${dbNotInExcel.length - 30} mas`);
    }
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
