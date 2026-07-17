import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
dotenv.config({ path: resolve(repoRoot, ".env.local") });

const DEFAULT_TERM = "Pago a la recepción del servicio";
const dryRun = process.argv.includes("--dry-run");

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Falta MONGODB_URI en .env.local");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const Store = mongoose.connection.collection("stores");

  const before = await Store.countDocuments({
    defaultPaymentMethod: { $ne: DEFAULT_TERM },
  });
  const total = await Store.countDocuments({});

  console.log(`Clientes totales: ${total}`);
  console.log(`A actualizar: ${before}`);
  console.log(`Modo: ${dryRun ? "dry-run" : "aplicar"}`);

  if (!dryRun && before > 0) {
    const result = await Store.updateMany(
      {},
      { $set: { defaultPaymentMethod: DEFAULT_TERM, updatedAt: new Date() } },
    );
    console.log(`Actualizados: ${result.modifiedCount}`);
  }

  const sample = await Store.find({}, { projection: { name: 1, defaultPaymentMethod: 1 } }).limit(5).toArray();
  console.log("Muestra:", sample);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
