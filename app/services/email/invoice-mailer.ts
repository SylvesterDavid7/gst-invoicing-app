import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

interface InvoiceEmailOptions {
  toEmail: string;
  customerName?: string;
  invoiceNumber: string;
  orderNumber: string;
  grandTotal: string | number;
  pdfUrl?: string | null;
  storeName?: string;
  pdfBuffer?: Buffer;
}

export async function sendInvoiceEmail(options: InvoiceEmailOptions): Promise<boolean> {
  const {
    toEmail,
    customerName = "Valued Customer",
    invoiceNumber,
    orderNumber,
    grandTotal,
    pdfUrl,
    storeName = "X-Brews Specialty Coffee",
    pdfBuffer
  } = options;

  if (!toEmail) {
    console.warn(`[InvoiceMailer] No recipient email provided for invoice ${invoiceNumber}`);
    return false;
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM || `"${storeName} Invoicing" <invoices@inaragroups.com>`;

  // Fallback: If no SMTP configured, log email generation details and return
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log(`[InvoiceMailer] SMTP not configured. Prepared email for ${toEmail} (Invoice: ${invoiceNumber}, Order: #${orderNumber}, Total: ₹${grandTotal})`);
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const publicDownloadUrl = pdfUrl && pdfUrl.startsWith("http")
      ? pdfUrl
      : `https://itskoop.inaragroups.com/api/invoices/download?order_number=${encodeURIComponent(orderNumber)}`;

    const attachments: any[] = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `${invoiceNumber.replace(/\//g, "-")}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf"
      });
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px; }
    .header { border-bottom: 2px solid #16a34a; padding-bottom: 16px; margin-bottom: 24px; }
    .store-name { font-size: 20px; font-weight: 700; color: #111827; }
    .badge { background: #dcfce7; color: #166534; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 4px; }
    .content { font-size: 15px; color: #374151; line-height: 1.6; }
    .invoice-card { background: #f3f4f6; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .detail-label { color: #6b7280; }
    .detail-val { font-weight: 600; color: #111827; }
    .button-container { text-align: center; margin: 28px 0; }
    .btn { background-color: #16a34a; color: #ffffff !important; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 6px; display: inline-block; }
    .footer { font-size: 12px; color: #9ca3af; text-align: center; margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="store-name">${storeName}</div>
      <div class="badge">Official GST Tax Invoice</div>
    </div>
    <div class="content">
      <p>Dear ${customerName},</p>
      <p>Thank you for your order! Your official statutory GST tax invoice has been generated for order <strong>#${orderNumber}</strong>.</p>
      
      <div class="invoice-card">
        <div class="detail-row"><span class="detail-label">Invoice Number:</span><span class="detail-val">${invoiceNumber}</span></div>
        <div class="detail-row"><span class="detail-label">Order Reference:</span><span class="detail-val">#${orderNumber}</span></div>
        <div class="detail-row"><span class="detail-label">Total Amount:</span><span class="detail-val">₹${grandTotal}</span></div>
      </div>

      <div class="button-container">
        <a href="${publicDownloadUrl}" class="btn" target="_blank">📥 Download GST Tax Invoice (PDF)</a>
      </div>

      <p style="font-size: 13px; color: #6b7280;">
        This invoice complies with the Central Goods and Services Tax (CGST) Act, containing full statutory HSN/SAC breakups and applicable tax percentages.
      </p>
    </div>
    <div class="footer">
      Generated automatically by ${storeName} GST Invoicing System.
    </div>
  </div>
</body>
</html>
    `;

    await transporter.sendMail({
      from: fromEmail,
      to: toEmail,
      subject: `GST Tax Invoice ${invoiceNumber} for Order #${orderNumber} - ${storeName}`,
      html: htmlContent,
      attachments
    });

    console.log(`[InvoiceMailer] Successfully sent invoice email to ${toEmail} for ${invoiceNumber}`);
    return true;
  } catch (err: any) {
    console.error(`[InvoiceMailer] Error sending invoice email: ${err.message}`);
    return false;
  }
}
