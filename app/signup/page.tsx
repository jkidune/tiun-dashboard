import Link from "next/link";
import { redirect } from "next/navigation";
import { Zap } from "lucide-react";
import { getCurrentMember } from "@/lib/auth";
import { signup } from "@/app/actions/signup";
import { ActionForm, SubmitButton } from "@/components/ui/client";

export const metadata = { title: "Create your workspace" };

export default async function SignupPage() {
  if (await getCurrentMember()) redirect("/");
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-logo">
          <span className="logo-mark"><Zap size={15} fill="currentColor" strokeWidth={0} /></span>
          tiun.
        </div>
        <div>
          <h1>Create your workspace</h1>
          <p>Start empty and add your plans, customers and API keys as you go.</p>
        </div>
        <ActionForm action={signup}>
          <div className="field">
            <label htmlFor="workspace">Workspace name</label>
            <input id="workspace" name="workspace" className="input" placeholder="Your company" autoComplete="organization" required />
          </div>
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" className="input" autoComplete="name" required />
          </div>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" className="input" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={10} required />
            <span className="hint">At least 10 characters.</span>
          </div>
          <SubmitButton className="btn btn-ink btn-lg" pendingLabel="Creating workspace…">Create workspace</SubmitButton>
        </ActionForm>
        <p className="hint" style={{ textAlign: "center" }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
