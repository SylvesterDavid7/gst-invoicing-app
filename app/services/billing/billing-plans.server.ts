import { prisma } from "../../db.server";
import { BILLING_PLANS, type PlanConfig } from "./billing-plans";
export { BILLING_PLANS, type PlanConfig };

/**
 * Checks if a store is currently in its 3-day full access free trial
 */
export function isStoreTrialActive(store: { createdAt: Date; trialEndsAt?: Date | null }): boolean {
  if (store.trialEndsAt) {
    return new Date() < new Date(store.trialEndsAt);
  }
  // Default: 3 days from store account creation
  const trialEnd = new Date(store.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
  return new Date() < trialEnd;
}

/**
 * Get remaining trial hours/days
 */
export function getRemainingTrialDays(store: { createdAt: Date; trialEndsAt?: Date | null }): number {
  const trialEnd = store.trialEndsAt
    ? new Date(store.trialEndsAt).getTime()
    : store.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000;
  
  const diffMs = trialEnd - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Checks if a store has exceeded its monthly order limit on its current plan
 */
export async function checkStoreOrderLimit(storeId: string): Promise<{
  canProcess: boolean;
  isTrial: boolean;
  currentUsage: number;
  limit: number | "UNLIMITED";
  plan: string;
}> {
  const store = await prisma.store.findUnique({
    where: { id: storeId }
  });

  if (!store) {
    return { canProcess: false, isTrial: false, currentUsage: 0, limit: 500, plan: "STARTER" };
  }

  // During 3-day trial: FULL UNLIMITED ACCESS
  if (isStoreTrialActive(store)) {
    return {
      canProcess: true,
      isTrial: true,
      currentUsage: store.monthlyOrderUsage || 0,
      limit: "UNLIMITED",
      plan: store.plan
    };
  }

  const planConfig = BILLING_PLANS[store.plan || "STARTER"] || BILLING_PLANS.STARTER;
  const currentUsage = store.monthlyOrderUsage || 0;

  if (planConfig.orderLimit === "UNLIMITED") {
    return { canProcess: true, isTrial: false, currentUsage, limit: "UNLIMITED", plan: store.plan };
  }

  const canProcess = currentUsage < planConfig.orderLimit;
  return {
    canProcess,
    isTrial: false,
    currentUsage,
    limit: planConfig.orderLimit,
    plan: store.plan
  };
}

/**
 * Increments the monthly order usage for a store
 */
export async function incrementStoreOrderUsage(storeId: string) {
  await prisma.store.update({
    where: { id: storeId },
    data: {
      monthlyOrderUsage: { increment: 1 }
    }
  });
}

/**
 * GraphQL mutation to request a recurring application charge with a 3-day trial via Shopify Billing API
 */
export async function createShopifySubscriptionCharge(
  shopDomain: string,
  accessToken: string,
  planId: "STARTER" | "GROWTH" | "PRO",
  returnUrl: string
) {
  const plan = BILLING_PLANS[planId];
  if (!plan) {
    throw new Error(`Invalid plan selected: ${planId}`);
  }

  const mutation = `
    mutation AppSubscriptionCreate(
      $name: String!
      $lineItems: [AppSubscriptionLineItemInput!]!
      $returnUrl: URL!
      $trialDays: Int
      $test: Boolean
    ) {
      appSubscriptionCreate(
        name: $name
        lineItems: $lineItems
        returnUrl: $returnUrl
        trialDays: $trialDays
        test: $test
      ) {
        appSubscription {
          id
        }
        confirmationUrl
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    name: `GST Pro - ${plan.name} Plan`,
    returnUrl,
    trialDays: 3, // Mandatory 3-day free trial on all plans!
    test: process.env.NODE_ENV !== "production",
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: {
              amount: plan.priceUsd,
              currencyCode: "USD"
            },
            interval: "EVERY_30_DAYS"
          }
        }
      }
    ]
  };

  const response = await fetch(`https://${shopDomain}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    },
    body: JSON.stringify({ query: mutation, variables })
  });

  const json = (await response.json()) as any;
  if (json.errors || json.data?.appSubscriptionCreate?.userErrors?.length > 0) {
    throw new Error(
      json.errors?.[0]?.message ||
        json.data?.appSubscriptionCreate?.userErrors?.[0]?.message ||
        "Shopify billing failed"
    );
  }

  return {
    confirmationUrl: json.data.appSubscriptionCreate.confirmationUrl as string,
    subscriptionId: json.data.appSubscriptionCreate.appSubscription?.id as string
  };
}
