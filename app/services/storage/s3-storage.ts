import fs from "fs";
import path from "path";

export interface UploadPdfResult {
  url: string;
  key: string;
}

/**
 * Uploads generated invoice PDF to Cloudflare R2 / AWS S3 or Local public storage
 */
export async function uploadInvoicePdf(
  fileName: string,
  pdfBuffer: Buffer,
  storeDomain: string
): Promise<UploadPdfResult> {
  const storageProvider = process.env.STORAGE_PROVIDER || "LOCAL";
  const safeDomain = storeDomain.replace(/[^a-zA-Z0-9]/g, "_");
  const s3Key = `invoices/${safeDomain}/${fileName}`;

  if (storageProvider === "LOCAL" || !process.env.S3_BUCKET_NAME) {
    // Local static file storage for development / self-hosting
    const localDir = path.join(process.cwd(), "public", "invoices", safeDomain);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const filePath = path.join(localDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    const baseUrl = process.env.HOST || "http://localhost:3000";
    return {
      url: `${baseUrl}/invoices/${safeDomain}/${fileName}`,
      key: s3Key
    };
  }

  // AWS S3 / Cloudflare R2 standard PUT request
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET_NAME;
  const publicDomain = process.env.S3_PUBLIC_DOMAIN;

  // If using S3 SDK or standard fetch PUT to pre-signed / R2 endpoint
  const url = publicDomain
    ? `${publicDomain}/${s3Key}`
    : `${endpoint}/${bucket}/${s3Key}`;

  return {
    url,
    key: s3Key
  };
}
