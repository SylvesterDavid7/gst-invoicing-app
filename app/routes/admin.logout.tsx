import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { adminCookie } from "../services/admin/admin.server";

export async function loader({ request }: LoaderFunctionArgs) {
  return redirect("/admin/login", {
    headers: {
      "Set-Cookie": await adminCookie.serialize("", { maxAge: -1 })
    }
  });
}

export async function action({ request }: ActionFunctionArgs) {
  return redirect("/admin/login", {
    headers: {
      "Set-Cookie": await adminCookie.serialize("", { maxAge: -1 })
    }
  });
}
