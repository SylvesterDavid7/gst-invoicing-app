import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  DataTable,
  Badge,
  Button,
  BlockStack,
  InlineStack,
  Text,
  TextField
} from "@shopify/polaris";
import { useState } from "react";
import { prisma } from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const shopDomain = "quickstart-demo.myshopify.com";

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shopDomain }
  });

  const invoices = store
    ? await prisma.invoice.findMany({
        where: { storeId: store.id },
        include: { creditNote: true },
        orderBy: { invoiceDate: "desc" },
        take: 50
      })
    : [];

  return json({ invoices });
}

export default function InvoicesListPage() {
  const { invoices } = useLoaderData<typeof loader>();
  const [search, setSearch] = useState("");

  const filteredInvoices = invoices.filter((inv: any) => {
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.orderNumber.toLowerCase().includes(q) ||
      (inv.buyerGstin && inv.buyerGstin.toLowerCase().includes(q)) ||
      (inv.buyerCompanyName && inv.buyerCompanyName.toLowerCase().includes(q))
    );
  });

  const rows = filteredInvoices.map((inv: any) => [
    inv.invoiceNumber,
    `#${inv.orderNumber}`,
    new Date(inv.invoiceDate).toLocaleDateString("en-IN"),
    inv.buyerGstin ? <Badge tone="success">{`B2B: ${inv.buyerGstin}`}</Badge> : <Badge tone="info">B2C</Badge>,
    `POS: ${inv.posStateCode}`,
    inv.isInterState ? "IGST" : "CGST+SGST",
    `₹${inv.grandTotal}`,
    inv.creditNote ? <Badge tone="critical">{inv.creditNote.creditNoteNo}</Badge> : <Badge tone="success">Active</Badge>,
    inv.pdfUrl ? (
      <Button url={inv.pdfUrl} target="_blank" size="micro" variant="plain">
        Download PDF
      </Button>
    ) : (
      <Text as="span" tone="subdued">Pending</Text>
    )
  ]);

  return (
    <Page
      title="Tax Invoices & Credit Notes"
      subtitle="Complete chronological audit trail of all issued GST statutory documents"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <TextField
              label="Search Invoices"
              labelHidden
              placeholder="Search by Invoice Number, Order ID, GSTIN, or Customer Name..."
              value={search}
              onChange={setSearch}
              autoComplete="off"
              clearButton
              onClearButtonClick={() => setSearch("")}
            />

            <DataTable
              columnContentTypes={[
                "text",
                "text",
                "text",
                "text",
                "text",
                "text",
                "numeric",
                "text",
                "text"
              ]}
              headings={[
                "Invoice No",
                "Order",
                "Date",
                "Type / GSTIN",
                "Place of Supply",
                "Tax Mode",
                "Total Amount",
                "Status / CN",
                "Actions"
              ]}
              rows={rows}
            />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
