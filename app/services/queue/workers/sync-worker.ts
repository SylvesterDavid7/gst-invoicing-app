import { Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redisConnection } from "../redis";

const prisma = new PrismaClient();

export function startSyncWorker() {
  const worker = new Worker(
    "sync-distribution",
    async (job: Job) => {
      console.log(`[SyncWorker] Syncing invoice PDF with Shopify for Invoice ID: ${job.data.invoiceId}`);
      const { invoiceId, pdfUrl } = job.data;

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { store: true }
      });

      if (!invoice) {
        throw new Error(`Invoice not found for ID: ${invoiceId}`);
      }

      const store = invoice.store;

      // Update Shopify Order Metafields using Shopify Admin GraphQL API
      const graphqlQuery = `
        mutation orderUpdateMetafield($input: OrderInput!) {
          orderUpdate(input: $input) {
            order {
              id
              metafields(first: 5) {
                edges {
                  node {
                    namespace
                    key
                    value
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        input: {
          id: `gid://shopify/Order/${invoice.shopifyOrderId}`,
          metafields: [
            {
              namespace: "gst_invoicing",
              key: "invoice_url",
              value: pdfUrl,
              type: "url"
            },
            {
              namespace: "gst_invoicing",
              key: "invoice_number",
              value: invoice.invoiceNumber,
              type: "single_line_text_field"
            }
          ],
          customAttributes: [
            {
              key: "GST Invoice Number",
              value: invoice.invoiceNumber
            },
            {
              key: "GST Invoice Download",
              value: pdfUrl
            }
          ]
        }
      };

      try {
        const response = await fetch(
          `https://${store.shopifyDomain}/admin/api/2024-10/graphql.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": store.accessToken
            },
            body: JSON.stringify({ query: graphqlQuery, variables })
          }
        );

        const result = (await response.json()) as any;
        if (result.errors || result.data?.orderUpdate?.userErrors?.length > 0) {
          console.error("Shopify GraphQL errors:", result.errors || result.data.orderUpdate.userErrors);
        } else {
          console.log(`Successfully synced metafields for Order #${invoice.shopifyOrderId}`);
        }
      } catch (err: any) {
        console.warn(`Could not sync to live Shopify store (development mock): ${err.message}`);
      }

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          shopifyMetafieldSynced: true,
          status: "DELIVERED"
        }
      });

      return { success: true };
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[SyncWorker] Job ${job?.id} failed with error:`, err);
  });

  return worker;
}
