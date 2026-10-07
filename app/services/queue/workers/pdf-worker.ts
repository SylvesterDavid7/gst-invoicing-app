import { Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redisConnection } from "../redis";
import { renderInvoicePdfBuffer } from "../../pdf/pdf-generator";
import { uploadInvoicePdf } from "../../storage/s3-storage";
import { syncDistributionQueue } from "../invoice-queue";

const prisma = new PrismaClient();

export function startPdfWorker() {
  const worker = new Worker(
    "pdf-rendering",
    async (job: Job) => {
      console.log(`[PdfWorker] Rendering PDF for Invoice ID: ${job.data.invoiceId}`);
      const { invoiceId, storeId } = job.data;

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          store: true,
          items: true
        }
      });

      if (!invoice) {
        throw new Error(`Invoice not found for ID: ${invoiceId}`);
      }

      const store = invoice.store;
      const buyerAddress = (invoice.buyerAddress as any)?.billing || {};
      const shippingAddress = (invoice.buyerAddress as any)?.shipping || buyerAddress;

      // Group HSN summary list
      const hsnSummaryMap: Record<string, any> = {};
      for (const it of invoice.items) {
        if (!hsnSummaryMap[it.hsnCode]) {
          hsnSummaryMap[it.hsnCode] = {
            hsnCode: it.hsnCode,
            taxableAmount: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            totalTax: 0
          };
        }
        const s = hsnSummaryMap[it.hsnCode];
        s.taxableAmount += parseFloat(String(it.taxableAmount));
        s.cgstAmount += parseFloat(String(it.cgstAmount));
        s.sgstAmount += parseFloat(String(it.sgstAmount));
        s.igstAmount += parseFloat(String(it.igstAmount));
        s.totalTax += parseFloat(String(it.cgstAmount)) + parseFloat(String(it.sgstAmount)) + parseFloat(String(it.igstAmount));
      }

      const hsnSummaryList = Object.values(hsnSummaryMap).map((entry: any) => ({
        hsnCode: entry.hsnCode,
        taxableAmount: entry.taxableAmount.toFixed(2),
        cgstAmount: entry.cgstAmount.toFixed(2),
        sgstAmount: entry.sgstAmount.toFixed(2),
        igstAmount: entry.igstAmount.toFixed(2),
        totalTax: entry.totalTax.toFixed(2)
      }));

      // Render PDF Buffer via Puppeteer
      const pdfBuffer = await renderInvoicePdfBuffer({
        store: {
          legalName: store.legalName,
          tradeName: store.tradeName,
          gstin: store.gstin,
          stateCode: store.stateCode,
          registeredAddress: store.registeredAddress,
          logoUrl: store.logoUrl,
          signatureUrl: store.signatureUrl,
          termsAndConditions: store.termsAndConditions
        },
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate.toISOString().split("T")[0],
        orderNumber: invoice.orderNumber,
        posStateCode: invoice.posStateCode,
        buyerName: invoice.buyerCompanyName || `${buyerAddress.first_name || ""} ${buyerAddress.last_name || ""}`.trim() || "Customer",
        buyerCompanyName: invoice.buyerCompanyName,
        buyerGstin: invoice.buyerGstin,
        buyerAddress,
        shippingAddress,
        isInterState: invoice.isInterState,
        items: invoice.items.map((it) => ({
          title: it.title,
          sku: it.sku,
          hsnCode: it.hsnCode,
          quantity: it.quantity,
          unitPrice: String(it.unitPrice),
          taxableAmount: String(it.taxableAmount),
          taxRate: String(it.taxRate),
          cgstAmount: String(it.cgstAmount),
          sgstAmount: String(it.sgstAmount),
          igstAmount: String(it.igstAmount),
          totalAmount: String(it.totalAmount)
        })),
        shipping: {
          shippingGross: (
            parseFloat(String(invoice.shippingTaxable)) +
            parseFloat(String(invoice.shippingCgst)) +
            parseFloat(String(invoice.shippingSgst)) +
            parseFloat(String(invoice.shippingIgst))
          ).toFixed(2),
          shippingTaxable: String(invoice.shippingTaxable),
          shippingTaxRate: String(invoice.shippingTaxRate),
          shippingCgst: String(invoice.shippingCgst),
          shippingSgst: String(invoice.shippingSgst),
          shippingIgst: String(invoice.shippingIgst)
        },
        totalTaxable: String(invoice.totalTaxable),
        totalCgst: String(invoice.totalCgst),
        totalSgst: String(invoice.totalSgst),
        totalIgst: String(invoice.totalIgst),
        grandTotal: String(invoice.grandTotal),
        hsnSummaryList
      });

      // Upload PDF to Cloudflare R2 / AWS S3
      const safeInvoiceName = `${invoice.invoiceNumber.replace(/\//g, "-")}.pdf`;
      const uploadResult = await uploadInvoicePdf(safeInvoiceName, pdfBuffer, store.shopifyDomain);

      // Save PDF URL in database
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { pdfUrl: uploadResult.url }
      });

      console.log(`[PdfWorker] Successfully rendered and uploaded PDF: ${uploadResult.url}`);

      // Enqueue Worker 3 for sync & distribution
      await syncDistributionQueue.add("sync-shopify-order", {
        invoiceId: invoice.id,
        storeId: store.id,
        pdfUrl: uploadResult.url
      });

      return { pdfUrl: uploadResult.url };
    },
    { connection: redisConnection, concurrency: 3 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[PdfWorker] Job ${job?.id} failed with error:`, err);
  });

  return worker;
}
