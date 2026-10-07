import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Divider,
  Box
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { GST_STATE_MAP } from "../services/tax-engine/state-codes";
import { validateGstin } from "../services/tax-engine/gstin-validator";
import { prisma } from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // In a real Shopify app, retrieve the session shop domain
  const shopDomain = "quickstart-demo.myshopify.com";

  let store = await prisma.store.findUnique({
    where: { shopifyDomain: shopDomain }
  });

  if (!store) {
    // Default initial profile
    store = {
      id: "demo-store",
      shopifyDomain: shopDomain,
      accessToken: "mock-token",
      legalName: "Acme Enterprises Private Limited",
      tradeName: "Acme Store",
      gstin: "27AABCA1234A1Z5",
      stateCode: "27",
      registeredAddress: {
        addressLine1: "101, Tech Park, Andheri East",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400069",
        country: "India"
      },
      invoicePrefix: "INV",
      creditNotePrefix: "CN",
      currentFiscalYear: "26-27",
      invoiceSequence: 0,
      creditSequence: 0,
      logoUrl: "",
      signatureUrl: "",
      termsAndConditions: "1. Goods once sold will not be returned unless damaged in transit. 2. Subject to Mumbai Jurisdiction.",
      supportEmail: "billing@acme.com",
      supportPhone: "+91 98765 43210",
      createdAt: new Date(),
      updatedAt: new Date()
    } as any;
  }

  return json({ store });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const legalName = String(formData.get("legalName") || "").trim();
  const tradeName = String(formData.get("tradeName") || "").trim();
  const gstin = String(formData.get("gstin") || "").trim().toUpperCase();
  const stateCode = String(formData.get("stateCode") || "27");
  const invoicePrefix = String(formData.get("invoicePrefix") || "INV").trim();
  const creditNotePrefix = String(formData.get("creditNotePrefix") || "CN").trim();
  const logoUrl = String(formData.get("logoUrl") || "").trim();
  const signatureUrl = String(formData.get("signatureUrl") || "").trim();
  const termsAndConditions = String(formData.get("termsAndConditions") || "").trim();

  // Validate GSTIN format
  const gstinCheck = validateGstin(gstin);
  if (!gstinCheck.isValid) {
    return json({ error: gstinCheck.error || "Invalid GSTIN format" }, { status: 400 });
  }

  const shopDomain = "quickstart-demo.myshopify.com";

  await prisma.store.upsert({
    where: { shopifyDomain: shopDomain },
    update: {
      legalName,
      tradeName,
      gstin,
      stateCode,
      invoicePrefix,
      creditNotePrefix,
      logoUrl,
      signatureUrl,
      termsAndConditions
    },
    create: {
      shopifyDomain: shopDomain,
      accessToken: "mock-token",
      legalName,
      tradeName,
      gstin,
      stateCode,
      registeredAddress: {
        addressLine1: "Registered Address Line",
        city: "City",
        state: "State",
        pincode: "400001",
        country: "India"
      },
      invoicePrefix,
      creditNotePrefix,
      currentFiscalYear: "26-27",
      logoUrl,
      signatureUrl,
      termsAndConditions
    }
  });

  return json({ success: true });
}

export default function SettingsPage() {
  const { store } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [legalName, setLegalName] = useState(store?.legalName || "");
  const [tradeName, setTradeName] = useState(store?.tradeName || "");
  const [gstin, setGstin] = useState(store?.gstin || "");
  const [stateCode, setStateCode] = useState(store?.stateCode || "27");
  const [invoicePrefix, setInvoicePrefix] = useState(store?.invoicePrefix || "INV");
  const [creditNotePrefix, setCreditNotePrefix] = useState(store?.creditNotePrefix || "CN");
  const [logoUrl, setLogoUrl] = useState(store?.logoUrl || "");
  const [signatureUrl, setSignatureUrl] = useState(store?.signatureUrl || "");
  const [terms, setTerms] = useState(store?.termsAndConditions || "");

  const stateOptions = Object.entries(GST_STATE_MAP).map(([code, item]) => ({
    label: `${code} - ${item.name}`,
    value: code
  }));

  const handleSave = () => {
    const fd = new FormData();
    fd.append("legalName", legalName);
    fd.append("tradeName", tradeName);
    fd.append("gstin", gstin);
    fd.append("stateCode", stateCode);
    fd.append("invoicePrefix", invoicePrefix);
    fd.append("creditNotePrefix", creditNotePrefix);
    fd.append("logoUrl", logoUrl);
    fd.append("signatureUrl", signatureUrl);
    fd.append("termsAndConditions", terms);
    submit(fd, { method: "POST" });
  };

  const isSaving = navigation.state === "submitting";

  return (
    <Page
      title="GST Invoicing Settings"
      subtitle="Configure statutory business details, series numbering, and invoice branding"
      primaryAction={{
        content: isSaving ? "Saving..." : "Save Settings",
        onAction: handleSave,
        loading: isSaving
      }}
    >
      <BlockStack gap="500">
        {actionData && "error" in actionData && (
          <Banner title="Configuration Error" tone="critical">
            <p>{(actionData as any).error}</p>
          </Banner>
        )}
        {actionData && "success" in actionData && (
          <Banner title="Settings Saved" tone="success">
            <p>Your GST invoicing configuration has been updated successfully.</p>
          </Banner>
        )}

        <Layout>
          <Layout.AnnotatedSection
            title="Business & GSTIN Profile"
            description="Statutory legal details that appear on the Tax Invoice issued under Rule 46 of CGST Rules."
          >
            <Card>
              <FormLayout>
                <TextField
                  label="Legal Entity Name (As on GST Certificate)"
                  value={legalName}
                  onChange={setLegalName}
                  autoComplete="off"
                />
                <TextField
                  label="Trade Name (Optional)"
                  value={tradeName}
                  onChange={setTradeName}
                  autoComplete="off"
                />
                <TextField
                  label="GSTIN (15-character statutory GST number)"
                  value={gstin}
                  onChange={(val) => setGstin(val.toUpperCase())}
                  helpText="Format: 27AABCA1234A1Z5"
                  autoComplete="off"
                />
                <Select
                  label="State of Origin (Place of Dispatch)"
                  options={stateOptions}
                  value={stateCode}
                  onChange={setStateCode}
                  helpText="Used by the calculation engine to distinguish Intra-state (CGST+SGST) vs Inter-state (IGST) sales."
                />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Invoice & Credit Note Series"
            description="Configure continuous sequential numbering format. Sequences automatically reset on April 1st."
          >
            <Card>
              <FormLayout>
                <TextField
                  label="Invoice Number Prefix"
                  value={invoicePrefix}
                  onChange={setInvoicePrefix}
                  helpText="Example: 'INV' produces INV/26-27/0001"
                  autoComplete="off"
                />
                <TextField
                  label="Credit Note Prefix"
                  value={creditNotePrefix}
                  onChange={setCreditNotePrefix}
                  helpText="Example: 'CN' produces CN/26-27/0001"
                  autoComplete="off"
                />
                <Banner tone="info">
                  <Text as="p" variant="bodySm">
                    <strong>Preview Sequence:</strong> {invoicePrefix}/26-27/0001 &bull; {creditNotePrefix}/26-27/0001
                  </Text>
                </Banner>
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Branding & Signature Stamp"
            description="Customize your invoice visual presentation and authorized signatory stamp."
          >
            <Card>
              <FormLayout>
                <TextField
                  label="Logo Image URL"
                  value={logoUrl}
                  onChange={setLogoUrl}
                  placeholder="https://yourdomain.com/cdn/logo.png"
                  autoComplete="off"
                />
                <TextField
                  label="Signature Stamp Image URL"
                  value={signatureUrl}
                  onChange={setSignatureUrl}
                  placeholder="https://yourdomain.com/cdn/signature.png"
                  autoComplete="off"
                />
                <TextField
                  label="Terms & Conditions"
                  value={terms}
                  onChange={setTerms}
                  multiline={3}
                  autoComplete="off"
                />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Customer Email Notifications"
            description="Attach your GST Invoice link directly into Shopify's native Order Confirmation & Shipping emails."
          >
            <Card>
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd">
                  Because Shopify automatically sends order emails to customers, our app syncs the invoice download URL directly to the order metafields.
                </Text>
                <Banner tone="success">
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      📋 Add to Shopify Admin &rarr; Settings &rarr; Notifications &rarr; Order Confirmation:
                    </Text>
                    <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                      <code>{`{% if order.metafields.gst_invoicing.invoice_url %}
  <p style="margin-top:16px;">
    <a href="{{ order.metafields.gst_invoicing.invoice_url.value }}" style="color:#008060;font-weight:bold;text-decoration:underline;">
      📄 Download Official GST Tax Invoice (PDF)
    </a>
  </p>
{% endif %}`}</code>
                    </Box>
                  </BlockStack>
                </Banner>
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>
      </BlockStack>
    </Page>
  );
}
