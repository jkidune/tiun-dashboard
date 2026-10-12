"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { authorize } from "@/lib/auth";
import { run, UserError, type ActionState } from "@/lib/action";

const METHODS = { MPESA: "M-Pesa", CASH: "Cash", BANK: "Bank transfer" } as const;

const paymentSchema = z.object({
  customerId: z.string().min(1),
  amount: z.coerce.number({ error: "Enter the amount received." }).positive("Amount must be more than zero.").max(1_000_000, "That amount looks too large."),
  method: z.enum(["MPESA", "CASH", "BANK"], { error: "Choose how the customer paid." }),
  reference: z.string().trim().max(40).optional(),
  note: z.string().trim().max(120).optional(),
});

/**
 * Records a payment taken outside tiun. (M-Pesa, cash, bank transfer).
 * Nothing is charged; card payments need a payment processor and are not collected here.
 */
export async function recordPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace, member } = await authorize("manageCustomers");
    const input = paymentSchema.parse({
      customerId: fd.get("customerId"),
      amount: fd.get("amount"),
      method: fd.get("method"),
      reference: fd.get("reference") || undefined,
      note: fd.get("note") || undefined,
    });
    if (input.method !== "CASH" && !input.reference) throw new UserError("Add the transaction reference so you can match it later.");
    const customer = await db.customer.findFirst({ where: { id: input.customerId, workspaceId: workspace.id } });
    if (!customer) throw new UserError("Customer not found.");
    const cents = Math.round(input.amount * 100);
    await db.$transaction([
      db.transaction.create({
        data: {
          workspaceId: workspace.id,
          mode: customer.mode,
          customerId: customer.id,
          amountCents: cents,
          feeCents: 0,
          currency: workspace.currency,
          status: "SUCCEEDED",
          description: input.note || `Manual payment${input.reference ? ` · ref ${input.reference}` : ""}`,
          methodBrand: METHODS[input.method],
          methodLast4: input.reference ? input.reference.replace(/\s/g, "").slice(-4) : "",
          createdAt: new Date(),
        },
      }),
      db.customer.update({ where: { id: customer.id }, data: { lastActiveAt: new Date() } }),
      db.activity.create({
        data: { workspaceId: workspace.id, mode: customer.mode, type: "payment", actorName: member.name, message: `${member.name} recorded ${METHODS[input.method]} payment of $${(cents / 100).toFixed(2)} from ${customer.name}` },
      }),
    ]);
    revalidatePath("/app/customers");
    revalidatePath("/app/transactions");
    return { ok: true, message: "Payment recorded." };
  });
}

const refundSchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number({ error: "Enter an amount." }).positive("Refund amount must be more than zero."),
  reason: z.string().max(200).optional(),
});

export async function refundTransaction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace, member } = await authorize("refund");
    const { id, amount, reason } = refundSchema.parse({ id: fd.get("id"), amount: fd.get("amount"), reason: fd.get("reason") || undefined });
    const cents = Math.round(amount * 100);

    // Lock the row so two refunds can't race past the refundable amount.
    return db.$transaction(async (tx) => {
      const [t] = await tx.$queryRaw<{ id: string; amountCents: number; refundedCents: number; status: string; mode: string; customerId: string }[]>`
        SELECT id, "amountCents", "refundedCents", status::text, mode::text, "customerId" FROM "Transaction"
        WHERE id = ${id} AND "workspaceId" = ${workspace.id} FOR UPDATE`;
      if (!t) throw new UserError("Transaction not found.");
      if (t.status !== "SUCCEEDED") throw new UserError("Only succeeded payments can be refunded.");
      const refundable = t.amountCents - t.refundedCents;
      if (cents > refundable) throw new UserError(`You can refund at most $${(refundable / 100).toFixed(2)}.`);

      const refunded = t.refundedCents + cents;
      await tx.transaction.update({
        where: { id },
        data: { refundedCents: refunded, status: refunded >= t.amountCents ? "REFUNDED" : "SUCCEEDED" },
      });
      const customer = await tx.customer.findUnique({ where: { id: t.customerId }, select: { name: true } });
      await tx.activity.create({
        data: {
          workspaceId: workspace.id,
          mode: t.mode as "LIVE" | "TEST",
          type: "refund",
          actorName: member.name,
          message: `${member.name} refunded $${(cents / 100).toFixed(2)} to ${customer?.name ?? "a customer"}${reason ? ` (${reason})` : ""}`,
        },
      });
      revalidatePath("/app/transactions");
      return { ok: true, message: `Refunded $${(cents / 100).toFixed(2)}.` };
    });
  });
}
