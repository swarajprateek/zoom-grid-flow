/**
 * Waits for cloudflared to write a trycloudflare.com URL to tunnel.err.log
 * before sync-tunnel-url.mjs runs.
 */
import fs from "node:fs";
import path from "node:path";

const logPath = path.resolve("tunnel.err.log");
const maxWaitMs = 30000;
const pollIntervalMs = 500;

console.log("⏳ Waiting for Cloudflare tunnel URL...");

const start = Date.now();

const found = await new Promise((resolve) => {
  const interval = setInterval(() => {
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, "utf8");
      if (/https:\/\/[-a-z0-9]+\.trycloudflare\.com/.test(content)) {
        clearInterval(interval);
        resolve(true);
        return;
      }
    }
    if (Date.now() - start > maxWaitMs) {
      clearInterval(interval);
      resolve(false);
    }
  }, pollIntervalMs);
});

if (!found) {
  console.error("❌ Timed out waiting for tunnel URL in tunnel.err.log");
  process.exit(1);
}

console.log("✅ Tunnel URL detected!");
