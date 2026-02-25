import fs from "node:fs";
import path from "node:path";

const value = process.argv[2];

if (!value) {
  console.error("Usage: node scripts/set-runtime-api-url.mjs <api-base-url>");
  process.exit(1);
}

const normalized = value.replace(/\/+$/, "");
const targetPath = path.resolve("public/runtime-config.json");

fs.writeFileSync(
  targetPath,
  `${JSON.stringify({ apiBaseUrl: normalized }, null, 2)}\n`,
  "utf8"
);

console.log(`Updated ${targetPath} to ${normalized}`);
