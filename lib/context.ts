import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Mode } from "@/lib/generated/prisma";
import { requireMember } from "./auth";

export const MODE_COOKIE = "tiun_mode";
export const MONTH_COOKIE = "tiun_month";

export type MonthRange = { key: string; label: string; start: Date; end: Date; prevStart: Date };

export function monthRange(key: string): MonthRange {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  return {
    key,
    label: start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    start,
    end: new Date(Date.UTC(y, m, 1)),
    prevStart: new Date(Date.UTC(y, m - 2, 1)),
  };
}

export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** The last 12 months, newest first. */
export function monthOptions() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return monthRange(monthKey(d));
  });
}

/** Signed-in member + workspace + the global Live/Sandbox and month selections. */
export const getContext = cache(async () => {
  const auth = await requireMember();
  const jar = await cookies();
  const mode: Mode = jar.get(MODE_COOKIE)?.value === "test" ? "TEST" : "LIVE";
  const options = monthOptions();
  const wanted = jar.get(MONTH_COOKIE)?.value;
  const month = options.find((o) => o.key === wanted) ?? options[0];
  return { ...auth, mode, month, monthOptions: options };
});

export type Ctx = Awaited<ReturnType<typeof getContext>>;
