import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:4001";

export default defineConfig({
  envDir: repoRoot,
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_DEV_PORT || 5173),
    strictPort: true,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
