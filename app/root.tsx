import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico" }
];

export default function Root() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Shopify GST Invoicing Pro</title>
        <Meta />
        <Links />
      </head>
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const isRouteError = isRouteErrorResponse(error);

  const title = isRouteError
    ? `${error.status} ${error.statusText || "Notice"}`
    : "Application Error";

  const message = isRouteError
    ? (typeof error.data === "string" ? error.data : error.statusText || "The requested page could not be found.")
    : (error instanceof Error ? error.message : "An unexpected application error occurred.");

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} | Shopify GST Invoicing Pro</title>
        <Meta />
        <Links />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          backgroundColor: "#f8fafc",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px"
        }}
      >
        <div
          style={{
            maxWidth: "500px",
            width: "100%",
            backgroundColor: "#ffffff",
            padding: "36px 32px",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.06)",
            textAlign: "center"
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "#fee2e2",
              color: "#dc2626",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
              marginBottom: "16px"
            }}
          >
            ⚠️
          </div>

          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
            {title}
          </h1>

          <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 24px 0", lineHeight: 1.5 }}>
            {message}
          </p>

          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="/app"
              style={{
                display: "inline-block",
                padding: "10px 18px",
                backgroundColor: "#008060",
                color: "#ffffff",
                textDecoration: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600
              }}
            >
              Go to Dashboard
            </a>

            <a
              href="/admin"
              style={{
                display: "inline-block",
                padding: "10px 18px",
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
            </a>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
