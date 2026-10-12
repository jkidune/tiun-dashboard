"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { CustomerStatus, Mode } from "@/lib/generated/prisma";
import { db } from "@/lib/db";
import { authorize } from "@/lib/auth";
import { MODE_COOKIE } from "@/lib/context";
import { formObject, run, UserError, type ActionState } from "@/lib/action";

const COLORS = ["#3f6f68", "#5b5650", "#7a3a5c", "#2f5d7c", "#8a5a3c", "#b0703f", "#3d4f73", "#2f7a64"];

async function currentMode(): Promise<Mode> {
  return (await cookies()).get(MODE_COOKIE)?.value === "test" ? "TEST" : "LIVE";
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Enter the customer’s full name."),
  email: z.email("Enter a valid email address.").transform((s) => s.toLowerCase()),
  planId: z.string().optional().transform((v) => v || null),
  status: z.enum(["SUBSCRIBED", "TRIAL"]),
});

export async function createCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace, member } = await authorize("manageCustomers");
    const input = createSchema.parse(formObject(fd));
    const mode = await currentMode();
    const plan = input.planId ? await db.plan.findFirst({ where: { id: input.planId, workspaceId: workspace.id } }) : null;
    if (input.planId && !plan) throw new UserError("That plan no longer exists. Pick another.");
    const exists = await db.customer.findFirst({ where: { workspaceId: workspace.id, mode, email: input.email } });
    if (exists) throw new UserError(`${input.email} is already a customer.`);

    await db.$transaction([
      db.customer.create({
        data: { ...input, workspaceId: workspace.id, mode, avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)] },
      }),
      db.activity.create({
        data: { workspaceId: workspace.id, mode, type: "signup", actorName: member.name, message: `${member.name} added ${input.name}${plan ? ` on ${plan.name}` : ""}` },
      }),
    ]);
    revalidatePath("/app/customers");
    return { ok: true, message: `${input.name} added.` };
  });
}

const STATUS_VERB: Record<CustomerStatus, string> = { SUBSCRIBED: "reactivated", PAUSED: "paused", CHURNED: "cancelled", TRIAL: "moved to trial" };

export async function setCustomerStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace, member } = await authorize("manageCustomers");
    const id = String(fd.get("id"));
    const status = z.enum(["SUBSCRIBED", "PAUSED", "CHURNED"]).parse(fd.get("status"));
    const c = await db.customer.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!c) throw new UserError("Customer not found.");
    await db.$transaction([
      db.customer.update({ where: { id }, data: { status, churnedAt: status === "CHURNED" ? new Date() : null } }),
      db.activity.create({
        data: { workspaceId: workspace.id, mode: c.mode, type: status === "CHURNED" ? "churn" : "upgrade", actorName: member.name, message: `${member.name} ${STATUS_VERB[status]} ${c.name}` },
      }),
    ]);
    revalidatePath("/app/customers");
    return { ok: true, message: `${c.name} ${STATUS_VERB[status]}.` };
  });
}

export async function bulkCustomers(ids: string[], op: "pause" | "resume" | "delete"): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("manageCustomers");
    const where = { id: { in: ids.slice(0, 500) }, workspaceId: workspace.id };
    if (op === "delete") await db.customer.deleteMany({ where });
    else await db.customer.updateMany({ where: { ...where, status: { not: "CHURNED" } }, data: { status: op === "pause" ? "PAUSED" : "SUBSCRIBED" } });
    revalidatePath("/app/customers");
    return { ok: true, message: `${ids.length} customer${ids.length === 1 ? "" : "s"} updated.` };
  });
}
