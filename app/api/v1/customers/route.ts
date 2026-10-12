import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, withApiKey } from "@/lib/api-auth";

const serialize = (c: { id: string; name: string; email: string; status: string; createdAt: Date; plan?: { name: string } | null }) => ({
  id: c.id,
  name: c.name,
  email: c.email,
  status: c.status.toLowerCase(),
  plan: c.plan?.name ?? null,
  created_at: c.createdAt.toISOString(),
});

/** GET /api/v1/customers?limit=20&status=subscribed */
export async function GET(req: NextRequest) {
  return withApiKey(req, "customers:read", async ({ key }) => {
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
    const status = url.searchParams.get("status")?.toUpperCase();
    const valid = ["SUBSCRIBED", "TRIAL", "PAUSED", "CHURNED"];
    if (status && !valid.includes(status)) return apiError(400, `status must be one of ${valid.join(", ").toLowerCase()}`);
    const rows = await db.customer.findMany({
      where: { workspaceId: key.workspaceId, mode: key.mode, ...(status && { status: status as never }) },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { plan: { select: { name: true } } },
    });
    return { status: 200, body: { data: rows.map(serialize), has_more: rows.length === limit } };
  });
}

const createSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email(),
  plan: z.string().optional(),
});

/** POST /api/v1/customers  { name, email, plan? } */
export async function POST(req: NextRequest) {
  return withApiKey(req, "customers:write", async ({ key, body }) => {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return apiError(422, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const { name, email, plan: planName } = parsed.data;
    const plan = planName
      ? await db.plan.findFirst({ where: { workspaceId: key.workspaceId, name: { equals: planName, mode: "insensitive" } } })
      : null;
    if (planName && !plan) return apiError(404, `No plan named "${planName}".`);
    const exists = await db.customer.findFirst({ where: { workspaceId: key.workspaceId, mode: key.mode, email: email.toLowerCase() } });
    if (exists) return apiError(409, "A customer with this email already exists.");
    const c = await db.customer.create({
      data: { workspaceId: key.workspaceId, mode: key.mode, name, email: email.toLowerCase(), status: plan ? "SUBSCRIBED" : "TRIAL", planId: plan?.id, avatarColor: "#2f5d7c" },
      include: { plan: { select: { name: true } } },
    });
    return { status: 201, body: { data: serialize(c) } };
  });
}
