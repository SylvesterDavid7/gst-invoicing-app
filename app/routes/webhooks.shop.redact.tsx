import { type ActionFunctionArgs, json } from "@remix-run/node";
import crypto from "crypto";
import { prisma } from "../db.server";

/**
 * Mandatory Shopify Compliance Webhook: shop/redact
 * Sent 48 hours after a merchant uninstalls the app to delete store data.
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
      console.warn(`[GDPR Shop Redact] Invalid HMAC for shop: ${shopDomain}`);
      return json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const payload = JSON.parse(rawBody);
    const domain = payload.shop_domain || shopDomain;

    console.log(`[GDPR Shop Redact] Erasing store access credentials for shop: ${domain}`);

    if (domain) {
      // Clear sensitive access tokens and credentials
      await prisma.store.updateMany({
        where: { shopifyDomain: domain },
        data: {
          accessToken: "revoked",
          subscriptionId: null
        }
      });
    }

    return json({ success: true, message: "Shop credentials redacted" }, { status: 200 });
  } catch (err: any) {
    console.error(`[GDPR Shop Redact Error]:`, err);
    return json({ error: "Internal error" }, { status: 500 });
  }
}
