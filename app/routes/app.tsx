import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLocation, Link, useLoaderData } from "@remix-run/react";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { getActiveStore } from "../services/store/store.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const activeStore = await getActiveStore(request);

  return json({
    activeStore
  });
}

export default function AppLayout() {
  const { activeStore } = useLoaderData<typeof loader>();
  const location = useLocation();

  if (!activeStore) {
    return (
      <AppProvider i18n={enTranslations}>
        <div style={{ background: "#f6f6f7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#ffffff", maxWidth: "480px", width: "100%", borderRadius: "12px", border: "1px solid #dcdcdc", padding: "36px", textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: "42px", marginBottom: "16px" }}>🔒</div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#202223", marginBottom: "8px" }}>Store Authentication Required</h2>
            <p style={{ fontSize: "14px", color: "#6d7175", lineHeight: 1.5, marginBottom: "24px" }}>
              To ensure strict data privacy, each store's invoices and GST filings are strictly isolated. Please open this app from your <strong>Shopify Admin</strong> panel, or enter your store domain below.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const input = form.elements.namedItem("shop") as HTMLInputElement;
                let shop = input.value.trim().toLowerCase();
                if (shop && !shop.includes(".")) shop += ".myshopify.com";
                if (shop) {
                  document.cookie = `active_shop=${encodeURIComponent(shop)}; path=/; max-age=31536000`;
                  window.location.href = `/app?shop=${encodeURIComponent(shop)}`;
                }
              }}
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <input
                type="text"
                name="shop"
                placeholder="e.g. xbrews-gst-demo.myshopify.com"
                required
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #c9cccf", fontSize: "14px", outline: "none" }}
              />
              <button
                type="submit"
                style={{ padding: "10px 16px", borderRadius: "8px", border: "none", background: "#008060", color: "#ffffff", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}
              >
                Access Store Dashboard &rarr;
              </button>
            </form>
          </div>
        </div>
      </AppProvider>
    );
  }

  const shopQuery = `?shop=${encodeURIComponent(activeStore.shopifyDomain)}`;

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
      </div>
    </AppProvider>
  );
}
