import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs
} from "@remix-run/node";
import { useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Select,
  Button,
  List
} from "@shopify/polaris";
import { useState } from "react";
import { prisma } from "../db.server";
import { generateGstr1Excel } from "../services/gstr1/gstr1-exporter.server";

import { getActiveStore } from "../services/store/store.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const store = await getActiveStore(request);
  return json({ store });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const month = parseInt(String(formData.get("month") || "10"), 10);
  const year = parseInt(String(formData.get("year") || "2026"), 10);

  // Fetch store from database
  const store = await getActiveStore(request);

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
  const { store } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  const [month, setMonth] = useState("10"); // October
  const [year, setYear] = useState("2026");

  const shopQuery = store ? `&shop=${encodeURIComponent(store.shopifyDomain)}` : "";

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

  const isExporting = navigation.state === "submitting";

  return (
    <Page
      title="CA Reporting & GSTR-1 Exports"
      subtitle="Export government-compliant GSTR-1 Excel workbooks partitioned into Tables 4, 5, 7, 12 & 13"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <div>
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

                <div style={{ marginTop: "12px" }}>
                  <a
                    href={`/api/reports/gstr1?month=${month}&year=${year}${shopQuery}`}
                    download
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      backgroundColor: "#008060",
                      color: "#ffffff",
                      padding: "10px 22px",
                      borderRadius: "8px",
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: "14px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      cursor: "pointer"
                    }}
                  >
                    📥 Download GSTR-1 Excel (.xlsx)
                  </a>
                </div>
              </BlockStack>
            </div>
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
