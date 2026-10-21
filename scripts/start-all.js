import { spawn } from "child_process";
import fs from "fs";
import path from "path";

console.log("==================================================");
console.log("   LAUNCHING PRODUCTION SERVICES CONCURRENTLY    ");
console.log("   1. Remix Web Server (Port " + (process.env.PORT || 3000) + ")");
console.log("   2. BullMQ Worker Daemon (Chromium PDF & Tax)  ");
console.log("==================================================");

// Ensure template.html is in build/server for compiled Remix Vite runtime
const srcTemplate = path.join(process.cwd(), "app", "services", "pdf", "template.html");
const destTemplate = path.join(process.cwd(), "build", "server", "template.html");
try {
  if (fs.existsSync(srcTemplate)) {
    fs.mkdirSync(path.dirname(destTemplate), { recursive: true });
    fs.copyFileSync(srcTemplate, destTemplate);
    console.log("[Asset Check] Verified & synced template.html to build/server");
  }
} catch (e) {
  console.warn("[Asset Check] Could not copy template.html:", e.message);
}

// Ensure public URL is preserved for application services while remix-serve binds to 0.0.0.0
const rawUrl = process.env.APP_URL || (process.env.HOST && process.env.HOST !== "0.0.0.0" ? process.env.HOST : undefined);
const webEnv = { ...process.env, HOST: "0.0.0.0", ...(rawUrl ? { APP_URL: rawUrl } : {}) };

const web = spawn("npx", ["remix-serve", "./build/server/index.js"], {
  stdio: "inherit",
  shell: true,
  env: webEnv
});

const worker = spawn("npx", ["tsx", "src/workers/index.ts"], {
  stdio: "inherit",
  shell: true,
  env: process.env
});

const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down child processes...`);
  web.kill();
  worker.kill();
  process.exit(0);
};

web.on("close", (code) => {
  console.error(`Web server exited with code ${code}`);
  worker.kill();
  process.exit(code || 1);
});

worker.on("close", (code) => {
  console.error(`Worker daemon exited with code ${code}`);
  web.kill();
  process.exit(code || 1);
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
