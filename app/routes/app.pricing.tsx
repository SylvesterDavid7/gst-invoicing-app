import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs
} from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Grid,
  BlockStack,
  Text,
  Badge,
  Button,
  List,
  ProgressBar,
  Banner,
  Divider,
  InlineStack,
  Box
} from "@shopify/polaris";
import { prisma } from "../db.server";
import { BILLING_PLANS } from "../services/billing/billing-plans";
import {
  createShopifySubscriptionCharge,
  isStoreTrialActive,
  getRemainingTrialDays
} from "../services/billing/billing-plans.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const shopDomain = "quickstart-demo.myshopify.com";

  let store = await prisma.store.findUnique({
    where: { shopifyDomain: shopDomain }
  });

  if (!store) {
    store = {
      id: "demo",
      shopifyDomain: shopDomain,
      plan: "STARTER",
      monthlyOrderUsage: 12,
      createdAt: new Date(),
      trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    } as any;
  }

  const currentPlanId = store?.plan || "STARTER";
  const currentPlan = BILLING_PLANS[currentPlanId] || BILLING_PLANS.STARTER;
  const currentUsage = store?.monthlyOrderUsage || 0;
  const isTrial = isStoreTrialActive(store as any);
  const remainingDays = getRemainingTrialDays(store as any);

  const usagePercent =
    currentPlan.orderLimit === "UNLIMITED"
      ? 15
      : Math.min(Math.round((currentUsage / (currentPlan.orderLimit as number)) * 100), 100);

  return json({
    store,
    currentPlanId,
    currentUsage,
    usagePercent,
    isTrial,
    remainingDays,
    plans: Object.values(BILLING_PLANS)
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const targetPlan = String(formData.get("planId") || "STARTER") as "STARTER" | "GROWTH" | "PRO";

  const shopDomain = "quickstart-demo.myshopify.com";
  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shopDomain }
  });

  if (!store) {
    return json({ error: "Store not found" }, { status: 400 });
  }

  const url = new URL(request.url);
  const returnUrl = `${url.origin}/app/pricing?upgraded=true`;

  try {
    const { confirmationUrl, subscriptionId } =
      await createShopifySubscriptionCharge(
        store.shopifyDomain,
        store.accessToken,
        targetPlan,
        returnUrl
      );

    await prisma.store.update({
      where: { id: store.id },
      data: { subscriptionId, plan: targetPlan as any }
    });

    return redirect(confirmationUrl);
  } catch (err: any) {
    // In local demo / development mode
    await prisma.store.update({
      where: { id: store.id },
      data: { plan: targetPlan as any }
    });
    return json({ success: true, mockUpgraded: true, targetPlan });
  }
}

export default function PricingPage() {
  const { currentPlanId, currentUsage, usagePercent, isTrial, remainingDays, plans } =
    useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const handleSelectPlan = (planId: string) => {
    const fd = new FormData();
    fd.append("planId", planId);
    submit(fd, { method: "POST" });
  };

  const isSubmitting = navigation.state === "submitting";

  return (
    <Page
      title="Plans & Billing"
      subtitle="Start your 3-Day Full Access Free Trial. Pick a plan to automate your GST invoicing with zero interruptions."
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <BlockStack gap="500">
        {/* Trial Status Banner */}
        {isTrial ? (
          <Banner title="🎁 3-Day Free Trial Active (Full Access)" tone="success">
            <p>
              You have <strong>{remainingDays} days remaining</strong> of full access to all Pro features
              (including GSTR-1 Excel exports, B2B GSTIN collection, and digital signature stamps). Choose a
              plan below to ensure uninterrupted billing once your trial concludes.
            </p>
          </Banner>
        ) : (
          <Banner title="Trial Concluded - Select a Plan" tone="warning">
            <p>
              Your 3-day trial has ended. Select a plan below to continue automatically issuing compliant
              statutory GST Tax Invoices.
            </p>
          </Banner>
        )}

        {/* Current Plan & Quota Card */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <div>
                <Text as="h2" variant="headingMd">
                  Current Selected Plan:{" "}
                  <Badge tone={currentPlanId === "PRO" ? "success" : "info"}>
                    {BILLING_PLANS[currentPlanId]?.name || "Starter"}
                  </Badge>
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {isTrial
                    ? "✨ Full access granted during your 3-day trial period."
                    : "Monthly quota resets at the start of each billing cycle."}
                </Text>
              </div>
              <div style={{ textAlign: "right" }}>
                <Text as="p" variant="headingLg">
                  {currentUsage}{" "}
                  <Text as="span" variant="bodySm" tone="subdued">
                    /{" "}
                    {BILLING_PLANS[currentPlanId]?.orderLimit === "UNLIMITED"
                      ? "∞ Unlimited"
                      : `${BILLING_PLANS[currentPlanId]?.orderLimit} orders`}
                  </Text>
                </Text>
              </div>
            </InlineStack>

            <ProgressBar progress={usagePercent} size="small" tone="highlight" />
          </BlockStack>
        </Card>

        {/* Pricing Cards Grid ($6, $12, $19) */}
        <Grid>
          {plans.map((plan: any) => {
            const isCurrent = plan.id === currentPlanId;

            return (
              <Grid.Cell key={plan.id} columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingLg">
                        {plan.name}
                      </Text>
                      {plan.badge ? (
                        <Badge tone="attention">{plan.badge}</Badge>
                      ) : isCurrent ? (
                        <Badge tone="success">Active</Badge>
                      ) : null}
                    </InlineStack>

                    <div>
                      <Text as="p" variant="heading2xl">
                        ${plan.priceUsd}
                        <Text as="span" variant="bodySm" tone="subdued">
                          {" "}
                          / month
                        </Text>
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        (approx. ₹{plan.priceInr} INR &bull; 3-Day Free Trial included)
                      </Text>
                    </div>

                    <Divider />

                    <BlockStack gap="200">
                      <Text as="p" variant="bodySm" fontWeight="bold">
                        Included Features:
                      </Text>
                      <List type="bullet">
                        {plan.features.map((f: string, i: number) => (
                          <List.Item key={i}>{f}</List.Item>
                        ))}
                      </List>
                    </BlockStack>

                    <Button
                      variant={isCurrent ? "secondary" : "primary"}
                      disabled={isSubmitting}
                      onClick={() => handleSelectPlan(plan.id)}
                      fullWidth
                    >
                      {isCurrent ? "Current Plan" : `Start 3-Day Trial ($${plan.priceUsd}/mo)`}
                    </Button>
                  </BlockStack>
                </Card>
              </Grid.Cell>
            );
          })}
        </Grid>

        <Banner tone="info">
          <Text as="p" variant="bodySm">
            <strong>🔒 Risk-Free Billing:</strong> You will not be charged by Shopify until your 3-day trial
            ends. You can switch plans or cancel at any time directly through your Shopify App admin.
          </Text>
        </Banner>
      </BlockStack>
    </Page>
  );
}
