"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/lib/generated/prisma";
import { db } from "@/lib/db";
import { authorize } from "@/lib/auth";
import { PROVIDERS, readAuth, readCheckout } from "@/lib/settings";
import { checked, run, UserError, type ActionState } from "@/lib/action";

const json = (v: object) => v as Prisma.InputJsonObject;

export async function saveAuthProviders(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("developer");
    const current = readAuth(workspace.authSettings);
    const providers = Object.fromEntries(PROVIDERS.map((p) => [p.key, checked(fd, `p_${p.key}`)])) as typeof current.providers;
    if (!Object.values(providers).some(Boolean)) throw new UserError("Keep at least one sign-in method on, or nobody can sign in.");
    const providerConfig = Object.fromEntries(
      PROVIDERS.filter((p) => p.needsClient).map((p) => [p.key, { clientId: String(fd.get(`c_${p.key}`) ?? "").trim() }]),
    );
    for (const p of PROVIDERS) {
      if (p.needsClient && providers[p.key] && !providerConfig[p.key]?.clientId) {
        throw new UserError(`Add a client ID for ${p.name} before turning it on.`);
      }
    }
    await db.workspace.update({ where: { id: workspace.id }, data: { authSettings: json({ ...current, providers, providerConfig }) } });
    revalidatePath("/setup/authentication");
    return { ok: true, message: "Sign-in methods saved." };
  });
}

const policySchema = z.object({
  sessionDays: z.coerce.number().int().min(1, "Sessions must last at least 1 day.").max(365),
  minPasswordLength: z.coerce.number().int().min(8, "Passwords should be at least 8 characters.").max(64),
  mfa: z.enum(["off", "optional", "required"]),
  allowedDomains: z
    .string()
    .trim()
    .refine((s) => !s || s.split(",").every((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d.trim())), "List domains like akoya.ai, separated by commas."),
});

export async function saveAuthPolicies(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("developer");
    const input = policySchema.parse({
      sessionDays: fd.get("sessionDays"),
      minPasswordLength: fd.get("minPasswordLength"),
      mfa: fd.get("mfa"),
      allowedDomains: fd.get("allowedDomains") ?? "",
    });
    const current = readAuth(workspace.authSettings);
    await db.workspace.update({
      where: { id: workspace.id },
      data: { authSettings: json({ ...current, ...input, requireSymbols: checked(fd, "requireSymbols"), botProtection: checked(fd, "botProtection") }) },
    });
    revalidatePath("/setup/authentication/policies");
    return { ok: true, message: "Policies saved." };
  });
}

const planSchema = z.object({
  name: z.string().trim().min(2, "Give the plan a name.").max(40),
  model: z.enum(["MONTHLY", "PER_USE"]),
  price: z.coerce.number({ error: "Enter a price." }).min(0, "Price can’t be negative."),
  trialDays: z.coerce.number().int().min(0).max(90, "Trials can be up to 90 days."),
});

export async function createPlan(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("checkout");
    const input = planSchema.parse({ name: fd.get("name"), model: fd.get("model"), price: fd.get("price"), trialDays: fd.get("trialDays") || 0 });
    await db.plan.create({
      data: { workspaceId: workspace.id, name: input.name, model: input.model, priceCents: Math.round(input.price * 100), trialDays: input.trialDays, currency: workspace.currency },
    });
    revalidatePath("/setup/checkout");
    return { ok: true, message: `${input.name} created.` };
  });
}

export async function setPlanActive(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("checkout");
    await db.plan.updateMany({ where: { id: String(fd.get("id")), workspaceId: workspace.id }, data: { active: fd.get("active") === "true" } });
    revalidatePath("/setup/checkout");
    return { ok: true };
  });
}

const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/, "Codes use 3–20 letters, numbers, - or _."),
  percentOff: z.coerce.number().int().min(1, "Discount must be 1–100%.").max(100, "Discount must be 1–100%."),
  maxRedemptions: z.coerce.number().int().positive().optional(),
  expiresAt: z.string().optional(),
});

export async function createCoupon(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("checkout");
    const input = couponSchema.parse({
      code: fd.get("code"),
      percentOff: fd.get("percentOff"),
      maxRedemptions: fd.get("maxRedemptions") || undefined,
      expiresAt: fd.get("expiresAt") || undefined,
    });
    const exists = await db.coupon.findUnique({ where: { workspaceId_code: { workspaceId: workspace.id, code: input.code } } });
    if (exists) throw new UserError(`${input.code} already exists.`);
    await db.coupon.create({
      data: { workspaceId: workspace.id, code: input.code, percentOff: input.percentOff, maxRedemptions: input.maxRedemptions ?? null, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null },
    });
    revalidatePath("/setup/checkout");
    return { ok: true, message: `${input.code} created.` };
  });
}

export async function deleteCoupon(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("checkout");
    await db.coupon.deleteMany({ where: { id: String(fd.get("id")), workspaceId: workspace.id } });
    revalidatePath("/setup/checkout");
    return { ok: true };
  });
}

const appearanceSchema = z.object({
  brandColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Pick a colour."),
  buttonStyle: z.enum(["rounded", "square", "pill"]),
  layout: z.enum(["single", "split"]),
  successUrl: z.union([z.literal(""), z.url("Success URL must be a full URL.")]),
  cancelUrl: z.union([z.literal(""), z.url("Cancel URL must be a full URL.")]),
});

export async function saveCheckoutAppearance(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("checkout");
    const input = appearanceSchema.parse({
      brandColor: fd.get("brandColor"),
      buttonStyle: fd.get("buttonStyle"),
      layout: fd.get("layout"),
      successUrl: fd.get("successUrl") ?? "",
      cancelUrl: fd.get("cancelUrl") ?? "",
    });
    const current = readCheckout(workspace.checkoutSettings);
    await db.workspace.update({
      where: { id: workspace.id },
      data: {
        checkoutSettings: json({
          ...current,
          ...input,
          collectTaxId: checked(fd, "collectTaxId"),
          collectAddress: checked(fd, "collectAddress"),
          allowPromoCodes: checked(fd, "allowPromoCodes"),
        }),
      },
    });
    revalidatePath("/setup/checkout/appearance");
    return { ok: true, message: "Checkout settings saved." };
  });
}
