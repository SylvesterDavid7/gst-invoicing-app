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
  const demoTokenParam = url.searchParams.get("demo_token") || demoSession?.token;

  const headers = new Headers();
  if (shopParam) {
    headers.append(
      "Set-Cookie",
      `active_shop=${encodeURIComponent(shopParam)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
    );
  }
  if (demoTokenParam) {
    headers.append(
      "Set-Cookie",
      `demo_token=${encodeURIComponent(demoTokenParam)}; Path=/; Max-Age=259200; SameSite=Lax; Secure`
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

  // Bulletproof demo detection: check demoSession OR if store domain belongs to an isolated demo sandbox
  const isDemoMode = Boolean(
    demoInfo ||
    activeStore?.shopifyDomain?.startsWith("demo-") ||
    activeStore?.accessToken === "demo-sandbox-token"
  );

  const demoToken = demoInfo?.token;
  const shopQuery = activeStore
    ? `?shop=${encodeURIComponent(activeStore.shopifyDomain)}${demoToken ? `&demo_token=${encodeURIComponent(demoToken)}` : ""}`
    : (demoToken ? `?demo_token=${encodeURIComponent(demoToken)}` : "");

  // In demo mode, only expose product features (Dashboard, POS, Invoices, Settings, Reports), NEVER Plans & Pricing
  const navItems = [
    { label: "Dashboard", path: "/app" },
    { label: "Manual Billing (POS)", path: "/app/billing" },
    { label: "Invoices", path: "/app/invoices" },
    { label: "Settings", path: "/app/settings" },
    { label: "GSTR-1 Exports", path: "/app/reports" }
  ];

  if (!isDemoMode) {
    navItems.push({ label: "Plans & Pricing", path: "/app/pricing" });
  }

  return (
    <AppProvider i18n={enTranslations}>
      <style>{`
        /* Mobile-First Navigation & Layout Responsive Rules */
        .app-mobile-nav {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          padding: 4px 0;
        }
        .app-mobile-nav::-webkit-scrollbar {
          display: none;
        }
        .app-nav-link {
          flex-shrink: 0;
          white-space: nowrap;
          text-decoration: none;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.15s ease;
        }
        @media (max-width: 768px) {
          .app-header-box {
            padding: 10px 14px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .app-header-top-row {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
          }
          .app-main-box {
            padding: 12px 10px !important;
          }
          .app-demo-banner {
            padding: 10px 14px !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 6px !important;
          }
          .app-store-badge {
            font-size: 11px !important;
            padding: 2px 8px !important;
          }
        }
      `}</style>

      <div style={{ background: "#f6f6f7", minHeight: "100vh" }}>
        {demoInfo && (
          <div
            className="app-demo-banner"
            style={{
              background: "linear-gradient(90deg, #1e1b4b 0%, #312e81 100%)",
              color: "#ffffff",
              padding: "9px 24px",
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
                <strong>Demo Sandbox:</strong> Workspace for{" "}
                <strong>{demoInfo.clientName}</strong> &bull; Valid until{" "}
                <span style={{ color: "#fef08a", fontWeight: 700 }}>
                  {new Date(demoInfo.expiresAt).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                </span>
              </span>
            </div>
            <span
              style={{
                color: "#e0e7ff",
                background: "rgba(255,255,255,0.12)",
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 600,
                border: "1px solid rgba(255,255,255,0.2)"
              }}
            >
              3-Day Access
            </span>
          </div>
        )}

        <header
          className="app-header-box"
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
          <div className="app-header-top-row" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "20px" }}>⚡</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "15px", color: "#202223" }}>
                GST Pro &bull; Invoicing &amp; Tax Compliance
              </div>
              {activeStore && (
                <div style={{ fontSize: "11px", color: "#6d7175" }}>
                  Active: <strong>{activeStore.tradeName || activeStore.legalName}</strong> &bull; GSTIN: <code>{activeStore.gstin}</code>
                </div>
              )}
            </div>

            {/* Merchant's Connected Store Identity (Tenant Isolated) */}
            {activeStore && (
              <div
                className="app-store-badge"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#f1f8f5",
                  border: "1px solid #b7ece0",
                  padding: "4px 10px",
                  borderRadius: "8px",
                  marginLeft: "auto"
                }}
              >
                <span style={{ fontSize: "12px", color: "#008060", fontWeight: 700 }}>
                  🏬 {activeStore.tradeName || activeStore.shopifyDomain.split(".")[0]}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", width: "100%", maxWidth: "100%", overflow: "hidden" }}>
            <nav className="app-mobile-nav" style={{ width: "100%" }}>
              {navItems.map((item) => {
                const isActive =
                  item.path === "/app"
                    ? location.pathname === "/app"
                    : location.pathname.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    to={`${item.path}${shopQuery}`}
                    className="app-nav-link"
                    style={{
                      color: isActive ? "#008060" : "#5c5f62",
                      background: isActive ? "#e6f4ea" : "#f1f2f3",
                      border: isActive ? "1px solid #b7ece0" : "1px solid transparent"
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <main className="app-main-box" style={{ padding: "20px 24px" }}>
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
