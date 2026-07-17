import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const webRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = resolve(webRoot, "../..");

dotenv.config({ path: resolve(repoRoot, ".env.local") });
dotenv.config({ path: resolve(repoRoot, ".env") });

const projectId = (
  process.env.VITE_FIREBASE_PROJECT_ID
  ?? process.env.FIREBASE_PROJECT_ID
  ?? "sps-push-3c894"
).trim();

const messagingSenderId = (
  process.env.VITE_FIREBASE_MESSAGING_SENDER_ID
  ?? process.env.FIREBASE_MESSAGING_SENDER_ID
  ?? "444142009095"
).trim();

const apiKey = (
  process.env.VITE_FIREBASE_API_KEY
  ?? process.env.FIREBASE_WEB_API_KEY
  ?? ""
).trim();

const appId = (
  process.env.VITE_FIREBASE_APP_ID
  ?? process.env.FIREBASE_WEB_APP_ID
  ?? ""
).trim();

const config = {
  apiKey,
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: `${projectId}.firebasestorage.app`,
  messagingSenderId,
  appId,
};

const outputPath = resolve(webRoot, "public/firebase-config.js");
const contents = `self.__FIREBASE_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`;

writeFileSync(outputPath, contents, "utf8");

if (!apiKey || !appId) {
  console.warn(`Wrote ${outputPath} with incomplete Firebase web config (apiKey/appId missing). Push SW will not initialize until env vars are set.`);
} else {
  console.log(`Wrote ${outputPath}`);
}
