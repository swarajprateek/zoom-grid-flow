import fs from "node:fs";
import path from "node:path";

const logPath = path.resolve("tunnel.err.log");

if (!fs.existsSync(logPath)) {
  console.error(`Missing ${logPath}. Start cloudflared first.`);
  process.exit(1);
}

const content = fs.readFileSync(logPath, "utf8");
const matches = [...content.matchAll(/https:\/\/[-a-z0-9]+\.trycloudflare\.com/g)];
const latest = matches.at(-1)?.[0];

if (!latest) {
  console.error("No trycloudflare URL found in tunnel.err.log");
  process.exit(1);
}

const targetPath = path.resolve("public/runtime-config.json");
fs.writeFileSync(
  targetPath,
  `${JSON.stringify({ apiBaseUrl: latest }, null, 2)}\n`,
  "utf8"
);

console.log(`Updated ${targetPath} to ${latest}`);
