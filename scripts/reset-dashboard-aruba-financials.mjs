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

async function main() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const logisticsInvoices = db.collection("logisticsinvoices");
  const carteraEntries = db.collection("carteraentries");

  const invoiceResult = await logisticsInvoices.updateMany(
    {},
    {
      $set: {
        active: false,
        syncExcluded: true,
      },
    },
  );

  const carteraResult = await carteraEntries.updateMany(
    {},
    {
      $set: {
        active: false,
        outstandingAmountAwg: 0,
        collectedAmountAwg: 0,
      },
    },
  );

  console.log(`Logistics invoices reset: ${invoiceResult.modifiedCount} updated (${invoiceResult.matchedCount} matched)`);
  console.log(`Cartera entries reset: ${carteraResult.modifiedCount} updated (${carteraResult.matchedCount} matched)`);
  console.log("Dashboard KPIs Ventas del mes, Cartera pendiente and Utilidad del mes should now show 0.");

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
