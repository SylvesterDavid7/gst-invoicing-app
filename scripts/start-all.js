import { spawn } from "child_process";

console.log("==================================================");
console.log("   LAUNCHING PRODUCTION SERVICES CONCURRENTLY    ");
console.log("   1. Remix Web Server (Port " + (process.env.PORT || 3000) + ")");
console.log("   2. BullMQ Worker Daemon (Chromium PDF & Tax)  ");
console.log("==================================================");

// Ensure public URL is preserved for application services while remix-serve binds to 0.0.0.0
const publicUrl = process.env.APP_URL || process.env.HOST;
const webEnv = { ...process.env, HOST: "0.0.0.0", APP_URL: publicUrl };

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
