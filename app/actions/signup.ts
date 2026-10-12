"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { formObject, run, UserError, type ActionState } from "@/lib/action";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  email: z.email("Enter a valid email address.").transform((s) => s.toLowerCase()),
  password: z.string().min(10, "Use at least 10 characters for your password."),
  workspace: z.string().trim().min(2, "Name your workspace, e.g. your company name.").max(60),
});

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "workspace";

/** Creates an empty workspace and its owner, then signs them in. */
export async function signup(_: ActionState, fd: FormData): Promise<ActionState> {
  const result = await run(async () => {
    const input = schema.parse(formObject(fd));
    if (await db.teamMember.findUnique({ where: { email: input.email } })) {
      throw new UserError("An account with this email already exists. Sign in instead.");
    }
    let slug = slugify(input.workspace);
    if (await db.workspace.findUnique({ where: { slug } })) slug = `${slug}-${randomBytes(2).toString("hex")}`;

    const member = await db.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: input.workspace,
          slug,
          publishableKey: `pk_live_${randomBytes(12).toString("base64url")}`,
          authSettings: { providers: { email: true, magicLink: false, google: false, github: false, apple: false, saml: false }, providerConfig: {}, sessionDays: 30, minPasswordLength: 10, requireSymbols: true, mfa: "optional", allowedDomains: "", botProtection: true },
          checkoutSettings: { brandColor: "#6c4cff", buttonStyle: "rounded", layout: "single", collectTaxId: false, collectAddress: true, allowPromoCodes: true, successUrl: "", cancelUrl: "" },
          notificationSettings: {},
          integrations: {},
        },
      });
      return tx.teamMember.create({
        data: { workspaceId: ws.id, name: input.name, email: input.email, role: "OWNER", passwordHash: await bcrypt.hash(input.password, 10) },
      });
    });
    await createSession(member.id);
  });
  if (result?.error) return result;
  redirect("/");
}
