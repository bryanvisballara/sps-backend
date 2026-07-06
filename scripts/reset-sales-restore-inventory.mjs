import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
dotenv.config({ path: resolve(repoRoot, ".env.local") });

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("MONGODB_URI is not configured in .env.local");
  process.exit(1);
}

function stripDispatchPricingFromOrderItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    ...(item.stockCurrent !== undefined ? { stockCurrent: item.stockCurrent } : {}),
    ...(typeof item.notes === "string" && item.notes.trim() ? { notes: item.notes.trim() } : {}),
  }));
}

async function restoreUnitsToWarehouseStock(warehouseStocks, productId, quantityToRestore) {
  if (quantityToRestore <= 0) {
    return;
  }

  const stockRows = await warehouseStocks
    .find({ productId })
    .sort({ expirationDate: 1, availableUnits: -1 })
    .toArray();

  if (stockRows.length === 0) {
    return;
  }

  const targetRow = stockRows[0];
  const nextAvailable = Number(targetRow.availableUnits ?? 0) + quantityToRestore;
  const minUnits = Number(targetRow.minUnits ?? 0);

  await warehouseStocks.updateOne(
    { _id: targetRow._id },
    {
      $set: {
        availableUnits: nextAvailable,
        status: nextAvailable <= 0 ? "out-of-stock" : nextAvailable <= minUnits ? "low-stock" : "available",
      },
    },
  );
}

async function main() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const inventoryAdjustments = db.collection("inventoryadjustments");
  const warehouseStocks = db.collection("warehousestocks");
  const logisticsInvoices = db.collection("logisticsinvoices");
  const carteraEntries = db.collection("carteraentries");
  const carteraCollections = db.collection("carteracollections");
  const orders = db.collection("orders");

  const outboundAdjustments = await inventoryAdjustments
    .find({ source: { $ne: "inventory-entry" } })
    .toArray();

  const restoreByProduct = new Map();

  for (const adjustment of outboundAdjustments) {
    const productId = String(adjustment.productId ?? "");
    const quantity = Number(adjustment.quantity ?? 0);

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    restoreByProduct.set(productId, (restoreByProduct.get(productId) ?? 0) + quantity);
  }

  let restoredUnits = 0;

  for (const [productId, quantity] of restoreByProduct.entries()) {
    await restoreUnitsToWarehouseStock(warehouseStocks, adjustmentProductObjectId(productId), quantity);
    restoredUnits += quantity;
    console.log(`Restored ${quantity} unit(s) to inventory for product ${productId}`);
  }

  const deletedAdjustments = await inventoryAdjustments.deleteMany({ source: { $ne: "inventory-entry" } });

  const deliveredOrders = await orders.find({ status: "delivered" }).toArray();
  let revertedDeliveredOrders = 0;

  for (const order of deliveredOrders) {
    await orders.updateOne(
      { _id: order._id },
      {
        $set: {
          status: "submitted",
          items: stripDispatchPricingFromOrderItems(order.items),
        },
        $unset: { invoiceNumber: "" },
      },
    );
    revertedDeliveredOrders += 1;
  }

  const dispatchedOrders = await orders.find({ status: "dispatched" }).toArray();
  let revertedDispatchedOrders = 0;

  for (const order of dispatchedOrders) {
    await orders.updateOne(
      { _id: order._id },
      {
        $set: {
          status: "submitted",
          items: stripDispatchPricingFromOrderItems(order.items),
        },
        $unset: { invoiceNumber: "" },
      },
    );
    revertedDispatchedOrders += 1;
  }

  const invoiceResult = await logisticsInvoices.updateMany(
    {},
    { $set: { active: false, syncExcluded: true } },
  );

  const carteraResult = await carteraEntries.updateMany(
    {},
    { $set: { active: false, outstandingAmountAwg: 0, collectedAmountAwg: 0 } },
  );

  const collectionsResult = await carteraCollections.updateMany(
    { active: { $ne: false } },
    { $set: { active: false } },
  );

  console.log(`Outbound inventory adjustments removed: ${deletedAdjustments.deletedCount}`);
  console.log(`Units restored to warehouse stock: ${restoredUnits}`);
  console.log(`Delivered orders reverted to submitted: ${revertedDeliveredOrders}`);
  console.log(`Dispatched orders reverted to submitted: ${revertedDispatchedOrders}`);
  console.log(`Logistics invoices reset: ${invoiceResult.modifiedCount}`);
  console.log(`Cartera entries reset: ${carteraResult.modifiedCount}`);
  console.log(`Cartera collections reset: ${collectionsResult.modifiedCount}`);
  console.log("Sales and financial metrics should now read 0; inventory quantities were restored.");

  await mongoose.disconnect();
}

function adjustmentProductObjectId(productId) {
  try {
    return new mongoose.Types.ObjectId(productId);
  } catch {
    return productId;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
