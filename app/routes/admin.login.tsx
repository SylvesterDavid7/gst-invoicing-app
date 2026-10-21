import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, useActionData, useNavigation, useSearchParams } from "@remix-run/react";
import { adminCookie, isAdminAuthenticated, verifyAdminPassword } from "../services/admin/admin.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Admin Portal Login | GST Pro Platform Management" },
    { name: "robots", content: "noindex, nofollow" }
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const authenticated = await isAdminAuthenticated(request);
  if (authenticated) {
    return redirect("/admin");
  }
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const password = formData.get("password")?.toString() || "";
  const redirectTo = formData.get("redirectTo")?.toString() || "/admin";

  if (!verifyAdminPassword(password)) {
    return json({ error: "Invalid admin password. Please try again." }, { status: 401 });
  }

  const cookie = await adminCookie.serialize({ isAdmin: true, loginTime: Date.now() });

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": cookie
    }
  });
}

export default function AdminLoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";

  const redirectTo = searchParams.get("redirectTo") || "/admin";

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoBadge}>⚡</div>
          <h1 style={styles.title}>GST Pro Admin Portal</h1>
          <p style={styles.subtitle}>Platform Management &amp; Client Demo Access</p>
        </div>

        {actionData?.error && (
          <div style={styles.errorBox}>
            <span>⚠️</span> {actionData.error}
          </div>
        )}

        <Form method="post" style={styles.form}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          
          <div style={styles.fieldGroup}>
            <label htmlFor="password" style={styles.label}>
              Master Admin Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              placeholder="Enter master admin key"
              style={styles.input}
            />
          </div>

          <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
            {isSubmitting ? "Authenticating..." : "Sign In to Admin Portal →"}
          </button>
        </Form>

        <div style={styles.footerNote}>
          Default master password is <code>admin@gst2026</code> (configurable via <code>ADMIN_PASSWORD</code> in <code>.env</code>).
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
    padding: "20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  card: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "40px",
    maxWidth: "440px",
    width: "100%",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
    border: "1px solid rgba(255, 255, 255, 0.1)"
  },
  header: {
    textAlign: "center",
    marginBottom: "28px"
  },
  logoBadge: {
    width: "56px",
    height: "56px",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #008060 0%, #004c3f 100%)",
    color: "#ffffff",
    fontSize: "26px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px auto",
    boxShadow: "0 10px 15px -3px rgba(0, 128, 96, 0.3)"
  },
  title: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 6px 0"
  },
  subtitle: {
    fontSize: "13px",
    color: "#64748b",
    margin: 0
  },
  errorBox: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px"
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },
  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#334155"
  },
  input: {
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.15s",
    width: "100%",
    boxSizing: "border-box"
  },
  submitBtn: {
    padding: "12px",
    background: "linear-gradient(135deg, #008060 0%, #004c3f 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.15s",
    marginTop: "6px"
  },
  footerNote: {
    marginTop: "24px",
    fontSize: "11px",
    color: "#94a3b8",
    textAlign: "center",
    borderTop: "1px solid #f1f5f9",
    paddingTop: "16px"
  }
};
