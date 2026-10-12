import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, withApiKey } from "@/lib/api-auth";

const schema = z.object({
  customer: z.string().min(1),
  feature: z.string().trim().min(1).max(60),
  units: z.number().int().nonnegative(),
  duration_ms: z.number().int().nonnegative().default(0),
  status: z.enum(["completed", "running", "failed"]).default("completed"),
});

/** POST /api/v1/sessions  { customer, feature, units, duration_ms?, status? } — records usage. */
export async function POST(req: NextRequest) {
  return withApiKey(req, "sessions:write", async ({ key, body }) => {
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(422, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const input = parsed.data;
    const customer = await db.customer.findFirst({ where: { id: input.customer, workspaceId: key.workspaceId, mode: key.mode } });
    if (!customer) return apiError(404, "No customer with that id in this mode.");
    const now = new Date();
    const s = await db.$transaction(async (tx) => {
      const created = await tx.usageSession.create({
        data: {
          workspaceId: key.workspaceId,
          mode: key.mode,
          customerId: customer.id,
          feature: input.feature,
          units: input.units,
          durationMs: input.duration_ms,
          costCents: Math.max(1, Math.round(input.units * 0.002)),
          status: input.status.toUpperCase() as "COMPLETED" | "RUNNING" | "FAILED",
          startedAt: new Date(now.getTime() - input.duration_ms),
        },
      });
      await tx.customer.update({ where: { id: customer.id }, data: { lastActiveAt: now } });
      return created;
    });
    return { status: 201, body: { data: { id: s.id, customer: s.customerId, feature: s.feature, units: s.units, status: s.status.toLowerCase() } } };
  });
}
