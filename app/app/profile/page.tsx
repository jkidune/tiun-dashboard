import { db } from "@/lib/db";
import { getContext } from "@/lib/context";
import { relative, titleCase } from "@/lib/format";
import { PageTopbar } from "@/components/shell/PageTopbar";
import { Avatar, CardHead } from "@/components/ui/bits";
import { ActionButton, ActionForm, DirtyForm, SubmitButton } from "@/components/ui/client";
import { changePassword, signOutSession, updateProfile } from "@/app/actions/account";
import { AvatarUploader } from "./AvatarUploader";

export const metadata = { title: "Profile" };

/** A readable device name from a user-agent string. */
function device(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export default async function ProfilePage() {
  const { member, sessionId } = await getContext();
  const sessions = await db.authSession.findMany({ where: { memberId: member.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } });

  return (
    <>
      <PageTopbar title="Profile" showPeriod={false} />
      <div className="content">
        <section className="card">
          <div className="card-body">
            <div className="profile-head">
              <Avatar name={member.name} src={member.avatarUrl} size="xl" />
              <div style={{ flex: 1, minWidth: 200 }}>
                <h2>{member.name}</h2>
                <div className="row" style={{ marginTop: 6 }}>
                  <span className="muted">{member.email}</span>
                  <span className="tag">{titleCase(member.role)}</span>
                </div>
              </div>
              <AvatarUploader hasPhoto={!!member.avatarUrl} />
            </div>
          </div>
        </section>

        <div className="grid grid-2">
          <DirtyForm action={updateProfile}>
            <section className="card">
              <CardHead title="Personal details" divider />
              <div className="card-body form">
                <div className="row-2">
                  <div className="field">
                    <label htmlFor="pf-name">Full name</label>
                    <input id="pf-name" name="name" className="input" defaultValue={member.name} required />
                  </div>
                  <div className="field">
                    <label htmlFor="pf-email">Email</label>
                    <input id="pf-email" name="email" type="email" className="input" defaultValue={member.email} required />
                  </div>
                </div>
                <div className="row-2">
                  <div className="field">
                    <label htmlFor="pf-title">Job title</label>
                    <input id="pf-title" name="title" className="input" defaultValue={member.title ?? ""} />
                  </div>
                  <div className="field">
                    <label htmlFor="pf-phone">Phone</label>
                    <input id="pf-phone" name="phone" type="tel" className="input" defaultValue={member.phone ?? ""} />
                  </div>
                </div>
                <div className="field" style={{ maxWidth: 260 }}>
                  <label htmlFor="pf-lang">Language</label>
                  <select id="pf-lang" name="language" className="select" defaultValue={member.language}>
                    {["English", "Kiswahili", "Deutsch", "Français"].map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
              </div>
            </section>
          </DirtyForm>

          <section className="card">
            <CardHead title="Password" divider />
            <div className="card-body">
              <ActionForm action={changePassword} resetOnSuccess>
                <div className="field">
                  <label htmlFor="pw-cur">Current password</label>
                  <input id="pw-cur" name="current" type="password" className="input" autoComplete="current-password" required />
                </div>
                <div className="row-2">
                  <div className="field">
                    <label htmlFor="pw-new">New password</label>
                    <input id="pw-new" name="next" type="password" className="input" autoComplete="new-password" minLength={10} required />
                  </div>
                  <div className="field">
                    <label htmlFor="pw-conf">Confirm new password</label>
                    <input id="pw-conf" name="confirm" type="password" className="input" autoComplete="new-password" required />
                  </div>
                </div>
                <SubmitButton className="btn" pendingLabel="Changing…">Change password</SubmitButton>
              </ActionForm>
            </div>
          </section>
        </div>

        <section className="card">
          <CardHead title="Security" divider />
          <div className="card-body">
            <div className="setting-row">
              <div className="text">
                <div className="title">Two-factor authentication</div>
                <div className="desc">{member.twoFactor ? "On. You’ll be asked for a code from your authenticator app." : "Off. Add a second step to protect your account."}</div>
              </div>
              <span className={`pill ${member.twoFactor ? "active" : "inactive"}`}>{member.twoFactor ? "On" : "Off"}</span>
              <button className="btn btn-sm" disabled title="Authenticator setup is not available in this build">{member.twoFactor ? "Manage" : "Set up"}</button>
            </div>
            <h3 className="h-sub" style={{ marginTop: 20 }}>Signed-in devices</h3>
            {sessions.map((s) => (
              <div className="setting-row" key={s.id}>
                <div className="text">
                  <div className="title">{device(s.userAgent)}{s.id === sessionId && <span className="tag" style={{ marginLeft: 8 }}>This device</span>}</div>
                  <div className="desc">Signed in {relative(s.createdAt)} · last active {relative(s.lastSeenAt)}</div>
                </div>
                {s.id !== sessionId && <ActionButton action={signOutSession} fields={{ id: s.id }}>Sign out</ActionButton>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
