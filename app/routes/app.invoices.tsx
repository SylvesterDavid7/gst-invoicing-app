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
import { getActiveStore } from "../services/store/store.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const activeStore = await getActiveStore(request);

  const invoices = activeStore
    ? await prisma.invoice.findMany({
        where: { storeId: activeStore.id },
        include: { creditNote: true },
        orderBy: { invoiceDate: "desc" },
        take: 100
      })
    : [];

  return json({ invoices, activeStore });
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
    <InlineStack gap="100" wrap={false}>
      <Button url={`/app/receipt/${inv.id}`} target="_blank" size="micro">
        🖨️ POS Receipt
      </Button>
      {inv.pdfUrl ? (() => {
        const match = inv.pdfUrl.match(/\/invoices\/[^\s'"]+/);
        const pdfHref = match ? match[0] : (inv.pdfUrl.startsWith("/") ? inv.pdfUrl : `/${inv.pdfUrl}`);
        return (
          <Button url={pdfHref} target="_blank" size="micro" variant="plain">
            A4 PDF
          </Button>
        );
      })() : (
        <Text as="span" tone="subdued">PDF Pending</Text>
      )}
    </InlineStack>
  ]);

  return (
    <Page
      title="Tax Invoices & Credit Notes"
      subtitle="Complete chronological audit trail of all issued GST statutory documents"
      backAction={{ content: "Dashboard", url: "/app" }}
      primaryAction={{ content: "+ Create POS Bill", url: "/app/billing" }}
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

            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
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
            </div>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
