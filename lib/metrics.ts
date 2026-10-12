import "server-only";
import { Prisma, type Mode } from "@/lib/generated/prisma";
import { db } from "./db";
import { monthKey } from "./context";

export type Month = { key: string; label: string; start: Date; end: Date };

/** n months ending with the month that starts at `last` (inclusive), oldest first. */
export function monthsEnding(last: Date, n: number): Month[] {
  return Array.from({ length: n }, (_, i) => {
    const start = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - (n - 1 - i), 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return { key: monthKey(start), label: start.toLocaleString("en-US", { month: "short", timeZone: "UTC" }), start, end };
  });
}

const capNow = (d: Date) => (d.getTime() > Date.now() ? new Date() : d);

/**
 * Subscriber movement per month. Reads three columns per customer and counts in memory —
 * fine for thousands of customers; move to SQL window functions if this grows past ~100k.
 */
export async function subscriberSeries(workspaceId: string, mode: Mode, months: Month[]) {
  const rows = await db.customer.findMany({
    where: { workspaceId, mode },
    select: { createdAt: true, churnedAt: true, status: true },
  });
  return months.map((m) => {
    const at = capNow(m.end);
    let active = 0, added = 0, churned = 0;
    for (const c of rows) {
      const isTrial = c.status === "TRIAL";
      if (!isTrial && c.createdAt < at && (!c.churnedAt || c.churnedAt >= at)) active++;
      if (!isTrial && c.createdAt >= m.start && c.createdAt < m.end) added++;
      if (c.churnedAt && c.churnedAt >= m.start && c.churnedAt < m.end) churned++;
    }
    return { ...m, active, added, churned, net: added - churned };
  });
}

/** Net collected revenue (cents) per month, keyed YYYY-MM. */
export async function revenueByMonth(workspaceId: string, mode: Mode, from: Date) {
  const rows = await db.$queryRaw<{ m: Date; cents: bigint }[]>(Prisma.sql`
    SELECT date_trunc('month', "createdAt") AS m, SUM("amountCents" - "refundedCents")::bigint AS cents
    FROM "Transaction"
    WHERE "workspaceId" = ${workspaceId} AND mode = ${mode}::"Mode"
      AND status::text IN ('SUCCEEDED', 'REFUNDED') AND "createdAt" >= ${from}
    GROUP BY 1`);
  return new Map(rows.map((r) => [monthKey(new Date(r.m)), Number(r.cents)]));
}

/** Count of usage sessions per day for the last `days` days, oldest first. */
export async function sessionsPerDay(workspaceId: string, mode: Mode, days: number) {
  const from = new Date(Date.now() - days * 86_400_000);
  const rows = await db.$queryRaw<{ d: Date; n: bigint }[]>(Prisma.sql`
    SELECT date_trunc('day', "startedAt") AS d, COUNT(*)::bigint AS n
    FROM "UsageSession"
    WHERE "workspaceId" = ${workspaceId} AND mode = ${mode}::"Mode" AND "startedAt" >= ${from}
    GROUP BY 1`);
  const map = new Map(rows.map((r) => [new Date(r.d).toISOString().slice(0, 10), Number(r.n)]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: map.get(key) ?? 0 };
  });
}

/** Sessions per hour for the last 24 hours, oldest first. */
export async function sessionsPerHour(workspaceId: string, mode: Mode) {
  const from = new Date(Date.now() - 24 * 3600_000);
  const rows = await db.$queryRaw<{ h: Date; n: bigint; failed: bigint }[]>(Prisma.sql`
    SELECT date_trunc('hour', "startedAt") AS h, COUNT(*)::bigint AS n,
           COUNT(*) FILTER (WHERE status = 'FAILED')::bigint AS failed
    FROM "UsageSession"
    WHERE "workspaceId" = ${workspaceId} AND mode = ${mode}::"Mode" AND "startedAt" >= ${from}
    GROUP BY 1`);
  const map = new Map(rows.map((r) => [new Date(r.h).getTime(), r]));
  const top = new Date();
  top.setMinutes(0, 0, 0);
  return Array.from({ length: 24 }, (_, i) => {
    const t = top.getTime() - (23 - i) * 3600_000;
    const r = map.get(t);
    return {
      label: new Date(t).toLocaleTimeString("en-US", { hour: "numeric" }),
      ok: r ? Number(r.n - r.failed) : 0,
      failed: r ? Number(r.failed) : 0,
    };
  });
}

/** API requests per day split by status class, last `days` days. */
export async function requestsPerDay(workspaceId: string, mode: Mode, days: number) {
  const from = new Date(Date.now() - days * 86_400_000);
  const rows = await db.$queryRaw<{ d: Date; ok: bigint; c4: bigint; c5: bigint }[]>(Prisma.sql`
    SELECT date_trunc('day', "createdAt") AS d,
      COUNT(*) FILTER (WHERE "statusCode" < 400)::bigint AS ok,
      COUNT(*) FILTER (WHERE "statusCode" >= 400 AND "statusCode" < 500)::bigint AS c4,
      COUNT(*) FILTER (WHERE "statusCode" >= 500)::bigint AS c5
    FROM "ApiRequest"
    WHERE "workspaceId" = ${workspaceId} AND mode = ${mode}::"Mode" AND "createdAt" >= ${from}
    GROUP BY 1`);
  const map = new Map(rows.map((r) => [new Date(r.d).toISOString().slice(0, 10), r]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86_400_000);
    const r = map.get(d.toISOString().slice(0, 10));
    return {
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ok: r ? Number(r.ok) : 0,
      c4: r ? Number(r.c4) : 0,
      c5: r ? Number(r.c5) : 0,
    };
  });
}

export const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);
