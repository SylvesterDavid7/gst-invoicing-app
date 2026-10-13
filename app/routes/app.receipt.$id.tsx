import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { prisma } from "../db.server";
import { getStateNameByCode } from "../services/tax-engine/state-codes";
import { convertNumberToIndianWords } from "../services/pdf/number-to-words";
import { useState } from "react";

export async function loader({ params }: LoaderFunctionArgs) {
  const invoiceId = params.id;
  if (!invoiceId) {
    throw new Response("Invoice ID is required", { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      store: true,
      creditNote: true
    }
  });

  if (!invoice) {
    throw new Response("Invoice not found", { status: 404 });
  }

  const amountInWords = convertNumberToIndianWords(Number(invoice.grandTotal));
  const posStateName = getStateNameByCode(invoice.posStateCode);

  return json({
    invoice,
    amountInWords,
    posStateName
  });
}

export default function PosReceiptPage() {
  const { invoice, amountInWords, posStateName } = useLoaderData<typeof loader>();
  const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm">("80mm");

  const store = invoice.store;
  const storeAddress = store.registeredAddress as any;
  const buyerAddress = invoice.buyerAddress as any;

  // Group items by HSN for thermal summary
  const hsnMap: Record<string, { taxable: number; cgst: number; sgst: number; igst: number; totalTax: number }> = {};
  for (const item of invoice.items) {
    if (!hsnMap[item.hsnCode]) {
      hsnMap[item.hsnCode] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
    }
    const h = hsnMap[item.hsnCode];
    h.taxable += Number(item.taxableAmount);
    h.cgst += Number(item.cgstAmount);
    h.sgst += Number(item.sgstAmount);
    h.igst += Number(item.igstAmount);
    h.totalTax += Number(item.cgstAmount) + Number(item.sgstAmount) + Number(item.igstAmount);
  }

  return (
    <div style={{ background: "#e5e7eb", minHeight: "100vh", padding: "20px" }}>
      {/* Non-printing Control Bar */}
      <div className="no-print" style={{ maxWidth: "800px", margin: "0 auto 20px auto", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff", padding: "12px 20px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link to="/app/invoices" style={{ textDecoration: "none", color: "#2563eb", fontWeight: 600, fontSize: "14px" }}>
            &larr; Back to Invoices
          </Link>
          <span style={{ color: "#d1d5db" }}>|</span>
          <Link to="/app/billing" style={{ textDecoration: "none", color: "#16a34a", fontWeight: 600, fontSize: "14px" }}>
            + New POS Bill
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>Roll Size:</label>
          <select
            value={paperWidth}
            onChange={(e) => setPaperWidth(e.target.value as any)}
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", background: "#fff", cursor: "pointer" }}
          >
            <option value="80mm">80mm (Standard POS)</option>
            <option value="58mm">58mm (Compact Mobile)</option>
          </select>

          {invoice.pdfUrl && (
            <a
              href={invoice.pdfUrl}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none", padding: "8px 14px", borderRadius: "6px", background: "#f3f4f6", color: "#374151", fontWeight: 600, fontSize: "13px" }}
            >
              Full A4 PDF
            </a>
          )}

          <button
            onClick={() => window.print()}
            style={{
              padding: "8px 18px",
              borderRadius: "6px",
              background: "#16a34a",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "13px",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 4px rgba(22, 163, 74, 0.3)"
            }}
          >
            🖨️ Print Receipt
          </button>
        </div>
      </div>

      {/* Thermal Receipt Paper Container */}
      <div
        className="receipt-container"
        style={{
          width: paperWidth,
          maxWidth: paperWidth,
          margin: "0 auto",
          background: "#ffffff",
          padding: paperWidth === "80mm" ? "14px 10px" : "10px 6px",
          color: "#000000",
          fontFamily: "'Courier New', Courier, monospace, monospace",
          fontSize: paperWidth === "80mm" ? "11px" : "10px",
          lineHeight: "1.3",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          borderRadius: "4px"
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "8px", marginBottom: "8px" }}>
          <h2 style={{ fontSize: paperWidth === "80mm" ? "15px" : "13px", fontWeight: "bold", margin: "0 0 2px 0", textTransform: "uppercase" }}>
            {store.tradeName || store.legalName}
          </h2>
          {store.tradeName && store.legalName !== store.tradeName && (
            <div style={{ fontSize: "10px", color: "#333" }}>({store.legalName})</div>
          )}
          {storeAddress && (
            <div style={{ fontSize: "10px", margin: "2px 0" }}>
              {storeAddress.addressLine1}, {storeAddress.city} - {storeAddress.pincode}
            </div>
          )}
          <div style={{ fontSize: "11px", fontWeight: "bold", marginTop: "3px" }}>
            GSTIN: {store.gstin}
          </div>
          <div style={{ fontSize: "10px" }}>State Code: {store.stateCode}</div>
          {store.supportPhone && <div style={{ fontSize: "10px" }}>Ph: {store.supportPhone}</div>}
        </div>

        {/* Invoice Metadata */}
        <div style={{ borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}>
          <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "12px", textDecoration: "underline", marginBottom: "4px" }}>
            TAX INVOICE / POS RECEIPT
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span><strong>Inv No:</strong> {invoice.invoiceNumber}</span>
            <span><strong>Order:</strong> #{invoice.orderNumber}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span><strong>Date:</strong> {new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}</span>
            <span><strong>Time:</strong> {new Date(invoice.invoiceDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div>
            <strong>POS:</strong> {invoice.posStateCode} - {posStateName} ({invoice.isInterState ? "IGST" : "CGST+SGST"})
          </div>
          {invoice.buyerCompanyName ? (
            <div style={{ marginTop: "4px", background: "#f3f4f6", padding: "3px 4px", border: "1px solid #000" }}>
              <div><strong>B2B Recipient:</strong> {invoice.buyerCompanyName}</div>
              {invoice.buyerGstin && <div><strong>Buyer GSTIN:</strong> {invoice.buyerGstin}</div>}
            </div>
          ) : (
            buyerAddress?.customerName && (
              <div><strong>Customer:</strong> {buyerAddress.customerName}</div>
            )
          )}
        </div>

        {/* Line Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6px", fontSize: paperWidth === "80mm" ? "11px" : "9.5px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #000", borderTop: "1px solid #000", textAlign: "left" }}>
              <th style={{ padding: "3px 0" }}>Item</th>
              <th style={{ padding: "3px 0", textAlign: "center" }}>Qty</th>
              <th style={{ padding: "3px 0", textAlign: "right" }}>Rate</th>
              <th style={{ padding: "3px 0", textAlign: "right" }}>Amt</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, idx) => (
              <tr key={item.id || idx} style={{ borderBottom: "1px dotted #ccc" }}>
                <td style={{ padding: "3px 0", verticalAlign: "top" }}>
                  <div style={{ fontWeight: "bold" }}>{item.title}</div>
                  <div style={{ fontSize: "9px", color: "#555" }}>HSN:{item.hsnCode} | GST:{Number(item.taxRate)}%</div>
                </td>
                <td style={{ padding: "3px 0", textAlign: "center", verticalAlign: "top" }}>{item.quantity}</td>
                <td style={{ padding: "3px 0", textAlign: "right", verticalAlign: "top" }}>₹{Number(item.unitPrice).toFixed(2)}</td>
                <td style={{ padding: "3px 0", textAlign: "right", verticalAlign: "top", fontWeight: "bold" }}>₹{Number(item.totalAmount).toFixed(2)}</td>
              </tr>
            ))}

            {Number(invoice.shippingTaxable) > 0 && (
              <tr style={{ borderBottom: "1px dotted #ccc" }}>
                <td style={{ padding: "3px 0" }}>
                  <div style={{ fontWeight: "bold" }}>Shipping / Delivery</div>
                  <div style={{ fontSize: "9px", color: "#555" }}>GST: {Number(invoice.shippingTaxRate)}%</div>
                </td>
                <td style={{ padding: "3px 0", textAlign: "center" }}>1</td>
                <td style={{ padding: "3px 0", textAlign: "right" }}>₹{(Number(invoice.shippingTaxable) + Number(invoice.shippingCgst) + Number(invoice.shippingSgst) + Number(invoice.shippingIgst)).toFixed(2)}</td>
                <td style={{ padding: "3px 0", textAlign: "right", fontWeight: "bold" }}>₹{(Number(invoice.shippingTaxable) + Number(invoice.shippingCgst) + Number(invoice.shippingSgst) + Number(invoice.shippingIgst)).toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Financial Totals */}
        <div style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "4px 0", marginBottom: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Taxable Value:</span>
            <span>₹{(Number(invoice.totalTaxable) + Number(invoice.shippingTaxable)).toFixed(2)}</span>
          </div>

          {invoice.isInterState ? (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>IGST:</span>
              <span>₹{(Number(invoice.totalIgst) + Number(invoice.shippingIgst)).toFixed(2)}</span>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>CGST:</span>
                <span>₹{(Number(invoice.totalCgst) + Number(invoice.shippingCgst)).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>SGST:</span>
                <span>₹{(Number(invoice.totalSgst) + Number(invoice.shippingSgst)).toFixed(2)}</span>
              </div>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: paperWidth === "80mm" ? "14px" : "12px", fontWeight: "bold", borderTop: "1px dashed #000", marginTop: "4px", paddingTop: "4px" }}>
            <span>GRAND TOTAL:</span>
            <span>₹{Number(invoice.grandTotal).toFixed(2)}</span>
          </div>
        </div>

        {/* Amount in words & Statutory flags */}
        <div style={{ fontSize: "9.5px", marginBottom: "6px", borderBottom: "1px dashed #000", paddingBottom: "4px" }}>
          <div><strong>Words:</strong> INR {amountInWords} Only</div>
          <div style={{ marginTop: "2px", color: "#333" }}>Rev Charge: <strong>NO</strong> | Copy: <strong>ORIGINAL</strong></div>
        </div>

        {/* Compact HSN Summary */}
        <div style={{ marginBottom: "8px", fontSize: "9px" }}>
          <div style={{ fontWeight: "bold", textAlign: "center", textDecoration: "underline", marginBottom: "2px" }}>HSN TAX SUMMARY</div>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dotted #888", fontWeight: "bold" }}>
            <span>HSN</span>
            <span>Taxable</span>
            <span>Tax</span>
          </div>
          {Object.entries(hsnMap).map(([hsn, data]) => (
            <div key={hsn} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{hsn}</span>
              <span>₹{data.taxable.toFixed(2)}</span>
              <span>₹{data.totalTax.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", borderTop: "1px dashed #000", paddingTop: "6px", fontSize: "9px" }}>
          <div style={{ fontWeight: "bold" }}>THANK YOU FOR CHOOSING {store.tradeName || "US"}!</div>
          <div style={{ margin: "2px 0" }}>Fresh Coffee Roasted to Perfection</div>
          <div style={{ fontSize: "8px", color: "#666", marginTop: "4px" }}>
            * This is a computer generated POS invoice *
          </div>
        </div>
      </div>

      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .receipt-container {
            width: ${paperWidth} !important;
            max-width: ${paperWidth} !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 2mm !important;
          }
          @page {
            size: ${paperWidth} auto;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
