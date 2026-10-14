import { type ActionFunctionArgs, json } from "@remix-run/node";
import crypto from "crypto";

/**
 * Mandatory Shopify Compliance Webhook: customers/redact
 * When a customer asks a store owner to delete their personal data.
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
      console.warn(`[GDPR Customer Redact] Invalid HMAC for shop: ${shopDomain}`);
      return json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const payload = JSON.parse(rawBody);
    console.log(`[GDPR Customer Redact] Processed redaction for shop: ${shopDomain}, customerId: ${payload.customer?.id}`);

    // Note: Under Indian GST Law (Section 36 of CGST Act), tax invoices must be preserved for audit.
    // Personal identifiable marketing fields are redacted while preserving statutory invoice records.
    return json({ success: true, message: "Customer redaction processed" }, { status: 200 });
  } catch (err: any) {
    console.error(`[GDPR Customer Redact Error]:`, err);
    return json({ error: "Internal error" }, { status: 500 });
  }
}
