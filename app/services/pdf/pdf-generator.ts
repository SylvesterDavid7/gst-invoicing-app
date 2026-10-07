import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import { convertNumberToIndianWords } from "./number-to-words";
import { getStateNameByCode } from "../tax-engine/state-codes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register Handlebars helpers
Handlebars.registerHelper("halfRate", function (rate: any) {
  const num = parseFloat(rate);
  return isNaN(num) ? "0.00" : (num / 2).toFixed(2);
});

Handlebars.registerHelper("@index", function (options: any) {
  return (options.data?.index ?? 0) + 1;
});

const templatePath = path.join(__dirname, "template.html");
let cachedTemplate: HandlebarsTemplateDelegate | null = null;

function getTemplate(): HandlebarsTemplateDelegate {
  if (!cachedTemplate) {
    const rawHtml = fs.readFileSync(templatePath, "utf-8");
    cachedTemplate = Handlebars.compile(rawHtml);
  }
  return cachedTemplate;
}

export interface RenderInvoicePdfInput {
  store: {
    legalName: string;
    tradeName?: string | null;
    gstin: string;
    stateCode: string;
    registeredAddress: any;
    logoUrl?: string | null;
    signatureUrl?: string | null;
    termsAndConditions?: string | null;
  };
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string;
  posStateCode: string;
  buyerName: string;
  buyerCompanyName?: string | null;
  buyerGstin?: string | null;
  buyerAddress?: any;
  shippingAddress?: any;
  isInterState: boolean;
  items: Array<{
    title: string;
    sku?: string | null;
    hsnCode: string;
    quantity: number;
    unitPrice: string | number;
    taxableAmount: string | number;
    taxRate: string | number;
    cgstAmount: string | number;
    sgstAmount: string | number;
    igstAmount: string | number;
    totalAmount: string | number;
  }>;
  shipping: {
    shippingGross: string | number;
    shippingTaxable: string | number;
    shippingTaxRate: string | number;
    shippingCgst: string | number;
    shippingSgst: string | number;
    shippingIgst: string | number;
  };
  totalTaxable: string | number;
  totalCgst: string | number;
  totalSgst: string | number;
  totalIgst: string | number;
  grandTotal: string | number;
  hsnSummaryList: Array<{
    hsnCode: string;
    taxableAmount: string | number;
    cgstAmount: string | number;
    sgstAmount: string | number;
    igstAmount: string | number;
    totalTax: string | number;
  }>;
}

/**
 * Compiles HTML and renders an A4 PDF Buffer using headless Chromium
 */
export async function renderInvoicePdfBuffer(data: RenderInvoicePdfInput): Promise<Buffer> {
  const template = getTemplate();

  const posStateName = getStateNameByCode(data.posStateCode);
  const amountInWords = convertNumberToIndianWords(data.grandTotal);

  const htmlContent = template({
    ...data,
    posStateName,
    amountInWords
  });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "10mm",
        right: "12mm",
        bottom: "12mm",
        left: "12mm"
      }
    });

    return Buffer.from(pdfUint8Array);
  } finally {
    await browser.close();
  }
}
