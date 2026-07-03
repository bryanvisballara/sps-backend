import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(import.meta.dirname, "../dist");
const indexPath = resolve(distDir, "index.html");
const html = readFileSync(indexPath, "utf8");
const scriptMatch = html.match(/\/assets\/(index-[^"]+\.js)/);
const buildId = scriptMatch?.[1]?.replace(/\.js$/, "") ?? "unknown";
const stampedAt = new Date().toISOString();

const metaTag = `<meta name="sps-build" content="${buildId}@${stampedAt}" />`;
const nextHtml = html.includes('name="sps-build"')
  ? html.replace(/<meta name="sps-build" content="[^"]*" \/>/, metaTag)
  : html.replace("</head>", `    ${metaTag}\n  </head>`);

writeFileSync(indexPath, nextHtml);
console.log(`Stamped build ${buildId} in dist/index.html`);
