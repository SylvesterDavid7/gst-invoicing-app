import { ActionFunctionArgs, json } from "@remix-run/node";
import crypto from "crypto";
import { enqueueOrderPaid } from "../services/queue/invoice-queue";

/**
 * Verify Shopify Webhook HMAC signature
 */
function verifyShopifyHmac(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader || !secret) return false;
  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const shopDomain = request.headers.get("x-shopify-shop-domain");
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  const rawBody = await request.text();

  const candidateSecrets = [
    process.env.WEBHOOK_SECRET,
    process.env.SHOPIFY_API_SECRET
  ].filter(Boolean) as string[];

  // In production, enforce HMAC signature validation unless explicitly skipped
  if (process.env.NODE_ENV === "production" && process.env.SKIP_HMAC_VERIFICATION !== "true" && candidateSecrets.length > 0) {
    const isValid = candidateSecrets.some(sec => verifyShopifyHmac(rawBody, hmacHeader, sec));
    if (!isValid) {
      console.error(`[Webhook Error] HMAC signature verification failed for shop domain: ${shopDomain}. Check SHOPIFY_API_SECRET or WEBHOOK_SECRET in .env.`);
      return json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const orderData = JSON.parse(rawBody);

    // Asynchronous decoupled handoff: Push to BullMQ queue and immediately respond
    if (shopDomain) {
      await enqueueOrderPaid(shopDomain, orderData);
      console.log(`[Webhook] Enqueued orders/paid for #${orderData.order_number || orderData.id}`);
    }

    // Immediately return HTTP 200 to satisfy Shopify 5-second webhook timeout
    return json({ success: true, queued: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error processing orders/paid webhook:", error.message);
    // Still return 200 to avoid Shopify retrying corrupt or unprocessable payloads repeatedly
    return json({ error: error.message }, { status: 200 });
  }
}
