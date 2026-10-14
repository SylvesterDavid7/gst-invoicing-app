import { type MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Data Usage & Security Policy - GST Pro Invoicing" },
    { name: "description", content: "Data handling, storage architecture, encryption, and GDPR compliance details." }
  ];
};

export default function DataPolicyPage() {
  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", color: "#202223", lineHeight: 1.6, background: "#f9fafb", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", background: "#ffffff", padding: "40px", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ borderBottom: "2px solid #008060", paddingBottom: "16px", marginBottom: "28px" }}>
          <span style={{ fontSize: "28px" }}>🛡️</span>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "8px 0 4px 0", color: "#111827" }}>Data Protection &amp; Security Architecture</h1>
          <p style={{ color: "#6b7280", fontSize: "14px", margin: 0 }}>GST Pro Invoicing &bull; Multi-Tenant Security Standards</p>
        </div>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>1. Multi-Tenant Data Isolation</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            Every merchant account on GST Pro Invoicing operates in a strictly isolated tenant scope. All database transactions (Invoices, Credit Notes, Settings, Tax Sequences, and POS counter bills) are strictly partitioned by unique <code>storeId</code> foreign keys. Merchants can never view, query, or access another store&apos;s data or customer orders.
          </p>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>2. Encryption In Transit &amp; At Rest</h2>
          <ul style={{ fontSize: "14px", color: "#4b5563", paddingLeft: "20px" }}>
            <li><strong>In Transit:</strong> All HTTP traffic is protected by TLS 1.3 encryption with automatic Let&apos;s Encrypt SSL certificates managed by our Caddy reverse proxy. Direct plaintext HTTP traffic is permanently redirected to HTTPS.</li>
            <li><strong>At Rest:</strong> PostgreSQL records are hosted on encrypted SSD volumes with TLS-enforced database pooling. S3/R2 storage buckets utilize AES-256 server-side encryption.</li>
          </ul>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>3. Shopify API Scope Minimization</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            In accordance with the principle of least privilege, our app requests only the minimum Shopify OAuth permissions necessary to calculate taxes, generate invoices, and fulfill orders:
          </p>
          <ul style={{ fontSize: "14px", color: "#4b5563", paddingLeft: "20px" }}>
            <li><code>read_orders, write_orders</code>: To read order amounts, line items, and attach invoice PDF links to order metafields.</li>
            <li><code>read_products</code>: To fetch product HSN codes and tax categories.</li>
            <li><code>read_customer_events</code>: To support checkout extension B2B GSTIN input validation.</li>
          </ul>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>4. GDPR / Mandatory Compliance Implementation</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            We implement and actively monitor all three mandatory Shopify compliance endpoints:
          </p>
          <div style={{ background: "#f3f4f6", padding: "14px", borderRadius: "8px", fontSize: "13px", color: "#374151" }}>
            <div>&bull; <code>/webhooks/customers/data-request</code> &mdash; Customer data request processing.</div>
            <div style={{ margin: "4px 0" }}>&bull; <code>/webhooks/customers/redact</code> &mdash; Customer data anonymization/redaction.</div>
            <div>&bull; <code>/webhooks/shop/redact</code> &mdash; Complete store credential revocation 48h after uninstallation.</div>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>5. Security Inquiries</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            For security assessments or vulnerability disclosure, please contact:
            <br />
            <strong>Security Team:</strong> security@inaragroups.com
          </p>
        </section>
      </div>
    </div>
  );
}
