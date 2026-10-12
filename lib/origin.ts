import "server-only";
import { headers } from "next/headers";

/**
 * Public base URL of the app, for links we show or hand out (invite links, API examples).
 * Set APP_URL in production (e.g. https://tiun.example.com); otherwise we use the request's host.
 */
export async function appOrigin() {
  const fixed = process.env.APP_URL?.replace(/\/+$/, "");
  if (fixed) return fixed;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
