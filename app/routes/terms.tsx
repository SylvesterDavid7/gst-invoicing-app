import { type MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Terms of Service - GST Pro Invoicing" },
    { name: "description", content: "Terms of service and subscription agreement for GST Pro Invoicing Shopify App." }
  ];
};

export default function TermsOfServicePage() {
  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", color: "#202223", lineHeight: 1.6, background: "#f9fafb", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", background: "#ffffff", padding: "40px", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ borderBottom: "2px solid #008060", paddingBottom: "16px", marginBottom: "28px" }}>
          <span style={{ fontSize: "28px" }}>📜</span>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "8px 0 4px 0", color: "#111827" }}>Terms of Service</h1>
          <p style={{ color: "#6b7280", fontSize: "14px", margin: 0 }}>Effective Date: October 2026 &bull; GST Pro Invoicing</p>
        </div>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>1. Acceptance of Terms</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            By installing or using the GST Pro Invoicing app (&quot;the Service&quot;) from the Shopify App Store, you agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a company or legal entity, you represent that you have the authority to bind such entity.
          </p>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>2. Scope of Service</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            GST Pro Invoicing provides automated Indian Goods and Services Tax (GST) invoice generation, sequential numbering, credit note issuance, B2B tax validation, POS manual counter billing, customer invoice delivery, and monthly GSTR-1 Excel export summaries.
          </p>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>3. Subscriptions, Free Trials &amp; Payments</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            The Service operates under three subscription tiers (Starter, Growth, and Enterprise Pro). All billing and subscription charges are processed exclusively through <strong>Shopify&apos;s Recurring Application Charge API</strong>:
          </p>
          <ul style={{ fontSize: "14px", color: "#4b5563", paddingLeft: "20px" }}>
            <li><strong>3-Day Free Trial:</strong> All paid plans include a 3-day free trial with full feature access. You will not be billed by Shopify until the trial period concludes.</li>
            <li><strong>Billing Cycle:</strong> Subscriptions are billed on a recurring 30-day cycle via your standard Shopify invoice.</li>
            <li><strong>Cancellations:</strong> You may cancel at any time by uninstalling the application from your Shopify Admin panel or downgrading your plan. Shopify automatically terminates subscription billing upon app uninstallation.</li>
          </ul>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>4. Merchant Responsibilities &amp; Tax Accuracy</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            The merchant is solely responsible for ensuring the legal accuracy of their business configuration, including registered GSTIN, legal business name, registered address, applicable HSN codes, and configured tax rates (CGST/SGST/IGST). While the Service calculates taxes in accordance with Indian GST statutes, the ultimate responsibility for tax filing and return submission rests with the registered merchant entity.
          </p>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>5. Service Availability &amp; Uptime</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            We strive to maintain a 99.9% uptime across our redundant web servers, BullMQ queue workers, and database clusters. We are not liable for transient disruptions arising from Shopify API rate limits, third-party internet service disruptions, or scheduled maintenance windows.
          </p>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>6. Limitation of Liability</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            To the maximum extent permitted by law, GST Pro Invoicing shall not be liable for any indirect, incidental, punitive, or consequential damages resulting from your use of the Service or any discrepancies in statutory tax returns.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>7. Contact Information</h2>
          <p style={{ fontSize: "14px", color: "#4b5563" }}>
            Questions regarding these Terms of Service may be directed to:
            <br />
            <strong>Email:</strong> legal@inaragroups.com
            <br />
            <strong>Support:</strong> https://itskoop.inaragroups.com
          </p>
        </section>
      </div>
    </div>
  );
}
