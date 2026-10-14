import { type ActionFunctionArgs, json } from "@remix-run/node";
import crypto from "crypto";

/**
 * Mandatory Shopify Compliance Webhook: customers/data_request
 * When a customer requests their data from the store owner, Shopify invokes this endpoint.
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const hmacHeader = request.headers.get("X-Shopify-Hmac-Sha256");
  const shopDomain = request.headers.get("X-Shopify-Shop-Domain");
  const rawBody = await request.text();

  const secret = process.env.SHOPIFY_API_SECRET || process.env.WEBHOOK_SECRET;
  if (secret && hmacHeader && process.env.SKIP_HMAC_VERIFICATION !== "true") {
    const generatedHash = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("base64");

    if (generatedHash !== hmacHeader) {
      console.warn(`[GDPR Data Request] Invalid HMAC for shop: ${shopDomain}`);
      return json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const payload = JSON.parse(rawBody);
    console.log(`[GDPR Data Request] Received request for shop: ${shopDomain}, customer: ${payload.customer?.email}`);

    // Invoices and tax filings are associated with orders. Acknowledge receipt to Shopify.
    return json({ success: true, message: "Data request logged" }, { status: 200 });
  } catch (err: any) {
    console.error(`[GDPR Data Request Error]:`, err);
    return json({ error: "Internal error" }, { status: 500 });
  }
}
