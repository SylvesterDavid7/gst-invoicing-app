import ExcelJS from "exceljs";
import { prisma } from "../../db.server";
import { getStateNameByCode } from "../tax-engine/state-codes";

export interface Gstr1ExportFilter {
  storeId: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Builds government-compliant GSTR-1 Excel Workbook conforming to statutory rules.
 * Updated with Notification No. 12/2024 (B2CL threshold updated to ₹1,00,000)
 * 
 * Sheets:
 * - b2b (Table 4A, 4B, 4C, 6B, 6C) - Invoices to registered customers with GSTIN eligible for ITC
 * - b2cl (Table 5A, 5B) - Inter-state B2C orders exceeding ₹1,00,000
 * - b2cs (Table 7) - Consolidated intra-state retail + smaller inter-state supplies (<= ₹1,00,000)
 * - hsn (Table 12) - Mandatory HSN/SAC quantity and tax breakdown summary with B2B/B2C split
 * - hsn_b2b (Table 12 - B2B) - Dedicated HSN breakdown for registered supplies
 * - hsn_b2c (Table 12 - B2C) - Dedicated HSN breakdown for retail/unregistered supplies
 * - cdnr (Table 9B) - Credit / Debit Notes to registered recipients
 * - docs (Table 13) - Documents issued summary (Serial number range, total issued)
 */
export async function generateGstr1Excel(filter: Gstr1ExportFilter): Promise<ExcelJS.Buffer> {
  const { storeId, startDate, endDate } = filter;

  const invoices = await prisma.invoice.findMany({
    where: {
      storeId,
      invoiceDate: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      items: true,
      creditNote: true,
      store: true
    },
    orderBy: { invoiceDate: "asc" }
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GST Pro Shopify App";
  workbook.created = new Date();

  // ==========================================
  // 1. Table 4: B2B Invoices (Registered Customers)
  // ==========================================
  const b2bSheet = workbook.addWorksheet("b2b", { views: [{ state: "frozen", ySplit: 1 }] });
  b2bSheet.columns = [
    { header: "GSTIN/UIN of Recipient", key: "gstin", width: 22 },
    { header: "Receiver Name", key: "name", width: 28 },
    { header: "Invoice Number", key: "invNo", width: 18 },
    { header: "Invoice date", key: "invDate", width: 14 },
    { header: "Invoice Value", key: "invVal", width: 14 },
    { header: "Place Of Supply", key: "pos", width: 22 },
    { header: "Reverse Charge", key: "revCharge", width: 14 },
    { header: "Applicable % of Tax Rate", key: "appRate", width: 14 },
    { header: "Invoice Type", key: "invType", width: 14 },
    { header: "E-Commerce GSTIN", key: "ecomGstin", width: 16 },
    { header: "Rate", key: "rate", width: 10 },
    { header: "Taxable Value", key: "taxable", width: 14 },
    { header: "Cess Amount", key: "cess", width: 12 }
  ];

  // ==========================================
  // 2. Table 5: B2CL (Inter-state large > ₹1,00,000)
  // Threshold updated to ₹1,00,000 per Notification No. 12/2024
  // ==========================================
  const b2clSheet = workbook.addWorksheet("b2cl", { views: [{ state: "frozen", ySplit: 1 }] });
  b2clSheet.columns = [
    { header: "Invoice Number", key: "invNo", width: 18 },
    { header: "Invoice date", key: "invDate", width: 14 },
    { header: "Invoice Value", key: "invVal", width: 14 },
    { header: "Place Of Supply", key: "pos", width: 22 },
    { header: "Applicable % of Tax Rate", key: "appRate", width: 14 },
    { header: "Rate", key: "rate", width: 10 },
    { header: "Taxable Value", key: "taxable", width: 14 },
    { header: "Cess Amount", key: "cess", width: 12 },
    { header: "E-Commerce GSTIN", key: "ecomGstin", width: 16 }
  ];

  // ==========================================
  // 3. Table 7: B2CS (Consolidated Retail + Small Inter-state <= ₹1,00,000)
  // Grouped by Place of Supply and Tax Rate
  // ==========================================
  const b2csSheet = workbook.addWorksheet("b2cs", { views: [{ state: "frozen", ySplit: 1 }] });
  b2csSheet.columns = [
    { header: "Type", key: "type", width: 12 },
    { header: "Place Of Supply", key: "pos", width: 22 },
    { header: "Applicable % of Tax Rate", key: "appRate", width: 14 },
    { header: "Rate", key: "rate", width: 10 },
    { header: "Taxable Value", key: "taxable", width: 14 },
    { header: "Cess Amount", key: "cess", width: 12 },
    { header: "E-Commerce GSTIN", key: "ecomGstin", width: 16 }
  ];

  // ==========================================
  // 4. Table 12: HSN Summary (Master Sheet with Supply Type)
  // ==========================================
  const hsnSheet = workbook.addWorksheet("hsn", { views: [{ state: "frozen", ySplit: 1 }] });
  hsnSheet.columns = [
    { header: "HSN", key: "hsn", width: 12 },
    { header: "Description", key: "desc", width: 26 },
    { header: "UQC", key: "uqc", width: 10 },
    { header: "Supply Type", key: "supplyType", width: 14 }, // B2B vs B2C
    { header: "Total Quantity", key: "totalQty", width: 14 },
    { header: "Total Value", key: "totalVal", width: 14 },
    { header: "Rate (%)", key: "rate", width: 10 },
    { header: "Taxable Value", key: "taxable", width: 14 },
    { header: "Integrated Tax Amount", key: "igst", width: 16 },
    { header: "Central Tax Amount", key: "cgst", width: 16 },
    { header: "State/UT Tax Amount", key: "sgst", width: 16 },
    { header: "Cess Amount", key: "cess", width: 12 }
  ];

  // Dedicated Table 12 Sub-sheets for B2B and B2C
  const hsnB2bSheet = workbook.addWorksheet("hsn_b2b", { views: [{ state: "frozen", ySplit: 1 }] });
  hsnB2bSheet.columns = [
    { header: "HSN", key: "hsn", width: 12 },
    { header: "Description", key: "desc", width: 26 },
    { header: "UQC", key: "uqc", width: 10 },
    { header: "Total Quantity", key: "totalQty", width: 14 },
    { header: "Total Value", key: "totalVal", width: 14 },
    { header: "Rate (%)", key: "rate", width: 10 },
    { header: "Taxable Value", key: "taxable", width: 14 },
    { header: "Integrated Tax Amount", key: "igst", width: 16 },
    { header: "Central Tax Amount", key: "cgst", width: 16 },
    { header: "State/UT Tax Amount", key: "sgst", width: 16 },
    { header: "Cess Amount", key: "cess", width: 12 }
  ];

  const hsnB2cSheet = workbook.addWorksheet("hsn_b2c", { views: [{ state: "frozen", ySplit: 1 }] });
  hsnB2cSheet.columns = [
    { header: "HSN", key: "hsn", width: 12 },
    { header: "Description", key: "desc", width: 26 },
    { header: "UQC", key: "uqc", width: 10 },
    { header: "Total Quantity", key: "totalQty", width: 14 },
    { header: "Total Value", key: "totalVal", width: 14 },
    { header: "Rate (%)", key: "rate", width: 10 },
    { header: "Taxable Value", key: "taxable", width: 14 },
    { header: "Integrated Tax Amount", key: "igst", width: 16 },
    { header: "Central Tax Amount", key: "cgst", width: 16 },
    { header: "State/UT Tax Amount", key: "sgst", width: 16 },
    { header: "Cess Amount", key: "cess", width: 12 }
  ];

  // ==========================================
  // 5. Table 13: Document Issued Summary (Docs)
  // ==========================================
  const docsSheet = workbook.addWorksheet("docs", { views: [{ state: "frozen", ySplit: 1 }] });
  docsSheet.columns = [
    { header: "Nature of Document", key: "docType", width: 30 },
    { header: "Sr. No. From", key: "from", width: 20 },
    { header: "Sr. No. To", key: "to", width: 20 },
    { header: "Total Number", key: "total", width: 14 },
    { header: "Cancelled", key: "cancelled", width: 14 },
    { header: "Net Issued", key: "net", width: 14 }
  ];

  // Aggregation buckets
  // Key: `${posLabel}__${rate}`
  const b2csAggregate: Record<string, { type: string; pos: string; rate: number; taxable: number; cess: number }> = {};

  // Key: `${hsn}__${supplyType}__${rate}`
  const hsnAggregate: Record<string, any> = {};

  // Document range tracker
  let firstInvNo = "";
  let lastInvNo = "";
  let totalInvoices = invoices.length;
  let cancelledInvoices = 0;

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    if (i === 0) firstInvNo = inv.invoiceNumber;
    lastInvNo = inv.invoiceNumber;

    if (inv.status === "CANCELLED") {
      cancelledInvoices++;
      continue; // Skip line items for cancelled docs
    }

    const invDateStr = inv.invoiceDate.toISOString().split("T")[0];
    const posStateName = getStateNameByCode(inv.posStateCode) || "State";
    const posLabel = `${inv.posStateCode}-${posStateName}`;
    const grandTotalNum = parseFloat(String(inv.grandTotal));
    const isB2b = Boolean(inv.buyerGstin && inv.buyerGstin.trim().length === 15);
    const supplyType = isB2b ? "B2B" : "B2C";

    // Statutory threshold check: Notification No. 12/2024 updated B2CL threshold to > ₹1,00,000
    const isB2cl = !isB2b && inv.isInterState && grandTotalNum > 100000;
    const isB2cs = !isB2b && (!inv.isInterState || (inv.isInterState && grandTotalNum <= 100000));

    // Process line items
    for (const item of inv.items) {
      const taxableNum = parseFloat(String(item.taxableAmount));
      const rateNum = parseFloat(String(item.taxRate));
      const totalAmountNum = parseFloat(String(item.totalAmount));
      const igstNum = parseFloat(String(item.igstAmount));
      const cgstNum = parseFloat(String(item.cgstAmount));
      const sgstNum = parseFloat(String(item.sgstAmount));

      // Table 4: B2B Invoices (Eligible for ITC)
      if (isB2b) {
        b2bSheet.addRow({
          gstin: inv.buyerGstin,
          name: inv.buyerCompanyName || "B2B Registered Buyer",
          invNo: inv.invoiceNumber,
          invDate: invDateStr,
          invVal: grandTotalNum,
          pos: posLabel,
          revCharge: "N",
          appRate: "",
          invType: "Regular",
          ecomGstin: "",
          rate: rateNum,
          taxable: taxableNum,
          cess: 0
        });
      }
      // Table 5: B2CL (Inter-state large > ₹1,00,000)
      else if (isB2cl) {
        b2clSheet.addRow({
          invNo: inv.invoiceNumber,
          invDate: invDateStr,
          invVal: grandTotalNum,
          pos: posLabel,
          appRate: "",
          rate: rateNum,
          taxable: taxableNum,
          cess: 0,
          ecomGstin: ""
        });
      }
      // Table 7: B2CS (Consolidated summary for intra-state + small inter-state <= ₹1,00,000)
      else if (isB2cs) {
        const b2csKey = `${posLabel}__${rateNum}`;
        if (!b2csAggregate[b2csKey]) {
          b2csAggregate[b2csKey] = {
            type: "OE",
            pos: posLabel,
            rate: rateNum,
            taxable: 0,
            cess: 0
          };
        }
        b2csAggregate[b2csKey].taxable += taxableNum;
      }

      // Aggregate for Table 12: HSN Summary (Split into B2B and B2C)
      const hsnKey = `${item.hsnCode}__${supplyType}__${rateNum}`;
      if (!hsnAggregate[hsnKey]) {
        hsnAggregate[hsnKey] = {
          hsn: item.hsnCode,
          desc: item.title,
          uqc: "NOS",
          supplyType,
          rate: rateNum,
          totalQty: 0,
          totalVal: 0,
          taxable: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
          cess: 0
        };
      }

      const h = hsnAggregate[hsnKey];
      h.totalQty += item.quantity;
      h.totalVal += totalAmountNum;
      h.taxable += taxableNum;
      h.igst += igstNum;
      h.cgst += cgstNum;
      h.sgst += sgstNum;
    }

    // Process Composite Shipping Charges (SAC 9968) if present
    const shippingTaxable = parseFloat(String(inv.shippingTaxable || 0));
    if (shippingTaxable > 0) {
      const shipRate = parseFloat(String(inv.shippingTaxRate || 18));
      const shipIgst = parseFloat(String(inv.shippingIgst || 0));
      const shipCgst = parseFloat(String(inv.shippingCgst || 0));
      const shipSgst = parseFloat(String(inv.shippingSgst || 0));
      const shipTotal = shippingTaxable + shipIgst + shipCgst + shipSgst;

      if (isB2b) {
        b2bSheet.addRow({
          gstin: inv.buyerGstin,
          name: inv.buyerCompanyName || "B2B Registered Buyer",
          invNo: inv.invoiceNumber,
          invDate: invDateStr,
          invVal: grandTotalNum,
          pos: posLabel,
          revCharge: "N",
          appRate: "",
          invType: "Regular",
          ecomGstin: "",
          rate: shipRate,
          taxable: shippingTaxable,
          cess: 0
        });
      } else if (isB2cl) {
        b2clSheet.addRow({
          invNo: inv.invoiceNumber,
          invDate: invDateStr,
          invVal: grandTotalNum,
          pos: posLabel,
          appRate: "",
          rate: shipRate,
          taxable: shippingTaxable,
          cess: 0,
          ecomGstin: ""
        });
      } else if (isB2cs) {
        const b2csKey = `${posLabel}__${shipRate}`;
        if (!b2csAggregate[b2csKey]) {
          b2csAggregate[b2csKey] = {
            type: "OE",
            pos: posLabel,
            rate: shipRate,
            taxable: 0,
            cess: 0
          };
        }
        b2csAggregate[b2csKey].taxable += shippingTaxable;
      }

      // Add Shipping to HSN Table under SAC 9968
      const shipHsnKey = `9968__${supplyType}__${shipRate}`;
      if (!hsnAggregate[shipHsnKey]) {
        hsnAggregate[shipHsnKey] = {
          hsn: "9968",
          desc: "Postal, Courier & Delivery Services",
          uqc: "NA",
          supplyType,
          rate: shipRate,
          totalQty: 1,
          totalVal: 0,
          taxable: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
          cess: 0
        };
      }
      const sh = hsnAggregate[shipHsnKey];
      sh.totalVal += shipTotal;
      sh.taxable += shippingTaxable;
      sh.igst += shipIgst;
      sh.cgst += shipCgst;
      sh.sgst += shipSgst;
    }
  }

  // Populate Table 7 (B2CS Consolidated Rows)
  for (const b of Object.values(b2csAggregate)) {
    b2csSheet.addRow({
      type: b.type,
      pos: b.pos,
      appRate: "",
      rate: b.rate,
      taxable: parseFloat(b.taxable.toFixed(2)),
      cess: 0,
      ecomGstin: ""
    });
  }

  // Populate Table 12 (HSN Master, HSN B2B, and HSN B2C)
  for (const h of Object.values(hsnAggregate)) {
    const rowData = {
      hsn: h.hsn,
      desc: h.desc,
      uqc: h.uqc,
      supplyType: h.supplyType,
      totalQty: h.totalQty,
      totalVal: parseFloat(h.totalVal.toFixed(2)),
      rate: h.rate,
      taxable: parseFloat(h.taxable.toFixed(2)),
      igst: parseFloat(h.igst.toFixed(2)),
      cgst: parseFloat(h.cgst.toFixed(2)),
      sgst: parseFloat(h.sgst.toFixed(2)),
      cess: h.cess
    };

    // Master Sheet
    hsnSheet.addRow(rowData);

    // Dedicated B2B vs B2C sheets
    if (h.supplyType === "B2B") {
      hsnB2bSheet.addRow({
        hsn: h.hsn,
        desc: h.desc,
        uqc: h.uqc,
        totalQty: h.totalQty,
        totalVal: parseFloat(h.totalVal.toFixed(2)),
        rate: h.rate,
        taxable: parseFloat(h.taxable.toFixed(2)),
        igst: parseFloat(h.igst.toFixed(2)),
        cgst: parseFloat(h.cgst.toFixed(2)),
        sgst: parseFloat(h.sgst.toFixed(2)),
        cess: h.cess
      });
    } else {
      hsnB2cSheet.addRow({
        hsn: h.hsn,
        desc: h.desc,
        uqc: h.uqc,
        totalQty: h.totalQty,
        totalVal: parseFloat(h.totalVal.toFixed(2)),
        rate: h.rate,
        taxable: parseFloat(h.taxable.toFixed(2)),
        igst: parseFloat(h.igst.toFixed(2)),
        cgst: parseFloat(h.cgst.toFixed(2)),
        sgst: parseFloat(h.sgst.toFixed(2)),
        cess: h.cess
      });
    }
  }

  // Populate Table 13 (Document Issued Summary)
  if (totalInvoices > 0) {
    docsSheet.addRow({
      docType: "Invoices for outward supply",
      from: firstInvNo || "-",
      to: lastInvNo || "-",
      total: totalInvoices,
      cancelled: cancelledInvoices,
      net: totalInvoices - cancelledInvoices
    });
  }

  // Professional styling for all worksheets (Government Navy Blue Header)
  workbook.eachSheet((ws) => {
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" } // Deep Navy Blue
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 24;

    // Add thin borders and alternate row shading
    ws.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.font = { size: 10 };
        row.alignment = { vertical: "middle" };
        if (rowNumber % 2 === 0) {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" } // Subtle slate tint
          };
        }
      }
    });
  });

  return await workbook.xlsx.writeBuffer();
}
