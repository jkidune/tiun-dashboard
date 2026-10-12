"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSession, destroySession, getCurrentMember } from "@/lib/auth";
import { MODE_COOKIE, MONTH_COOKIE } from "@/lib/context";
import { formObject, run, type ActionState } from "@/lib/action";
import { blockedFor, clearFailures, clientIp, recordFailure, tooManyMessage } from "@/lib/rate-limit";

const year = 60 * 60 * 24 * 365;
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function setMode(mode: "live" | "test") {
  if (!(await getCurrentMember())) return;
  (await cookies()).set(MODE_COOKIE, mode === "test" ? "test" : "live", { path: "/", maxAge: year, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setMonth(key: string) {
  if (!(await getCurrentMember()) || !/^\d{4}-\d{2}$/.test(key)) return;
  (await cookies()).set(MONTH_COOKIE, key, { path: "/", maxAge: year, sameSite: "lax" });
  revalidatePath("/", "layout");
}

const loginSchema = z.object({
  email: z.email("Enter a valid email address.").transform((s) => s.toLowerCase()),
  password: z.string().min(1, "Enter your password."),
});

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const result = await run(async () => {
    const { email, password } = loginSchema.parse(formObject(fd));
    const ip = await clientIp();
    const wait = await blockedFor(email, ip);
    if (wait) return { error: tooManyMessage(wait) };

    const member = await db.teamMember.findUnique({ where: { email } });
    // Compare against a dummy hash when the email is unknown, so timing doesn't reveal accounts.
    const ok = await bcrypt.compare(password, member?.passwordHash ?? DUMMY_HASH);
    if (!member || !ok) {
      await recordFailure(email, ip);
      return { error: "That email and password don’t match. Try again." };
    }
    await clearFailures(email);
    await createSession(member.id);
  });
  if (result?.error) return result;
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
