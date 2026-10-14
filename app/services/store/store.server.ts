import { prisma } from "../../db.server";

/**
 * Resolves the active store for the current request.
 * Checks:
 * 1. URL search parameter: ?shop=xyz.myshopify.com
 * 2. Cookie: active_shop
 * 3. Fallback to the first store in the database.
 */
export async function getActiveStore(request: Request) {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");

  // Check cookie for active store if query param not present
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/active_shop=([^;]+)/);
  const shopCookie = match ? decodeURIComponent(match[1]) : null;

  const targetDomain = shopParam || shopCookie || process.env.DEFAULT_STORE_DOMAIN;

  if (targetDomain) {
    const store = await prisma.store.findUnique({
      where: { shopifyDomain: targetDomain }
    });
    if (store) return store;
  }

  // Seamless fallback: default to the primary store so you are never prompted
  const defaultStore =
    (await prisma.store.findFirst({
      where: { shopifyDomain: { contains: "xbrews" } }
    })) ||
    (await prisma.store.findFirst({
      orderBy: { updatedAt: "desc" }
    }));

  return defaultStore;
}

/**
 * Ensures a store exists for an incoming domain (e.g. from a webhook)
 */
export async function ensureStoreExists(shopifyDomain: string) {
  let store = await prisma.store.findUnique({
    where: { shopifyDomain }
  });

  if (!store) {
    // Generate clean brand name from domain (e.g. xbrews-gst-demo -> Xbrews Gst Demo)
    const cleanName = shopifyDomain
      .replace(".myshopify.com", "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    store = await prisma.store.create({
      data: {
        shopifyDomain,
        accessToken: "auto-provisioned",
        legalName: `${cleanName} Private Limited`,
        tradeName: cleanName,
        gstin: "27AABCA1234A1Z5", // Default template GSTIN for configuration
        stateCode: "27",
        registeredAddress: {
          addressLine1: "Store Headquarters",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
          country: "India"
        },
        invoicePrefix: "XB",
        creditNotePrefix: "CN",
        currentFiscalYear: "26-27"
      }
    });
    console.log(`[Multi-Tenancy] Auto-provisioned dedicated store record for: ${shopifyDomain}`);
  }

  return store;
}
