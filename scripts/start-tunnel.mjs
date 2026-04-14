/**
 * Starts cloudflared tunnel, waits for URL, syncs to runtime-config.json, and git pushes.
 * Cross-platform (works on Windows).
 *
 * Usage: node scripts/start-tunnel.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";

const logPath = path.resolve("tunnel.err.log");
const configPath = path.resolve("public/runtime-config.json");
const maxWaitMs = 30000;
const pollIntervalMs = 500;

// Clear old log so we don't pick up a stale URL
if (fs.existsSync(logPath)) fs.writeFileSync(logPath, "");

console.log("🚇 Starting Cloudflare tunnel on http://localhost:4001 (protocol: http2)...");

// Start cloudflared with http2 to avoid UDP/QUIC blocks
const logStream = fs.createWriteStream(logPath, { flags: "a" });
const cf = spawn("cloudflared", ["tunnel", "--protocol", "http2", "--url", "http://localhost:4001"], {
  stdio: ["ignore", "pipe", "pipe"],
});
cf.stdout.pipe(logStream);
cf.stderr.pipe(logStream);

cf.on("error", (err) => {
  console.error("❌ Failed to start cloudflared:", err.message);
  console.error("   Make sure cloudflared is installed: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/");
  process.exit(1);
});

// Poll tunnel.err.log for the URL
console.log("⏳ Waiting for tunnel URL...");
const start = Date.now();

const url = await new Promise((resolve) => {
  const interval = setInterval(() => {
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, "utf8");
      const match = content.match(/https:\/\/[-a-z0-9]+\.trycloudflare\.com/);
      if (match) {
        clearInterval(interval);
        resolve(match[0]);
        return;
      }
    }
    if (Date.now() - start > maxWaitMs) {
      clearInterval(interval);
      resolve(null);
    }
  }, pollIntervalMs);
});

if (!url) {
  console.error("❌ Timed out waiting for tunnel URL. Check tunnel.err.log for details.");
  process.exit(1);
}

// Write runtime-config.json
fs.writeFileSync(configPath, `${JSON.stringify({ apiBaseUrl: url }, null, 2)}\n`, "utf8");
console.log(`✅ Tunnel live: ${url}`);
console.log(`✅ Updated public/runtime-config.json`);

// Git commit and push
try {
  execSync("git add public/runtime-config.json", { stdio: "inherit" });
  execSync(`git commit -m "chore: update tunnel URL to ${url}"`, { stdio: "inherit" });
  execSync("git push", { stdio: "inherit" });
  console.log(`🚀 Pushed to repo — deployed frontend will now use the new tunnel URL!`);
} catch (err) {
  console.warn("⚠️  Git push failed (maybe nothing to commit, or no remote set up):", err.message);
}

console.log("\n🟢 Tunnel is running. Press Ctrl+C to stop.\n");

// Keep process alive so cloudflared stays running
process.on("SIGINT", () => {
  console.log("\n🛑 Stopping tunnel...");
  cf.kill();
  process.exit(0);
});
