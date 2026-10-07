import { spawn } from "child_process";

console.log("==================================================");
console.log("   LAUNCHING PRODUCTION SERVICES CONCURRENTLY    ");
console.log("   1. Remix Web Server (Port " + (process.env.PORT || 3000) + ")");
console.log("   2. BullMQ Worker Daemon (Chromium PDF & Tax)  ");
console.log("==================================================");

const web = spawn("npx", ["remix-serve", "./build/server/index.js"], {
  stdio: "inherit",
  shell: true,
  env: process.env
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
