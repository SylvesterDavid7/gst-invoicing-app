(function() {
  if (typeof window === "undefined") return;

  function injectInvoiceBox() {
    if (!window.Shopify || !Shopify.Checkout || !Shopify.Checkout.OrderStatus) {
      return;
    }

    var orderId = null;
    var orderNumber = null;

    if (window.Shopify.checkout) {
      orderId = Shopify.checkout.order_id || Shopify.checkout.id;
      orderNumber = Shopify.checkout.order_number;
    } else if (window.Shopify.order) {
      orderId = Shopify.order.id;
      orderNumber = Shopify.order.order_number;
    }

    if (!orderId) {
      var urlParams = new URLSearchParams(window.location.search);
      orderId = urlParams.get("order_id") || urlParams.get("id");
    }

    if (!orderId && !orderNumber) return;

    var downloadUrl = "https://itskoop.inaragroups.com/api/invoices/download?";
    if (orderId) downloadUrl += "order_id=" + encodeURIComponent(orderId);
    if (orderNumber) downloadUrl += (orderId ? "&" : "") + "order_number=" + encodeURIComponent(orderNumber);

    var contentHtml = 
      '<div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:16px;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
          '<span style="font-size:18px;">📄</span>' +
          '<span style="font-weight:700;color:#166534;font-size:16px;">Official GST Tax Invoice</span>' +
        '</div>' +
        '<p style="color:#15803d;font-size:13px;margin:0 0 12px 0;">' +
          'Your tax invoice with government-compliant GSTIN and HSN summary is ready for download.' +
        '</p>' +
        '<a href="' + downloadUrl + '" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#16a34a;color:#ffffff;padding:10px 18px;border-radius:6px;font-weight:700;font-size:13px;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.1);">' +
          '📥 Download GST Tax Invoice (PDF)' +
        '</a>' +
      '</div>';

    Shopify.Checkout.OrderStatus.addContentBox(
      contentHtml
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectInvoiceBox);
  } else {
    injectInvoiceBox();
  }
})();
