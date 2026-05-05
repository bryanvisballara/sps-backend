import { app } from "./app.js";
import { connectDatabase, initializeCollections } from "./config/database.js";
import { env } from "./config/env.js";
async function bootstrap() {
    await connectDatabase();
    await initializeCollections();
    app.listen(env.PORT, () => {
        console.log(`API listening on port ${env.PORT}`);
    });
}
bootstrap().catch((error) => {
    console.error("Failed to start API", error);
    process.exit(1);
});
//# sourceMappingURL=server.js.map