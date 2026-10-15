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

Handlebars.registerHelper("inc", function (value: any) {
  const num = parseInt(value, 10);
  return isNaN(num) ? 1 : num + 1;
});

Handlebars.registerHelper("formatCurrency", function (value: any) {
  const num = parseFloat(value);
  return isNaN(num) ? "0.00" : num.toFixed(2);
});

Handlebars.registerHelper("ifAny", function (this: any, ...args: any[]) {
  const options = args.pop();
  return args.some(Boolean) ? options.fn(this) : options.inverse(this);
});

function findTemplatePath(): string {
  const candidates = [
    path.join(__dirname, "template.html"),
    path.join(process.cwd(), "app", "services", "pdf", "template.html"),
    path.join(process.cwd(), "build", "server", "template.html"),
    path.resolve(__dirname, "../../app/services/pdf/template.html")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(process.cwd(), "app", "services", "pdf", "template.html");
}

let cachedTemplate: HandlebarsTemplateDelegate | null = null;

function getTemplate(): HandlebarsTemplateDelegate {
  if (!cachedTemplate) {
    const templatePath = findTemplatePath();
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
    brandColor?: string | null;
    bankDetails?: any;
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

  let parsedBankDetails = data.store.bankDetails;
  if (typeof parsedBankDetails === "string") {
    try {
      parsedBankDetails = JSON.parse(parsedBankDetails);
    } catch {
      parsedBankDetails = null;
    }
  }

  const brandColor = data.store.brandColor && data.store.brandColor.trim() ? data.store.brandColor.trim() : "#008060";

  const htmlContent = template({
    ...data,
    brandColor,
    store: {
      ...data.store,
      brandColor,
      bankDetails: parsedBankDetails
    },
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
