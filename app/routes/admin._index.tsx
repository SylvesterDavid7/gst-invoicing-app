import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction
} from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form } from "@remix-run/react";
import { useState } from "react";
import { prisma } from "../db.server";
import {
  requireAdmin,
  getPublicOrigin,
  createDemoAccess,
  revokeDemoAccess,
  extendDemoAccess,
  deleteDemoAccess,
  listAllDemoAccesses,
  listAllClientsWithStats
} from "../services/admin/admin.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Admin Portal | Client Management & Demo Access Controls" },
    { name: "robots", content: "noindex, nofollow" }
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const origin = getPublicOrigin(request);

  const demos = await listAllDemoAccesses();
  const clients = await listAllClientsWithStats();

  const totalInvoices = await prisma.invoice.count();
  const activeDemos = demos.filter((d) => d.computedStatus === "ACTIVE").length;
  const expiredDemos = demos.filter((d) => d.computedStatus === "EXPIRED" || d.computedStatus === "REVOKED").length;

  return json({
    origin,
    demos,
    clients,
    stats: {
      totalClients: clients.length,
      activeDemos,
      expiredDemos,
      totalInvoices
    }
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);

  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  if (intent === "create_demo") {
    const clientName = formData.get("clientName")?.toString() || "";
    const clientEmail = formData.get("clientEmail")?.toString() || "";
    const clientPhone = formData.get("clientPhone")?.toString() || "";
    const storeDomain = formData.get("storeDomain")?.toString() || "";
    const durationDays = parseInt(formData.get("durationDays")?.toString() || "3", 10);
    const notes = formData.get("notes")?.toString() || "";

    if (!clientName.trim()) {
      return json({ error: "Client Name is required to generate a demo URL." }, { status: 400 });
    }
    if (!storeDomain.trim()) {
      return json({ error: "Please select or enter a target store domain for the demo." }, { status: 400 });
    }

    const createdDemo = await createDemoAccess({
      clientName,
      clientEmail,
      clientPhone,
      storeDomain,
      durationDays: isNaN(durationDays) ? 3 : durationDays,
      notes
    });

    return json({ success: true, intent: "create_demo", createdDemo });
  }

  if (intent === "revoke_demo") {
    const demoId = formData.get("demoId")?.toString();
    if (demoId) {
      await revokeDemoAccess(demoId);
      return json({ success: true, intent: "revoke_demo" });
    }
  }

  if (intent === "extend_demo") {
    const demoId = formData.get("demoId")?.toString();
    const additionalDays = parseInt(formData.get("additionalDays")?.toString() || "3", 10);
    if (demoId) {
      await extendDemoAccess(demoId, additionalDays);
      return json({ success: true, intent: "extend_demo" });
    }
  }

  if (intent === "delete_demo") {
    const demoId = formData.get("demoId")?.toString();
    if (demoId) {
      await deleteDemoAccess(demoId);
      return json({ success: true, intent: "delete_demo" });
    }
  }

  if (intent === "update_client_plan") {
    const storeId = formData.get("storeId")?.toString();
    const plan = formData.get("plan")?.toString() as "STARTER" | "GROWTH" | "PRO";
    if (storeId && plan) {
      await prisma.store.update({
        where: { id: storeId },
        data: { plan }
      });
      return json({ success: true, intent: "update_client_plan" });
    }
  }

  return json({ error: "Invalid action intent" }, { status: 400 });
}

export default function AdminPortal() {
  const { origin, demos, clients, stats } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const effectiveOrigin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : origin;

  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(3);
  const [customDays, setCustomDays] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"demos" | "clients">("demos");
  const [searchQuery, setSearchQuery] = useState("");

  const handleCopy = (url: string, token: string) => {
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const filteredDemos = demos.filter((d) => {
    const query = searchQuery.toLowerCase();
    return (
      d.clientName.toLowerCase().includes(query) ||
      d.storeDomain.toLowerCase().includes(query) ||
      d.token.toLowerCase().includes(query)
    );
  });

  const newlyCreated = actionData?.intent === "create_demo" ? actionData.createdDemo : null;

  return (
    <div style={styles.root}>
      {/* Top Navbar */}
      <header style={styles.topNav}>
        <div style={styles.navBrand}>
          <div style={styles.navLogo}>⚡</div>
          <div>
            <div style={styles.navTitle}>GST Pro Admin Portal</div>
            <div style={styles.navSubtitle}>Client Governance &amp; Time-Limited Demo URLs</div>
          </div>
        </div>

        <div style={styles.navActions}>
          <a href="/app" target="_blank" rel="noreferrer" style={styles.ghostBtn}>
            Open Store App ↗
          </a>
          <Form method="post" action="/admin/logout">
            <button type="submit" style={styles.logoutBtn}>
              Sign Out ⎋
            </button>
          </Form>
        </div>
      </header>

      <main style={styles.mainContent}>
        {/* KPI Metric Cards */}
        <div style={styles.metricsGrid}>
          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Active Demo Leads</div>
            <div style={{ ...styles.metricValue, color: "#008060" }}>{stats.activeDemos}</div>
            <div style={styles.metricSub}>Live links with unexpired access</div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Total Managed Stores</div>
            <div style={{ ...styles.metricValue, color: "#2563eb" }}>{stats.totalClients}</div>
            <div style={styles.metricSub}>Active merchant databases</div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Expired / Revoked</div>
            <div style={{ ...styles.metricValue, color: "#d97706" }}>{stats.expiredDemos}</div>
            <div style={styles.metricSub}>3-day access window concluded</div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Total Invoices Generated</div>
            <div style={{ ...styles.metricValue, color: "#7c3aed" }}>{stats.totalInvoices}</div>
            <div style={styles.metricSub}>Across all tenant stores</div>
          </div>
        </div>

        {/* Newly Created Demo Banner */}
        {newlyCreated && (
          <div style={styles.newDemoBanner}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <span style={styles.newBadge}>🎉 Unique Demo Link Generated Successfully</span>
                <h3 style={{ margin: "8px 0 4px 0", fontSize: "18px", color: "#0f172a" }}>
                  Demo for {newlyCreated.clientName} ({newlyCreated.durationDays} Days Access)
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>
                  Access expires on{" "}
                  <strong>
                    {new Date(newlyCreated.expiresAt).toLocaleDateString("en-IN", {
                      dateStyle: "medium"
                    })}{" "}
                    at {new Date(newlyCreated.expiresAt).toLocaleTimeString("en-IN", { timeStyle: "short" })}
                  </strong>
                  . After this point, the URL will be automatically locked out.
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleCopy(`${effectiveOrigin}/demo/${newlyCreated.token}`, newlyCreated.token)}
                  style={styles.copyBtn}
                >
                  {copiedToken === newlyCreated.token ? "✓ Copied!" : "📋 Copy Demo Link"}
                </button>

                <a
                  href={`${effectiveOrigin}/demo/${newlyCreated.token}`}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.previewBtn}
                >
                  Open Preview ↗
                </a>

                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Hi ${newlyCreated.clientName}! Here is your exclusive 3-day preview link for the automated Indian GST Invoicing app for Shopify: ${effectiveOrigin}/demo/${newlyCreated.token}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.whatsappBtn}
                >
                  💬 Share on WhatsApp
                </a>
              </div>
            </div>

            <div style={styles.urlDisplayBox}>
              <code style={{ fontSize: "13px", color: "#008060", wordBreak: "break-all" }}>
                {effectiveOrigin}/demo/{newlyCreated.token}
              </code>
            </div>
          </div>
        )}

        {/* Generate Demo Form Card */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>⚡ Create Unique Time-Limited Demo URL</h2>
              <p style={styles.cardSubtitle}>
                Generate a secure, single-use prospect link. Once the access duration expires, the demo URL will
                automatically lock the user out.
              </p>
            </div>
          </div>

          <Form method="post" style={styles.createForm}>
            <input type="hidden" name="intent" value="create_demo" />

            <div style={styles.formRow}>
              <div style={styles.field}>
                <label style={styles.label}>
                  Client / Lead Name <span style={{ color: "#e11d48" }}>*</span>
                </label>
                <input
                  name="clientName"
                  type="text"
                  required
                  placeholder="e.g. Madras Square / Blue Tokai"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Demo Store Environment</label>
                <select name="storeDomain" defaultValue="auto_fresh_sandbox" style={styles.select}>
                  <option value="auto_fresh_sandbox">
                    ✨ Clean Isolated Sandbox (Fresh 0 Invoices for this Client — Recommended)
                  </option>
                  <optgroup label="Or Map to an Existing Store">
                    {clients.map((c) => (
                      <option key={c.id} value={c.shopifyDomain}>
                        {c.tradeName || c.legalName} ({c.shopifyDomain})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.field}>
                <label style={styles.label}>Client Email (Optional)</label>
                <input
                  name="clientEmail"
                  type="email"
                  placeholder="owner@clientdomain.com"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Client Phone / WhatsApp (Optional)</label>
                <input
                  name="clientPhone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  style={styles.input}
                />
              </div>
            </div>

            {/* Access Limit Presets */}
            <div style={{ marginTop: "6px" }}>
              <label style={styles.label}>
                Access Limit Duration (They will lose access after this period)
              </label>
              <div style={styles.durationSelector}>
                {[
                  { days: 3, label: "3 Days (Standard Demo)" },
                  { days: 1, label: "24 Hours (Flash Preview)" },
                  { days: 7, label: "7 Days (Extended Trial)" },
                  { days: 14, label: "14 Days" },
                  { days: 30, label: "30 Days (Partner Sandbox)" }
                ].map((item) => (
                  <button
                    key={item.days}
                    type="button"
                    onClick={() => {
                      setSelectedDuration(item.days);
                      setCustomDays("");
                    }}
                    style={{
                      ...styles.durationBtn,
                      background: selectedDuration === item.days && !customDays ? "#008060" : "#ffffff",
                      color: selectedDuration === item.days && !customDays ? "#ffffff" : "#334155",
                      borderColor: selectedDuration === item.days && !customDays ? "#008060" : "#cbd5e1"
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <input
                type="hidden"
                name="durationDays"
                value={customDays ? parseInt(customDays, 10) || selectedDuration : selectedDuration}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Internal Admin Notes (Optional)</label>
              <input
                name="notes"
                type="text"
                placeholder="e.g. Inquired via Instagram for multi-counter billing sample"
                style={styles.input}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" disabled={isSubmitting} style={styles.primaryBtn}>
                {isSubmitting ? "Generating Unique URL..." : "✨ Generate 3-Day Demo URL →"}
              </button>
            </div>
          </Form>
        </section>

        {/* Tab Controls for Tables */}
        <div style={styles.tabBar}>
          <button
            type="button"
            onClick={() => setActiveTab("demos")}
            style={{
              ...styles.tabBtn,
              borderBottom: activeTab === "demos" ? "2px solid #008060" : "none",
              color: activeTab === "demos" ? "#008060" : "#64748b",
              fontWeight: activeTab === "demos" ? 700 : 500
            }}
          >
            📋 Client Demo Links ({demos.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("clients")}
            style={{
              ...styles.tabBtn,
              borderBottom: activeTab === "clients" ? "2px solid #008060" : "none",
              color: activeTab === "clients" ? "#008060" : "#64748b",
              fontWeight: activeTab === "clients" ? 700 : 500
            }}
          >
            🏬 Managed Client Stores ({clients.length})
          </button>
        </div>

        {/* Demo Links Table View */}
        {activeTab === "demos" && (
          <section style={styles.card}>
            <div style={styles.tableToolbar}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by client name, domain, or token..."
                style={styles.searchInput}
              />
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Showing {filteredDemos.length} demo URLs
              </span>
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thRow}>
                    <th style={styles.th}>Client</th>
                    <th style={styles.th}>Unique Demo URL</th>
                    <th style={styles.th}>Store Scope</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Access Limit &amp; Expiry</th>
                    <th style={styles.th}>Visits</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDemos.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "36px", color: "#64748b" }}>
                        No demo URLs generated yet. Use the form above to create your first 3-day demo link.
                      </td>
                    </tr>
                  ) : (
                    filteredDemos.map((demo) => {
                      const isExpired = demo.computedStatus === "EXPIRED";
                      const isRevoked = demo.computedStatus === "REVOKED";
                      const isActive = demo.computedStatus === "ACTIVE";

                      const fullUrl = `${effectiveOrigin}/demo/${demo.token}`;
                      const remainingMs = new Date(demo.expiresAt).getTime() - Date.now();
                      const remainingHours = Math.round(remainingMs / (1000 * 60 * 60));
                      const remainingDays = (remainingMs / (1000 * 60 * 60 * 24)).toFixed(1);

                      return (
                        <tr key={demo.id} style={styles.tr}>
                          <td style={styles.td}>
                            <div style={{ fontWeight: 700, color: "#0f172a" }}>{demo.clientName}</div>
                            {demo.clientEmail && (
                              <div style={{ fontSize: "11px", color: "#64748b" }}>{demo.clientEmail}</div>
                            )}
                            {demo.clientPhone && (
                              <div style={{ fontSize: "11px", color: "#64748b" }}>{demo.clientPhone}</div>
                            )}
                            {demo.notes && (
                              <div style={{ fontSize: "11px", color: "#008060", fontStyle: "italic", marginTop: "2px" }}>
                                &ldquo;{demo.notes}&rdquo;
                              </div>
                            )}
                          </td>

                          <td style={styles.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <code style={styles.tokenCode}>/demo/{demo.token.slice(0, 16)}...</code>
                              <button
                                type="button"
                                onClick={() => handleCopy(fullUrl, demo.token)}
                                title="Copy full URL"
                                style={styles.iconBtn}
                              >
                                {copiedToken === demo.token ? "✓" : "📋"}
                              </button>
                            </div>
                          </td>

                          <td style={styles.td}>
                            <span style={{ fontSize: "12px", color: "#334155" }}>{demo.storeDomain}</span>
                          </td>

                          <td style={styles.td}>
                            {isActive && <span style={styles.badgeActive}>● Active</span>}
                            {isExpired && <span style={styles.badgeExpired}>⏳ Expired (3-Day Limit Reached)</span>}
                            {isRevoked && <span style={styles.badgeRevoked}>✕ Revoked</span>}
                          </td>

                          <td style={styles.td}>
                            <div style={{ fontSize: "12px", fontWeight: 600 }}>
                              {demo.durationDays} Days Limit
                            </div>
                            <div style={{ fontSize: "11px", color: isExpired ? "#b91c1c" : "#64748b" }}>
                              {isExpired
                                ? `Expired ${new Date(demo.expiresAt).toLocaleDateString("en-IN")}`
                                : `${remainingDays}d (${remainingHours}h) left`}
                            </div>
                          </td>

                          <td style={styles.td}>
                            <div style={{ fontWeight: 700, fontSize: "13px" }}>{demo.accessCount} views</div>
                            {demo.lastAccessedAt ? (
                              <div style={{ fontSize: "10px", color: "#64748b" }}>
                                Last: {new Date(demo.lastAccessedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            ) : (
                              <div style={{ fontSize: "10px", color: "#94a3b8" }}>Not opened yet</div>
                            )}
                          </td>

                          <td style={styles.td}>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                              {isActive && (
                                <Form method="post" style={{ display: "inline" }}>
                                  <input type="hidden" name="intent" value="revoke_demo" />
                                  <input type="hidden" name="demoId" value={demo.id} />
                                  <button
                                    type="submit"
                                    title="Revoke access immediately"
                                    style={styles.revokeActionBtn}
                                  >
                                    Revoke
                                  </button>
                                </Form>
                              )}

                              <Form method="post" style={{ display: "inline" }}>
                                <input type="hidden" name="intent" value="extend_demo" />
                                <input type="hidden" name="demoId" value={demo.id} />
                                <input type="hidden" name="additionalDays" value="3" />
                                <button
                                  type="submit"
                                  title="Extend access by +3 days"
                                  style={styles.extendActionBtn}
                                >
                                  +3 Days
                                </button>
                              </Form>

                              <Form method="post" style={{ display: "inline" }}>
                                <input type="hidden" name="intent" value="delete_demo" />
                                <input type="hidden" name="demoId" value={demo.id} />
                                <button
                                  type="submit"
                                  title="Delete demo link"
                                  onClick={(e) => {
                                    if (!confirm("Are you sure you want to delete this demo record?")) {
                                      e.preventDefault();
                                    }
                                  }}
                                  style={styles.deleteActionBtn}
                                >
                                  ✕
                                </button>
                              </Form>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Managed Client Stores View */}
        {activeTab === "clients" && (
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h3 style={styles.cardTitle}>🏬 Active Client Accounts &amp; Stores</h3>
                <p style={styles.cardSubtitle}>
                  View client store configurations, GSTIN settings, invoice volumes, and subscription tiers.
                </p>
              </div>
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thRow}>
                    <th style={styles.th}>Store &amp; Legal Name</th>
                    <th style={styles.th}>Shopify Domain</th>
                    <th style={styles.th}>GSTIN</th>
                    <th style={styles.th}>Plan Tier</th>
                    <th style={styles.th}>Total Invoices</th>
                    <th style={styles.th}>Credit Notes</th>
                    <th style={styles.th}>Quick Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>
                          {client.tradeName || client.legalName}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>{client.legalName}</div>
                      </td>

                      <td style={styles.td}>
                        <code style={styles.tokenCode}>{client.shopifyDomain}</code>
                      </td>

                      <td style={styles.td}>
                        <code style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                          {client.gstin}
                        </code>
                        <div style={{ fontSize: "10px", color: "#64748b" }}>State: {client.stateCode}</div>
                      </td>

                      <td style={styles.td}>
                        <Form method="post" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <input type="hidden" name="intent" value="update_client_plan" />
                          <input type="hidden" name="storeId" value={client.id} />
                          <select
                            name="plan"
                            defaultValue={client.plan}
                            onChange={(e) => e.target.form?.requestSubmit()}
                            style={styles.planSelect}
                          >
                            <option value="STARTER">STARTER ($6)</option>
                            <option value="GROWTH">GROWTH ($12)</option>
                            <option value="PRO">PRO ($19)</option>
                          </select>
                        </Form>
                      </td>

                      <td style={styles.td}>
                        <span style={{ fontWeight: 700, color: "#0f172a" }}>{client._count.invoices}</span>
                      </td>

                      <td style={styles.td}>
                        <span style={{ fontWeight: 600, color: "#64748b" }}>{client._count.creditNotes}</span>
                      </td>

                      <td style={styles.td}>
                        <a
                          href={`/app?shop=${encodeURIComponent(client.shopifyDomain)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.actionLink}
                        >
                          View App Dashboard ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    color: "#0f172a"
  },
  topNav: {
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    padding: "14px 28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    position: "sticky",
    top: 0,
    zIndex: 50
  },
  navBrand: {
    display: "flex",
    alignItems: "center",
    gap: "12px"
  },
  navLogo: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #008060 0%, #004c3f 100%)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px"
  },
  navTitle: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#0f172a"
  },
  navSubtitle: {
    fontSize: "11px",
    color: "#64748b"
  },
  navActions: {
    display: "flex",
    alignItems: "center",
    gap: "12px"
  },
  ghostBtn: {
    padding: "8px 14px",
    background: "#f1f5f9",
    color: "#334155",
    textDecoration: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600
  },
  logoutBtn: {
    padding: "8px 14px",
    background: "transparent",
    border: "1px solid #cbd5e1",
    color: "#64748b",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer"
  },
  mainContent: {
    maxWidth: "1280px",
    margin: "0 auto",
    padding: "24px 28px"
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "24px"
  },
  metricCard: {
    background: "#ffffff",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
  },
  metricLabel: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  },
  metricValue: {
    fontSize: "28px",
    fontWeight: 800,
    margin: "8px 0 4px 0"
  },
  metricSub: {
    fontSize: "12px",
    color: "#94a3b8"
  },
  newDemoBanner: {
    background: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: "12px",
    padding: "20px 24px",
    marginBottom: "24px",
    boxShadow: "0 4px 6px -1px rgba(0, 128, 96, 0.1)"
  },
  newBadge: {
    display: "inline-block",
    padding: "4px 10px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "11px",
    fontWeight: 700,
    borderRadius: "9999px",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  },
  urlDisplayBox: {
    marginTop: "14px",
    background: "#ffffff",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px dashed #86efac",
    display: "flex",
    alignItems: "center"
  },
  copyBtn: {
    padding: "8px 14px",
    background: "#008060",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer"
  },
  previewBtn: {
    padding: "8px 14px",
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    textDecoration: "none"
  },
  whatsappBtn: {
    padding: "8px 14px",
    background: "#25d366",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 700,
    textDecoration: "none"
  },
  card: {
    background: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    padding: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    marginBottom: "24px"
  },
  cardHeader: {
    marginBottom: "18px"
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 4px 0"
  },
  cardSubtitle: {
    fontSize: "13px",
    color: "#64748b",
    margin: 0
  },
  createForm: {
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px"
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },
  label: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#334155"
  },
  input: {
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontSize: "13px",
    outline: "none"
  },
  select: {
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontSize: "13px",
    background: "#ffffff",
    outline: "none"
  },
  durationSelector: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "6px"
  },
  durationBtn: {
    padding: "8px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s"
  },
  primaryBtn: {
    padding: "10px 20px",
    background: "linear-gradient(135deg, #008060 0%, #004c3f 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer"
  },
  tabBar: {
    display: "flex",
    gap: "16px",
    borderBottom: "1px solid #e2e8f0",
    marginBottom: "16px"
  },
  tabBtn: {
    background: "transparent",
    border: "none",
    padding: "10px 14px",
    fontSize: "14px",
    cursor: "pointer"
  },
  tableToolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    flexWrap: "wrap",
    gap: "12px"
  },
  searchInput: {
    padding: "8px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontSize: "13px",
    width: "320px",
    outline: "none"
  },
  tableWrapper: {
    overflowX: "auto"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
    textAlign: "left"
  },
  thRow: {
    borderBottom: "2px solid #f1f5f9"
  },
  th: {
    padding: "10px 14px",
    fontWeight: 700,
    color: "#475569",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  },
  tr: {
    borderBottom: "1px solid #f1f5f9"
  },
  td: {
    padding: "14px",
    verticalAlign: "middle"
  },
  tokenCode: {
    background: "#f1f5f9",
    padding: "3px 6px",
    borderRadius: "4px",
    fontSize: "12px",
    color: "#0f172a"
  },
  iconBtn: {
    background: "transparent",
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
    padding: "2px 6px",
    fontSize: "11px",
    cursor: "pointer"
  },
  badgeActive: {
    display: "inline-block",
    padding: "3px 8px",
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "9999px",
    fontSize: "11px",
    fontWeight: 700
  },
  badgeExpired: {
    display: "inline-block",
    padding: "3px 8px",
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: "9999px",
    fontSize: "11px",
    fontWeight: 700
  },
  badgeRevoked: {
    display: "inline-block",
    padding: "3px 8px",
    background: "#f1f5f9",
    color: "#64748b",
    borderRadius: "9999px",
    fontSize: "11px",
    fontWeight: 700
  },
  revokeActionBtn: {
    padding: "4px 8px",
    background: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer"
  },
  extendActionBtn: {
    padding: "4px 8px",
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer"
  },
  deleteActionBtn: {
    padding: "4px 6px",
    background: "transparent",
    border: "1px solid #e2e8f0",
    color: "#94a3b8",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer"
  },
  planSelect: {
    padding: "4px 8px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "12px",
    fontWeight: 600,
    background: "#ffffff"
  },
  actionLink: {
    fontSize: "12px",
    color: "#008060",
    fontWeight: 700,
    textDecoration: "none"
  }
};
