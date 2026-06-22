import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const projectId = process.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? "sps-push-3c894";
const messagingSenderId = process.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "444142009095";
const apiKey = process.env.VITE_FIREBASE_API_KEY?.trim() ?? "";
const appId = process.env.VITE_FIREBASE_APP_ID?.trim() ?? "";

const config = {
  apiKey,
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: `${projectId}.firebasestorage.app`,
  messagingSenderId,
  appId,
};

const outputPath = resolve(import.meta.dirname, "../public/firebase-config.js");
const contents = `self.__FIREBASE_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`;

writeFileSync(outputPath, contents, "utf8");
console.log(`Wrote ${outputPath}`);
