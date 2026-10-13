import { ActionFunctionArgs, json } from "@remix-run/node";
import crypto from "crypto";
import { enqueueRefundCreated } from "../services/queue/invoice-queue";

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

  if (process.env.NODE_ENV === "production" && process.env.SKIP_HMAC_VERIFICATION !== "true" && candidateSecrets.length > 0) {
    const isValid = candidateSecrets.some(sec => verifyShopifyHmac(rawBody, hmacHeader, sec));
    if (!isValid) {
      console.error(`[Webhook Error] HMAC verification failed for webhook refunds/create on ${shopDomain}`);
      return json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const refundData = JSON.parse(rawBody);

    if (shopDomain) {
      await enqueueRefundCreated(shopDomain, refundData);
      console.log(`[Webhook] Enqueued refunds/create for order #${refundData.order_id}`);
    }

    return json({ success: true, queued: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error processing refunds/create webhook:", error.message);
    return json({ error: error.message }, { status: 200 });
  }
}
