import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";
const envFilePath = resolve(fileURLToPath(new URL("../../../..", import.meta.url)), ".env.local");
const loadedEnv = config({ path: envFilePath, override: false });
const envSource = {
    ...(loadedEnv.parsed ?? {}),
    ...process.env,
};
const envSchema = z.object({
    MONGODB_URI: z.string().min(1),
    PORT: z.coerce.number().default(4000),
    CORS_ORIGIN: z.string().default("http://localhost:5173,http://127.0.0.1:5173"),
    RENDER_BACKEND_URL: z.string().url(),
    RENDER_DEPLOY_HOOK: z.string().url(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_WHATSAPP_FROM_NUMBER: z.string().optional(),
});
const parsedEnv = envSchema.parse(envSource);
export const env = {
    ...parsedEnv,
    CORS_ORIGIN: parsedEnv.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
};
//# sourceMappingURL=env.js.map