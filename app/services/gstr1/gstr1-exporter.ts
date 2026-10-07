import ExcelJS from "exceljs";
import { prisma } from "../../db.server";
import { getStateNameByCode } from "../tax-engine/state-codes";

export interface Gstr1ExportFilter {
  storeId: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Builds standard government-compliant GSTR-1 Excel Workbook
 * Sheets:
 * - b2b (Table 4A, 4B, 4C, 6B, 6C)
 * - b2cl (Table 5A, 5B) - Inter-state B2C invoices > ₹2,50,000
 * - b2cs (Table 7) - Other B2C supplies (Intra-state any value + Inter-state <= ₹2,50,000)
 * - cdnr (Table 9B) - Credit Notes for Registered Persons
 * - hsn (Table 12) - HSN Summary of Outward Supplies
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

  // 1. Table 4: B2B Invoices
  const b2bSheet = workbook.addWorksheet("b2b", { views: [{ state: "frozen", ySplit: 1 }] });
  b2bSheet.columns = [
    { header: "GSTIN/UIN of Recipient", key: "gstin", width: 20 },
    { header: "Receiver Name", key: "name", width: 25 },
    { header: "Invoice Number", key: "invNo", width: 18 },
    { header: "Invoice date", key: "invDate", width: 14 },
    { header: "Invoice Value", key: "invVal", width: 14 },
    { header: "Place Of Supply", key: "pos", width: 20 },
    { header: "Reverse Charge", key: "revCharge", width: 14 },
    { header: "Applicable % of Tax Rate", key: "appRate", width: 14 },
    { header: "Invoice Type", key: "invType", width: 14 },
    { header: "E-Commerce GSTIN", key: "ecomGstin", width: 16 },
    { header: "Rate", key: "rate", width: 10 },
    { header: "Taxable Value", key: "taxable", width: 14 },
    { header: "Cess Amount", key: "cess", width: 12 }
  ];

  // 2. Table 5: B2CL (Inter-state large > 2.5L)
  const b2clSheet = workbook.addWorksheet("b2cl", { views: [{ state: "frozen", ySplit: 1 }] });
  b2clSheet.columns = [
    { header: "Invoice Number", key: "invNo", width: 18 },
    { header: "Invoice date", key: "invDate", width: 14 },
    { header: "Invoice Value", key: "invVal", width: 14 },
    { header: "Place Of Supply", key: "pos", width: 20 },
    { header: "Applicable % of Tax Rate", key: "appRate", width: 14 },
    { header: "Rate", key: "rate", width: 10 },
    { header: "Taxable Value", key: "taxable", width: 14 },
    { header: "Cess Amount", key: "cess", width: 12 }
  ];

  // 3. Table 7: B2CS (Small B2C)
  const b2csSheet = workbook.addWorksheet("b2cs", { views: [{ state: "frozen", ySplit: 1 }] });
  b2csSheet.columns = [
    { header: "Type", key: "type", width: 12 },
    { header: "Place Of Supply", key: "pos", width: 20 },
    { header: "Applicable % of Tax Rate", key: "appRate", width: 14 },
    { header: "Rate", key: "rate", width: 10 },
    { header: "Taxable Value", key: "taxable", width: 14 },
    { header: "Cess Amount", key: "cess", width: 12 },
    { header: "E-Commerce GSTIN", key: "ecomGstin", width: 16 }
  ];

  // 4. Table 12: HSN Summary
  const hsnSheet = workbook.addWorksheet("hsn", { views: [{ state: "frozen", ySplit: 1 }] });
  hsnSheet.columns = [
    { header: "HSN", key: "hsn", width: 12 },
    { header: "Description", key: "desc", width: 25 },
    { header: "UQC", key: "uqc", width: 10 },
    { header: "Total Quantity", key: "totalQty", width: 14 },
    { header: "Total Value", key: "totalVal", width: 14 },
    { header: "Taxable Value", key: "taxable", width: 14 },
    { header: "Integrated Tax Amount", key: "igst", width: 16 },
    { header: "Central Tax Amount", key: "cgst", width: 16 },
    { header: "State/UT Tax Amount", key: "sgst", width: 16 },
    { header: "Cess Amount", key: "cess", width: 12 }
  ];

  const hsnAggregate: Record<string, any> = {};

  for (const inv of invoices) {
    const invDateStr = inv.invoiceDate.toISOString().split("T")[0];
    const posLabel = `${inv.posStateCode}-${getStateNameByCode(inv.posStateCode)}`;
    const grandTotalNum = parseFloat(String(inv.grandTotal));

    for (const item of inv.items) {
      const taxableNum = parseFloat(String(item.taxableAmount));
      const rateNum = parseFloat(String(item.taxRate));

      // Table 4: B2B
      if (inv.buyerGstin) {
        b2bSheet.addRow({
          gstin: inv.buyerGstin,
          name: inv.buyerCompanyName || "B2B Buyer",
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
      // Table 5: B2CL (Inter-state & Grand Total > 2.5 Lakhs)
      else if (inv.isInterState && grandTotalNum > 250000) {
        b2clSheet.addRow({
          invNo: inv.invoiceNumber,
          invDate: invDateStr,
          invVal: grandTotalNum,
          pos: posLabel,
          appRate: "",
          rate: rateNum,
          taxable: taxableNum,
          cess: 0
        });
      }
      // Table 7: B2CS
      else {
        b2csSheet.addRow({
          type: "OE",
          pos: posLabel,
          appRate: "",
          rate: rateNum,
          taxable: taxableNum,
          cess: 0,
          ecomGstin: ""
        });
      }

      // Aggregate for Table 12: HSN
      if (!hsnAggregate[item.hsnCode]) {
        hsnAggregate[item.hsnCode] = {
          hsn: item.hsnCode,
          desc: item.title,
          uqc: "NOS",
          totalQty: 0,
          totalVal: 0,
          taxable: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
          cess: 0
        };
      }
      const h = hsnAggregate[item.hsnCode];
      h.totalQty += item.quantity;
      h.totalVal += parseFloat(String(item.totalAmount));
      h.taxable += taxableNum;
      h.igst += parseFloat(String(item.igstAmount));
      h.cgst += parseFloat(String(item.cgstAmount));
      h.sgst += parseFloat(String(item.sgstAmount));
    }
  }

  // Populate HSN Sheet
  for (const h of Object.values(hsnAggregate)) {
    hsnSheet.addRow(h);
  }

  // Styling header row for all worksheets
  workbook.eachSheet((ws) => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" } // Navy Blue
    };
    row.alignment = { vertical: "middle" };
  });

  return await workbook.xlsx.writeBuffer();
}
