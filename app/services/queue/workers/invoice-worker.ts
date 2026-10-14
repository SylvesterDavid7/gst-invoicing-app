import { Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redisConnection } from "../redis";
import { calculateGstOrder } from "../../tax-engine/gst-calculator";
import { normalizeStateCode } from "../../tax-engine/state-codes";
import { validateGstin } from "../../tax-engine/gstin-validator";
import { getNextInvoiceNumber, getNextCreditNoteNumber } from "../../sequence-engine/sequence-generator";
import { pdfRenderingQueue } from "../invoice-queue";
import { incrementStoreOrderUsage } from "../../billing/billing-plans.server";
import { ensureStoreExists } from "../../store/store.server";

const prisma = new PrismaClient();

export function startInvoiceWorker() {
  const worker = new Worker(
    "invoice-processing",
    async (job: Job) => {
      console.log(`[InvoiceWorker] Processing job ${job.name} (ID: ${job.id})`);

      if (job.name === "process-order-tax") {
        const { shopifyDomain, order } = job.data;
        const store = await ensureStoreExists(shopifyDomain);

        // Check if invoice already exists for this order (idempotency check)
        const existingInvoice = await prisma.invoice.findUnique({
          where: { shopifyOrderId: String(order.id) }
        });

        if (existingInvoice) {
          console.log(`Invoice already exists for Shopify Order #${order.id} (${existingInvoice.invoiceNumber})`);
          return { invoiceId: existingInvoice.id, invoiceNumber: existingInvoice.invoiceNumber };
        }

        // 1. Extract Buyer GSTIN & Company from note_attributes / custom_attributes
        let buyerGstin: string | null = null;
        let buyerCompanyName: string | null = null;

        const customAttributes = order.note_attributes || order.custom_attributes || [];
        for (const attr of customAttributes) {
          const name = (attr.name || "").toLowerCase().trim();
          if (name === "gstin" || name === "gst_number" || name === "business_gstin") {
            const validation = validateGstin(attr.value);
            if (validation.isValid) {
              buyerGstin = validation.gstin;
            }
          }
          if (name === "company_name" || name === "business_name" || name === "buyer_company") {
            buyerCompanyName = attr.value;
          }
        }

        // 2. Determine Destination State (Place of Supply)
        const shippingAddress = order.shipping_address || order.billing_address || {};
        const destinationProvince = shippingAddress.province_code || shippingAddress.province;
        let posStateCode = normalizeStateCode(destinationProvince);

        // Fallback: If buyer provided GSTIN, state code is determined by first 2 digits of GSTIN
        if (buyerGstin) {
          posStateCode = buyerGstin.substring(0, 2);
        }

        if (!posStateCode) {
          // If no state provided, default to merchant origin state
          posStateCode = store.stateCode;
        }

        // 3. Map line items with HSN and tax rates
        const rawItems = (order.line_items || []).map((li: any) => {
          // Check for tax lines on the item
          const taxLine = (li.tax_lines && li.tax_lines[0]) || {};
          const ratePercent = taxLine.rate ? taxLine.rate * 100 : 18; // default 18% if unspecified
          
          return {
            title: li.title || "Product",
            sku: li.sku,
            hsnCode:
              li.hs_code ||
              li.hsn_code ||
              li.harmonized_system_code ||
              li.properties?.find((p: any) => p.name?.toUpperCase() === "HSN" || p.name?.toUpperCase() === "HSN_CODE")?.value ||
              "9983",
            quantity: li.quantity || 1,
            unitPrice: li.price,
            taxRate: ratePercent,
            discountAmount: li.total_discount || 0
          };
        });

        const shippingPrice = order.total_shipping_price_set?.shop_money?.amount || 0;
        const isTaxInclusive = order.taxes_included ?? true;

        // 4. Run Tax Calculation Engine
        const taxSummary = calculateGstOrder({
          sellerStateCode: store.stateCode,
          buyerStateCode: posStateCode,
          items: rawItems,
          shippingPrice,
          isTaxInclusive
        });

        // 5. Atomic Transaction: Lock store sequence & insert invoice record
        const savedInvoice = await prisma.$transaction(async (tx) => {
          const seqResult = await getNextInvoiceNumber(tx, store.id);

          const invoice = await tx.invoice.create({
            data: {
              storeId: store.id,
              shopifyOrderId: String(order.id),
              orderNumber: String(order.order_number || order.name || order.id),
              invoiceNumber: seqResult.invoiceNumber,
              posStateCode,
              isInterState: taxSummary.isInterState,
              totalTaxable: taxSummary.totalTaxable.toFixed(2),
              totalCgst: taxSummary.totalCgst.toFixed(2),
              totalSgst: taxSummary.totalSgst.toFixed(2),
              totalIgst: taxSummary.totalIgst.toFixed(2),
              shippingTaxable: taxSummary.shipping.shippingTaxable.toFixed(2),
              shippingTaxRate: taxSummary.shipping.shippingTaxRate.toFixed(2),
              shippingCgst: taxSummary.shipping.shippingCgst.toFixed(2),
              shippingSgst: taxSummary.shipping.shippingSgst.toFixed(2),
              shippingIgst: taxSummary.shipping.shippingIgst.toFixed(2),
              grandTotal: taxSummary.grandTotal.toFixed(2),
              buyerGstin,
              buyerCompanyName,
              buyerAddress: {
                shipping: order.shipping_address,
                billing: order.billing_address,
                email: order.email || order.contact_email || order.customer?.email,
                customerName: `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim() || order.shipping_address?.name
              },
              items: {
                create: taxSummary.items.map((item) => ({
                  title: item.title,
                  sku: item.sku,
                  hsnCode: item.hsnCode,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice.toFixed(2),
                  taxRate: item.taxRate.toFixed(2),
                  taxableAmount: item.taxableAmount.toFixed(2),
                  cgstAmount: item.cgstAmount.toFixed(2),
                  sgstAmount: item.sgstAmount.toFixed(2),
                  igstAmount: item.igstAmount.toFixed(2),
                  totalAmount: item.totalAmount.toFixed(2)
                }))
              }
            }
          });

          return invoice;
        });

        console.log(`[InvoiceWorker] Generated Invoice #${savedInvoice.invoiceNumber} for Order #${order.id}`);
        await incrementStoreOrderUsage(store.id);

        // 6. Enqueue PDF Rendering Worker
        await pdfRenderingQueue.add("render-invoice-pdf", {
          invoiceId: savedInvoice.id,
          storeId: store.id
        });

        return { invoiceId: savedInvoice.id, invoiceNumber: savedInvoice.invoiceNumber };
      }

      if (job.name === "process-refund-credit-note") {
        const { shopifyDomain, refund } = job.data;
        const store = await prisma.store.findUnique({
          where: { shopifyDomain }
        });

        if (!store) {
          throw new Error(`Store not registered for domain: ${shopifyDomain}`);
        }

        const invoice = await prisma.invoice.findUnique({
          where: { shopifyOrderId: String(refund.order_id) }
        });

        if (!invoice) {
          console.warn(`No invoice found for refunded order #${refund.order_id}`);
          return;
        }

        // Create sequential Credit Note under Rule 53
        const creditNote = await prisma.$transaction(async (tx) => {
          const seqResult = await getNextCreditNoteNumber(tx, store.id);

          const refundAmount = refund.transactions?.reduce(
            (sum: number, t: any) => sum + parseFloat(t.amount || 0),
            0
          ) || 0;

          return await tx.creditNote.create({
            data: {
              storeId: store.id,
              invoiceId: invoice.id,
              shopifyRefundId: String(refund.id),
              creditNoteNo: seqResult.creditNoteNumber,
              refundAmount: refundAmount.toFixed(2),
              reason: refund.note || "Customer Return / Refund"
            }
          });
        });

        console.log(`[InvoiceWorker] Generated Credit Note #${creditNote.creditNoteNo} for Refund #${refund.id}`);
        return { creditNoteId: creditNote.id, creditNoteNo: creditNote.creditNoteNo };
      }
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[InvoiceWorker] Job ${job?.id} failed with error:`, err);
  });

  return worker;
}
