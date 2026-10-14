import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit, useNavigation, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Grid,
  Text,
  Badge,
  DataTable,
  Button,
  BlockStack,
  InlineStack,
  Banner,
  Divider
} from "@shopify/polaris";
import { prisma } from "../db.server";
import { invoiceProcessingQueue, pdfRenderingQueue, syncDistributionQueue, enqueueOrderPaid } from "../services/queue/invoice-queue.server";
import { getActiveStore } from "../services/store/store.server";

export async function action({ request }: ActionFunctionArgs) {
  const store = await getActiveStore(request);
  if (!store) {
    return json({ success: false, error: "Store not found or unauthorized", orderNumber: 0 }, { status: 400 });
  }
  const shopDomain = store.shopifyDomain;

  const orderNum = Math.floor(1000 + Math.random() * 9000);
  const testOrder = {
    id: Date.now(),
    order_number: orderNum,
    email: "buyer@koramangalacafes.com",
    created_at: new Date().toISOString(),
    taxes_included: true,
    total_shipping_price_set: {
      shop_money: { amount: "150.00" }
    },
    shipping_address: {
      first_name: "Aarav",
      last_name: "Sharma",
      company: "Koramangala Specialty Roasters LLP",
      address1: "100 Feet Road, Indiranagar",
      city: "Bengaluru",
      province: "Karnataka",
      province_code: "KA",
      zip: "560038",
      country: "India"
    },
    note_attributes: [
      { name: "gstin", value: "29AABCU9603R1ZM" },
      { name: "company_name", value: "Koramangala Specialty Roasters LLP" }
    ],
    line_items: [
      {
        id: 101,
        title: "Monsooned Malabar Whole Beans (1kg)",
        sku: "XB-MM-1KG",
        hsn_code: "0901",
        quantity: 2,
        price: "1200.00",
        total_discount: "0.00",
        tax_lines: [{ rate: 0.05, title: "GST 5%" }]
      },
      {
        id: 102,
        title: "Precision Espresso Tamper 58.5mm",
        sku: "XB-ACC-TMPR",
        hsn_code: "8205",
        quantity: 1,
        price: "2360.00",
        total_discount: "0.00",
        tax_lines: [{ rate: 0.18, title: "GST 18%" }]
      }
    ]
  };

  await enqueueOrderPaid(shopDomain, testOrder);
  return json({ success: true, orderNumber: orderNum });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const store = await getActiveStore(request);

  const recentInvoices = store
    ? await prisma.invoice.findMany({
        where: { storeId: store.id },
        orderBy: { invoiceDate: "desc" },
        take: 10
      })
    : [];

  const totalInvoicesCount = store
    ? await prisma.invoice.count({ where: { storeId: store.id } })
    : 0;

  const b2bInvoicesCount = store
    ? await prisma.invoice.count({
        where: { storeId: store.id, buyerGstin: { not: null } }
      })
    : 0;

  let totalTaxAmount = "0.00";
  if (store) {
    const invoices = await prisma.invoice.findMany({
      where: { storeId: store.id },
      select: { totalCgst: true, totalSgst: true, totalIgst: true }
    });
    const sum = invoices.reduce((acc, inv) => {
      return acc + Number(inv.totalCgst || 0) + Number(inv.totalSgst || 0) + Number(inv.totalIgst || 0);
    }, 0);
    totalTaxAmount = sum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return json({
    store,
    recentInvoices,
    totalInvoicesCount,
    b2bInvoicesCount,
    totalTaxAmount
  });
}

export default function AppDashboard() {
  const { store, recentInvoices, totalInvoicesCount, b2bInvoicesCount, totalTaxAmount } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const isTriggering = navigation.state === "submitting";

  const handleTriggerTestOrder = () => {
    submit(null, { method: "POST" });
  };

  const rows = recentInvoices.map((inv: any) => [
    inv.invoiceNumber,
    `#${inv.orderNumber}`,
    inv.buyerCompanyName || "Retail Customer",
    inv.buyerGstin ? <Badge tone="success">{inv.buyerGstin}</Badge> : <Badge tone="info">B2C</Badge>,
    `₹${inv.grandTotal}`,
    inv.isInterState ? "IGST (Inter)" : "CGST+SGST (Intra)",
    new Date(inv.invoiceDate).toLocaleDateString("en-IN"),
    inv.pdfUrl ? (
      <Button url={inv.pdfUrl} target="_blank" size="micro" variant="plain">
        Download PDF
      </Button>
    ) : (
      <Badge tone="attention">Rendering...</Badge>
    )
  ]);

  return (
    <Page
      title="GST Invoicing Overview"
      subtitle="Automated Statutory Invoicing, B2B Tax Credit Engine & GSTR-1 Compliance"
      primaryAction={{
        content: "Export GSTR-1 Excel",
        url: "/app/reports"
      }}
      secondaryActions={[
        {
          content: "Store Settings",
          url: "/app/settings"
        }
      ]}
    >
      <BlockStack gap="500">
        {actionData?.success && (
          <Banner title="Test Order Enqueued Successfully!" tone="success">
            <p>
              Order #{actionData.orderNumber} has been added to the BullMQ queue in Upstash Redis.
              Watch your worker terminal process the tax computation, sequence numbering, and PDF rendering!
            </p>
          </Banner>
        )}
        {!store && (
          <Banner title="Action Required: Setup Store GST Profile" tone="warning">
            <p>
              Please navigate to <Link to="/app/settings">Settings</Link> to configure your 15-digit GSTIN,
              origin state code, and registered address to start auto-generating invoices.
            </p>
          </Banner>
        )}

        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Total Invoices Issued
                </Text>
                <Text as="p" variant="heading2xl">
                  {totalInvoicesCount}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Current FY: {store?.currentFiscalYear || "26-27"}
                </Text>
              </BlockStack>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  B2B Tax Credit Orders
                </Text>
                <Text as="p" variant="heading2xl">
                  {b2bInvoicesCount}
                </Text>
                <Text as="p" variant="bodySm" tone="success">
                  GSTR-1 Table 4 Eligible
                </Text>
              </BlockStack>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Current Sequence
                </Text>
                <Text as="p" variant="heading2xl">
                  #{store?.invoiceSequence || 0}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Next: {store?.invoicePrefix || "INV"}/{store?.currentFiscalYear || "26-27"}/
                  {String((store?.invoiceSequence || 0) + 1).padStart(4, "0")}
                </Text>
              </BlockStack>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Total GST Computed
                </Text>
                <Text as="p" variant="heading2xl">
                  ₹{totalTaxAmount}
                </Text>
                <InlineStack gap="100" align="start">
                  <Badge tone="success">🟢 Auto-Invoicing Active</Badge>
                </InlineStack>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Recent Generated Invoices
                  </Text>
                  <Button variant="plain" url="/app/invoices">
                    View All
                  </Button>
                </InlineStack>

                {recentInvoices.length === 0 ? (
                  <Text as="p" tone="subdued">
                    No invoices generated yet. Webhook listening on <code>orders/paid</code>.
                  </Text>
                ) : (
                  <DataTable
                    columnContentTypes={[
                      "text",
                      "text",
                      "text",
                      "text",
                      "numeric",
                      "text",
                      "text",
                      "text"
                    ]}
                    headings={[
                      "Invoice No",
                      "Order",
                      "Customer / Company",
                      "GSTIN Type",
                      "Grand Total",
                      "Tax Type",
                      "Date",
                      "Actions"
                    ]}
                    rows={rows}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
