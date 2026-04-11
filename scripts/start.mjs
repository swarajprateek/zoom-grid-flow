/**
 * One command to rule them all:
 *   node scripts/start.mjs
 *
 * 1. Starts cloudflared tunnel → http://localhost:4001
 * 2. Waits for tunnel URL
 * 3. Writes public/runtime-config.json
 * 4. Git commits + pushes config
 * 5. Starts photo server (port 4000)
 * 6. Starts proxy server (port 4001)
 * 7. Stays alive — Ctrl+C stops everything
 */

import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";

const LOG_PATH = path.resolve("tunnel.err.log");
const CONFIG_PATH = path.resolve("public/runtime-config.json");
const MAX_WAIT_MS = 30000;
const POLL_MS = 500;

const procs = [];

const cleanup = () => {
  console.log("\n🛑 Shutting down all processes...");
  procs.forEach((p) => { try { p.kill(); } catch {} });
  process.exit(0);
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

const spawnLogged = (label, cmd, args, env = {}) => {
  const p = spawn(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  p.on("error", (err) => console.error(`❌ [${label}] ${err.message}`));
  p.on("exit", (code) => {
    if (code !== 0 && code !== null) console.warn(`⚠️  [${label}] exited with code ${code}`);
  });
  procs.push(p);
  return p;
};

// ── Step 1: Clear old log and start cloudflared ──────────────────────────────
console.log("🚇 Starting Cloudflare tunnel → http://localhost:4001 ...");
if (fs.existsSync(LOG_PATH)) fs.writeFileSync(LOG_PATH, "");

const logStream = fs.createWriteStream(LOG_PATH, { flags: "a" });
const cf = spawn("cloudflared", ["tunnel", "--url", "http://localhost:4001"], {
  stdio: ["ignore", "ignore", "pipe"],
});
cf.stderr.pipe(logStream);
cf.on("error", (err) => {
  console.error("❌ cloudflared failed to start:", err.message);
  console.error("   Install it from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/");
  process.exit(1);
});
procs.push(cf);

// ── Step 2: Wait for tunnel URL ───────────────────────────────────────────────
console.log("⏳ Waiting for tunnel URL...");
const start = Date.now();

const tunnelUrl = await new Promise((resolve) => {
  const iv = setInterval(() => {
    if (fs.existsSync(LOG_PATH)) {
      const content = fs.readFileSync(LOG_PATH, "utf8");
      const match = content.match(/https:\/\/[-a-z0-9]+\.trycloudflare\.com/);
      if (match) { clearInterval(iv); resolve(match[0]); return; }
    }
    if (Date.now() - start > MAX_WAIT_MS) { clearInterval(iv); resolve(null); }
  }, POLL_MS);
});

if (!tunnelUrl) {
  console.error("❌ Timed out waiting for tunnel URL. Check tunnel.err.log.");
  cleanup();
}

console.log(`✅ Tunnel live: ${tunnelUrl}`);

// ── Step 3: Update runtime-config.json ───────────────────────────────────────
fs.writeFileSync(CONFIG_PATH, `${JSON.stringify({ apiBaseUrl: tunnelUrl }, null, 2)}\n`, "utf8");
console.log("✅ Updated public/runtime-config.json");

// ── Step 4: Git commit + push ─────────────────────────────────────────────────
try {
  execSync("git add public/runtime-config.json", { stdio: "inherit" });
  execSync(`git commit -m "chore: update tunnel URL to ${tunnelUrl}"`, { stdio: "inherit" });
  execSync("git push", { stdio: "inherit" });
  console.log("🚀 Pushed to repo — deployed frontend now pointing to new tunnel!");
} catch {
  console.warn("⚠️  Git push skipped (nothing to commit or no remote configured).");
}

// ── Step 5: Start photo server (port 4000) ────────────────────────────────────
console.log("🗄️  Starting photo server on http://localhost:4000 ...");
spawnLogged("photo-server", "node", ["server/index.js"]);

// Small delay so photo server is ready before proxy starts
await new Promise((r) => setTimeout(r, 1500));

// ── Step 6: Start proxy server (port 4001) ────────────────────────────────────
console.log("🔀 Starting proxy server on http://localhost:4001 ...");
spawnLogged("proxy", "node", ["server/image-proxy.js"]);

console.log("\n🟢 All systems go! Everything is running:");
console.log(`   Tunnel  → ${tunnelUrl}`);
console.log(`   Proxy   → http://localhost:4001`);
console.log(`   Server  → http://localhost:4000`);
console.log("\n   Press Ctrl+C to stop everything.\n");
