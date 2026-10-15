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
import { getActiveStore } from "../services/store/store.server";

export async function loader({ request }: LoaderFunctionArgs) {
  let store = await getActiveStore(request);

  if (!store) {
    const url = new URL(request.url);
    const domain = url.searchParams.get("shop") || "xbrews-gst-demo.myshopify.com";
    // Default initial profile
    store = {
      id: "demo-store",
      shopifyDomain: domain,
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
      brandColor: "#008060",
      bankDetails: {
        bankName: "",
        accountNumber: "",
        ifsc: "",
        accountName: "",
        upiId: ""
      },
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
  const brandColor = String(formData.get("brandColor") || "#008060").trim();
  const termsAndConditions = String(formData.get("termsAndConditions") || "").trim();

  const bankName = String(formData.get("bankName") || "").trim();
  const accountNumber = String(formData.get("accountNumber") || "").trim();
  const ifsc = String(formData.get("ifsc") || "").trim().toUpperCase();
  const accountName = String(formData.get("accountName") || "").trim();
  const upiId = String(formData.get("upiId") || "").trim();
  const bankDetails = {
    bankName,
    accountNumber,
    ifsc,
    accountName,
    upiId
  };

  // Validate GSTIN format
  const gstinCheck = validateGstin(gstin);
  if (!gstinCheck.isValid) {
    return json({ error: gstinCheck.error || "Invalid GSTIN format" }, { status: 400 });
  }

  const currentStore = await getActiveStore(request);
  const shopDomain = currentStore ? currentStore.shopifyDomain : "xbrews-gst-demo.myshopify.com";

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
      brandColor,
      bankDetails,
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
      brandColor,
      bankDetails,
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

  const initialBank = (store?.bankDetails as any) || {};
  const [legalName, setLegalName] = useState(store?.legalName || "");
  const [tradeName, setTradeName] = useState(store?.tradeName || "");
  const [gstin, setGstin] = useState(store?.gstin || "");
  const [stateCode, setStateCode] = useState(store?.stateCode || "27");
  const [invoicePrefix, setInvoicePrefix] = useState(store?.invoicePrefix || "INV");
  const [creditNotePrefix, setCreditNotePrefix] = useState(store?.creditNotePrefix || "CN");
  const [logoUrl, setLogoUrl] = useState(store?.logoUrl || "");
  const [signatureUrl, setSignatureUrl] = useState(store?.signatureUrl || "");
  const [brandColor, setBrandColor] = useState(store?.brandColor || "#008060");
  const [terms, setTerms] = useState(store?.termsAndConditions || "");

  const [bankName, setBankName] = useState(initialBank.bankName || "");
  const [accountNumber, setAccountNumber] = useState(initialBank.accountNumber || "");
  const [ifsc, setIfsc] = useState(initialBank.ifsc || "");
  const [accountName, setAccountName] = useState(initialBank.accountName || "");
  const [upiId, setUpiId] = useState(initialBank.upiId || "");

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
    fd.append("brandColor", brandColor.startsWith("#") ? brandColor : `#${brandColor}`);
    fd.append("termsAndConditions", terms);
    fd.append("bankName", bankName);
    fd.append("accountNumber", accountNumber);
    fd.append("ifsc", ifsc);
    fd.append("accountName", accountName);
    fd.append("upiId", upiId);
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
            title="Branding & Visual Accent"
            description="Customize your invoice visual presentation, primary brand accent color, and authorized signatory stamp."
          >
            <Card>
              <FormLayout>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    Primary Brand Accent Color
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Applied to table headers, borders, and total accents on your generated PDF invoices.
                  </Text>
                  <InlineStack gap="300" align="start">
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "6px",
                        backgroundColor: brandColor,
                        border: "2px solid #d2d5d8",
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flex: 1, maxWidth: "220px" }}>
                      <TextField
                        label="Brand Color Hex"
                        labelHidden
                        value={brandColor}
                        onChange={setBrandColor}
                        autoComplete="off"
                      />
                    </div>
                  </InlineStack>
                  <InlineStack gap="200" wrap>
                    {[
                      { name: "Shopify Emerald", hex: "#008060" },
                      { name: "Navy Blue", hex: "#1e3a8a" },
                      { name: "Indigo", hex: "#4f46e5" },
                      { name: "Purple", hex: "#7c3aed" },
                      { name: "Crimson", hex: "#991b1b" },
                      { name: "Charcoal Slate", hex: "#1f2937" }
                    ].map((c) => (
                      <Button
                        key={c.hex}
                        size="slim"
                        pressed={brandColor.toLowerCase() === c.hex.toLowerCase()}
                        onClick={() => setBrandColor(c.hex)}
                      >
                        <InlineStack gap="100" blockAlign="center">
                          <span
                            style={{
                              display: "inline-block",
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              backgroundColor: c.hex,
                              marginRight: "4px"
                            }}
                          />
                          {c.name}
                        </InlineStack>
                      </Button>
                    ))}
                  </InlineStack>
                </BlockStack>

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
            title="Bank Account & UPI Details"
            description="Display statutory bank transfer and UPI details on invoices for B2B direct wire, NEFT/RTGS, and UPI payments."
          >
            <Card>
              <FormLayout>
                <TextField
                  label="Account Beneficiary Name"
                  value={accountName}
                  onChange={setAccountName}
                  placeholder="e.g. Acme Enterprises Private Limited"
                  autoComplete="off"
                />
                <FormLayout.Group>
                  <TextField
                    label="Bank Name"
                    value={bankName}
                    onChange={setBankName}
                    placeholder="e.g. HDFC Bank / ICICI Bank"
                    autoComplete="off"
                  />
                  <TextField
                    label="Bank Account Number"
                    value={accountNumber}
                    onChange={setAccountNumber}
                    placeholder="e.g. 50200012345678"
                    autoComplete="off"
                  />
                </FormLayout.Group>
                <FormLayout.Group>
                  <TextField
                    label="IFSC Code (11 alphanumeric digits)"
                    value={ifsc}
                    onChange={(val) => setIfsc(val.toUpperCase())}
                    placeholder="e.g. HDFC0001234"
                    autoComplete="off"
                  />
                  <TextField
                    label="UPI ID / VPA (Optional)"
                    value={upiId}
                    onChange={setUpiId}
                    placeholder="e.g. merchant@upi or yourname@okhdfcbank"
                    autoComplete="off"
                    helpText="Enables 1-click UPI payments for customers"
                  />
                </FormLayout.Group>
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
