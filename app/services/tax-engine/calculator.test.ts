import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateGstOrder } from "./gst-calculator";
import { normalizeStateCode, getStateNameByCode } from "./state-codes";
import { validateGstin } from "./gstin-validator";
import { getCurrentIndianFiscalYear } from "../sequence-engine/sequence-generator";

describe("GST State Codes & Normalization", () => {
  it("should normalize state abbreviations and names correctly", () => {
    assert.equal(normalizeStateCode("MH"), "27");
    assert.equal(normalizeStateCode("Maharashtra"), "27");
    assert.equal(normalizeStateCode("KA"), "29");
    assert.equal(normalizeStateCode("Karnataka"), "29");
    assert.equal(normalizeStateCode("Delhi"), "07");
    assert.equal(normalizeStateCode("DL"), "07");
    assert.equal(normalizeStateCode("27"), "27");
  });

  it("should return state name for given code", () => {
    assert.equal(getStateNameByCode("27"), "Maharashtra");
    assert.equal(getStateNameByCode("29"), "Karnataka");
    assert.equal(getStateNameByCode("07"), "Delhi");
  });
});

describe("GSTIN Validation & Checksum", () => {
  it("should validate a valid GSTIN format and state", () => {
    // 27 (Maharashtra) + AAPFU0955D (PAN) + 1 + Z + 5
    const res = validateGstin("27AAPFU0955D1Z5");
    assert.equal(res.stateCode, "27");
    assert.equal(res.pan, "AAPFU0955D");
  });

  it("should reject invalid length or bad characters", () => {
    assert.equal(validateGstin("27AAPFU0955D1Z").isValid, false);
    assert.equal(validateGstin("INVALIDGSTIN123").isValid, false);
  });
});

describe("GST Calculation Engine", () => {
  it("should correctly calculate Intra-state CGST and SGST for tax-inclusive price", () => {
    // Seller: Maharashtra (27), Buyer: Maharashtra (27)
    // Item: ₹1,180 (incl. 18% GST) -> Taxable: ₹1,000, CGST: ₹90, SGST: ₹90
    const result = calculateGstOrder({
      sellerStateCode: "27",
      buyerStateCode: "27",
      items: [
        {
          title: "Premium Roasted Coffee Beans",
          sku: "COFFEE-01",
          quantity: 1,
          unitPrice: 1180,
          taxRate: 18
        }
      ],
      shippingPrice: 0,
      isTaxInclusive: true
    });

    assert.equal(result.isInterState, false);
    assert.equal(result.totalTaxable.toFixed(2), "1000.00");
    assert.equal(result.totalCgst.toFixed(2), "90.00");
    assert.equal(result.totalSgst.toFixed(2), "90.00");
    assert.equal(result.totalIgst.toFixed(2), "0.00");
    assert.equal(result.grandTotal.toFixed(2), "1180.00");
  });

  it("should correctly calculate Inter-state IGST for tax-inclusive price", () => {
    // Seller: Maharashtra (27), Buyer: Karnataka (29)
    // Item: ₹1,180 (incl. 18% GST) -> Taxable: ₹1,000, IGST: ₹180
    const result = calculateGstOrder({
      sellerStateCode: "27",
      buyerStateCode: "29",
      items: [
        {
          title: "Pour-over Dripper",
          sku: "DRIPPER-02",
          quantity: 1,
          unitPrice: 1180,
          taxRate: 18
        }
      ],
      shippingPrice: 0,
      isTaxInclusive: true
    });

    assert.equal(result.isInterState, true);
    assert.equal(result.totalTaxable.toFixed(2), "1000.00");
    assert.equal(result.totalCgst.toFixed(2), "0.00");
    assert.equal(result.totalSgst.toFixed(2), "0.00");
    assert.equal(result.totalIgst.toFixed(2), "180.00");
    assert.equal(result.grandTotal.toFixed(2), "1180.00");
  });

  it("should tax composite shipping charges at highest bracket in cart", () => {
    // Cart has item with 5% GST and item with 18% GST
    // Shipping of ₹118 should be taxed at 18%
    const result = calculateGstOrder({
      sellerStateCode: "27",
      buyerStateCode: "27",
      items: [
        {
          title: "Coffee Powder",
          quantity: 1,
          unitPrice: 105,
          taxRate: 5 // 5%
        },
        {
          title: "Ceramic Mug",
          quantity: 1,
          unitPrice: 118,
          taxRate: 18 // 18% (Highest)
        }
      ],
      shippingPrice: 118, // Shipping ₹118 (incl. tax)
      isTaxInclusive: true
    });

    assert.equal(result.shipping.shippingTaxRate.toFixed(2), "18.00");
    assert.equal(result.shipping.shippingTaxable.toFixed(2), "100.00");
    assert.equal(result.shipping.shippingCgst.toFixed(2), "9.00");
    assert.equal(result.shipping.shippingSgst.toFixed(2), "9.00");
  });
});

describe("Fiscal Year Rollover", () => {
  it("should calculate correct Indian FY before and after April 1st", () => {
    const may2026 = new Date(2026, 4, 15); // May 2026
    assert.equal(getCurrentIndianFiscalYear(may2026), "26-27");

    const feb2027 = new Date(2027, 1, 10); // Feb 2027
    assert.equal(getCurrentIndianFiscalYear(feb2027), "26-27");

    const apr2027 = new Date(2027, 3, 1); // April 1, 2027
    assert.equal(getCurrentIndianFiscalYear(apr2027), "27-28");
  });
});
