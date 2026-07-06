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

async function main() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const orders = db.collection("orders");
  const carteraEntries = db.collection("carteraentries");
  const carteraCollections = db.collection("carteracollections");

  const dispatchedOrders = await orders.find({ status: "dispatched" }).toArray();

  if (dispatchedOrders.length === 0) {
    console.log("No dispatched orders found.");
    await mongoose.disconnect();
    return;
  }

  let cancelledCount = 0;

  for (const order of dispatchedOrders) {
    const orderId = String(order._id);

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

    const relatedEntries = await carteraEntries.find({ orderId }).project({ _id: 1 }).toArray();
    const carteraEntryIds = relatedEntries.map((entry) => entry._id);

    if (carteraEntryIds.length > 0) {
      await carteraEntries.updateMany({ orderId }, { $set: { active: false } });
      await carteraCollections.updateMany(
        {
          active: { $ne: false },
          $or: [
            { relatedOrderId: orderId },
            { carteraEntryId: { $in: carteraEntryIds.map(String) } },
          ],
        },
        { $set: { active: false } },
      );
    }

    cancelledCount += 1;
    console.log(`Cancelled dispatch for order ${orderId} (${order.storeName ?? "unknown store"})`);
  }

  console.log(`Done. ${cancelledCount} dispatched order(s) moved back to submitted.`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
