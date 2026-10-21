import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

/**
 * Catches malformed demo links containing /0.0.0.0/ and redirects seamlessly to /demo/:token
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const token = params.token;
  const url = new URL(request.url);
  return redirect(`/demo/${token}${url.search}`, 301);
}

export default function CatchZeroDemoRedirect() {
  return null;
}
