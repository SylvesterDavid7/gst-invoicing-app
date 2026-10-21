const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Read the high quality Sanbaee Vector Logo SVG (purple outline version)
const logoPath = 'c:/Users/GF63/OneDrive/Desktop/App CC/Antigravity/X-Brews/sanbaee/public/SanBaee_Logo.svg';
let sanbaeeLogoSvg = '';
if (fs.existsSync(logoPath)) {
  sanbaeeLogoSvg = fs.readFileSync(logoPath, 'utf8')
    .replace(/width=\"[^\"]*\"/, '')
    .replace(/height=\"[^\"]*\"/, '');
}

const invoiceHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - Klimare Sustainables / Sanbaee - Madras Square</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    
    @page {
      size: A4;
      margin: 12mm 14mm 12mm 14mm;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e1b2e;
      background: #ffffff;
      line-height: 1.5;
      font-size: 11.5px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .invoice-wrapper {
      width: 100%;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
    }

    /* Top Accent Banner */
    .top-accent {
      height: 6px;
      background: linear-gradient(90deg, #321e54 0%, #683bb5 50%, #905cf2 100%);
    }

    .content-padded {
      padding: 30px 34px;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 1px solid #f0edf6;
    }

    .brand-section {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .logo-container {
      width: 125px;
      height: 65px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }

    .logo-container svg {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .brand-divider {
      width: 1.5px;
      height: 48px;
      background-color: #e5e0f0;
    }

    .brand-text h2 {
      font-size: 16px;
      font-weight: 800;
      color: #321e54;
      letter-spacing: -0.2px;
      line-height: 1.2;
    }

    .brand-text .company-sub {
      font-size: 10.5px;
      color: #683bb5;
      font-weight: 600;
      margin-top: 2px;
    }

    .invoice-title-block {
      text-align: right;
    }

    .invoice-tag {
      display: inline-block;
      font-size: 9.5px;
      font-weight: 800;
      color: #683bb5;
      background: #f1ecff;
      padding: 3px 9px;
      border-radius: 4px;
      letter-spacing: 0.8px;
      margin-bottom: 5px;
      text-transform: uppercase;
    }

    .invoice-title {
      font-size: 20px;
      font-weight: 800;
      color: #1e1b2e;
      letter-spacing: -0.5px;
      line-height: 1.1;
    }

    .invoice-no {
      font-size: 12px;
      font-weight: 700;
      color: #5d5672;
      margin-top: 3px;
    }

    /* Metadata Parties */
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin: 22px 0 24px 0;
    }

    .meta-box {
      background: #faf9fd;
      border: 1px solid #efeaf8;
      border-radius: 10px;
      padding: 16px;
    }

    .meta-label {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #683bb5;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .party-name {
      font-size: 14px;
      font-weight: 800;
      color: #1e1b2e;
      margin-bottom: 6px;
    }

    .party-detail {
      font-size: 11px;
      color: #5d5672;
      line-height: 1.6;
    }

    .meta-inline-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #5d5672;
      padding-top: 4px;
      margin-top: 4px;
      border-top: 1px dashed #e8e2f2;
    }

    .meta-inline-row span:last-child {
      font-weight: 700;
      color: #1e1b2e;
    }

    /* Table Styles */
    .table-container {
      margin-bottom: 22px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #eeeaf6;
      border-radius: 8px;
      overflow: hidden;
    }

    thead th {
      background: #321e54;
      color: #ffffff;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 10px 14px;
      text-align: left;
    }

    tbody td {
      padding: 12px 14px;
      border-bottom: 1px solid #f2edf8;
      color: #3b364c;
      font-size: 11px;
      vertical-align: middle;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    tbody tr:nth-child(even) {
      background-color: #fdfcff;
    }

    .td-center {
      text-align: center;
    }

    .td-right {
      text-align: right;
    }

    .item-title {
      font-weight: 700;
      color: #1e1b2e;
      font-size: 12px;
      margin-bottom: 2px;
    }

    .item-desc {
      font-size: 10.5px;
      color: #7b748f;
    }

    .badge-qty {
      display: inline-block;
      font-weight: 700;
      background: #f1ecff;
      color: #4b2297;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      white-space: nowrap;
    }

    /* Calculation Section */
    .summary-section {
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 18px;
    }

    .words-and-notes {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .words-box {
      background: #faf8fe;
      border-left: 3px solid #683bb5;
      padding: 10px 14px;
      border-radius: 0 8px 8px 0;
    }

    .words-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #7f7895;
      margin-bottom: 2px;
    }

    .words-val {
      font-size: 11.5px;
      font-weight: 700;
      color: #321e54;
      line-height: 1.35;
    }

    /* Bank Details Card */
    .bank-card {
      background: #fcfbfe;
      border: 1px solid #e7e0f4;
      border-radius: 8px;
      padding: 12px 14px;
    }

    .bank-title {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #683bb5;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .bank-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 14px;
    }

    .bank-item-label {
      font-size: 9.5px;
      font-weight: 600;
      color: #7f7895;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .bank-item-val {
      font-size: 11px;
      font-weight: 700;
      color: #1e1b2e;
      margin-top: 1px;
    }

    .notes-box {
      font-size: 10px;
      color: #6d6682;
      line-height: 1.5;
      background: #fbfbfd;
      border: 1px dashed #e6e2ee;
      border-radius: 8px;
      padding: 10px 14px;
    }

    .notes-box strong {
      color: #2b2738;
    }

    .totals-card {
      background: #faf9fd;
      border: 1px solid #efeaf8;
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      padding: 6px 0;
      color: #5d5672;
    }

    .total-row.exempt {
      color: #1f8b4c;
      font-weight: 600;
    }

    .total-divider {
      height: 1px;
      background: #e7e0f2;
      margin: 10px 0;
    }

    .grand-total-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding-top: 4px;
    }

    .grand-total-label {
      font-size: 13px;
      font-weight: 800;
      color: #1e1b2e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .grand-total-val {
      font-size: 22px;
      font-weight: 800;
      color: #321e54;
      white-space: nowrap;
    }

    /* Footer Clean / Computer Generated */
    .footer-section {
      margin-top: 26px;
      padding-top: 16px;
      border-top: 1px solid #f0edf6;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .declaration {
      font-size: 9.5px;
      color: #8c859d;
      max-width: 60%;
      line-height: 1.4;
    }

    .no-sign-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 700;
      color: #4b2297;
      background: #f4f0fc;
      border: 1px solid #e5daf7;
      padding: 6px 12px;
      border-radius: 6px;
      letter-spacing: 0.2px;
    }
  </style>
</head>
<body>

  <div class="invoice-wrapper">
    <div class="top-accent"></div>
    <div class="content-padded">
      
      <!-- Header with Authentic Sanbaee Logo -->
      <div class="header">
        <div class="brand-section">
          <div class="logo-container">
            ${sanbaeeLogoSvg}
          </div>
          <div class="brand-divider"></div>
          <div class="brand-text">
            <h2>Klimare Sustainables Pvt. Ltd.</h2>
            <div class="company-sub">Brand: Sanbaee &bull; Premium Wellness Solutions</div>
          </div>
        </div>

        <div class="invoice-title-block">
          <div class="invoice-tag">NON-GST INVOICE</div>
          <div class="invoice-title">BILL / INVOICE</div>
          <div class="invoice-no">#SB-2026-1482</div>
        </div>
      </div>

      <!-- Parties Metadata Grid -->
      <div class="meta-grid">
        <!-- Billed By -->
        <div class="meta-box">
          <div class="meta-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Billed By (Seller)
          </div>
          <div class="party-name">Klimare Sustainables Pvt. Ltd.</div>
          <div class="party-detail">
            <strong>Brand:</strong> Sanbaee<br>
            <strong>Nature of Supply:</strong> Premium Wellness & Premix Solutions<br>
            <strong>Website:</strong> www.sanbaee.com
          </div>
        </div>

        <!-- Billed To -->
        <div class="meta-box">
          <div class="meta-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Billed To (Customer)
          </div>
          <div class="party-name">East Coast Madras</div>
          <div class="party-detail">
            <strong>Customer Account:</strong> Madras Square (East Coast Madras)<br>
            <strong>Supply Type:</strong> Commercial Sample Supply
          </div>
          <div class="meta-inline-row">
            <span>Invoice Date:</span>
            <span>19 October 2026</span>
          </div>
          <div class="meta-inline-row">
            <span>Payment Terms:</span>
            <span>Due on Receipt</span>
          </div>
        </div>
      </div>

      <!-- Line Items Table -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="td-center" style="width: 38px;">#</th>
              <th style="width: 48%;">Item & Description</th>
              <th class="td-center" style="width: 14%;">Qty</th>
              <th class="td-right" style="width: 18%;">Unit Price</th>
              <th class="td-right" style="width: 20%;">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="td-center" style="font-weight: 600; color: #888;">01</td>
              <td>
                <div class="item-title">Sanbaee Premix Sample</div>
                <div class="item-desc">Sample pack formulation — Non-GST supply</div>
              </td>
              <td class="td-center">
                <span class="badge-qty">7 units</span>
              </td>
              <td class="td-right" style="font-weight: 600;">₹ 250.00</td>
              <td class="td-right" style="font-weight: 700; color: #1e1b2e;">₹ 1,750.00</td>
            </tr>
            <tr>
              <td class="td-center" style="font-weight: 600; color: #888;">02</td>
              <td>
                <div class="item-title">Sanbaee Premix 1kg</div>
                <div class="item-desc">1 Kilogram bulk pack formulation — Non-GST supply</div>
              </td>
              <td class="td-center">
                <span class="badge-qty">1 unit</span>
              </td>
              <td class="td-right" style="font-weight: 600;">₹ 5,999.00</td>
              <td class="td-right" style="font-weight: 700; color: #1e1b2e;">₹ 5,999.00</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Calculation & Payment Section -->
      <div class="summary-section">
        <div class="words-and-notes">
          <div class="words-box">
            <div class="words-title">Total Amount in Words</div>
            <div class="words-val">Seven Thousand Seven Hundred Forty-Nine Rupees Only</div>
          </div>

          <!-- Bank & Payment Details Card -->
          <div class="bank-card">
            <div class="bank-title">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
              Bank &amp; Payment Details
            </div>
            <div class="bank-grid">
              <div>
                <div class="bank-item-label">Account Name</div>
                <div class="bank-item-val">SANJANA VIJAY SARATHY</div>
              </div>
              <div>
                <div class="bank-item-label">Bank</div>
                <div class="bank-item-val">HDFC Bank</div>
              </div>
              <div>
                <div class="bank-item-label">Account Number</div>
                <div class="bank-item-val" style="letter-spacing: 0.5px;">50100816198055</div>
              </div>
              <div>
                <div class="bank-item-label">IFSC Code</div>
                <div class="bank-item-val" style="letter-spacing: 0.5px;">HDFC0000010</div>
              </div>
              <div style="grid-column: span 2;">
                <div class="bank-item-label">Branch</div>
                <div class="bank-item-val">Besant Nagar, Chennai - 600090</div>
              </div>
            </div>
          </div>

          <div class="notes-box">
            <strong>Notes & Terms:</strong><br>
            • This is a Non-GST commercial invoice / bill of supply.<br>
            • No GST has been added or charged to this bill.
          </div>
        </div>

        <div class="totals-card">
          <div>
            <div class="total-row">
              <span>Subtotal (Net Amount)</span>
              <span style="font-weight: 600; color: #1e1b2e;" class="nowrap">₹ 7,749.00</span>
            </div>
            <div class="total-row exempt">
              <span>GST / Taxes (0%)</span>
              <span class="nowrap">₹ 0.00 (Nil)</span>
            </div>
          </div>
          <div>
            <div class="total-divider"></div>
            <div class="grand-total-row">
              <span class="grand-total-label">Grand Total</span>
              <span class="grand-total-val">₹ 7,749.00</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Clean / Computer Generated -->
      <div class="footer-section">
        <div class="declaration">
          <strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
        </div>
        <div class="no-sign-badge">
          Computer Generated Invoice &bull; No Signature Required
        </div>
      </div>

    </div>
  </div>

</body>
</html>
`;

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(invoiceHtml, { waitUntil: 'networkidle0' });

    const targetPaths = [
      'c:/Users/GF63/OneDrive/Desktop/App CC/Antigravity/X-Brews/sanbaee/public/invoices/sanbaee-madras-square-bill.pdf',
      'c:/Users/GF63/OneDrive/Desktop/App CC/Antigravity/X-Brews/sanbaee-madras-square-bill.pdf',
      'C:/Users/GF63/.gemini/antigravity-ide/brain/6aaefe37-dcb7-4386-a07f-e4b53ea38d85/sanbaee-madras-square-bill.pdf'
    ];

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        right: '12mm',
        bottom: '12mm',
        left: '12mm'
      }
    });

    for (const p of targetPaths) {
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, pdfBuffer);
      console.log('Saved PDF to:', p);
    }

    await browser.close();
    console.log('SUCCESS: Generated PDF with bank details');
  } catch (err) {
    console.error('Error generating PDF:', err);
    process.exit(1);
  }
})();
