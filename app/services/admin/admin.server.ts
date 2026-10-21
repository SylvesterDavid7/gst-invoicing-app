import crypto from "crypto";
import { createCookie, redirect } from "@remix-run/node";
import { prisma } from "../../db.server";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "gst-admin-supersecret-2026";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin@gst2026";

export const adminCookie = createCookie("gst_admin_session", {
  secrets: [ADMIN_SECRET],
  path: "/",
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 7, // 7 days
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production"
});

/**
 * Validates whether the admin password is correct
 */
export function verifyAdminPassword(password: string): boolean {
  if (!password) return false;
  return password.trim() === ADMIN_PASSWORD.trim();
}

/**
 * Checks if current request has a valid admin session cookie
 */
export async function isAdminAuthenticated(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get("Cookie");
  const session = await adminCookie.parse(cookieHeader);
  return Boolean(session && session.isAdmin === true);
}

/**
 * Ensures admin is authenticated, otherwise redirects to /admin/login
 */
export async function requireAdmin(request: Request) {
  const authenticated = await isAdminAuthenticated(request);
  if (!authenticated) {
    const url = new URL(request.url);
    const redirectTo = encodeURIComponent(url.pathname + url.search);
    throw redirect(`/admin/login?redirectTo=${redirectTo}`);
  }
}

/**
 * Generates a cryptographically secure unique demo token
 */
export function generateUniqueDemoToken(): string {
  const randomPart = crypto.randomBytes(12).toString("hex");
  return `demo_${randomPart}`;
}

export interface CreateDemoInput {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  storeDomain: string;
  durationDays?: number; // e.g. 3
  notes?: string;
}

/**
 * Provisions a completely fresh, isolated demo store specifically for a prospect.
 * Starts with 0 invoices and custom prefix so they never see anyone else's data.
 */
export async function provisionDemoSandboxStore(clientName: string) {
  const cleanSlug = clientName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const uniqueHex = crypto.randomBytes(3).toString("hex");
  const storeDomain = `demo-${cleanSlug || "client"}-${uniqueHex}.myshopify.com`;

  const cleanPrefix =
    clientName
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 3) || "INV";

  const store = await prisma.store.create({
    data: {
      shopifyDomain: storeDomain,
      accessToken: "demo-sandbox-token",
      legalName: `${clientName.trim()} Private Limited`,
      tradeName: clientName.trim(),
      gstin: "33AABCM1234F1Z8", // Sample GSTIN
      stateCode: "33",
      registeredAddress: {
        addressLine1: "Flagship Commercial Premises",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600001",
        country: "India"
      },
      invoicePrefix: cleanPrefix,
      creditNotePrefix: "CN",
      currentFiscalYear: "26-27",
      invoiceSequence: 0,
      creditSequence: 0
    }
  });

  return store;
}

/**
 * Creates a unique time-limited demo URL access record.
 * Automatically provisions a fresh isolated sandbox with 0 old invoices by default.
 */
export async function createDemoAccess(input: CreateDemoInput) {
  const durationDays = input.durationDays && input.durationDays > 0 ? input.durationDays : 3;
  const token = generateUniqueDemoToken();
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

  let storeDomain = input.storeDomain?.trim();

  // If auto/empty or explicitly requested fresh sandbox, provision an isolated store
  if (!storeDomain || storeDomain === "auto" || storeDomain === "auto_fresh_sandbox" || storeDomain.startsWith("new_")) {
    const sandboxStore = await provisionDemoSandboxStore(input.clientName);
    storeDomain = sandboxStore.shopifyDomain;
  }

  const demo = await prisma.demoAccess.create({
    data: {
      token,
      clientName: input.clientName.trim(),
      clientEmail: input.clientEmail?.trim() || null,
      clientPhone: input.clientPhone?.trim() || null,
      storeDomain,
      durationDays,
      expiresAt,
      status: "ACTIVE",
      notes: input.notes?.trim() || null
    }
  });

  return demo;
}

/**
 * Retrieves a demo record by token and automatically marks as expired if time has passed
 */
export async function getAndValidateDemoAccess(token: string) {
  if (!token) return null;

  const demo = await prisma.demoAccess.findUnique({
    where: { token }
  });

  if (!demo) return null;

  // Auto-expire if past expiresAt
  if (demo.status === "ACTIVE" && new Date() > new Date(demo.expiresAt)) {
    const updated = await prisma.demoAccess.update({
      where: { id: demo.id },
      data: { status: "EXPIRED" }
    });
    return updated;
  }

  return demo;
}

/**
 * Records a client visit / access to their demo link
 */
export async function recordDemoVisit(demoId: string) {
  const now = new Date();
  return prisma.demoAccess.update({
    where: { id: demoId },
    data: {
      accessCount: { increment: 1 },
      lastAccessedAt: now,
      firstAccessedAt: prisma.demoAccess.fields.firstAccessedAt ? undefined : now
    }
  });
}

/**
 * Marks first accessed time if not already set, and optionally starts the duration timer from first visit
 */
export async function activateDemoSession(demoId: string) {
  const demo = await prisma.demoAccess.findUnique({ where: { id: demoId } });
  if (!demo) return null;

  const now = new Date();
  const isFirstVisit = !demo.firstAccessedAt;

  // If first visit, set firstAccessedAt
  return prisma.demoAccess.update({
    where: { id: demoId },
    data: {
      firstAccessedAt: demo.firstAccessedAt || now,
      lastAccessedAt: now,
      accessCount: { increment: 1 }
    }
  });
}

/**
 * Revokes a demo URL immediately
 */
export async function revokeDemoAccess(id: string) {
  return prisma.demoAccess.update({
    where: { id },
    data: { status: "REVOKED" }
  });
}

/**
 * Reactivates or extends an existing demo access
 */
export async function extendDemoAccess(id: string, additionalDays: number = 3) {
  const demo = await prisma.demoAccess.findUnique({ where: { id } });
  if (!demo) throw new Error("Demo record not found");

  // If already expired, extend from now; if still active, extend from current expiresAt
  const baseTime = demo.expiresAt > new Date() ? new Date(demo.expiresAt) : new Date();
  const newExpiresAt = new Date(baseTime.getTime() + additionalDays * 24 * 60 * 60 * 1000);

  return prisma.demoAccess.update({
    where: { id },
    data: {
      status: "ACTIVE",
      expiresAt: newExpiresAt,
      durationDays: demo.durationDays + additionalDays
    }
  });
}

/**
 * Deletes a demo record
 */
export async function deleteDemoAccess(id: string) {
  return prisma.demoAccess.delete({
    where: { id }
  });
}

/**
 * Lists all demo access records
 */
export async function listAllDemoAccesses() {
  const demos = await prisma.demoAccess.findMany({
    orderBy: { createdAt: "desc" }
  });

  // Evaluate current status for each active link against current clock
  const now = new Date();
  return demos.map((d) => {
    const isExpired = d.status === "ACTIVE" && now > new Date(d.expiresAt);
    return {
      ...d,
      computedStatus: isExpired ? "EXPIRED" : d.status,
      isExpired
    };
  });
}

/**
 * Lists all connected stores/clients with aggregated metrics for the admin portal
 */
export async function listAllClientsWithStats() {
  const stores = await prisma.store.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          invoices: true,
          creditNotes: true
        }
      }
    }
  });

  return stores;
}
