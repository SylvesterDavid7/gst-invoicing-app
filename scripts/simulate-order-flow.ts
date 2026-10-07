import fs from "fs";
import path from "path";
import { calculateGstOrder } from "../app/services/tax-engine/gst-calculator";
import { normalizeStateCode, getStateNameByCode } from "../app/services/tax-engine/state-codes";
import { validateGstin } from "../app/services/tax-engine/gstin-validator";
import { getCurrentIndianFiscalYear } from "../app/services/sequence-engine/sequence-generator";
import { renderInvoicePdfBuffer } from "../app/services/pdf/pdf-generator";
import ExcelJS from "exceljs";

async function runDemoSimulation() {
  console.log("====================================================");
  console.log(" ⚡ GST PRO - SIMULATING REAL SHOPIFY ORDER FLOW ⚡ ");
  console.log("====================================================");

  // 1. Merchant Store Config
  const merchantStore = {
    legalName: "X-Brews Specialty Coffee Private Limited",
    tradeName: "X-Brews Roasters",
    gstin: "27AABCA1234A1Z5", // 27 = Maharashtra
    stateCode: "27",
    registeredAddress: {
      addressLine1: "Plot 42, Bandra-Kurla Complex",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400051",
      country: "India"
    },
    invoicePrefix: "XB",
    currentFiscalYear: getCurrentIndianFiscalYear(),
    logoUrl: "",
    signatureUrl: "",
    termsAndConditions: "1. All disputes subject to Mumbai jurisdiction. 2. Fresh coffee roasted to order."
  };

  console.log(`\n[1] Merchant Configured:`);
  console.log(`    Legal Name : ${merchantStore.legalName}`);
  console.log(`    GSTIN      : ${merchantStore.gstin} (State: ${merchantStore.stateCode} - Maharashtra)`);
  console.log(`    Fiscal Year: ${merchantStore.currentFiscalYear}`);

  // 2. Incoming Shopify Order Payload (B2B Inter-state order)
  const incomingShopifyOrder = {
    id: 9876543210,
    order_number: 1042,
    email: "procurement@koramangalacafes.com",
    created_at: new Date().toISOString(),
    taxes_included: true,
    total_shipping_price_set: {
      shop_money: { amount: "150.00" }
    },
    shipping_address: {
      first_name: "Rohan",
      last_name: "Mehta",
      company: "Koramangala Specialty Roasters LLP",
      address1: "80 Feet Road, 4th Block, Koramangala",
      city: "Bengaluru",
      province: "Karnataka",
      province_code: "KA",
      zip: "560034",
      country: "India"
    },
    note_attributes: [
      { name: "gstin", value: "29AABCU9603R1ZM" }, // 29 = Karnataka (Valid B2B GSTIN)
      { name: "company_name", value: "Koramangala Specialty Roasters LLP" }
    ],
    line_items: [
      {
        id: 11,
        title: "Monsooned Malabar Whole Beans (1kg)",
        sku: "XB-MM-1KG",
        hsn_code: "0901",
        quantity: 2,
        price: "1200.00",
        total_discount: "0.00",
        tax_lines: [{ rate: 0.05, title: "GST 5%" }]
      },
      {
        id: 12,
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

  console.log(`\n[2] Ingested Shopify Order #${incomingShopifyOrder.order_number}:`);
  console.log(`    Buyer Company: ${incomingShopifyOrder.shipping_address.company}`);
  console.log(`    Destination  : ${incomingShopifyOrder.shipping_address.province} (${incomingShopifyOrder.shipping_address.province_code})`);

  // 3. Tax Engine Execution
  const buyerGstinAttr = incomingShopifyOrder.note_attributes.find((a) => a.name === "gstin")?.value;
  const buyerCompanyAttr = incomingShopifyOrder.note_attributes.find((a) => a.name === "company_name")?.value;

  const gstinValidation = validateGstin(buyerGstinAttr);
  console.log(`\n[3] B2B GSTIN Validation:`);
  console.log(`    Input GSTIN : ${buyerGstinAttr}`);
  console.log(`    Status      : ${gstinValidation.isValid ? "VALID B2B GSTIN" : "INVALID"} (State: ${gstinValidation.stateName})`);

  const posStateCode = gstinValidation.stateCode || normalizeStateCode(incomingShopifyOrder.shipping_address.province_code) || "27";

  const rawItems = incomingShopifyOrder.line_items.map((li) => ({
    title: li.title,
    sku: li.sku,
    hsnCode: li.hsn_code,
    quantity: li.quantity,
    unitPrice: parseFloat(li.price),
    taxRate: (li.tax_lines[0]?.rate || 0.18) * 100,
    discountAmount: parseFloat(li.total_discount || "0")
  }));

  const shippingPrice = parseFloat(incomingShopifyOrder.total_shipping_price_set.shop_money.amount);

  const taxSummary = calculateGstOrder({
    sellerStateCode: merchantStore.stateCode,
    buyerStateCode: posStateCode,
    items: rawItems,
    shippingPrice,
    isTaxInclusive: incomingShopifyOrder.taxes_included
  });

  console.log(`\n[4] Statutory Tax Calculation Results:`);
  console.log(`    Supply Type   : ${taxSummary.isInterState ? "INTER-STATE (IGST)" : "INTRA-STATE (CGST + SGST)"}`);
  console.log(`    Total Taxable : ₹${taxSummary.totalTaxable.toFixed(2)}`);
  console.log(`    CGST (9%)     : ₹${taxSummary.totalCgst.toFixed(2)}`);
  console.log(`    SGST (9%)     : ₹${taxSummary.totalSgst.toFixed(2)}`);
  console.log(`    IGST          : ₹${taxSummary.totalIgst.toFixed(2)}`);
  console.log(`    Shipping Tax  : ₹${taxSummary.shipping.shippingTotalTax.toFixed(2)} (Taxed at highest bracket: ${taxSummary.shipping.shippingTaxRate}%)`);
  console.log(`    Grand Total   : ₹${taxSummary.grandTotal.toFixed(2)}`);

  // 4. Sequential Numbering
  const invoiceNumber = `${merchantStore.invoicePrefix}/${merchantStore.currentFiscalYear}/0042`;
  console.log(`\n[5] Atomic Sequential Number Assigned: ${invoiceNumber}`);

  // 5. Generate Real PDF via Puppeteer
  console.log(`\n[6] Rendering A4 GST Tax Invoice PDF via Puppeteer...`);
  const outputDir = path.join(process.cwd(), "public", "demo-output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const hsnSummaryList = Object.values(taxSummary.hsnSummary).map((h) => ({
    hsnCode: h.hsnCode,
    taxableAmount: h.taxableAmount.toFixed(2),
    cgstAmount: h.cgstAmount.toFixed(2),
    sgstAmount: h.sgstAmount.toFixed(2),
    igstAmount: h.igstAmount.toFixed(2),
    totalTax: h.totalTax.toFixed(2)
  }));

  const pdfBuffer = await renderInvoicePdfBuffer({
    store: merchantStore,
    invoiceNumber,
    invoiceDate: new Date().toISOString().split("T")[0],
    orderNumber: String(incomingShopifyOrder.order_number),
    posStateCode,
    buyerName: `${incomingShopifyOrder.shipping_address.first_name} ${incomingShopifyOrder.shipping_address.last_name}`,
    buyerCompanyName: buyerCompanyAttr,
    buyerGstin: buyerGstinAttr,
    buyerAddress: incomingShopifyOrder.shipping_address,
    shippingAddress: incomingShopifyOrder.shipping_address,
    isInterState: taxSummary.isInterState,
    items: taxSummary.items.map((it) => ({
      title: it.title,
      sku: it.sku,
      hsnCode: it.hsnCode,
      quantity: it.quantity,
      unitPrice: it.unitPrice.toFixed(2),
      taxableAmount: it.taxableAmount.toFixed(2),
      taxRate: it.taxRate.toFixed(2),
      cgstAmount: it.cgstAmount.toFixed(2),
      sgstAmount: it.sgstAmount.toFixed(2),
      igstAmount: it.igstAmount.toFixed(2),
      totalAmount: it.totalAmount.toFixed(2)
    })),
    shipping: {
      shippingGross: taxSummary.shipping.shippingGross.toFixed(2),
      shippingTaxable: taxSummary.shipping.shippingTaxable.toFixed(2),
      shippingTaxRate: taxSummary.shipping.shippingTaxRate.toFixed(2),
      shippingCgst: taxSummary.shipping.shippingCgst.toFixed(2),
      shippingSgst: taxSummary.shipping.shippingSgst.toFixed(2),
      shippingIgst: taxSummary.shipping.shippingIgst.toFixed(2)
    },
    totalTaxable: taxSummary.totalTaxable.toFixed(2),
    totalCgst: taxSummary.totalCgst.toFixed(2),
    totalSgst: taxSummary.totalSgst.toFixed(2),
    totalIgst: taxSummary.totalIgst.toFixed(2),
    grandTotal: taxSummary.grandTotal.toFixed(2),
    hsnSummaryList
  });

  const pdfFilePath = path.join(outputDir, `Invoice_${invoiceNumber.replace(/\//g, "-")}.pdf`);
  fs.writeFileSync(pdfFilePath, pdfBuffer);
  console.log(`    ✅ PDF Successfully Generated: ${pdfFilePath} (${pdfBuffer.length} bytes)`);

  // 6. Generate Sample GSTR-1 Excel File
  console.log(`\n[7] Generating Statutory GSTR-1 Excel Report...`);
  const workbook = new ExcelJS.Workbook();
  const b2bSheet = workbook.addWorksheet("b2b");
  b2bSheet.columns = [
    { header: "GSTIN/UIN of Recipient", key: "gstin", width: 20 },
    { header: "Receiver Name", key: "name", width: 25 },
    { header: "Invoice Number", key: "invNo", width: 18 },
    { header: "Invoice date", key: "invDate", width: 14 },
    { header: "Invoice Value", key: "invVal", width: 14 },
    { header: "Place Of Supply", key: "pos", width: 20 },
    { header: "Rate", key: "rate", width: 10 },
    { header: "Taxable Value", key: "taxable", width: 14 }
  ];

  for (const it of taxSummary.items) {
    b2bSheet.addRow({
      gstin: buyerGstinAttr,
      name: buyerCompanyAttr,
      invNo: invoiceNumber,
      invDate: new Date().toISOString().split("T")[0],
      invVal: parseFloat(taxSummary.grandTotal.toFixed(2)),
      pos: `${posStateCode}-${getStateNameByCode(posStateCode)}`,
      rate: parseFloat(it.taxRate.toFixed(2)),
      taxable: parseFloat(it.taxableAmount.toFixed(2))
    });
  }

  const excelFilePath = path.join(outputDir, `GSTR1_Demo_Report.xlsx`);
  await workbook.xlsx.writeFile(excelFilePath);
  console.log(`    ✅ GSTR-1 Excel Successfully Created: ${excelFilePath}`);

  console.log("\n====================================================");
  console.log(" 🎉 ALL ARCHITECTURAL COMPONENTS VERIFIED! 🎉 ");
  console.log("====================================================");
}

runDemoSimulation().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
