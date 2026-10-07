import { Outlet, useLocation, Link } from "@remix-run/react";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";

export default function AppLayout() {
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", path: "/app" },
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
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "20px" }}>⚡</span>
            <span style={{ fontWeight: 700, fontSize: "16px", color: "#202223" }}>
              GST Pro &bull; Invoicing & Tax Compliance
            </span>
          </div>

          <nav style={{ display: "flex", gap: "8px" }}>
            {navItems.map((item) => {
              const isActive =
                item.path === "/app"
                  ? location.pathname === "/app"
                  : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    textDecoration: "none",
                    padding: "6px 14px",
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
        </header>

        <main style={{ padding: "20px 24px" }}>
          <Outlet />
        </main>
      </div>
    </AppProvider>
  );
}
