import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
var repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export default defineConfig({
    envDir: repoRoot,
    plugins: [react()],
    server: {
        port: 5173,
        strictPort: true,
        proxy: {
            "/api": {
                target: "http://127.0.0.1:4000",
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
