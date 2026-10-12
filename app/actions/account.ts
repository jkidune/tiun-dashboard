"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { appOrigin } from "@/lib/origin";
import { revalidatePath } from "next/cache";
import type { Prisma, Role } from "@/lib/generated/prisma";
import { db } from "@/lib/db";
import { authorize, createSession } from "@/lib/auth";
import { NOTIFICATION_EVENTS } from "@/lib/settings";
import { checked, run, UserError, type ActionState } from "@/lib/action";

/* ---------- Workspace ---------- */

const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Workspace name is too short.").max(60),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,40}$/, "Use 3–40 lowercase letters, numbers or dashes."),
  timezone: z.string().min(1),
  currency: z.enum(["USD", "TZS", "KES", "EUR"]),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
});

export async function saveWorkspace(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("workspace");
    const input = workspaceSchema.parse(Object.fromEntries(fd));
    const taken = await db.workspace.findFirst({ where: { slug: input.slug, NOT: { id: workspace.id } } });
    if (taken) throw new UserError("That workspace URL is taken. Try another.");
    await db.workspace.update({ where: { id: workspace.id }, data: input });
    revalidatePath("/", "layout");
    return { ok: true, message: "Workspace settings saved." };
  });
}

export async function saveNotifications(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("workspace");
    const settings = Object.fromEntries(
      NOTIFICATION_EVENTS.map((e) => [e.key, { email: checked(fd, `${e.key}_email`), slack: checked(fd, `${e.key}_slack`) }]),
    );
    await db.workspace.update({ where: { id: workspace.id }, data: { notificationSettings: settings as Prisma.InputJsonObject } });
    revalidatePath("/settings");
    return { ok: true, message: "Notification preferences saved." };
  });
}

export async function transferOwnership(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace, member } = await authorize("billing");
    if (String(fd.get("confirm")).trim() !== workspace.name) throw new UserError(`Type ${workspace.name} exactly to confirm.`);
    const target = await db.teamMember.findFirst({ where: { id: String(fd.get("memberId")), workspaceId: workspace.id } });
    if (!target || target.id === member.id) throw new UserError("Choose another team member.");
    await db.$transaction([
      db.teamMember.update({ where: { id: target.id }, data: { role: "OWNER" } }),
      db.teamMember.update({ where: { id: member.id }, data: { role: "ADMIN" } }),
    ]);
    revalidatePath("/", "layout");
    return { ok: true, message: `${target.name} is now the owner. You’re an admin.` };
  });
}

/* ---------- Profile ---------- */

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  email: z.email("Enter a valid email address.").transform((s) => s.toLowerCase()),
  title: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  language: z.enum(["English", "Kiswahili", "Deutsch", "Français"]),
});

export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { member } = await authorize();
    const input = profileSchema.parse(Object.fromEntries(fd));
    const clash = await db.teamMember.findFirst({ where: { email: input.email, NOT: { id: member.id } } });
    if (clash) throw new UserError("Another account already uses that email.");
    await db.teamMember.update({ where: { id: member.id }, data: input });
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile saved." };
  });
}

// The browser resizes photos to 256×256 JPEG before upload (~20–60 KB), so this cap is generous.
const MAX_AVATAR_CHARS = 400_000;

export async function updateAvatar(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { member } = await authorize();
    const data = String(fd.get("avatar") ?? "");
    if (fd.get("remove") === "1") {
      await db.teamMember.update({ where: { id: member.id }, data: { avatarUrl: null } });
      revalidatePath("/", "layout");
      return { ok: true, message: "Photo removed." };
    }
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data)) throw new UserError("Choose a JPG, PNG or WebP photo.");
    if (data.length > MAX_AVATAR_CHARS) throw new UserError("That photo is still too large after resizing. Try another one.");
    await db.teamMember.update({ where: { id: member.id }, data: { avatarUrl: data } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Photo updated." };
  });
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string().min(10, "New password must be at least 10 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "The new passwords don’t match.", path: ["confirm"] });

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { member, sessionId } = await authorize();
    const input = passwordSchema.parse(Object.fromEntries(fd));
    if (!(await bcrypt.compare(input.current, member.passwordHash))) throw new UserError("Your current password is wrong.");
    await db.$transaction([
      db.teamMember.update({ where: { id: member.id }, data: { passwordHash: await bcrypt.hash(input.next, 10) } }),
      // Sign out every other device after a password change.
      db.authSession.deleteMany({ where: { memberId: member.id, NOT: { id: sessionId } } }),
    ]);
    revalidatePath("/profile");
    return { ok: true, message: "Password changed. Other devices were signed out." };
  });
}

export async function signOutSession(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { member, sessionId } = await authorize();
    const id = String(fd.get("id"));
    if (id === sessionId) throw new UserError("Use Sign out in the account menu to end this session.");
    await db.authSession.deleteMany({ where: { id, memberId: member.id } });
    revalidatePath("/profile");
    return { ok: true };
  });
}

/* ---------- Team ---------- */

const ASSIGNABLE: Role[] = ["ADMIN", "DEVELOPER", "VIEWER"];
const TEAM_SEATS = 10;

export async function inviteMembers(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace, member } = await authorize("team");
    const role = z.enum(["ADMIN", "DEVELOPER", "VIEWER"]).parse(fd.get("role"));
    const emails = [...new Set(String(fd.get("emails") ?? "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (!emails.length) throw new UserError("Enter at least one email address.");
    const bad = emails.find((e) => !z.email().safeParse(e).success);
    if (bad) throw new UserError(`${bad} isn’t a valid email address.`);
    const existing = await db.teamMember.findMany({ where: { email: { in: emails } }, select: { email: true } });
    if (existing.length) throw new UserError(`${existing[0].email} already has an account.`);
    const seatsUsed = await db.teamMember.count({ where: { workspaceId: workspace.id } });
    if (seatsUsed + emails.length > TEAM_SEATS) throw new UserError(`Your plan has ${TEAM_SEATS} seats and ${TEAM_SEATS - seatsUsed} are left.`);

    const invites = emails.map((email) => ({
      workspaceId: workspace.id,
      email,
      role,
      token: randomBytes(18).toString("base64url"),
      invitedBy: member.name,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    }));
    const origin = await appOrigin();

    await db.$transaction([
      db.invite.deleteMany({ where: { workspaceId: workspace.id, email: { in: emails } } }),
      db.invite.createMany({ data: invites }),
      db.activity.create({
        data: { workspaceId: workspace.id, type: "invite", actorName: member.name, message: `${member.name} invited ${emails.join(", ")} as ${role[0] + role.slice(1).toLowerCase()}` },
      }),
    ]);
    revalidatePath("/settings/users");
    return {
      ok: true,
      message: `Invite${emails.length > 1 ? "s" : ""} created. Send each person their link; it works for 7 days.`,
      links: invites.map((i) => ({ label: i.email, url: `${origin}/invite/${i.token}` })),
    };
  });
}

export async function resendInvite(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("team");
    await db.invite.updateMany({
      where: { id: String(fd.get("id")), workspaceId: workspace.id },
      data: { expiresAt: new Date(Date.now() + 7 * 86_400_000), token: randomBytes(18).toString("base64url") },
    });
    revalidatePath("/settings/users");
    return { ok: true };
  });
}

export async function revokeInvite(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { workspace } = await authorize("team");
    await db.invite.deleteMany({ where: { id: String(fd.get("id")), workspaceId: workspace.id } });
    revalidatePath("/settings/users");
    return { ok: true };
  });
}

async function editableTarget(id: string) {
  const auth = await authorize("team");
  const target = await db.teamMember.findFirst({ where: { id, workspaceId: auth.workspace.id } });
  if (!target) throw new UserError("Team member not found.");
  if (target.role === "OWNER") throw new UserError("The owner’s role can only change by transferring ownership in Settings.");
  if (target.id === auth.member.id) throw new UserError("You can’t change your own role.");
  return target;
}

export async function changeRole(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const target = await editableTarget(String(fd.get("id")));
    const role = z.enum(ASSIGNABLE as [Role, ...Role[]]).parse(fd.get("role"));
    await db.teamMember.update({ where: { id: target.id }, data: { role } });
    revalidatePath("/settings/users");
    return { ok: true, message: `${target.name} is now ${role[0] + role.slice(1).toLowerCase()}.` };
  });
}

export async function removeMember(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const target = await editableTarget(String(fd.get("id")));
    await db.teamMember.delete({ where: { id: target.id } });
    revalidatePath("/settings/users");
    return { ok: true, message: `${target.name} was removed.` };
  });
}

/* ---------- Invite acceptance (public) ---------- */

const acceptSchema = z.object({
  token: z.string().min(10),
  name: z.string().trim().min(2, "Enter your full name."),
  password: z.string().min(10, "Use at least 10 characters."),
});

export async function acceptInvite(_: ActionState, fd: FormData): Promise<ActionState> {
  const result = await run(async () => {
    const input = acceptSchema.parse(Object.fromEntries(fd));
    const invite = await db.invite.findUnique({ where: { token: input.token } });
    if (!invite || invite.expiresAt < new Date()) throw new UserError("This invite has expired. Ask your admin to resend it.");
    if (await db.teamMember.findUnique({ where: { email: invite.email } })) throw new UserError("An account with this email already exists. Sign in instead.");
    const member = await db.$transaction(async (tx) => {
      const m = await tx.teamMember.create({
        data: { workspaceId: invite.workspaceId, email: invite.email, name: input.name, role: invite.role, passwordHash: await bcrypt.hash(input.password, 10) },
      });
      await tx.invite.delete({ where: { id: invite.id } });
      return m;
    });
    await createSession(member.id);
  });
  if (result?.error) return result;
  redirect("/");
}
