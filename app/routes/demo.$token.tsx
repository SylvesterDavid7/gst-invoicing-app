import { json, redirect, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { prisma } from "../db.server";
import {
  getAndValidateDemoAccess,
  activateDemoSession,
  provisionDemoSandboxStore
} from "../services/admin/admin.server";
import { ensureStoreExists } from "../services/store/store.server";

export const meta: MetaFunction = () => {
  return [
    { title: "GST Pro Demo Access | Automated Indian GST Invoicing" },
    { name: "robots", content: "noindex, nofollow" }
  ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const token = params.token;
  if (!token) {
    return json({ error: "NOT_FOUND", demo: null }, { status: 404 });
  }

  const demo = await getAndValidateDemoAccess(token);
  if (!demo) {
    return json({ error: "NOT_FOUND", demo: null }, { status: 404 });
  }

  const now = new Date();
  const isExpired = demo.status === "EXPIRED" || now > new Date(demo.expiresAt);
  const isRevoked = demo.status === "REVOKED";

  // If expired or revoked, display the dedicated expiration page without setting active session
  if (isExpired || isRevoked) {
    return json({
      error: isRevoked ? "REVOKED" : "EXPIRED",
      demo: {
        clientName: demo.clientName,
        storeDomain: demo.storeDomain,
        durationDays: demo.durationDays,
        expiresAt: demo.expiresAt.toISOString(),
        firstAccessedAt: demo.firstAccessedAt ? demo.firstAccessedAt.toISOString() : null,
        status: isRevoked ? "REVOKED" : "EXPIRED"
      }
    });
  }

  // Active Demo: Record access
  await activateDemoSession(demo.id);

  let targetDomain = demo.storeDomain;
  // If the demo was created against an old shared store with old invoices, auto-isolate it to a dedicated clean sandbox
  if (
    !targetDomain ||
    targetDomain === "xbrews-gst-demo.myshopify.com" ||
    targetDomain === "quickstart-demo.myshopify.com"
  ) {
    const sandboxStore = await provisionDemoSandboxStore(demo.clientName);
    targetDomain = sandboxStore.shopifyDomain;
    await prisma.demoAccess.update({
      where: { id: demo.id },
      data: { storeDomain: targetDomain }
    });
  }

  await ensureStoreExists(targetDomain);

  // Calculate remaining seconds for cookie lifespan
  const remainingMs = Math.max(0, new Date(demo.expiresAt).getTime() - now.getTime());
  const maxAge = Math.floor(remainingMs / 1000);

  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `active_shop=${encodeURIComponent(targetDomain)}; Path=/; Max-Age=${maxAge}; SameSite=None; Secure`
  );
  headers.append(
    "Set-Cookie",
    `demo_token=${encodeURIComponent(demo.token)}; Path=/; Max-Age=${maxAge}; SameSite=None; Secure`
  );
  headers.append(
    "Set-Cookie",
    `demo_client=${encodeURIComponent(demo.clientName)}; Path=/; Max-Age=${maxAge}; SameSite=None; Secure`
  );
  headers.append(
    "Set-Cookie",
    `demo_expires=${encodeURIComponent(demo.expiresAt.toISOString())}; Path=/; Max-Age=${maxAge}; SameSite=None; Secure`
  );

  return redirect(`/app?shop=${encodeURIComponent(targetDomain)}&demo_token=${encodeURIComponent(demo.token)}`, {
    headers
  });
}

export default function DemoTokenPage() {
  const data = useLoaderData<typeof loader>();

  if (data.error === "NOT_FOUND") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.iconCircle}>🔍</div>
          <h1 style={styles.heading}>Demo Link Not Found</h1>
          <p style={styles.subtext}>
            This unique demo link is either invalid or has been permanently removed by the administrator.
          </p>
          <Link to="/" style={styles.primaryBtn}>
            Visit GST Pro Homepage
          </Link>
        </div>
      </div>
    );
  }

  if (data.error === "REVOKED") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ ...styles.iconCircle, background: "#fee2e2", color: "#b91c1c" }}>🚫</div>
          <h1 style={styles.heading}>Demo Access Revoked</h1>
          <p style={styles.subtext}>
            Access to this demo environment for <strong>{data.demo?.clientName}</strong> has been revoked by the
            administrator.
          </p>
          <div style={styles.actions}>
            <a
              href="https://wa.me/?text=Hi%20there,%20I'd%20like%20to%20request%20access%20to%20the%20GST%20Invoicing%20demo"
              target="_blank"
              rel="noreferrer"
              style={styles.primaryBtn}
            >
              Contact Admin on WhatsApp
            </a>
            <Link to="/" style={styles.secondaryBtn}>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // EXPIRED state
  const expiryDate = data.demo?.expiresAt ? new Date(data.demo.expiresAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }) : "Recent";

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ ...styles.iconCircle, background: "#fef3c7", color: "#d97706" }}>⏳</div>
        <div style={styles.pill}>Demo Access Concluded</div>
        <h1 style={styles.heading}>Your Demo Access Has Ended</h1>
        <p style={styles.subtext}>
          The <strong>{data.demo?.durationDays || 3}-day</strong> preview period generated for{" "}
          <strong>{data.demo?.clientName}</strong> expired on <strong>{expiryDate}</strong>.
        </p>

        <div style={styles.infoBox}>
          <div style={styles.infoRow}>
            <span>Client Workspace:</span>
            <strong>{data.demo?.clientName}</strong>
          </div>
          <div style={styles.infoRow}>
            <span>Store Scope:</span>
            <code>{data.demo?.storeDomain}</code>
          </div>
          <div style={styles.infoRow}>
            <span>Access Status:</span>
            <span style={{ color: "#d97706", fontWeight: 700 }}>Expired (3 Days Reached)</span>
          </div>
        </div>

        <p style={{ fontSize: "13px", color: "#64748b", margin: "20px 0" }}>
          We hope you experienced how seamless Indian GST compliance, B2B tax validation, and automated A4 invoices can be for your Shopify store!
        </p>

        <div style={styles.actions}>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Hi! Our ${data.demo?.durationDays || 3}-day demo for ${data.demo?.clientName} just ended. We would like to get a plan or trial extension.`
            )}`}
            target="_blank"
            rel="noreferrer"
            style={styles.primaryBtn}
          >
            💬 Contact Admin to Activate Full App
          </a>
          <Link to="/#pricing" style={styles.secondaryBtn}>
            View Subscription Plans
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
    padding: "24px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  card: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "40px 36px",
    maxWidth: "520px",
    width: "100%",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    textAlign: "center"
  },
  iconCircle: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "30px",
    margin: "0 auto 16px auto"
  },
  pill: {
    display: "inline-block",
    padding: "4px 12px",
    background: "#fef3c7",
    color: "#b45309",
    borderRadius: "9999px",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    marginBottom: "12px"
  },
  heading: {
    fontSize: "24px",
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 10px 0"
  },
  subtext: {
    fontSize: "14px",
    color: "#475569",
    lineHeight: 1.6,
    margin: "0 0 20px 0"
  },
  infoBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "16px",
    textAlign: "left",
    marginBottom: "16px"
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "13px",
    color: "#334155",
    padding: "4px 0"
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  primaryBtn: {
    display: "block",
    padding: "12px 20px",
    background: "linear-gradient(135deg, #008060 0%, #004c3f 100%)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 700,
    borderRadius: "8px",
    fontSize: "14px",
    transition: "transform 0.1s"
  },
  secondaryBtn: {
    display: "block",
    padding: "12px 20px",
    background: "#f1f5f9",
    color: "#334155",
    textDecoration: "none",
    fontWeight: 600,
    borderRadius: "8px",
    fontSize: "14px"
  }
};
