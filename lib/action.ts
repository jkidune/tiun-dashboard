import "server-only";
import { z } from "zod";
import { PermissionError } from "./auth";

/** What every form-bound server action returns to useActionState. */
export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  /** A one-time secret (API key) to show once after success. */
  secret?: string;
  /** Links to show after success, e.g. invite links. */
  links?: { label: string; url: string }[];
} | null;

/** Runs an action body and turns validation/permission failures into a readable error. */
export async function run(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "Check the form and try again." };
    if (e instanceof PermissionError) return { error: e.message };
    if (e instanceof UserError) return { error: e.message };
    // Re-throw Next.js control-flow errors (redirect, notFound).
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { error: "Something went wrong on our side. Try again." };
  }
}

export class UserError extends Error {}

export const formObject = (fd: FormData) => Object.fromEntries(fd.entries()) as Record<string, string>;
export const checked = (fd: FormData, name: string) => fd.get(name) === "on";
