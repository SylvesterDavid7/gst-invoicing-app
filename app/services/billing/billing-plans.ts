export interface PlanConfig {
  id: "STARTER" | "GROWTH" | "PRO";
  name: string;
  priceUsd: number;
  priceInr: number;
  trialDays: number;
  orderLimit: number | "UNLIMITED";
  badge?: string;
  features: string[];
}

export const BILLING_PLANS: Record<string, PlanConfig> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    priceUsd: 6.0,
    priceInr: 499,
    trialDays: 3,
    orderLimit: 500,
    features: [
      "🎁 3-Day Free Trial (Full Access)",
      "Up to 500 GST Invoices / month",
      "Statutory Rule 46 A4 PDF Invoices",
      "B2B GSTIN Checkout UI Extension",
      "Customer 'Thank You' Page PDF Download",
      "Shopify Order Confirmation Email Invoice Link",
      "Automatic Rule 53 Credit Notes on Refunds",
      "Store Logo & Branding",
      "Automated Shopify Order Metafield Sync"
    ]
  },
  GROWTH: {
    id: "GROWTH",
    name: "Growth",
    priceUsd: 12.0,
    priceInr: 999,
    trialDays: 3,
    orderLimit: 2500,
    badge: "Most Popular",
    features: [
      "🎁 3-Day Free Trial (Full Access)",
      "Up to 2,500 Invoices / month",
      "Everything in Starter Plan",
      "1-Click Monthly GSTR-1 Excel Exports (CA-Ready)",
      "Custom Digital Signature & Seal Stamp",
      "Composite Supply Shipping Tax Engine",
      "Automated State Code & Tax Breakdown"
    ]
  },
  PRO: {
    id: "PRO",
    name: "Enterprise Pro",
    priceUsd: 19.0,
    priceInr: 1599,
    trialDays: 3,
    orderLimit: "UNLIMITED",
    badge: "Unlimited Scale",
    features: [
      "🎁 3-Day Free Trial (Full Access)",
      "Unlimited Invoices / month",
      "Everything in Growth Plan",
      "High-Volume Parallel Queue Processing",
      "Automatic April 1st Fiscal Year Rollover",
      "Unlimited Historical Invoice & Credit Note Storage",
      "Priority Audit & Export Access"
    ]
  }
};
