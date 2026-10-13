import { spawn } from "child_process";
import dotenv from "dotenv";
dotenv.config();

console.log("==================================================");
console.log("   LAUNCHING LOCAL DEVELOPMENT SUITE (VITE + BULLMQ)");
console.log("   1. Remix Vite Dev Server (Port " + (process.env.PORT || 3000) + ")");
console.log("   2. BullMQ Worker Daemon (Chromium PDF & Tax Engine)");
console.log("==================================================");

const isWindows = process.platform === "win32";
const npxCmd = isWindows ? "npx.cmd" : "npx";

const web = spawn(npxCmd, ["remix", "vite:dev"], {
  stdio: "inherit",
  shell: true,
  env: process.env
});

const worker = spawn(npxCmd, ["tsx", "src/workers/index.ts"], {
  stdio: "inherit",
  shell: true,
  env: process.env
});

const shutdown = (signal) => {
  console.log(`\nReceived ${signal}, shutting down dev processes...`);
  web.kill();
  worker.kill();
  process.exit(0);
};

web.on("close", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Web server exited with code ${code}`);
  }
  worker.kill();
  process.exit(code || 0);
});

worker.on("close", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Worker daemon exited with code ${code}`);
  }
  web.kill();
  process.exit(code || 0);
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
