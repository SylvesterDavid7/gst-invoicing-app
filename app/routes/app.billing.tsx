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
import { useState, useMemo } from "react";
import { prisma } from "../db.server";
import { GST_STATE_MAP, getStateNameByCode } from "../services/tax-engine/state-codes";
import { validateGstin } from "../services/tax-engine/gstin-validator";
import { calculateGstOrder } from "../services/tax-engine/gst-calculator";
import { getNextInvoiceNumber } from "../services/sequence-engine/sequence-generator";
import { renderInvoicePdfBuffer } from "../services/pdf/pdf-generator";
import { uploadInvoicePdf } from "../services/storage/s3-storage";
import { getActiveStore } from "../services/store/store.server";

export async function loader({ request }: LoaderFunctionArgs) {
  let store = await getActiveStore(request);

  if (!store) {
    store = await prisma.store.create({
      data: {
        shopifyDomain: shopDomain,
        accessToken: "mock-token",
        legalName: "X-Brews Specialty Coffee Private Limited",
        tradeName: "X-Brews Roasters",
        gstin: "27AABCA1234A1Z5",
        stateCode: "27",
        registeredAddress: {
          addressLine1: "Plot 42, Bandra-Kurla Complex",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400051",
          country: "India"
        },
        invoicePrefix: "XB",
        creditNotePrefix: "CN",
        currentFiscalYear: "26-27"
      }
    });
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

// Preset Items for fast 1-click counter add
const QUICK_ITEMS = [
  { title: "Monsooned Malabar Whole Beans (1kg)", sku: "XB-MM-1KG", hsnCode: "0901", unitPrice: 1200, taxRate: 5 },
  { title: "Kalledevarapura Estate Medium Roast (250g)", sku: "XB-KD-250G", hsnCode: "0901", unitPrice: 450, taxRate: 5 },
  { title: "Cold Brew Steep Packs (Box of 5)", sku: "XB-CB-BOX5", hsnCode: "2101", unitPrice: 550, taxRate: 18 },
  { title: "Precision Espresso Tamper 58.5mm", sku: "XB-ACC-TMPR", hsnCode: "8205", unitPrice: 2360, taxRate: 18 },
  { title: "Ceramic Cupping Bowl (200ml)", sku: "XB-CUP-200", hsnCode: "6912", unitPrice: 380, taxRate: 12 }
];

export default function ManualBillingPage() {
  const { store, stateOptions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [customerType, setCustomerType] = useState<"B2C" | "B2B">("B2C");
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [buyerCompanyName, setBuyerCompanyName] = useState("");
  const [buyerGstin, setBuyerGstin] = useState("");
  const [posStateCode, setPosStateCode] = useState(store.stateCode || "27");
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [shippingGross, setShippingGross] = useState("0");

  const [items, setItems] = useState([
    { id: 1, title: "Monsooned Malabar Whole Beans (1kg)", sku: "XB-MM-1KG", hsnCode: "0901", quantity: 1, unitPrice: 1200, taxRate: 5 }
  ]);

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

  const handleAddItem = (preset?: typeof QUICK_ITEMS[0]) => {
    const newItem = preset
      ? { id: Date.now(), ...preset, quantity: 1 }
      : { id: Date.now(), title: "Fresh Coffee Beans (250g)", sku: "XB-CUSTOM", hsnCode: "0901", quantity: 1, unitPrice: 400, taxRate: 5 };
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

        {/* Quick Add Presets Bar */}
        <Card>
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text as="h3" variant="headingSm">⚡ Quick Add Roastery Catalog Items:</Text>
              <Badge tone="info">{`${items.length} items in cart`}</Badge>
            </InlineStack>
            <InlineStack gap="200" wrap>
              {QUICK_ITEMS.map((item, idx) => (
                <Button key={String(idx)} size="slim" onClick={() => handleAddItem(item)}>
                  {`+ ${item.title.split("(")[0].trim()} (₹${item.unitPrice})`}
                </Button>
              ))}
              <Button size="slim" variant="plain" onClick={() => handleAddItem()}>
                + Custom Item
              </Button>
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
                              { label: "0% (Exempt)", value: "0" },
                              { label: "5% (Coffee)", value: "5" },
                              { label: "12% (Goods)", value: "12" },
                              { label: "18% (Standard)", value: "18" },
                              { label: "28% (Luxury)", value: "28" }
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
                        {items.length > 1 && (
                          <Button tone="critical" variant="plain" size="micro" onClick={() => handleRemoveItem(item.id)}>
                            Delete Item
                          </Button>
                        )}
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
      </BlockStack>
    </Page>
  );
}
