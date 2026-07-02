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

function resolveWarehouseStockStatus(availableUnits, minUnits) {
  if (availableUnits <= 0) {
    return "critical";
  }

  if (availableUnits <= minUnits) {
    return "low";
  }

  return "healthy";
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

function pickPrimaryStockRow(stockRows) {
  if (stockRows.length === 0) {
    return null;
  }

  return [...stockRows].sort((left, right) => {
    const leftExpiration = left.expirationDate ? new Date(left.expirationDate).getTime() : Number.MAX_SAFE_INTEGER;
    const rightExpiration = right.expirationDate ? new Date(right.expirationDate).getTime() : Number.MAX_SAFE_INTEGER;

    if (leftExpiration !== rightExpiration) {
      return leftExpiration - rightExpiration;
    }

    return String(left._id).localeCompare(String(right._id));
  })[0];
}

async function main() {
  const inventoryRows = readInventoryRows(excelPath);

  if (inventoryRows.length === 0) {
    throw new Error(`No se encontraron filas de inventario en ${excelPath}`);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const productsCollection = mongoose.connection.collection("products");
  const warehouseStockCollection = mongoose.connection.collection("warehousestocks");
  const warehousesCollection = mongoose.connection.collection("warehouses");

  const products = await productsCollection
    .find({ active: { $ne: false }, shareWithAruba: { $ne: false } })
    .project({ name: 1, sku: 1, inventoryAlert: 1 })
    .toArray();

  const warehouse = await warehousesCollection.findOne({ active: { $ne: false } }, { sort: { createdAt: 1 } });

  if (!warehouse?.code) {
    throw new Error("No se encontro una bodega activa para actualizar inventario.");
  }

  const targetByProductId = new Map();
  const unmatched = [];

  for (const row of inventoryRows) {
    const match = findBestProductMatch(row.name, products);

    if (!match) {
      unmatched.push(row);
      continue;
    }

    const productId = String(match.product._id);
    const currentTarget = targetByProductId.get(productId);

    if (currentTarget) {
      currentTarget.quantity += row.quantity;
      currentTarget.excelNames.push(row.name);
      continue;
    }

    targetByProductId.set(productId, {
      product: match.product,
      quantity: row.quantity,
      exact: match.exact,
      excelNames: [row.name],
    });
  }

  let updatedCount = 0;
  let unchangedCount = 0;
  let createdCount = 0;
  const updateSamples = [];

  for (const [productId, target] of targetByProductId.entries()) {
    const stockRows = await warehouseStockCollection.find({ productId: new mongoose.Types.ObjectId(productId) }).toArray();
    const currentTotal = stockRows.reduce((sum, row) => sum + Number(row.availableUnits ?? 0), 0);
    const targetQuantity = Math.max(0, Math.round(Number(target.quantity) || 0));

    if (currentTotal === targetQuantity && stockRows.length <= 1) {
      unchangedCount += 1;
      continue;
    }

    const primaryRow = pickPrimaryStockRow(stockRows);
    const minUnits = Number(primaryRow?.minUnits ?? target.product.inventoryAlert ?? 0);
    const status = resolveWarehouseStockStatus(targetQuantity, minUnits);

    if (!dryRun) {
      if (primaryRow) {
        await warehouseStockCollection.updateOne(
          { _id: primaryRow._id },
          {
            $set: {
              availableUnits: targetQuantity,
              minUnits,
              status,
              updatedAt: new Date(),
            },
          },
        );

        const secondaryRowIds = stockRows
          .filter((row) => String(row._id) !== String(primaryRow._id) && Number(row.availableUnits ?? 0) > 0)
          .map((row) => row._id);

        if (secondaryRowIds.length > 0) {
          await warehouseStockCollection.updateMany(
            { _id: { $in: secondaryRowIds } },
            {
              $set: {
                availableUnits: 0,
                status: resolveWarehouseStockStatus(0, minUnits),
                updatedAt: new Date(),
              },
            },
          );
        }
      } else {
        await warehouseStockCollection.insertOne({
          productId: new mongoose.Types.ObjectId(productId),
          warehouseCode: warehouse.code,
          expirationDate: null,
          availableUnits: targetQuantity,
          reservedUnits: 0,
          minUnits,
          status,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        createdCount += 1;
      }
    } else if (!primaryRow) {
      createdCount += 1;
    }

    updatedCount += 1;

    if (updateSamples.length < 10) {
      updateSamples.push({
        product: target.product.name,
        excelNames: target.excelNames,
        previous: currentTotal,
        next: targetQuantity,
        exact: target.exact,
      });
    }
  }

  console.log(`Archivo: ${excelPath}`);
  console.log(`Modo: ${dryRun ? "dry-run" : "aplicar"}`);
  console.log(`Bodega: ${warehouse.name} (${warehouse.code})`);
  console.log(`Filas Excel: ${inventoryRows.length}`);
  console.log(`Productos emparejados: ${targetByProductId.size}`);
  console.log(`Productos actualizados: ${updatedCount}`);
  console.log(`Filas de stock creadas: ${createdCount}`);
  console.log(`Sin cambio: ${unchangedCount}`);
  console.log(`Sin coincidencia: ${unmatched.length}`);
  console.log("Ejemplos:", updateSamples);

  if (unmatched.length > 0) {
    console.log("\nSin coincidencia en base de datos:");
    unmatched.slice(0, 40).forEach((row) => console.log(`- ${row.name} (${row.quantity})`));

    if (unmatched.length > 40) {
      console.log(`... y ${unmatched.length - 40} mas`);
    }
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
