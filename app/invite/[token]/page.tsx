import Link from "next/link";
import { Zap } from "lucide-react";
import { db } from "@/lib/db";
import { titleCase } from "@/lib/format";
import { acceptInvite } from "@/app/actions/account";
import { ActionForm, SubmitButton } from "@/components/ui/client";

export const metadata = { title: "Join workspace" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await db.invite.findUnique({ where: { token }, include: { workspace: { select: { name: true } } } });
  const valid = invite && invite.expiresAt > new Date();

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-logo">
          <span className="logo-mark"><Zap size={15} fill="currentColor" strokeWidth={0} /></span>
          tiun.
        </div>
        {!valid ? (
          <>
            <div>
              <h1>This invite link doesn’t work</h1>
              <p>It may have expired or been revoked. Ask your workspace admin to send a new one.</p>
            </div>
            <Link href="/login" className="btn">Go to sign in</Link>
          </>
        ) : (
          <>
            <div>
              <h1>Join {invite.workspace.name}</h1>
              <p>{invite.invitedBy} invited {invite.email} as {titleCase(invite.role)}.</p>
            </div>
            <ActionForm action={acceptInvite}>
              <input type="hidden" name="token" value={token} />
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input id="name" name="name" className="input" autoComplete="name" required />
              </div>
              <div className="field">
                <label htmlFor="password">Choose a password</label>
                <input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={10} required />
                <span className="hint">At least 10 characters.</span>
              </div>
              <SubmitButton pendingLabel="Creating account…">Create account and join</SubmitButton>
            </ActionForm>
          </>
        )}
      </div>
    </div>
  );
}
