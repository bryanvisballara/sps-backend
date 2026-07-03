import mongoose from "mongoose";

import { connectDatabase } from "../src/config/database.js";
import { Store } from "../src/modules/stores/store.model.js";

async function main() {
  await connectDatabase();

  const result = await Store.updateMany(
    {},
    { $set: { defaultPaymentMethod: "efectivo" } },
  );

  console.log(`Clientes actualizados: ${result.modifiedCount} de ${result.matchedCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
