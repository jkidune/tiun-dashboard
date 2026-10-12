import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import type { Role } from "@/lib/generated/prisma";
import { db } from "./db";

export const SESSION_COOKIE = "tiun_session";
const SESSION_DAYS = 30;

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export async function createSession(memberId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await db.authSession.create({ data: { id: sha256(token), memberId, expiresAt, userAgent } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.authSession.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in team member, or null. Cached per request. */
export const getCurrentMember = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = sha256(token);
  const session = await db.authSession.findUnique({
    where: { id },
    include: { member: { include: { workspace: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;

  // Touch activity at most every 5 minutes to keep reads cheap.
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.$transaction([
      db.authSession.update({ where: { id }, data: { lastSeenAt: new Date() } }),
      db.teamMember.update({ where: { id: session.memberId }, data: { lastActiveAt: new Date() } }),
    ]);
  }
  return { sessionId: id, member: session.member, workspace: session.member.workspace };
});

export async function requireMember() {
  const auth = await getCurrentMember();
  if (!auth) redirect("/login");
  return auth;
}

/* ---------- Permissions ---------- */

const PERMISSIONS = {
  manageCustomers: ["OWNER", "ADMIN"],
  refund: ["OWNER", "ADMIN"],
  developer: ["OWNER", "ADMIN", "DEVELOPER"],
  checkout: ["OWNER", "ADMIN"],
  workspace: ["OWNER", "ADMIN"],
  team: ["OWNER", "ADMIN"],
  billing: ["OWNER"],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export const can = (role: Role, permission: Permission) =>
  (PERMISSIONS[permission] as Role[]).includes(role);

export class PermissionError extends Error {}

/** For server actions: returns the member or throws when the role is not allowed. */
export async function authorize(permission?: Permission) {
  const auth = await getCurrentMember();
  if (!auth) throw new PermissionError("Your session has ended. Sign in again.");
  if (permission && !can(auth.member.role, permission)) {
    throw new PermissionError("Your role doesn't allow this. Ask a workspace admin.");
  }
  return auth;
}
