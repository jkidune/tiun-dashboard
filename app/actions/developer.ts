"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/lib/generated/prisma";
import { db } from "@/lib/db";
import { authorize } from "@/lib/auth";
import { MODE_COOKIE } from "@/lib/context";
import { API_SCOPES, generateApiKey, WEBHOOK_EVENTS } from "@/lib/keys";
import { run, UserError, type ActionState } from "@/lib/action";

const keySchema = z.object({
  name: z.string().trim().min(2, "Give the key a name you’ll recognise.").max(60),
  scopes: z.array(z.enum(API_SCOPES)).min(1, "Choose at least one permission."),
  expires: z.enum(["never", "30", "90", "365"]),
});

export async function createApiKey(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace, member } = await authorize("developer");
    const input = keySchema.parse({ name: fd.get("name"), scopes: fd.getAll("scopes"), expires: fd.get("expires") });
    const mode = (await cookies()).get(MODE_COOKIE)?.value === "test" ? "TEST" : "LIVE";
    const key = generateApiKey(mode);
    await db.$transaction([
      db.apiKey.create({
        data: {
          workspaceId: workspace.id,
          mode,
          name: input.name,
          scopes: input.scopes,
          prefix: key.prefix,
          keyHash: key.keyHash,
          expiresAt: input.expires === "never" ? null : new Date(Date.now() + Number(input.expires) * 86_400_000),
        },
      }),
      db.activity.create({
        data: { workspaceId: workspace.id, mode, type: "api_key", actorName: member.name, message: `${member.name} created the API key “${input.name}”` },
      }),
    ]);
    revalidatePath("/app/apis");
    revalidatePath("/app/setup/integration");
    return { ok: true, secret: key.raw };
  });
}

export async function rollApiKey(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("developer");
    const existing = await db.apiKey.findFirst({ where: { id: String(fd.get("id")), workspaceId: workspace.id, revokedAt: null } });
    if (!existing) throw new UserError("That key was revoked or no longer exists.");
    const key = generateApiKey(existing.mode);
    await db.apiKey.update({ where: { id: existing.id }, data: { keyHash: key.keyHash, prefix: key.prefix, createdAt: new Date(), lastUsedAt: null } });
    revalidatePath("/app/apis");
    return { ok: true, secret: key.raw };
  });
}

export async function revokeApiKey(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("developer");
    const { count } = await db.apiKey.updateMany({ where: { id: String(fd.get("id")), workspaceId: workspace.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!count) throw new UserError("That key was already revoked.");
    revalidatePath("/app/apis");
    return { ok: true, message: "Key revoked." };
  });
}

const hookSchema = z.object({
  url: z.url("Enter a full URL starting with https://").refine((u) => u.startsWith("https://"), "Webhook URLs must use https://"),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Choose at least one event."),
});

export async function createWebhook(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("developer");
    const input = hookSchema.parse({ url: fd.get("url"), events: fd.getAll("events") });
    await db.webhook.create({ data: { workspaceId: workspace.id, ...input } });
    revalidatePath("/app/setup/integration");
    return { ok: true, message: "Webhook added." };
  });
}

export async function setWebhookStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("developer");
    const status = z.enum(["ENABLED", "DISABLED"]).parse(fd.get("status"));
    await db.webhook.updateMany({ where: { id: String(fd.get("id")), workspaceId: workspace.id }, data: { status } });
    revalidatePath("/app/setup/integration");
    return { ok: true };
  });
}

export async function deleteWebhook(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("developer");
    await db.webhook.deleteMany({ where: { id: String(fd.get("id")), workspaceId: workspace.id } });
    revalidatePath("/app/setup/integration");
    return { ok: true };
  });
}

export async function toggleIntegration(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("developer");
    const app = z.enum(["slack", "stripe", "segment", "zapier", "hubspot"]).parse(fd.get("app"));
    const current = (workspace.integrations ?? {}) as Record<string, boolean>;
    await db.workspace.update({
      where: { id: workspace.id },
      data: { integrations: { ...current, [app]: !current[app] } as Prisma.InputJsonObject },
    });
    revalidatePath("/app/setup/integration");
    return { ok: true };
  });
}
