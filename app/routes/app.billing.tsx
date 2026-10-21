import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect
} from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  useSubmit,
  useNavigation,
  Link
} from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  TextField,
  Select,
  Button,
  Banner,
  Divider,
  Text,
  Badge,
  Grid,
  ButtonGroup
} from "@shopify/polaris";
import { useState, useMemo, useEffect } from "react";
import { prisma } from "../db.server";
import { GST_STATE_MAP, getStateNameByCode } from "../services/tax-engine/state-codes";
import { validateGstin } from "../services/tax-engine/gstin-validator";
import { calculateGstOrder } from "../services/tax-engine/gst-calculator";
import { getNextInvoiceNumber } from "../services/sequence-engine/sequence-generator";
import { renderInvoicePdfBuffer } from "../services/pdf/pdf-generator";
import { uploadInvoicePdf } from "../services/storage/s3-storage";
import { getActiveStore } from "../services/store/store.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const store = await getActiveStore(request);

  if (!store) {
    throw new Response("Store not found or unauthorized", { status: 404 });
  }

  const stateOptions = Object.values(GST_STATE_MAP).map((s) => ({
    label: `${s.code} - ${s.name}`,
    value: s.code
  }));

  return json({
    store,
    stateOptions
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const store = await getActiveStore(request);

  if (!store) {
    return json({ error: "Store not configured" }, { status: 400 });
  }

  const customerType = String(formData.get("customerType") || "B2C");
  const customerName = String(formData.get("customerName") || "Walk-in Customer");
  const customerPhone = String(formData.get("customerPhone") || "");
  const buyerGstin = String(formData.get("buyerGstin") || "").trim().toUpperCase();
  const buyerCompanyName = String(formData.get("buyerCompanyName") || "").trim();
  const posStateCode = String(formData.get("posStateCode") || store.stateCode);
  const paymentMode = String(formData.get("paymentMode") || "UPI");
  const shippingGross = parseFloat(String(formData.get("shippingGross") || "0"));

  const rawItemsJson = String(formData.get("items") || "[]");
  let rawItems: any[] = [];
  try {
    rawItems = JSON.parse(rawItemsJson);
  } catch {
    return json({ error: "Invalid line items data" }, { status: 400 });
  }

  if (!rawItems || rawItems.length === 0) {
    return json({ error: "Please add at least one line item" }, { status: 400 });
  }

  // Validate B2B GSTIN if provided
  if (customerType === "B2B") {
    if (!buyerGstin) {
      return json({ error: "GSTIN is mandatory for B2B Invoices" }, { status: 400 });
    }
    const validation = validateGstin(buyerGstin);
    if (!validation.isValid) {
      return json({ error: `Invalid GSTIN: ${validation.error}` }, { status: 400 });
    }
  }

  // Format line items for GST Tax Engine
  const orderItems = rawItems.map((item) => ({
    title: item.title,
    sku: item.sku || null,
    hsnCode: item.hsnCode || "0901",
    quantity: parseInt(String(item.quantity || "1"), 10),
    unitPrice: parseFloat(String(item.unitPrice || "0")),
    taxRate: parseFloat(String(item.taxRate || "5"))
  }));

  // Run statutory GST Calculation Engine
  const calcResult = calculateGstOrder({
    sellerStateCode: store.stateCode,
    buyerStateCode: posStateCode,
    items: orderItems,
    shippingPrice: shippingGross,
    isTaxInclusive: true
  });

  const orderNum = `POS-${Math.floor(1000 + Math.random() * 9000)}`;

  // Atomic database transaction: allocate sequence & persist
  let createdInvoice: any;
  try {
    createdInvoice = await prisma.$transaction(async (tx) => {
      const { invoiceNumber } = await getNextInvoiceNumber(tx, store.id);

      const inv = await tx.invoice.create({
        data: {
          storeId: store.id,
          shopifyOrderId: `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          orderNumber: orderNum,
          invoiceNumber,
          posStateCode,
          isInterState: calcResult.isInterState,
          totalTaxable: calcResult.totalTaxable.toFixed(2),
          totalCgst: calcResult.totalCgst.toFixed(2),
          totalSgst: calcResult.totalSgst.toFixed(2),
          totalIgst: calcResult.totalIgst.toFixed(2),
          shippingTaxable: calcResult.shipping.shippingTaxable.toFixed(2),
          shippingTaxRate: calcResult.shipping.shippingTaxRate.toFixed(2),
          shippingCgst: calcResult.shipping.shippingCgst.toFixed(2),
          shippingSgst: calcResult.shipping.shippingSgst.toFixed(2),
          shippingIgst: calcResult.shipping.shippingIgst.toFixed(2),
          grandTotal: calcResult.grandTotal.toFixed(2),
          buyerGstin: customerType === "B2B" ? buyerGstin : null,
          buyerCompanyName: customerType === "B2B" ? (buyerCompanyName || customerName) : null,
          buyerAddress: {
            customerName,
            phone: customerPhone,
            paymentMode,
            city: store.registeredAddress ? (store.registeredAddress as any).city : "Mumbai",
            province: getStateNameByCode(posStateCode),
            country: "India"
          },
          status: "DELIVERED",
          items: {
            create: calcResult.items.map((item) => ({
              title: item.title,
              sku: item.sku,
              hsnCode: item.hsnCode,
              quantity: item.quantity,
              unitPrice: item.unitPrice.toFixed(2),
              taxRate: item.taxRate.toFixed(2),
              taxableAmount: item.taxableAmount.toFixed(2),
              cgstAmount: item.cgstAmount.toFixed(2),
              sgstAmount: item.sgstAmount.toFixed(2),
              igstAmount: item.igstAmount.toFixed(2),
              totalAmount: item.totalAmount.toFixed(2)
            }))
          }
        },
        include: { items: true, store: true }
      });

      return inv;
    });

    // Render A4 PDF for records
    const hsnSummaryList = Object.values(calcResult.hsnSummary).map((h) => ({
      hsnCode: h.hsnCode,
      taxableAmount: h.taxableAmount.toFixed(2),
      cgstAmount: h.cgstAmount.toFixed(2),
      sgstAmount: h.sgstAmount.toFixed(2),
      igstAmount: h.igstAmount.toFixed(2),
      totalTax: h.cgstAmount.plus(h.sgstAmount).plus(h.igstAmount).toFixed(2)
    }));

    const pdfBuffer = await renderInvoicePdfBuffer({
      store: {
        legalName: store.legalName,
        tradeName: store.tradeName,
        gstin: store.gstin,
        stateCode: store.stateCode,
        registeredAddress: store.registeredAddress,
        logoUrl: store.logoUrl,
        signatureUrl: store.signatureUrl,
        brandColor: store.brandColor,
        bankDetails: store.bankDetails,
        termsAndConditions: store.termsAndConditions
      },
      invoiceNumber: createdInvoice.invoiceNumber,
      invoiceDate: new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }),
      orderNumber: orderNum,
      posStateCode,
      buyerName: customerName,
      buyerCompanyName: customerType === "B2B" ? (buyerCompanyName || customerName) : undefined,
      buyerGstin: customerType === "B2B" ? buyerGstin : undefined,
      buyerAddress: {
        address1: "Counter Sale / Walk-in",
        city: store.registeredAddress ? (store.registeredAddress as any).city : "Mumbai",
        province: getStateNameByCode(posStateCode),
        zip: store.registeredAddress ? (store.registeredAddress as any).pincode : "400051"
      },
      shippingAddress: {
        address1: "Immediate Counter Handover",
        city: store.registeredAddress ? (store.registeredAddress as any).city : "Mumbai",
        province: getStateNameByCode(posStateCode),
        zip: store.registeredAddress ? (store.registeredAddress as any).pincode : "400051"
      },
      isInterState: calcResult.isInterState,
      items: calcResult.items.map((item) => ({
        title: item.title,
        sku: item.sku,
        hsnCode: item.hsnCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        taxableAmount: item.taxableAmount.toFixed(2),
        taxRate: item.taxRate.toFixed(2),
        cgstAmount: item.cgstAmount.toFixed(2),
        sgstAmount: item.sgstAmount.toFixed(2),
        igstAmount: item.igstAmount.toFixed(2),
        totalAmount: item.totalAmount.toFixed(2)
      })),
      shipping: {
        shippingGross: calcResult.shipping.shippingGross.toFixed(2),
        shippingTaxable: calcResult.shipping.shippingTaxable.toFixed(2),
        shippingTaxRate: calcResult.shipping.shippingTaxRate.toFixed(2),
        shippingCgst: calcResult.shipping.shippingCgst.toFixed(2),
        shippingSgst: calcResult.shipping.shippingSgst.toFixed(2),
        shippingIgst: calcResult.shipping.shippingIgst.toFixed(2)
      },
      totalTaxable: calcResult.totalTaxable.toFixed(2),
      totalCgst: calcResult.totalCgst.toFixed(2),
      totalSgst: calcResult.totalSgst.toFixed(2),
      totalIgst: calcResult.totalIgst.toFixed(2),
      grandTotal: calcResult.grandTotal.toFixed(2),
      hsnSummaryList
    });

    const safeFileName = `${createdInvoice.invoiceNumber.replace(/\//g, "-")}.pdf`;
    const uploadResult = await uploadInvoicePdf(safeFileName, pdfBuffer, store.shopifyDomain);

    await prisma.invoice.update({
      where: { id: createdInvoice.id },
      data: { pdfUrl: uploadResult.url }
    });

    return redirect(`/app/receipt/${createdInvoice.id}`);
  } catch (err: any) {
    return json({ error: `Billing Failed: ${err.message}` }, { status: 500 });
  }
}

// Universal catalog item specification for fast 1-click counter add
export interface QuickCatalogItem {
  id: string;
  title: string;
  sku?: string;
  hsnCode: string;
  unitPrice: number;
  taxRate: number;
}

const DEFAULT_UNIVERSAL_ITEMS: QuickCatalogItem[] = [
  { id: "def_1", title: "Standard Retail Goods", sku: "SKU-01", hsnCode: "2106", unitPrice: 500, taxRate: 18 },
  { id: "def_2", title: "Packaged Consumables / F&B", sku: "PKG-02", hsnCode: "2106", unitPrice: 250, taxRate: 12 },
  { id: "def_3", title: "Essential Daily Supply", sku: "ESS-03", hsnCode: "1006", unitPrice: 150, taxRate: 5 },
  { id: "def_4", title: "Commercial Sample / Trial Pack", sku: "SMP-04", hsnCode: "2106", unitPrice: 250, taxRate: 0 },
  { id: "def_5", title: "Professional Service / Charge", sku: "SRV-05", hsnCode: "9983", unitPrice: 1500, taxRate: 18 }
];

export default function ManualBillingPage() {
  const { store, stateOptions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const storageKey = `gst_quick_catalog_${store?.shopifyDomain || "default"}`;

  const [customerType, setCustomerType] = useState<"B2C" | "B2B">("B2C");
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [buyerCompanyName, setBuyerCompanyName] = useState("");
  const [buyerGstin, setBuyerGstin] = useState("");
  const [posStateCode, setPosStateCode] = useState(store.stateCode || "27");
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [shippingGross, setShippingGross] = useState("0");

  const [items, setItems] = useState([
    { id: 1, title: "Standard Retail Goods", sku: "SKU-01", hsnCode: "2106", quantity: 1, unitPrice: 500, taxRate: 18 }
  ]);

  // Dynamic Quick Catalog Items (persisted in localStorage per store)
  const [quickItems, setQuickItems] = useState<QuickCatalogItem[]>(DEFAULT_UNIVERSAL_ITEMS);
  const [isManagingCatalog, setIsManagingCatalog] = useState(false);
  const [showAddCatalogForm, setShowAddCatalogForm] = useState(false);
  const [catalogFeedback, setCatalogFeedback] = useState<string | null>(null);

  // New Catalog Item Form State
  const [newCatTitle, setNewCatTitle] = useState("");
  const [newCatSku, setNewCatSku] = useState("");
  const [newCatHsn, setNewCatHsn] = useState("2106");
  const [newCatPrice, setNewCatPrice] = useState("500");
  const [newCatTaxRate, setNewCatTaxRate] = useState("18");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQuickItems(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load quick catalog from localStorage", e);
    }
  }, [storageKey]);

  const saveQuickItems = (newItems: QuickCatalogItem[], feedbackMsg?: string) => {
    setQuickItems(newItems);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newItems));
      if (feedbackMsg) {
        setCatalogFeedback(feedbackMsg);
        setTimeout(() => setCatalogFeedback(null), 3000);
      }
    } catch (e) {
      console.error("Failed to persist quick catalog to localStorage", e);
    }
  };

  const handleSaveNewCatalogItem = () => {
    if (!newCatTitle.trim()) return;
    const item: QuickCatalogItem = {
      id: `cat_${Date.now()}`,
      title: newCatTitle.trim(),
      sku: newCatSku.trim() || undefined,
      hsnCode: newCatHsn.trim() || "2106",
      unitPrice: parseFloat(newCatPrice) || 0,
      taxRate: parseFloat(newCatTaxRate) || 0
    };
    const updated = [...quickItems, item];
    saveQuickItems(updated, `Saved "${item.title}" to Quick-Add list!`);
    setNewCatTitle("");
    setNewCatSku("");
    setShowAddCatalogForm(false);
  };

  const handleDeleteCatalogItem = (id: string) => {
    const updated = quickItems.filter((item) => item.id !== id);
    saveQuickItems(updated, "Item removed from quick-adds.");
  };

  const handleSaveLineItemToCatalog = (item: { title: string; sku?: string | null; hsnCode: string; unitPrice: number; taxRate: number }) => {
    const catalogItem: QuickCatalogItem = {
      id: `cat_${Date.now()}`,
      title: item.title,
      sku: item.sku || undefined,
      hsnCode: item.hsnCode || "2106",
      unitPrice: Number(item.unitPrice) || 0,
      taxRate: Number(item.taxRate) || 0
    };
    const updated = [...quickItems, catalogItem];
    saveQuickItems(updated, `Saved "${item.title}" to quick-adds!`);
  };

  // When user types GSTIN, auto-extract the state code!
  const handleGstinChange = (val: string) => {
    const cleaned = val.trim().toUpperCase();
    setBuyerGstin(cleaned);
    if (cleaned.length >= 2) {
      const code = cleaned.substring(0, 2);
      if (GST_STATE_MAP[code]) {
        setPosStateCode(code);
      }
    }
  };

  const handleAddItem = (preset?: QuickCatalogItem) => {
    const newItem = preset
      ? { id: Date.now(), title: preset.title, sku: preset.sku || "", hsnCode: preset.hsnCode, quantity: 1, unitPrice: preset.unitPrice, taxRate: preset.taxRate }
      : { id: Date.now(), title: "Standard Retail Goods", sku: "ITEM", hsnCode: "2106", quantity: 1, unitPrice: 250, taxRate: 18 };
    setItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleUpdateItem = (id: number, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Real-time tax computation for live receipt preview
  const liveCalculation = useMemo(() => {
    try {
      const formattedItems = items.map((i) => ({
        title: i.title,
        sku: i.sku || null,
        hsnCode: i.hsnCode || "0901",
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unitPrice) || 0,
        taxRate: Number(i.taxRate) || 0
      }));

      const res = calculateGstOrder({
        sellerStateCode: store.stateCode,
        buyerStateCode: posStateCode,
        items: formattedItems,
        shippingPrice: parseFloat(shippingGross) || 0,
        isTaxInclusive: true
      });

      return {
        isInterState: res.isInterState,
        totalTaxable: res.totalTaxable.toFixed(2),
        totalCgst: res.totalCgst.toFixed(2),
        totalSgst: res.totalSgst.toFixed(2),
        totalIgst: res.totalIgst.toFixed(2),
        shippingTax: res.shipping.shippingTotalTax.toFixed(2),
        grandTotal: res.grandTotal.toFixed(2)
      };
    } catch {
      return {
        isInterState: false,
        totalTaxable: "0.00",
        totalCgst: "0.00",
        totalSgst: "0.00",
        totalIgst: "0.00",
        shippingTax: "0.00",
        grandTotal: "0.00"
      };
    }
  }, [items, posStateCode, shippingGross, store.stateCode]);

  const handleSubmitBill = () => {
    const formData = new FormData();
    formData.append("customerType", customerType);
    formData.append("customerName", customerName);
    formData.append("customerPhone", customerPhone);
    formData.append("buyerCompanyName", buyerCompanyName);
    formData.append("buyerGstin", buyerGstin);
    formData.append("posStateCode", posStateCode);
    formData.append("paymentMode", paymentMode);
    formData.append("shippingGross", shippingGross);
    formData.append("items", JSON.stringify(items));

    submit(formData, { method: "post" });
  };

  return (
    <Page
      title="Point of Sale (POS) & Manual Billing"
      subtitle="Instantly generate statutory GST tax invoices and print 80mm/58mm thermal receipts"
      backAction={{ content: "Invoices", url: "/app/invoices" }}
    >
      <BlockStack gap="500">
        {actionData?.error && (
          <Banner tone="critical" title="Billing Error">
            <p>{actionData.error}</p>
          </Banner>
        )}

        {/* Universal Quick-Add Catalog Bar */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <InlineStack gap="200" align="center">
                <Text as="h3" variant="headingSm">⚡ Quick-Add Catalog Items:</Text>
                <Badge tone="info">{`${items.length} in bill`}</Badge>
              </InlineStack>

              <InlineStack gap="200">
                <Button
                  size="slim"
                  variant={showAddCatalogForm ? "primary" : "secondary"}
                  onClick={() => setShowAddCatalogForm(!showAddCatalogForm)}
                >
                  {showAddCatalogForm ? "Close Form" : "+ Add New Item to Quick-Adds"}
                </Button>
                <Button
                  size="slim"
                  variant="plain"
                  onClick={() => setIsManagingCatalog(!isManagingCatalog)}
                >
                  {isManagingCatalog ? "Done Managing" : "⚙️ Manage Quick Items"}
                </Button>
              </InlineStack>
            </InlineStack>

            {catalogFeedback && (
              <Banner tone="success" onDismiss={() => setCatalogFeedback(null)}>
                <p>{catalogFeedback}</p>
              </Banner>
            )}

            {/* Inline Form to Add a Custom Item to Quick-Add List */}
            {showAddCatalogForm && (
              <div
                style={{
                  background: "#f8fafc",
                  padding: "16px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1"
                }}
              >
                <BlockStack gap="300">
                  <Text as="h4" variant="headingXs">
                    Add New Product / Service to Quick-Add Catalog
                  </Text>
                  <Grid>
                    <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3, xl: 3 }}>
                      <TextField
                        label="Product / Item Description *"
                        value={newCatTitle}
                        onChange={setNewCatTitle}
                        placeholder="e.g. Sanbaee Premix 1kg"
                        autoComplete="off"
                      />
                    </Grid.Cell>
                    <Grid.Cell columnSpan={{ xs: 3, sm: 3, md: 2, lg: 2, xl: 2 }}>
                      <TextField
                        label="SKU (Optional)"
                        value={newCatSku}
                        onChange={setNewCatSku}
                        placeholder="e.g. SB-1KG"
                        autoComplete="off"
                      />
                    </Grid.Cell>
                    <Grid.Cell columnSpan={{ xs: 3, sm: 3, md: 2, lg: 2, xl: 2 }}>
                      <TextField
                        label="HSN / SAC Code"
                        value={newCatHsn}
                        onChange={setNewCatHsn}
                        placeholder="e.g. 2106"
                        autoComplete="off"
                      />
                    </Grid.Cell>
                    <Grid.Cell columnSpan={{ xs: 3, sm: 3, md: 2, lg: 2, xl: 2 }}>
                      <TextField
                        label="Unit Rate (₹) *"
                        type="number"
                        value={newCatPrice}
                        onChange={setNewCatPrice}
                        autoComplete="off"
                      />
                    </Grid.Cell>
                    <Grid.Cell columnSpan={{ xs: 3, sm: 3, md: 3, lg: 3, xl: 3 }}>
                      <Select
                        label="GST Rate"
                        options={[
                          { label: "0% (Exempt / Nil Rated)", value: "0" },
                          { label: "5% (Essential Goods)", value: "5" },
                          { label: "12% (F&B / Goods)", value: "12" },
                          { label: "18% (Standard Rate)", value: "18" },
                          { label: "28% (Luxury / Aerated)", value: "28" }
                        ]}
                        value={newCatTaxRate}
                        onChange={setNewCatTaxRate}
                      />
                    </Grid.Cell>
                  </Grid>

                  <InlineStack align="end" gap="200">
                    <Button onClick={() => setShowAddCatalogForm(false)} size="slim">
                      Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSaveNewCatalogItem} size="slim">
                      💾 Save to Quick-Add Catalog
                    </Button>
                  </InlineStack>
                </BlockStack>
              </div>
            )}

            {/* Quick-Add Buttons List */}
            <InlineStack gap="200" wrap>
              {quickItems.map((item) => (
                <div key={item.id} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Button size="slim" onClick={() => handleAddItem(item)}>
                    {`+ ${item.title.split("(")[0].trim()} (₹${item.unitPrice})`}
                  </Button>
                  {isManagingCatalog && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCatalogItem(item.id)}
                      title={`Remove ${item.title} from quick-adds`}
                      style={{
                        background: "#fee2e2",
                        border: "1px solid #fecaca",
                        color: "#b91c1c",
                        borderRadius: "50%",
                        width: "18px",
                        height: "18px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: 0
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <Button size="slim" variant="plain" onClick={() => handleAddItem()}>
                + Custom Blank Row
              </Button>

              {isManagingCatalog && (
                <Button
                  size="slim"
                  variant="plain"
                  tone="critical"
                  onClick={() => saveQuickItems(DEFAULT_UNIVERSAL_ITEMS, "Reset quick-add items to universal defaults.")}
                >
                  Reset Defaults
                </Button>
              )}
            </InlineStack>
          </BlockStack>
        </Card>

        <Grid>
          {/* Left Column: Form & Line Items (2/3 width) */}
          <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 8, xl: 8 }}>
            <BlockStack gap="400">
              {/* Customer Details Card */}
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">1. Customer & Tax Category</Text>
                    <ButtonGroup variant="segmented">
                      <Button
                        pressed={customerType === "B2C"}
                        onClick={() => {
                          setCustomerType("B2C");
                          setCustomerName("Walk-in Customer");
                        }}
                      >
                        B2C Walk-in
                      </Button>
                      <Button
                        pressed={customerType === "B2B"}
                        onClick={() => {
                          setCustomerType("B2B");
                          if (customerName === "Walk-in Customer") setCustomerName("");
                        }}
                      >
                        B2B Business (GSTIN)
                      </Button>
                    </ButtonGroup>
                  </InlineStack>

                  <Divider />

                  <Grid>
                    <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 6, xl: 6 }}>
                      <TextField
                        label={customerType === "B2B" ? "Contact Person Name" : "Customer Name"}
                        value={customerName}
                        onChange={setCustomerName}
                        autoComplete="off"
                      />
                    </Grid.Cell>
                    <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 6, xl: 6 }}>
                      <TextField
                        label="Phone / Mobile (Optional)"
                        value={customerPhone}
                        onChange={setCustomerPhone}
                        placeholder="+91 98765 43210"
                        autoComplete="off"
                      />
                    </Grid.Cell>
                  </Grid>

                  {customerType === "B2B" && (
                    <Grid>
                      <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 6, xl: 6 }}>
                        <TextField
                          label="Buyer Legal Company Name *"
                          value={buyerCompanyName}
                          onChange={setBuyerCompanyName}
                          placeholder="e.g. Koramangala Roasters LLP"
                          autoComplete="off"
                        />
                      </Grid.Cell>
                      <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 6, xl: 6 }}>
                        <TextField
                          label="Buyer GSTIN (15 Digits) *"
                          value={buyerGstin}
                          onChange={handleGstinChange}
                          placeholder="e.g. 29AABCU9603R1ZM"
                          autoComplete="off"
                          helpText="Entering GSTIN automatically sets Place of Supply (POS)"
                        />
                      </Grid.Cell>
                    </Grid>
                  )}

                  <Grid>
                    <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 6, xl: 6 }}>
                      <Select
                        label="Place of Supply (POS State)"
                        options={stateOptions}
                        value={posStateCode}
                        onChange={setPosStateCode}
                        helpText={
                          posStateCode === store.stateCode
                            ? `Intra-state Supply: CGST (50%) + SGST (50%) applied`
                            : `Inter-state Supply: IGST (100%) applied`
                        }
                      />
                    </Grid.Cell>
                    <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 6, xl: 6 }}>
                      <Select
                        label="Payment Method"
                        options={[
                          { label: "⚡ UPI / QR Scan", value: "UPI" },
                          { label: "💵 Cash (Counter)", value: "Cash" },
                          { label: "💳 Debit / Credit Card", value: "Card" },
                          { label: "🏦 Bank Transfer / IMPS", value: "Net Banking" }
                        ]}
                        value={paymentMode}
                        onChange={setPaymentMode}
                      />
                    </Grid.Cell>
                  </Grid>
                </BlockStack>
              </Card>

              {/* Line Items Builder Card */}
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">2. Bill Items</Text>
                    <Button onClick={() => handleAddItem()} size="slim">
                      + Add Item Row
                    </Button>
                  </InlineStack>

                  <Divider />

                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      style={{
                        background: "#fafbfb",
                        border: "1px solid #e1e3e5",
                        borderRadius: "8px",
                        padding: "12px",
                        marginBottom: "8px"
                      }}
                    >
                      <Grid>
                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 2, lg: 4, xl: 4 }}>
                          <TextField
                            label={`Item #${index + 1} Description`}
                            value={item.title}
                            onChange={(val) => handleUpdateItem(item.id, "title", val)}
                            autoComplete="off"
                          />
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 3, sm: 3, md: 1, lg: 2, xl: 2 }}>
                          <TextField
                            label="HSN Code"
                            value={item.hsnCode}
                            onChange={(val) => handleUpdateItem(item.id, "hsnCode", val)}
                            autoComplete="off"
                          />
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 3, sm: 3, md: 1, lg: 2, xl: 2 }}>
                          <TextField
                            label="Quantity"
                            type="number"
                            value={String(item.quantity)}
                            onChange={(val) => handleUpdateItem(item.id, "quantity", parseInt(val || "1", 10))}
                            autoComplete="off"
                          />
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 3, sm: 3, md: 1, lg: 2, xl: 2 }}>
                          <TextField
                            label="Unit Rate (₹)"
                            type="number"
                            value={String(item.unitPrice)}
                            onChange={(val) => handleUpdateItem(item.id, "unitPrice", parseFloat(val || "0"))}
                            autoComplete="off"
                          />
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 3, sm: 3, md: 1, lg: 2, xl: 2 }}>
                          <Select
                            label="GST Rate"
                            options={[
                              { label: "0% (Exempt / Nil)", value: "0" },
                              { label: "5% (Essential Goods)", value: "5" },
                              { label: "12% (F&B / Goods)", value: "12" },
                              { label: "18% (Standard Rate)", value: "18" },
                              { label: "28% (Luxury / Aerated)", value: "28" }
                            ]}
                            value={String(item.taxRate)}
                            onChange={(val) => handleUpdateItem(item.id, "taxRate", parseFloat(val))}
                          />
                        </Grid.Cell>
                      </Grid>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", paddingTop: "6px", borderTop: "1px dashed #e1e3e5" }}>
                        <span style={{ fontSize: "12px", color: "#6d7175" }}>
                          Line Total: <strong>₹{(item.quantity * item.unitPrice).toFixed(2)}</strong> (Incl. {item.taxRate}% GST)
                        </span>
                        <InlineStack gap="200">
                          <Button
                            variant="plain"
                            size="micro"
                            onClick={() => handleSaveLineItemToCatalog(item)}
                          >
                            ⭐ Save to Quick-Adds
                          </Button>
                          {items.length > 1 && (
                            <Button tone="critical" variant="plain" size="micro" onClick={() => handleRemoveItem(item.id)}>
                              Delete Item
                            </Button>
                          )}
                        </InlineStack>
                      </div>
                    </div>
                  ))}

                  <div style={{ maxWidth: "250px", marginTop: "4px" }}>
                    <TextField
                      label="Delivery / Shipping Charges (₹)"
                      type="number"
                      value={shippingGross}
                      onChange={setShippingGross}
                      placeholder="0.00"
                      autoComplete="off"
                    />
                  </div>
                </BlockStack>
              </Card>
            </BlockStack>
          </Grid.Cell>

          {/* Right Column: Live Tax Breakdown & POS Actions (1/3 width) */}
          <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 2, lg: 4, xl: 4 }}>
            <div style={{ position: "sticky", top: "20px" }}>
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">3. Tax Summary</Text>
                    <Badge tone={liveCalculation.isInterState ? "attention" : "success"}>
                      {liveCalculation.isInterState ? "IGST (Inter-State)" : "CGST+SGST (Local)"}
                    </Badge>
                  </InlineStack>

                  <Divider />

                  <BlockStack gap="200">
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <span style={{ color: "#5c5f62" }}>Taxable Amount:</span>
                      <span style={{ fontWeight: 600 }}>₹{liveCalculation.totalTaxable}</span>
                    </div>

                    {liveCalculation.isInterState ? (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                        <span style={{ color: "#5c5f62" }}>Total IGST:</span>
                        <span style={{ fontWeight: 600, color: "#b91c1c" }}>₹{liveCalculation.totalIgst}</span>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ color: "#5c5f62" }}>Total CGST:</span>
                          <span style={{ fontWeight: 600 }}>₹{liveCalculation.totalCgst}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                          <span style={{ color: "#5c5f62" }}>Total SGST:</span>
                          <span style={{ fontWeight: 600 }}>₹{liveCalculation.totalSgst}</span>
                        </div>
                      </>
                    )}

                    {parseFloat(shippingGross) > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                        <span style={{ color: "#5c5f62" }}>Shipping Charges:</span>
                        <span style={{ fontWeight: 600 }}>₹{parseFloat(shippingGross).toFixed(2)}</span>
                      </div>
                    )}
                  </BlockStack>

                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "2px solid #22c55e",
                      borderRadius: "8px",
                      padding: "14px",
                      textAlign: "center"
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#15803d" }}>
                      Total Amount Payable
                    </div>
                    <div style={{ fontSize: "28px", fontWeight: 800, color: "#14532d", margin: "4px 0" }}>
                      ₹{liveCalculation.grandTotal}
                    </div>
                    <div style={{ fontSize: "11px", color: "#166534" }}>
                      Payment: <strong>{paymentMode}</strong> | Reverse Charge: <strong>NO</strong>
                    </div>
                  </div>

                  <BlockStack gap="200">
                    <Button
                      variant="primary"
                      size="large"
                      onClick={handleSubmitBill}
                      loading={isSubmitting}
                      fullWidth
                    >
                      🖨️ Generate & Print POS Receipt
                    </Button>
                    <Text as="p" variant="bodyXs" alignment="center" tone="subdued">
                      Allocates sequential invoice number & creates thermal receipt instantly
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            </div>
          </Grid.Cell>
        </Grid>

        {/* Mobile Sticky Bottom Action Bar */}
        <div
          className="pos-mobile-action-bar"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#ffffff",
            borderTop: "1px solid #cbd5e1",
            padding: "10px 16px",
            boxShadow: "0 -4px 16px rgba(0, 0, 0, 0.12)",
            zIndex: 9999,
            display: "none",
            alignItems: "center",
            justifyContent: "space-between",
            boxSizing: "border-box"
          }}
        >
          <div>
            <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
              Payable ({paymentMode})
            </div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#15803d" }}>
              ₹{liveCalculation.grandTotal}
            </div>
          </div>
          <Button
            variant="primary"
            size="large"
            onClick={handleSubmitBill}
            loading={isSubmitting}
          >
            🖨️ Generate &amp; Print Bill
          </Button>
        </div>

        <style>{`
          @media (max-width: 768px) {
            .pos-mobile-action-bar {
              display: flex !important;
            }
            body {
              padding-bottom: 70px !important;
            }
          }
        `}</style>
      </BlockStack>
    </Page>
  );
}
