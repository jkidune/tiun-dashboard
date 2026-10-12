import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth";
import { MODE_COOKIE } from "@/lib/context";

const csvCell = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : String(v ?? "");
  // Quote, and neutralise spreadsheet formulas (CSV injection).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const toCsv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");

/** GET /api/export/customers|transactions|sessions — CSV download for signed-in team members. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const auth = await getCurrentMember();
  if (!auth) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { kind } = await params;
  const mode = (await cookies()).get(MODE_COOKIE)?.value === "test" ? "TEST" : "LIVE";
  const where = { workspaceId: auth.workspace.id, mode } as const;
  let csv: string;

  if (kind === "customers") {
    const status = new URL(req.url).searchParams.get("status")?.toUpperCase();
    const rows = await db.customer.findMany({
      where: { ...where, ...(status && ["SUBSCRIBED", "TRIAL", "PAUSED", "CHURNED"].includes(status) && { status: status as never }) },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    csv = toCsv(["id", "name", "email", "status", "plan", "created_at", "last_active_at"], rows.map((c) => [c.id, c.name, c.email, c.status, c.plan?.name, c.createdAt, c.lastActiveAt]));
  } else if (kind === "transactions") {
    const rows = await db.transaction.findMany({ where, include: { customer: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } });
    csv = toCsv(
      ["id", "created_at", "customer", "email", "amount", "refunded", "fee", "currency", "status", "method", "description"],
      rows.map((t) => [t.id, t.createdAt, t.customer.name, t.customer.email, (t.amountCents / 100).toFixed(2), (t.refundedCents / 100).toFixed(2), (t.feeCents / 100).toFixed(2), t.currency, t.status, `${t.methodBrand} ${t.methodLast4}`, t.description]),
    );
  } else if (kind === "sessions") {
    const rows = await db.usageSession.findMany({ where, include: { customer: { select: { name: true } } }, orderBy: { startedAt: "desc" }, take: 50_000 });
    csv = toCsv(["id", "started_at", "customer", "feature", "duration_ms", "units", "cost", "status"], rows.map((s) => [s.id, s.startedAt, s.customer.name, s.feature, s.durationMs, s.units, (s.costCents / 100).toFixed(2), s.status]));
  } else {
    return NextResponse.json({ error: "Unknown export." }, { status: 404 });
  }

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tiun-${kind}-${mode.toLowerCase()}-${date}.csv"`,
    },
  });
}
