import { app } from "./app.js";
import { connectDatabase, initializeCollections } from "./config/database.js";
import { env } from "./config/env.js";
import { startInventoryPushMonitor } from "./services/inventory-push-monitor.service.js";
import { isFirebasePushConfigured } from "./services/firebase-admin.service.js";

async function bootstrap() {
  await connectDatabase();
  await initializeCollections();

  if (isFirebasePushConfigured()) {
    startInventoryPushMonitor();
  }

  app.listen(env.PORT, () => {
    console.log(`API listening on port ${env.PORT}`);
  });
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
