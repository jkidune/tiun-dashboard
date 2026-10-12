import "server-only";
import { cache } from "react";
import type { Mode } from "@/lib/generated/prisma";
import { db } from "./db";

/** What a workspace has set up so far. Drives the Home checklist and empty states. */
export const getSetup = cache(async (workspaceId: string, mode: Mode) => {
  const [plans, customers, transactions, keys, members, invites] = await Promise.all([
    db.plan.count({ where: { workspaceId } }),
    db.customer.count({ where: { workspaceId, mode } }),
    db.transaction.count({ where: { workspaceId, mode } }),
    db.apiKey.count({ where: { workspaceId, mode, revokedAt: null } }),
    db.teamMember.count({ where: { workspaceId } }),
    db.invite.count({ where: { workspaceId } }),
  ]);
  const steps = [
    { key: "plan", title: "Create your first plan", desc: "Monthly or pay-per-use pricing", href: "/app/setup/checkout", done: plans > 0 },
    { key: "customer", title: "Add a customer", desc: "By hand, or from your app via the API", href: "/app/customers", done: customers > 0 },
    { key: "key", title: "Create an API key", desc: "Connect your backend", href: "/app/apis", done: keys > 0 },
    { key: "team", title: "Invite a teammate", desc: "Share the work with your team", href: "/app/settings/users", done: members > 1 || invites > 0 },
  ];
  const done = steps.filter((s) => s.done).length;
  return {
    steps,
    done,
    complete: done === steps.length,
    hasCustomers: customers > 0,
    hasPlans: plans > 0,
    hasPayments: transactions > 0,
  };
});
