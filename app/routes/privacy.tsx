import { type MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy - GST Pro Invoicing" },
    { name: "description", content: "Privacy policy and data protection practices for GST Pro Invoicing Shopify App." }
  ];
};

export default function PrivacyPolicyPage() {
  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", color: "#202223", lineHeight: 1.6, background: "#f9fafb", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", background: "#ffffff", padding: "40px", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ borderBottom: "2px solid #008060", paddingBottom: "16px", marginBottom: "28px" }}>
          <span style={{ fontSize: "28px" }}>⚡</span>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "8px 0 4px 0", color: "#111827" }}>Privacy Policy</h1>
          <p style={{ color: "#6b7280", fontSize: "14px", margin: 0 }}>Last updated: October 2026 &bull; GST Pro Invoicing</p>
        </div>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>1. Overview</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            GST Pro Invoicing (&quot;we&quot;, &quot;our&quot;, or &quot;the App&quot;) provides automated Goods and Services Tax (GST) invoicing, B2B tax calculation, POS counter billing, and statutory GSTR-1 reporting for merchants operating on the Shopify platform. We are committed to safeguarding merchant and buyer data in accordance with applicable data privacy regulations and Indian Goods and Services Tax Act requirements.
          </p>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>2. Information We Collect</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            To generate legal GST-compliant tax invoices, credit notes, and statutory filings, our application processes the following data via Shopify APIs:
          </p>
          <ul style={{ fontSize: "14px", color: "#4b5563", paddingLeft: "20px" }}>
            <li><strong>Merchant Information:</strong> Store name, registered business address, GSTIN, legal trade name, logo, authorized signatory signature image, and Shopify domain.</li>
            <li><strong>Order Data:</strong> Order number, order ID, line item details, SKU, HSN codes, product pricing, applicable tax rates, discounts, and payment status.</li>
            <li><strong>Customer &amp; Shipping Details:</strong> Customer name, shipping address, billing address, email address (for transactional PDF delivery), and optional buyer B2B GSTIN.</li>
          </ul>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>3. How We Use Collected Data</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>Data collected is utilized exclusively for:</p>
          <ul style={{ fontSize: "14px", color: "#4b5563", paddingLeft: "20px" }}>
            <li>Generating statutory Rule 46 GST Tax Invoices and Rule 53 Credit Notes.</li>
            <li>Calculating state-level CGST, SGST, and IGST breakdowns for intra-state and inter-state supplies.</li>
            <li>Generating CA-ready GSTR-1 Excel reports (Tables 4, 5, 7, 12, and 13).</li>
            <li>Delivering transactional PDF invoice attachments via email to buyers upon order completion.</li>
            <li>Enabling customer invoice downloads via the Shopify Thank You and Order Status pages.</li>
          </ul>
          <p style={{ fontSize: "14px", color: "#4b5563", marginTop: "8px" }}>
            <strong>We never sell, rent, or monetize merchant or buyer personal data to third parties.</strong>
          </p>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>4. Data Retention &amp; Statutory Compliance</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            Under Section 36 of the Indian Central Goods and Services Tax (CGST) Act, 2017, registered businesses are legally obligated to maintain tax invoices, books of accounts, and credit notes for a minimum period of <strong>72 months (6 years)</strong> from the due date of filing the relevant annual return. Accordingly, invoice records are preserved for the statutory period to support tax audits and merchant compliance.
          </p>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>5. Data Security</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            All transmissions between Shopify, our web servers, and database storage are encrypted using industry-standard TLS 1.3 / SSL encryption. Database connections enforce SSL pooling with restricted access, and PDF files are stored on isolated, encrypted object storage volumes.
          </p>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>6. GDPR &amp; Merchant Rights</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            We support Shopify&apos;s mandatory compliance webhooks (<code>customers/data_request</code>, <code>customers/redact</code>, and <code>shop/redact</code>). When a customer or merchant requests deletion or exports through Shopify, we process requests in accordance with applicable privacy frameworks and statutory tax preservation rules.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>7. Contact Us</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            For privacy inquiries, audit requests, or data protection questions, please contact our privacy compliance team at:
            <br />
            <strong>Email:</strong> support@inaragroups.com
            <br />
            <strong>Subdomain:</strong> https://itskoop.inaragroups.com
          </p>
        </section>
      </div>
    </div>
  );
}
