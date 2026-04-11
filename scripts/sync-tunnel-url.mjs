import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

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

console.log(`✅ Updated ${targetPath} to ${latest}`);

// Git commit and push
try {
  execSync("git add public/runtime-config.json", { stdio: "inherit" });
  execSync(`git commit -m "chore: update tunnel URL to ${latest}"`, { stdio: "inherit" });
  execSync("git push", { stdio: "inherit" });
  console.log(`🚀 Pushed runtime-config.json to repo — frontend will pick up new tunnel URL.`);
} catch (err) {
  console.warn("⚠️  Git push failed (maybe nothing to commit, or no remote set up):", err.message);
}
