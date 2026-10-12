import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { withApiKey } from "@/lib/api-auth";

/** GET /api/v1/transactions?limit=20 */
export async function GET(req: NextRequest) {
  return withApiKey(req, "transactions:read", async ({ key }) => {
    const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 20));
    const rows = await db.transaction.findMany({
      where: { workspaceId: key.workspaceId, mode: key.mode },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return {
      status: 200,
      body: {
        data: rows.map((t) => ({
          id: t.id,
          customer: t.customerId,
          amount: t.amountCents,
          amount_refunded: t.refundedCents,
          currency: t.currency.toLowerCase(),
          status: t.status.toLowerCase(),
          description: t.description,
          created_at: t.createdAt.toISOString(),
        })),
        has_more: rows.length === limit,
      },
    };
  });
}
