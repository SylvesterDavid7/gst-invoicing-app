/**
 * Dispatches a simulated Shopify orders/paid webhook to the local dev server
 */

async function sendTestWebhook() {
  console.log("⚡ Dispatching test orders/paid webhook to http://localhost:3000/webhooks/orders-paid...");

  const testOrder = {
    id: Date.now(),
    order_number: Math.floor(1000 + Math.random() * 9000),
    email: "buyer@koramangalacafes.com",
    created_at: new Date().toISOString(),
    taxes_included: true,
    total_shipping_price_set: {
      shop_money: { amount: "150.00" }
    },
    shipping_address: {
      first_name: "Aarav",
      last_name: "Sharma",
      company: "Koramangala Specialty Roasters LLP",
      address1: "100 Feet Road, Indiranagar",
      city: "Bengaluru",
      province: "Karnataka",
      province_code: "KA",
      zip: "560038",
      country: "India"
    },
    note_attributes: [
      { name: "gstin", value: "29AABCU9603R1ZM" }, // Karnataka B2B GSTIN
      { name: "company_name", value: "Koramangala Specialty Roasters LLP" }
    ],
    line_items: [
      {
        id: 101,
        title: "Monsooned Malabar Whole Beans (1kg)",
        sku: "XB-MM-1KG",
        hsn_code: "0901",
        quantity: 2,
        price: "1200.00",
        total_discount: "0.00",
        tax_lines: [{ rate: 0.05, title: "GST 5%" }]
      },
      {
        id: 102,
        title: "Precision Espresso Tamper 58.5mm",
        sku: "XB-ACC-TMPR",
        hsn_code: "8205",
        quantity: 1,
        price: "2360.00",
        total_discount: "0.00",
        tax_lines: [{ rate: 0.18, title: "GST 18%" }]
      }
    ]
  };

  try {
    const res = await fetch("http://localhost:3000/webhooks/orders-paid", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shopify-shop-domain": "quickstart-demo.myshopify.com"
      },
      body: JSON.stringify(testOrder)
    });

    const data = await res.json();
    console.log(`✅ Webhook Response Status: ${res.status}`);
    console.log("Response Body:", data);
    console.log(`\n🎉 Test Order #${testOrder.order_number} successfully pushed to the queue!`);
    console.log("Check your worker terminal to watch tax calculation, sequence numbering & PDF rendering.");
  } catch (err: any) {
    console.error("❌ Failed to reach local server:", err.message);
    console.log("Make sure your dev server is running on http://localhost:3000 (npm run dev)");
  }
}

sendTestWebhook();
