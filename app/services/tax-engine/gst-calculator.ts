import Decimal from "decimal.js";

// Ensure 2-decimal financial rounding precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface RawOrderItem {
  title: string;
  sku?: string | null;
  hsnCode?: string | null;
  quantity: number;
  unitPrice: number | string;
  taxRate: number | string; // e.g. 18 for 18%
  discountAmount?: number | string;
}

export interface CalculatedInvoiceItem {
  title: string;
  sku: string | null;
  hsnCode: string;
  quantity: number;
  unitPrice: Decimal;
  taxRate: Decimal;
  grossAmount: Decimal;
  discountAmount: Decimal;
  taxableAmount: Decimal;
  cgstAmount: Decimal;
  sgstAmount: Decimal;
  igstAmount: Decimal;
  totalTax: Decimal;
  totalAmount: Decimal;
}

export interface ShippingTaxBreakdown {
  shippingGross: Decimal;
  shippingTaxable: Decimal;
  shippingTaxRate: Decimal;
  shippingCgst: Decimal;
  shippingSgst: Decimal;
  shippingIgst: Decimal;
  shippingTotalTax: Decimal;
}

export interface InvoiceCalculationSummary {
  isInterState: boolean;
  sellerStateCode: string;
  buyerStateCode: string;
  items: CalculatedInvoiceItem[];
  shipping: ShippingTaxBreakdown;
  totalTaxable: Decimal;
  totalCgst: Decimal;
  totalSgst: Decimal;
  totalIgst: Decimal;
  totalTax: Decimal;
  grandTotal: Decimal;
  hsnSummary: Record<string, {
    hsnCode: string;
    taxableAmount: Decimal;
    cgstAmount: Decimal;
    sgstAmount: Decimal;
    igstAmount: Decimal;
    totalTax: Decimal;
  }>;
}

export interface CalculateGstParams {
  sellerStateCode: string;
  buyerStateCode: string;
  items: RawOrderItem[];
  shippingPrice?: number | string;
  isTaxInclusive?: boolean; // Default true for Shopify India
  defaultHsn?: string;
}

/**
 * Core GST Calculation Engine conforming to statutory rules (CGST / SGST / IGST Acts)
 */
export function calculateGstOrder(params: CalculateGstParams): InvoiceCalculationSummary {
  const {
    sellerStateCode,
    buyerStateCode,
    items: rawItems,
    shippingPrice = 0,
    isTaxInclusive = true,
    defaultHsn = "9983"
  } = params;

  const isInterState = sellerStateCode.trim() !== buyerStateCode.trim();

  let totalTaxable = new Decimal(0);
  let totalCgst = new Decimal(0);
  let totalSgst = new Decimal(0);
  let totalIgst = new Decimal(0);
  let maxItemTaxRate = new Decimal(0);

  const calculatedItems: CalculatedInvoiceItem[] = [];
  const hsnMap: InvoiceCalculationSummary["hsnSummary"] = {};

  for (const item of rawItems) {
    const qty = new Decimal(item.quantity);
    const unitPrice = new Decimal(item.unitPrice);
    const taxRate = new Decimal(item.taxRate);
    const discount = new Decimal(item.discountAmount || 0);

    if (taxRate.greaterThan(maxItemTaxRate)) {
      maxItemTaxRate = taxRate;
    }

    const grossAmount = unitPrice.times(qty).minus(discount);
    let taxableAmount: Decimal;
    let lineTax: Decimal;

    if (isTaxInclusive) {
      // Base Taxable = Gross / (1 + Rate / 100)
      const divisor = new Decimal(1).plus(taxRate.dividedBy(100));
      taxableAmount = grossAmount.dividedBy(divisor).toDecimalPlaces(2);
      lineTax = grossAmount.minus(taxableAmount).toDecimalPlaces(2);
    } else {
      // Base Taxable = Gross
      taxableAmount = grossAmount.toDecimalPlaces(2);
      lineTax = taxableAmount.times(taxRate.dividedBy(100)).toDecimalPlaces(2);
    }

    let cgst = new Decimal(0);
    let sgst = new Decimal(0);
    let igst = new Decimal(0);

    if (isInterState) {
      igst = lineTax;
      totalIgst = totalIgst.plus(igst);
    } else {
      // Intra-state: CGST = Tax/2, SGST = Tax/2
      cgst = lineTax.dividedBy(2).toDecimalPlaces(2);
      // Allocate any remainder penny to SGST to preserve lineTax exact sum
      sgst = lineTax.minus(cgst);
      totalCgst = totalCgst.plus(cgst);
      totalSgst = totalSgst.plus(sgst);
    }

    totalTaxable = totalTaxable.plus(taxableAmount);

    const lineTotal = taxableAmount.plus(lineTax);
    const hsn = (item.hsnCode || defaultHsn).trim();

    calculatedItems.push({
      title: item.title,
      sku: item.sku || null,
      hsnCode: hsn,
      quantity: item.quantity,
      unitPrice,
      taxRate,
      grossAmount,
      discountAmount: discount,
      taxableAmount,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      totalTax: lineTax,
      totalAmount: lineTotal
    });

    // Populate statutory HSN summary table
    if (!hsnMap[hsn]) {
      hsnMap[hsn] = {
        hsnCode: hsn,
        taxableAmount: new Decimal(0),
        cgstAmount: new Decimal(0),
        sgstAmount: new Decimal(0),
        igstAmount: new Decimal(0),
        totalTax: new Decimal(0)
      };
    }
    hsnMap[hsn].taxableAmount = hsnMap[hsn].taxableAmount.plus(taxableAmount);
    hsnMap[hsn].cgstAmount = hsnMap[hsn].cgstAmount.plus(cgst);
    hsnMap[hsn].sgstAmount = hsnMap[hsn].sgstAmount.plus(sgst);
    hsnMap[hsn].igstAmount = hsnMap[hsn].igstAmount.plus(igst);
    hsnMap[hsn].totalTax = hsnMap[hsn].totalTax.plus(lineTax);
  }

  // Handle shipping tax allocation (Composite supply rule: taxed at highest rate in basket or 18% default)
  const shippingGross = new Decimal(shippingPrice);
  const shippingTaxRate = maxItemTaxRate.greaterThan(0) ? maxItemTaxRate : new Decimal(18);

  let shippingTaxable = new Decimal(0);
  let shippingTax = new Decimal(0);
  let shippingCgst = new Decimal(0);
  let shippingSgst = new Decimal(0);
  let shippingIgst = new Decimal(0);

  if (shippingGross.greaterThan(0)) {
    if (isTaxInclusive) {
      const shippingDivisor = new Decimal(1).plus(shippingTaxRate.dividedBy(100));
      shippingTaxable = shippingGross.dividedBy(shippingDivisor).toDecimalPlaces(2);
      shippingTax = shippingGross.minus(shippingTaxable).toDecimalPlaces(2);
    } else {
      shippingTaxable = shippingGross.toDecimalPlaces(2);
      shippingTax = shippingTaxable.times(shippingTaxRate.dividedBy(100)).toDecimalPlaces(2);
    }

    if (isInterState) {
      shippingIgst = shippingTax;
      totalIgst = totalIgst.plus(shippingIgst);
    } else {
      shippingCgst = shippingTax.dividedBy(2).toDecimalPlaces(2);
      shippingSgst = shippingTax.minus(shippingCgst);
      totalCgst = totalCgst.plus(shippingCgst);
      totalSgst = totalSgst.plus(shippingSgst);
    }

    totalTaxable = totalTaxable.plus(shippingTaxable);

    // Populate statutory SAC 9968 summary for shipping/courier charges
    const shippingHsn = "9968";
    if (!hsnMap[shippingHsn]) {
      hsnMap[shippingHsn] = {
        hsnCode: shippingHsn,
        taxableAmount: new Decimal(0),
        cgstAmount: new Decimal(0),
        sgstAmount: new Decimal(0),
        igstAmount: new Decimal(0),
        totalTax: new Decimal(0)
      };
    }
    hsnMap[shippingHsn].taxableAmount = hsnMap[shippingHsn].taxableAmount.plus(shippingTaxable);
    hsnMap[shippingHsn].cgstAmount = hsnMap[shippingHsn].cgstAmount.plus(shippingCgst);
    hsnMap[shippingHsn].sgstAmount = hsnMap[shippingHsn].sgstAmount.plus(shippingSgst);
    hsnMap[shippingHsn].igstAmount = hsnMap[shippingHsn].igstAmount.plus(shippingIgst);
    hsnMap[shippingHsn].totalTax = hsnMap[shippingHsn].totalTax.plus(shippingTax);
  }

  const shippingBreakdown: ShippingTaxBreakdown = {
    shippingGross,
    shippingTaxable,
    shippingTaxRate,
    shippingCgst,
    shippingSgst,
    shippingIgst,
    shippingTotalTax: shippingTax
  };

  const totalTax = totalCgst.plus(totalSgst).plus(totalIgst);
  const grandTotal = totalTaxable.plus(totalTax);

  return {
    isInterState,
    sellerStateCode,
    buyerStateCode,
    items: calculatedItems,
    shipping: shippingBreakdown,
    totalTaxable,
    totalCgst,
    totalSgst,
    totalIgst,
    totalTax,
    grandTotal,
    hsnSummary: hsnMap
  };
}
