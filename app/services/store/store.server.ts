import { prisma } from "../../db.server";
import { getAndValidateDemoAccess } from "../admin/admin.server";

/**
 * Checks if the request is governed by a demo token session
 */
export async function getActiveDemoSession(request: Request) {
  const url = new URL(request.url);
  const demoParam = url.searchParams.get("demo_token");
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/demo_token=([^;]+)/);
  const demoCookie = match ? decodeURIComponent(match[1]) : null;
  const token = demoParam || demoCookie;

  if (token) {
    return getAndValidateDemoAccess(token);
  }

  // Incognito resilience: If cookies were blocked/cleared, identify demo session via the sandboxed demo store domain
  const shopParam = url.searchParams.get("shop");
  const shopMatch = cookieHeader.match(/active_shop=([^;]+)/);
  const shopCookie = shopMatch ? decodeURIComponent(shopMatch[1]) : null;
  const currentShop = shopParam || shopCookie;

  if (currentShop && currentShop.startsWith("demo-")) {
    const demo = await prisma.demoAccess.findFirst({
      where: { storeDomain: currentShop },
      orderBy: { createdAt: "desc" }
    });
    if (demo) {
      return getAndValidateDemoAccess(demo.token);
    }
  }

  return null;
}

/**
 * Resolves the active store for the current request.
 * Checks:
 * 1. Demo token session (if present, enforces demo validity)
 * 2. URL search parameter: ?shop=xyz.myshopify.com
 * 3. Cookie: active_shop
 * 4. Fallback to DEFAULT_STORE_DOMAIN
 */
export async function getActiveStore(request: Request) {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");

  // Check demo session first if active
  const demoSession = await getActiveDemoSession(request);
  if (demoSession) {
    if (demoSession.status !== "ACTIVE" || new Date() > new Date(demoSession.expiresAt)) {
      // Demo is expired or revoked! Return null to lock them out of the app
      return null;
    }
  }

  // Check cookie for active store if query param not present
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/active_shop=([^;]+)/);
  const shopCookie = match ? decodeURIComponent(match[1]) : null;

  const targetDomain = demoSession?.storeDomain || shopParam || shopCookie || process.env.DEFAULT_STORE_DOMAIN;

  if (targetDomain) {
    const store = await prisma.store.findUnique({
      where: { shopifyDomain: targetDomain }
    });
    if (store) return store;
  }

  // Strictly return null if no store is specified to protect merchant data
  return null;
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
