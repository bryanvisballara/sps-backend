import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
dotenv.config({ path: resolve(repoRoot, ".env.local") });

const DRY_CATEGORY = "SECOS";
const COLD_CATEGORY = "REFRIGERADOS";
const DEFAULT_EXPORT_VOLUME_CU_FT = 1.8;
const SUPPLIER_NAME = "FRUTAS COLOMBIA SPS";

const refrigeratedProducts = [
  { sku: "RF001", name: "PAMPUNA", description: "KG", salePrice: 3, presentation: "kg", unitsPerBox: 1, unitsPerBoxUnit: "kg" },
  { sku: "RF002", name: "BOROJO", description: "KG", salePrice: 8, presentation: "kg", unitsPerBox: 1, unitsPerBoxUnit: "kg" },
  { sku: "RF003", name: "CEBOLLA BLANCA", description: "19 KG", salePrice: 70, presentation: "kg", unitsPerBox: 19, unitsPerBoxUnit: "kg" },
  { sku: "RF004", name: "CEBOLLA ROJA", description: "19 KG", salePrice: 80, presentation: "kg", unitsPerBox: 19, unitsPerBoxUnit: "kg" },
  { sku: "RF005", name: "LIMON", description: "19 KG", salePrice: 80, presentation: "kg", unitsPerBox: 19, unitsPerBoxUnit: "kg" },
  { sku: "RF006", name: "LULO", description: "17 KG", salePrice: 130, presentation: "kg", unitsPerBox: 17, unitsPerBoxUnit: "kg" },
  { sku: "RF007", name: "PATILLA", description: "UND 8-9 KG", salePrice: 17, presentation: "unidad", unitsPerBox: 1, unitsPerBoxUnit: "unidad" },
  { sku: "RF008", name: "PAPAYA", description: "CAJA 16 KG", salePrice: 60, presentation: "caja", unitsPerBox: 16, unitsPerBoxUnit: "kg" },
  { sku: "RF009", name: "PEPINO", description: "19 KG", salePrice: 55, presentation: "kg", unitsPerBox: 19, unitsPerBoxUnit: "kg" },
  { sku: "RF010", name: "PIMENTON ROJO", description: "10 KG", salePrice: 75, presentation: "kg", unitsPerBox: 10, unitsPerBoxUnit: "kg" },
  { sku: "RF011", name: "PIMENTON VERDE", description: "10 KG", salePrice: 60, presentation: "kg", unitsPerBox: 10, unitsPerBoxUnit: "kg" },
  { sku: "RF012", name: "PIÑA", description: "13 KG - 8 CT", salePrice: 45, presentation: "kg", unitsPerBox: 8, unitsPerBoxUnit: "unidad" },
  { sku: "RF013", name: "PLATANO VENEZUELA", description: "18 KG", salePrice: 50, presentation: "kg", unitsPerBox: 18, unitsPerBoxUnit: "kg" },
  { sku: "RF014", name: "TOMATE", description: "19 KG", salePrice: 95, presentation: "kg", unitsPerBox: 19, unitsPerBoxUnit: "kg" },
  { sku: "RF015", name: "TOMATE ARBOL", description: "19 KG", salePrice: 90, presentation: "kg", unitsPerBox: 19, unitsPerBoxUnit: "kg" },
];

async function ensureCategory(collection, name) {
  const existing = await collection.findOne({
    name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
  });

  if (existing) {
    await collection.updateOne({ _id: existing._id }, { $set: { name, active: true } });
    return existing._id;
  }

  const now = new Date();
  const result = await collection.insertOne({
    code: `CAT-${name}-${Date.now()}`,
    name,
    description: "",
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  return result.insertedId;
}

async function ensureSupplier(collection, name) {
  const existing = await collection.findOne({
    name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
  });

  if (existing) {
    return existing;
  }

  const now = new Date();
  const result = await collection.insertOne({
    code: `SUP-${Date.now()}`,
    name,
    contactName: "",
    email: "",
    phone: "",
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  return { _id: result.insertedId, name };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Falta MONGODB_URI en .env.local");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const Category = mongoose.connection.collection("categories");
  const Supplier = mongoose.connection.collection("suppliers");
  const Product = mongoose.connection.collection("products");

  await ensureCategory(Category, DRY_CATEGORY);
  await ensureCategory(Category, COLD_CATEGORY);
  await ensureSupplier(Supplier, SUPPLIER_NAME);

  const reassigned = await Product.updateMany(
    { active: { $ne: false } },
    { $set: { category: DRY_CATEGORY } },
  );

  const deletedCategories = await Category.deleteMany({
    name: { $not: { $regex: /^(SECOS|REFRIGERADOS)$/i } },
  });

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of refrigeratedProducts) {
    const payload = {
      sku: item.sku,
      name: item.name,
      description: item.description,
      category: COLD_CATEGORY,
      supplier: SUPPLIER_NAME,
      cost: 0,
      arubaPurchaseCostUsd: 0,
      arubaUsdToAwgRate: 1.79,
      variableSalePrice: false,
      salePrice: item.salePrice,
      presentation: item.presentation,
      containerType: "refrigerado",
      shareWithAruba: true,
      productWeightKg: 0,
      exportVolumeCubicFeet: DEFAULT_EXPORT_VOLUME_CU_FT,
      displaysPerBox: 1,
      unitsPerBox: item.unitsPerBox,
      unitsPerBoxUnit: item.unitsPerBoxUnit,
      inventoryAlert: 0,
      boxLengthCm: 0,
      boxWidthCm: 0,
      boxHeightCm: 0,
      active: true,
      updatedAt: new Date(),
    };

    const existing = await Product.findOne({ sku: item.sku });

    if (existing) {
      await Product.updateOne({ _id: existing._id }, { $set: payload });
      updatedCount += 1;
      continue;
    }

    await Product.insertOne({
      ...payload,
      createdAt: new Date(),
    });
    createdCount += 1;
  }

  const finalCategories = await Category.find({ active: { $ne: false } }).project({ name: 1 }).toArray();
  const categoryCounts = await Product.aggregate([
    { $match: { active: { $ne: false } } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();

  console.log("Categorias activas:", finalCategories.map((entry) => entry.name).join(", "));
  console.log("Productos reasignados a SECOS:", reassigned.modifiedCount);
  console.log("Categorias eliminadas:", deletedCategories.deletedCount);
  console.log("Refrigerados creados:", createdCount);
  console.log("Refrigerados actualizados:", updatedCount);
  console.log("Conteo por categoria:", categoryCounts);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
