import dotenv from "dotenv";
dotenv.config();

import { startInvoiceWorker } from "../../app/services/queue/workers/invoice-worker";
import { startPdfWorker } from "../../app/services/queue/workers/pdf-worker";
import { startSyncWorker } from "../../app/services/queue/workers/sync-worker";

console.log("==================================================");
console.log("   SHOPIFY GST INVOICING APP - WORKER DAEMON     ");
console.log("==================================================");

const invoiceWorker = startInvoiceWorker();
const pdfWorker = startPdfWorker();
const syncWorker = startSyncWorker();

console.log("Worker 1: Tax Engine & Sequential Numbering -> RUNNING");
console.log("Worker 2: Puppeteer Chromium PDF Renderer   -> RUNNING");
console.log("Worker 3: Shopify Metafields & Delivery Sync -> RUNNING");

process.on("SIGTERM", async () => {
  console.log("Gracefully shutting down BullMQ workers...");
  await Promise.all([
    invoiceWorker.close(),
    pdfWorker.close(),
    syncWorker.close()
  ]);
  process.exit(0);
});
