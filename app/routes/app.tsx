import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLocation, Link, useLoaderData } from "@remix-run/react";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { getActiveStore, getActiveDemoSession } from "../services/store/store.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Check if visitor is running inside a demo session
  const demoSession = await getActiveDemoSession(request);
  if (demoSession) {
    const isExpired = demoSession.status === "EXPIRED" || new Date() > new Date(demoSession.expiresAt);
    const isRevoked = demoSession.status === "REVOKED";
    if (isExpired || isRevoked) {
      return redirect(`/demo/${demoSession.token}`);
    }
  }

  const activeStore = await getActiveStore(request);

  if (!activeStore) {
    return redirect("/?auth=required");
  }

  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  const headers = new Headers();
  if (shopParam) {
    headers.append(
      "Set-Cookie",
      `active_shop=${encodeURIComponent(shopParam)}; Path=/; Max-Age=31536000; SameSite=None; Secure`
    );
  }

  return json(
    {
      activeStore,
      demoInfo: demoSession
        ? {
            clientName: demoSession.clientName,
            expiresAt: demoSession.expiresAt.toISOString(),
            token: demoSession.token
          }
        : null
    },
    { headers: headers.has("Set-Cookie") ? headers : undefined }
  );
}

export default function AppLayout() {
  const { activeStore, demoInfo } = useLoaderData<typeof loader>();
  const location = useLocation();

  const shopQuery = activeStore ? `?shop=${encodeURIComponent(activeStore.shopifyDomain)}` : "";

  const navItems = [
    { label: "Dashboard", path: "/app" },
    { label: "Manual Billing (POS)", path: "/app/billing" },
    { label: "Invoices", path: "/app/invoices" },
    { label: "Settings", path: "/app/settings" },
    { label: "GSTR-1 Exports", path: "/app/reports" },
    { label: "Plans & Pricing", path: "/app/pricing" }
  ];

  return (
    <AppProvider i18n={enTranslations}>
      <div style={{ background: "#f6f6f7", minHeight: "100vh" }}>
        {demoInfo && (
          <div
            style={{
              background: "linear-gradient(90deg, #1e1b4b 0%, #312e81 100%)",
              color: "#ffffff",
              padding: "10px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "12px",
              fontWeight: 500,
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              borderBottom: "1px solid #4338ca"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px" }}>⚡</span>
              <span>
                <strong>Demo Mode Active:</strong> Welcome, <strong>{demoInfo.clientName}</strong>! You have full interactive access to test GST Pro until{" "}
                <span style={{ color: "#fef08a", fontWeight: 700 }}>
                  {new Date(demoInfo.expiresAt).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                </span>{" "}
                at {new Date(demoInfo.expiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.
              </span>
            </div>
            <a
              href="/#pricing"
              target="_blank"
              rel="noreferrer"
              style={{
                color: "#fef08a",
                textDecoration: "none",
                fontWeight: 700,
                background: "rgba(255,255,255,0.15)",
                padding: "4px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.25)"
              }}
            >
              Get Full Access &rarr;
            </a>
          </div>
        )}
        <header
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e1e3e5",
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "20px" }}>⚡</span>
            <div>
              <span style={{ fontWeight: 700, fontSize: "15px", color: "#202223" }}>
                GST Pro &bull; Invoicing & Tax Compliance
              </span>
              {activeStore && (
                <div style={{ fontSize: "11px", color: "#6d7175" }}>
                  Active: <strong>{activeStore.tradeName || activeStore.legalName}</strong> &bull; GSTIN: <code>{activeStore.gstin}</code>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <nav style={{ display: "flex", gap: "6px" }}>
              {navItems.map((item) => {
                const isActive =
                  item.path === "/app"
                    ? location.pathname === "/app"
                    : location.pathname.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    to={`${item.path}${shopQuery}`}
                    style={{
                      textDecoration: "none",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: isActive ? "#008060" : "#5c5f62",
                      background: isActive ? "#f1f8f5" : "transparent"
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Merchant's Connected Store Identity (Tenant Isolated) */}
            {activeStore && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#f1f8f5",
                  border: "1px solid #b7ece0",
                  padding: "4px 10px",
                  borderRadius: "8px"
                }}
              >
                <span style={{ fontSize: "12px", color: "#008060", fontWeight: 700 }}>
                  🏬 {activeStore.tradeName || activeStore.shopifyDomain}
                </span>
              </div>
            )}
          </div>
        </header>

        <main style={{ padding: "20px 24px" }}>
          <Outlet />
        </main>

        <footer
          style={{
            borderTop: "1px solid #e1e3e5",
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "12px",
            color: "#6d7175",
            flexWrap: "wrap",
            gap: "8px"
          }}
        >
          <div>
            &copy; {new Date().getFullYear()} GST Pro Invoicing &bull; Indian Statutory GST Compliance
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: "#5c5f62", textDecoration: "none" }}>
              Privacy Policy
            </a>
            <a href="/terms" target="_blank" rel="noreferrer" style={{ color: "#5c5f62", textDecoration: "none" }}>
              Terms of Service
            </a>
            <a href="/data-policy" target="_blank" rel="noreferrer" style={{ color: "#5c5f62", textDecoration: "none" }}>
              Data &amp; GDPR Policy
            </a>
          </div>
        </footer>
      </div>
    </AppProvider>
  );
}
