import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs
} from "@remix-run/node";
import { useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Select,
  Button,
  Banner,
  List
} from "@shopify/polaris";
import { useState } from "react";
import { prisma } from "../db.server";
import { generateGstr1Excel } from "../services/gstr1/gstr1-exporter.server";

export async function loader({ request }: LoaderFunctionArgs) {
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const month = parseInt(String(formData.get("month") || "3"), 10);
  const year = parseInt(String(formData.get("year") || "2026"), 10);

  const shopDomain = "quickstart-demo.myshopify.com";
  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shopDomain }
  });

  if (!store) {
    return json({ error: "Store not configured" }, { status: 400 });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const excelBuffer = await generateGstr1Excel({
    storeId: store.id,
    startDate,
    endDate
  });

  const filename = `GSTR1_${store.gstin}_${String(month).padStart(2, "0")}${year}.xlsx`;

  return new Response(Buffer.from(excelBuffer as ArrayBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

export default function ReportsPage() {
  const submit = useSubmit();
  const navigation = useNavigation();

  const [month, setMonth] = useState("10"); // October
  const [year, setYear] = useState("2026");

  const monthOptions = [
    { label: "January", value: "1" },
    { label: "February", value: "2" },
    { label: "March", value: "3" },
    { label: "April", value: "4" },
    { label: "May", value: "5" },
    { label: "June", value: "6" },
    { label: "July", value: "7" },
    { label: "August", value: "8" },
    { label: "September", value: "9" },
    { label: "October", value: "10" },
    { label: "November", value: "11" },
    { label: "December", value: "12" }
  ];

  const yearOptions = [
    { label: "2025", value: "2025" },
    { label: "2026", value: "2026" },
    { label: "2027", value: "2027" }
  ];

  const handleExport = () => {
    const fd = new FormData();
    fd.append("month", month);
    fd.append("year", year);
    submit(fd, { method: "POST" });
  };

  const isExporting = navigation.state === "submitting";

  return (
    <Page
      title="CA Reporting & GSTR-1 Exports"
      subtitle="Export government-compliant GSTR-1 Excel workbooks partitioned into Tables 4, 5, 7 & 12"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Select Return Period
              </Text>
              <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <Select
                    label="Filing Month"
                    options={monthOptions}
                    value={month}
                    onChange={setMonth}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Select
                    label="Filing Year"
                    options={yearOptions}
                    value={year}
                    onChange={setYear}
                  />
                </div>
              </div>

              <Button
                variant="primary"
                onClick={handleExport}
                loading={isExporting}
              >
                Download GSTR-1 Excel (.xlsx)
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                Sheets Included in Export
              </Text>
              <List type="bullet">
                <List.Item>
                  <strong>Table 4 (b2b):</strong> Invoices to registered customers with GSTIN eligible for Input Tax Credit (ITC). Captures invoice-level outward B2B taxable supplies.
                </List.Item>
                <List.Item>
                  <strong>Table 5 (b2cl):</strong> Inter-state B2C orders exceeding <strong>₹1,00,000</strong> (updated per statutory Notification No. 12/2024).
                </List.Item>
                <List.Item>
                  <strong>Table 7 (b2cs):</strong> Consolidated intra-state retail + smaller inter-state supplies (up to ₹1,00,000) grouped by Place of Supply and tax rate.
                </List.Item>
                <List.Item>
                  <strong>Table 12 (hsn):</strong> Mandatory HSN/SAC quantity and tax breakdown summary, split into B2B and B2C summaries (plus dedicated <code>hsn_b2b</code> and <code>hsn_b2c</code> worksheets).
                </List.Item>
                <List.Item>
                  <strong>Table 13 (docs):</strong> Statutory Document Summary (Invoice serial number range from-to, total issued, cancelled, and net issued).
                </List.Item>
              </List>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
