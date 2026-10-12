import Link from "next/link";
import { redirect } from "next/navigation";
import { Zap } from "lucide-react";
import { getCurrentMember } from "@/lib/auth";
import { login } from "@/app/actions/session";
import { ActionForm, SubmitButton } from "@/components/ui/client";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentMember()) redirect("/app");
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-logo">
          <span className="logo-mark"><Zap size={15} fill="currentColor" strokeWidth={0} /></span>
          tiun.
        </div>
        <div>
          <h1>Sign in to your workspace</h1>
          <p>Use the email your team invited you with.</p>
        </div>
        <ActionForm action={login}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="input" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
          </div>
          <SubmitButton className="btn btn-ink btn-lg" pendingLabel="Signing in…">Sign in</SubmitButton>
        </ActionForm>
        <p className="hint" style={{ textAlign: "center" }}>
          New to tiun.? <Link href="/signup">Create a workspace</Link>
        </p>
      </div>
    </div>
  );
}
