import { type MetaFunction, json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { BILLING_PLANS } from "../services/billing/billing-plans";
import { ensureStoreExists } from "../services/store/store.server";

export const meta: MetaFunction = () => {
  return [
    { title: "GST Pro Invoicing & POS - Automated Indian GST for Shopify" },
    {
      name: "description",
      content:
        "Statutory Rule 46 A4 GST Invoices, B2B GSTIN checkout verification, POS counter billing, Rule 53 credit notes on refunds, and GSTR-1 Excel exports for Shopify India."
    }
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  // When launched from Shopify Admin (or with ?shop= parameter), redirect directly into the store app!
  if (shop) {
    await ensureStoreExists(shop);
    const search = url.search;
    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      `active_shop=${encodeURIComponent(shop)}; Path=/; Max-Age=31536000; SameSite=None; Secure`
    );
    return redirect(`/app${search}`, { headers });
  }

  // Check if merchant already has an active shop cookie
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/active_shop=([^;]+)/);
  const shopCookie = match ? decodeURIComponent(match[1]) : null;
  if (shopCookie && !url.searchParams.has("auth")) {
    return redirect(`/app?shop=${encodeURIComponent(shopCookie)}`);
  }

  const authRequired = url.searchParams.get("auth") === "required";

  return json({
    authRequired,
    plans: Object.values(BILLING_PLANS)
  });
}

export default function LandingPage() {
  const { authRequired, plans } = useLoaderData<typeof loader>();
  const [storeInput, setStoreInput] = useState("");

  const handleInstall = (e: React.FormEvent) => {
    e.preventDefault();
    let domain = storeInput.trim().toLowerCase();
    if (!domain) return;
    if (!domain.includes(".")) {
      domain = `${domain}.myshopify.com`;
    }
    // Set cookie and redirect to app with shop parameter to begin merchant session
    document.cookie = `active_shop=${encodeURIComponent(domain)}; path=/; max-age=31536000; SameSite=None; Secure`;
    window.location.href = `/app?shop=${encodeURIComponent(domain)}`;
  };

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: "#1a1a1a",
        background: "#ffffff",
        minHeight: "100vh",
        lineHeight: 1.5
      }}
    >
      {/* Top Notification Bar for Protected Redirects */}
      {authRequired && (
        <div
          style={{
            background: "#fff4e5",
            borderBottom: "1px solid #ffe2b5",
            padding: "10px 20px",
            textAlign: "center",
            fontSize: "13px",
            color: "#663c00",
            fontWeight: 600
          }}
        >
          🔒 Private Store Access: Please launch the app from your Shopify Admin panel or enter your store domain below.
        </div>
      )}

      {/* Navigation Bar */}
      <header
        style={{
          borderBottom: "1px solid #f1f2f4",
          padding: "16px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: "1200px",
          margin: "0 auto"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "24px" }}>⚡</span>
          <div>
            <span style={{ fontWeight: 800, fontSize: "18px", color: "#111827" }}>
              GST Pro Invoicing
            </span>
            <span
              style={{
                marginLeft: "8px",
                fontSize: "11px",
                background: "#f0fdf4",
                color: "#166534",
                border: "1px solid #bbf7d0",
                padding: "2px 8px",
                borderRadius: "12px",
                fontWeight: 700
              }}
            >
              Shopify App
            </span>
          </div>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <a
            href="#features"
            style={{ textDecoration: "none", color: "#4b5563", fontSize: "14px", fontWeight: 600 }}
          >
            Features
          </a>
          <a
            href="#demo"
            style={{ textDecoration: "none", color: "#4b5563", fontSize: "14px", fontWeight: 600 }}
          >
            Invoice Samples
          </a>
          <a
            href="#pricing"
            style={{ textDecoration: "none", color: "#4b5563", fontSize: "14px", fontWeight: 600 }}
          >
            Pricing
          </a>
          <a
            href="#install"
            style={{
              textDecoration: "none",
              background: "#008060",
              color: "#ffffff",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 700
            }}
          >
            Install App
          </a>
        </nav>
      </header>

      {/* Hero Section */}
      <section
        style={{
          padding: "64px 20px 48px 20px",
          textAlign: "center",
          maxWidth: "900px",
          margin: "0 auto"
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            padding: "6px 14px",
            borderRadius: "20px",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "24px"
          }}
        >
          <span>🇮🇳 Built Exclusively for Indian Shopify Merchants</span>
          <span>&bull;</span>
          <span>Rule 46 &amp; GSTR-1 Ready</span>
        </div>

        <h1
          style={{
            fontSize: "44px",
            fontWeight: 800,
            lineHeight: 1.15,
            color: "#0f172a",
            margin: "0 0 20px 0",
            letterSpacing: "-0.5px"
          }}
        >
          Automated GST Invoicing, B2B Tax Credits &amp; POS Billing
        </h1>

        <p
          style={{
            fontSize: "18px",
            color: "#475569",
            lineHeight: 1.6,
            maxWidth: "720px",
            margin: "0 auto 36px auto"
          }}
        >
          Instant statutory Rule 46 PDF tax invoices, B2B GSTIN collection at checkout, automatic Rule 53 credit notes on refunds, thermal POS walk-in billing, and 1-click CA-ready GSTR-1 Excel exports.
        </p>

        {/* Store Installation Form */}
        <div
          id="install"
          style={{
            maxWidth: "520px",
            margin: "0 auto 24px auto",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            padding: "8px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.04)"
          }}
        >
          <form
            onSubmit={handleInstall}
            style={{ display: "flex", gap: "8px" }}
          >
            <input
              type="text"
              value={storeInput}
              onChange={(e) => setStoreInput(e.target.value)}
              placeholder="e.g. your-store.myshopify.com"
              required
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                outline: "none"
              }}
            />
            <button
              type="submit"
              style={{
                background: "#008060",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 24px",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              Install App &rarr;
            </button>
          </form>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "24px", fontSize: "13px", color: "#64748b" }}>
          <span>🎁 3-Day Full-Access Free Trial</span>
          <span>&bull;</span>
          <span>⚡ No Coding Required</span>
          <span>&bull;</span>
          <span>🔒 100% Tenant Data Isolation</span>
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section
        id="features"
        style={{
          background: "#f8fafc",
          padding: "60px 20px",
          borderTop: "1px solid #f1f5f9",
          borderBottom: "1px solid #f1f5f9"
        }}
      >
        <div style={{ maxWidth: "1140px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h2 style={{ fontSize: "30px", fontWeight: 700, color: "#0f172a", margin: "0 0 12px 0" }}>
              Engineered for Complete Statutory Compliance
            </h2>
            <p style={{ color: "#64748b", fontSize: "16px", margin: 0 }}>
              Never worry about missing GSTINs, manual invoice sequence gaps, or tax calculation errors.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "24px"
            }}
          >
            {[
              {
                icon: "📄",
                title: "Rule 46 A4 PDF Invoices",
                desc: "High-resolution PDF invoices rendered via Chromium with statutory HSN breakdowns, state codes, CGST/SGST/IGST, brand logo, and authorized signature."
              },
              {
                icon: "🏢",
                title: "B2B GSTIN Checkout Extension",
                desc: "Native Shopify Checkout UI extension allows corporate buyers to input and validate their 15-digit GSTIN directly on the payment page for input tax credit."
              },
              {
                icon: "🧾",
                title: "Walk-in Counter POS Billing",
                desc: "Dedicated manual billing screen with instant thermal receipt generation (80mm & 58mm formats) for retail counter handovers and offline sales."
              },
              {
                icon: "📊",
                title: "1-Click GSTR-1 Excel Exports",
                desc: "Download pre-formatted monthly Excel files conforming to GSTN Notification No. 12/2024 (Tables 4, 5, 7, 12 HSN, and 13 document sequences) for your CA."
              },
              {
                icon: "↩️",
                title: "Rule 53 Credit Notes on Refunds",
                desc: "Automatic webhook listener tracks order refunds in real time and issues sequential GST credit notes linked to the original tax invoice."
              },
              {
                icon: "⚡",
                title: "Zero-Lag BullMQ Queue",
                desc: "Background Chromium PDF generation powered by Redis ensures your Shopify storefront checkout never slows down, even during high-traffic flash sales."
              }
            ].map((f, i) => (
              <div
                key={i}
                style={{
                  background: "#ffffff",
                  padding: "28px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "14px" }}>{f.icon}</div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", margin: "0 0 8px 0" }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: "14px", color: "#64748b", margin: 0, lineHeight: 1.6 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Invoice Showcase & Demo */}
      <section
        id="demo"
        style={{
          padding: "60px 20px",
          maxWidth: "1000px",
          margin: "0 auto",
          textAlign: "center"
        }}
      >
        <h2 style={{ fontSize: "30px", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
          Sample Invoice Formats
        </h2>
        <p style={{ color: "#64748b", fontSize: "16px", marginBottom: "36px" }}>
          Every invoice generated strictly satisfies Section 31 of the CGST Act.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", textAlign: "left" }}>
          {/* A4 Tax Invoice Card */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.04)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ fontWeight: 700, fontSize: "16px", color: "#111827" }}>Standard A4 GST Tax Invoice</span>
              <span style={{ fontSize: "12px", background: "#f1f5f9", padding: "2px 8px", borderRadius: "6px" }}>Online Orders</span>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "16px", fontSize: "12px", background: "#fafafa" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #ddd", paddingBottom: "8px", marginBottom: "8px" }}>
                <div><strong>YOUR BRAND PRIVATE LIMITED</strong><br />GSTIN: 27AABCA1234A1Z5</div>
                <div style={{ textAlign: "right" }}><strong>TAX INVOICE</strong><br />INV/26-27/0042</div>
              </div>
              <div style={{ color: "#6b7280", marginBottom: "10px" }}>
                Buyer: Corporate Customer LLP &bull; Buyer GSTIN: 29AABCC5678B1Z2 &bull; POS: 29 (Karnataka)
              </div>
              <div style={{ background: "#fff", border: "1px solid #eee", padding: "8px", marginBottom: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Specialty Coffee Beans (1kg) &bull; HSN: 0901</span>
                  <span>₹1,142.86</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#666" }}>
                  <span>IGST (5% Inter-State)</span>
                  <span>₹57.14</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid #ddd", paddingTop: "6px" }}>
                <span>Grand Total (INR):</span>
                <span>₹1,200.00</span>
              </div>
            </div>
          </div>

          {/* POS Thermal Receipt Card */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.04)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ fontWeight: 700, fontSize: "16px", color: "#111827" }}>80mm / 58mm Thermal Receipt</span>
              <span style={{ fontSize: "12px", background: "#f0fdf4", color: "#166534", padding: "2px 8px", borderRadius: "6px" }}>Walk-in POS</span>
            </div>
            <div style={{ border: "1px dashed #999", borderRadius: "8px", padding: "16px", fontSize: "12px", background: "#fafafa" }}>
              <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "8px", marginBottom: "8px" }}>
                <strong>YOUR STORE ROASTERS</strong><br />
                POS RECEIPT &bull; Inv: POS-8421<br />
                GSTIN: 27AABCA1234A1Z5
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>1x Arabica Filter Roast</span>
                <span>₹600.00</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#555" }}>
                <span>CGST (2.5%) + SGST (2.5%)</span>
                <span>₹28.57</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "4px 0", marginTop: "6px" }}>
                <span>TOTAL PAID (UPI):</span>
                <span>₹600.00</span>
              </div>
              <div style={{ textAlign: "center", fontSize: "10px", marginTop: "8px", color: "#666" }}>
                * Thank you for choosing us! *
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section
        id="pricing"
        style={{
          background: "#f8fafc",
          padding: "60px 20px",
          borderTop: "1px solid #f1f5f9",
          borderBottom: "1px solid #f1f5f9"
        }}
      >
        <div style={{ maxWidth: "1140px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h2 style={{ fontSize: "30px", fontWeight: 700, color: "#0f172a", margin: "0 0 12px 0" }}>
              Simple, Transparent Pricing
            </h2>
            <p style={{ color: "#64748b", fontSize: "16px", margin: 0 }}>
              All plans include a 3-day free trial. Billed conveniently through your regular monthly Shopify invoice.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "24px"
            }}
          >
            {plans.map((p) => {
              const isPopular = p.id === "GROWTH";
              return (
                <div
                  key={p.id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "16px",
                    border: isPopular ? "2px solid #008060" : "1px solid #e2e8f0",
                    padding: "32px 24px",
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    boxShadow: isPopular ? "0 10px 25px rgba(0,128,96,0.1)" : "none"
                  }}
                >
                  {isPopular && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-12px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "#008060",
                        color: "#fff",
                        padding: "4px 12px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase"
                      }}
                    >
                      Most Popular
                    </div>
                  )}

                  <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px 0", color: "#111827" }}>
                    {p.name}
                  </h3>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "16px" }}>
                    <span style={{ fontSize: "36px", fontWeight: 800, color: "#0f172a" }}>
                      ${p.priceUsd}
                    </span>
                    <span style={{ color: "#64748b", fontSize: "14px" }}>/ month</span>
                    <span style={{ color: "#94a3b8", fontSize: "13px" }}>(approx. ₹{p.priceInr})</span>
                  </div>

                  <div style={{ fontSize: "13px", color: "#008060", fontWeight: 700, marginBottom: "20px" }}>
                    {p.orderLimit === "UNLIMITED" ? "Unlimited Invoices / month" : `Up to ${p.orderLimit.toLocaleString()} Invoices / month`}
                  </div>

                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px 0", flex: 1 }}>
                    {p.features.map((feat, idx) => (
                      <li key={idx} style={{ fontSize: "13px", color: "#475569", marginBottom: "10px", display: "flex", gap: "8px" }}>
                        <span style={{ color: "#008060" }}>✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href="#install"
                    style={{
                      display: "block",
                      textAlign: "center",
                      background: isPopular ? "#008060" : "#f1f5f9",
                      color: isPopular ? "#ffffff" : "#1e293b",
                      padding: "12px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      textDecoration: "none",
                      fontSize: "14px"
                    }}
                  >
                    Start 3-Day Free Trial
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid #f1f2f4",
          padding: "32px 20px",
          textAlign: "center",
          fontSize: "13px",
          color: "#6b7280"
        }}
      >
        <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            &copy; {new Date().getFullYear()} GST Pro Invoicing &bull; Indian Statutory GST Compliance App
          </div>
          <div style={{ display: "flex", gap: "20px" }}>
            <Link to="/privacy" style={{ color: "#4b5563", textDecoration: "none" }}>
              Privacy Policy
            </Link>
            <Link to="/terms" style={{ color: "#4b5563", textDecoration: "none" }}>
              Terms of Service
            </Link>
            <Link to="/data-policy" style={{ color: "#4b5563", textDecoration: "none" }}>
              Data &amp; GDPR Policy
            </Link>
            <Link to="/admin" style={{ color: "#008060", textDecoration: "none", fontWeight: 600 }}>
              Admin Portal ⚡
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
