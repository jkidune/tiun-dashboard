import { createHash, randomBytes } from "node:crypto";
import type { Mode } from "@/lib/generated/prisma";

/** A new secret key. The raw value is shown once; only the hash and a display prefix are stored. */
export function generateApiKey(mode: Mode) {
  const raw = `sk_${mode === "LIVE" ? "live" : "test"}_${randomBytes(24).toString("base64url")}`;
  return {
    raw,
    keyHash: createHash("sha256").update(raw).digest("hex"),
    prefix: `${raw.slice(0, 8)}••••${raw.slice(-4)}`,
  };
}

export const hashApiKey = (raw: string) => createHash("sha256").update(raw).digest("hex");

export const API_SCOPES = [
  "customers:read",
  "customers:write",
  "sessions:read",
  "sessions:write",
  "transactions:read",
] as const;

export const WEBHOOK_EVENTS = [
  "customer.created",
  "customer.updated",
  "subscription.updated",
  "transaction.succeeded",
  "transaction.failed",
  "transaction.refunded",
  "session.completed",
] as const;
