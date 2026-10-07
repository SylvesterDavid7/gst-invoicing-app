import { type LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "../db.server";
import fs from "fs";
import path from "path";

/**
 * Public customer download endpoint for GST Tax Invoices
 * Accessible by order_id or invoice_number
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order_id");
  const invoiceNumber = url.searchParams.get("invoice_number");

  if (!orderId && !invoiceNumber) {
    return new Response("Order ID or Invoice Number required", { status: 400 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      OR: [
        ...(orderId ? [{ shopifyOrderId: orderId }] : []),
        ...(invoiceNumber ? [{ invoiceNumber }] : [])
      ]
    },
    include: { store: true }
  });

  if (!invoice) {
    return new Response("Invoice is still generating or not found. Please refresh in a moment.", {
      status: 404,
      headers: { "Content-Type": "text/plain" }
    });
  }

  // If stored in Cloudflare R2 / AWS S3
  if (invoice.pdfUrl && invoice.pdfUrl.startsWith("http")) {
    return Response.redirect(invoice.pdfUrl, 302);
  }

  // If stored locally
  const safeDomain = invoice.store.shopifyDomain.replace(/[^a-zA-Z0-9]/g, "_");
  const safeFileName = `${invoice.invoiceNumber.replace(/\//g, "-")}.pdf`;
  const localFilePath = path.join(process.cwd(), "public", "invoices", safeDomain, safeFileName);

  if (fs.existsSync(localFilePath)) {
    const fileBuffer = fs.readFileSync(localFilePath);
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFileName}"`
      }
    });
  }

  return new Response("PDF invoice is still being compiled. Please refresh in a few seconds.", {
    status: 202,
    headers: { "Content-Type": "text/plain" }
  });
}
