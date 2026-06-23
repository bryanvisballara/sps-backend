import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

import { connectDatabase } from "../src/config/database.js";
import { Category } from "../src/modules/categories/category.model.js";
import { Product } from "../src/modules/catalog/product.model.js";
import { Supplier } from "../src/modules/suppliers/supplier.model.js";

type ParsedProduct = {
  sku: string;
  name: string;
  description: string;
  salePrice: number;
  presentation: "kg" | "lb" | "unidad" | "paquete" | "caja";
  unitsPerPackage: number;
};

const CATEGORY_NAME = "SECO";
const SUPPLIER_NAME = "IMPORTADO SPS ARUBA";

function buildInternalCode(prefix: string, index: number) {
  return `${prefix}-${Date.now()}-${index}`;
}

async function ensureCategory(name: string) {
  const existing = await Category.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).lean();
  if (existing) {
    return existing;
  }

  return Category.create({
    code: buildInternalCode("CAT", 0),
    name,
    description: "Categoria creada automaticamente para productos SECO.",
    active: true,
  });
}

async function ensureSupplier(name: string) {
  const existing = await Supplier.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).lean();
  if (existing) {
    return existing;
  }

  return Supplier.create({
    code: buildInternalCode("SUP", 0),
    name,
    contactName: "",
    email: "",
    phoneCountryCode: "+297",
    phone: "",
    active: true,
  });
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const parsedProducts = JSON.parse(
    readFileSync(resolve(scriptDir, "seco-products-parsed.json"), "utf8"),
  ) as ParsedProduct[];

  await connectDatabase();
  await ensureCategory(CATEGORY_NAME);
  await ensureSupplier(SUPPLIER_NAME);

  const existingProducts = await Product.find({}).select({ sku: 1 }).lean();
  const existingSkus = new Set(existingProducts.map((product) => product.sku.toUpperCase()));

  let createdCount = 0;
  let skippedCount = 0;

  for (const [index, item] of parsedProducts.entries()) {
    if (existingSkus.has(item.sku.toUpperCase())) {
      skippedCount += 1;
      continue;
    }

    await Product.create({
      sku: item.sku,
      name: item.name,
      description: item.description,
      category: CATEGORY_NAME,
      supplier: SUPPLIER_NAME,
      salePrice: item.salePrice,
      variableSalePrice: false,
      cost: 0,
      arubaPurchaseCostUsd: 0,
      arubaUsdToAwgRate: 1.79,
      presentation: item.presentation,
      containerType: "seco",
      shareWithAruba: true,
      productWeightKg: 0,
      unitsPerBox: item.presentation === "paquete" ? item.unitsPerPackage : 0,
      unitsPerBoxUnit: "unidad",
      inventoryAlert: 0,
      boxLengthCm: 0,
      boxWidthCm: 0,
      boxHeightCm: 0,
      active: true,
    });

    existingSkus.add(item.sku.toUpperCase());
    createdCount += 1;

    if ((index + 1) % 25 === 0) {
      console.log(`Progreso: ${index + 1}/${parsedProducts.length}`);
    }
  }

  console.log(`Productos SECO creados: ${createdCount}`);
  console.log(`Omitidos (SKU ya existia): ${skippedCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
