import { Queue } from "bullmq";
import { redisConnection } from "./redis.server";

// Define BullMQ Queues
export const invoiceProcessingQueue = new Queue("invoice-processing", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000
    },
    removeOnComplete: 1000,
    removeOnFail: 5000
  }
});

export const pdfRenderingQueue = new Queue("pdf-rendering", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3000
    },
    removeOnComplete: 1000,
    removeOnFail: 5000
  }
});

export const syncDistributionQueue = new Queue("sync-distribution", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000
    },
    removeOnComplete: 1000,
    removeOnFail: 5000
  }
});

export interface OrderPaidWebhookJobData {
  shopifyDomain: string;
  order: any;
}

export interface PdfRenderJobData {
  invoiceId: string;
  storeId: string;
}

export interface SyncDistributionJobData {
  invoiceId: string;
  storeId: string;
  pdfUrl: string;
}

export async function enqueueOrderPaid(shopifyDomain: string, order: any) {
  const jobId = `order-${order.id}-${Date.now()}`;
  return await invoiceProcessingQueue.add(
    "process-order-tax",
    { shopifyDomain, order },
    { jobId }
  );
}

export async function enqueueRefundCreated(shopifyDomain: string, refund: any) {
  const jobId = `refund-${refund.id}-${Date.now()}`;
  return await invoiceProcessingQueue.add(
    "process-refund-credit-note",
    { shopifyDomain, refund },
    { jobId }
  );
}
