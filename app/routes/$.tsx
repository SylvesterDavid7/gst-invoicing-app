import { redirect, json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "404 - Page Not Found | Shopify GST Invoicing Pro" },
    { name: "robots", content: "noindex, nofollow" }
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 1. If URL contains /demo/demo_..., redirect directly to canonical demo URL
  if (pathname.includes("/demo/")) {
    const match = pathname.match(/\/demo\/(demo_[a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return redirect(`/demo/${match[1]}${url.search}`, 301);
    }
  }

  // 2. If path accidentally starts with /0.0.0.0/, strip it out and redirect
  if (pathname.startsWith("/0.0.0.0/")) {
    const stripped = pathname.replace(/^\/0\.0\.0\.0/, "") || "/";
    return redirect(`${stripped}${url.search}`, 301);
  }

  return json({ pathname }, { status: 404 });
}

export default function NotFoundRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8fafc",
        padding: "24px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          width: "100%",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
          padding: "40px",
          textAlign: "center"
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            backgroundColor: "#fef2f2",
            color: "#e11d48",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
            marginBottom: "20px"
          }}
        >
          🔍
        </div>

        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: "0 0 10px 0" }}>
          Page Not Found (404)
        </h1>

        <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 24px 0", lineHeight: 1.6 }}>
          The requested URL <code style={{ backgroundColor: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", color: "#0f172a" }}>{data?.pathname}</code> does not exist or has been moved.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            to="/app"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              backgroundColor: "#008060",
              color: "#ffffff",
              textDecoration: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600
            }}
          >
            Go to App Dashboard
          </Link>

          <Link
            to="/admin"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              backgroundColor: "#f1f5f9",
              color: "#334155",
              textDecoration: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              border: "1px solid #cbd5e1"
            }}
          >
            Admin Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
