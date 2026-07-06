import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
export const app = express();
const allowedLocalOrigins = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedLocalOrigins.test(origin) || env.CORS_ORIGIN.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/api", apiRouter);
//# sourceMappingURL=app.js.map