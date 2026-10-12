import "server-only";
import { headers } from "next/headers";
import { db } from "./db";

const WINDOW_MS = 15 * 60_000;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;

/** Best-effort client IP. On Vercel the first x-forwarded-for entry is the visitor. */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Database-backed limiter, so it works across serverless instances.
 * Returns the number of minutes to wait, or 0 when the attempt may proceed.
 */
export async function blockedFor(email: string | null, ip: string) {
  const since = new Date(Date.now() - WINDOW_MS);
  const keys = [`ip:${ip}`, ...(email ? [`email:${email}`] : [])];
  const rows = await db.loginAttempt.groupBy({
    by: ["key"],
    where: { key: { in: keys }, createdAt: { gte: since } },
    _count: true,
    _min: { createdAt: true },
  });
  for (const r of rows) {
    const limit = r.key.startsWith("ip:") ? MAX_PER_IP : MAX_PER_EMAIL;
    if (r._count >= limit) {
      const freeAt = (r._min.createdAt?.getTime() ?? Date.now()) + WINDOW_MS;
      return Math.max(1, Math.ceil((freeAt - Date.now()) / 60_000));
    }
  }
  return 0;
}

export async function recordFailure(email: string | null, ip: string) {
  await db.loginAttempt.createMany({
    data: [{ key: `ip:${ip}` }, ...(email ? [{ key: `email:${email}` }] : [])],
  });
  // Keep the table small: drop anything older than a day.
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
}

export async function clearFailures(email: string) {
  await db.loginAttempt.deleteMany({ where: { key: `email:${email}` } });
}

export const tooManyMessage = (minutes: number) =>
  `Too many attempts. Wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`;
