import { appOrigin } from "@/lib/origin";
import { Check, Link2, Mail, Minus, UserPlus } from "lucide-react";
import { EmptyRow } from "@/components/ui/empty";
import { InviteFields } from "./InviteFields";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { getContext } from "@/lib/context";
import { initials, relative, shortDate, titleCase } from "@/lib/format";
import { PageTopbar } from "@/components/shell/PageTopbar";
import { Avatar, CardHead, href, LinkTabs } from "@/components/ui/bits";
import { ActionButton, CopyButton, ModalForm } from "@/components/ui/client";
import { inviteMembers, removeMember, resendInvite, revokeInvite } from "@/app/actions/account";
import { RoleSelect } from "./RoleSelect";

export const metadata = { title: "Team" };

const SEATS = 10;
const MATRIX: [string, boolean, boolean, boolean, boolean][] = [
  ["View dashboards and data", true, true, true, true],
  ["Manage API keys, webhooks and sign-in", true, true, true, false],
  ["Manage customers and refunds", true, true, false, false],
  ["Plans, coupons and workspace settings", true, true, false, false],
  ["Invite and remove teammates", true, true, false, false],
  ["Billing and ownership", true, false, false, false],
];

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const { workspace, member } = await getContext();
  const tab = sp.tab === "pending" ? "pending" : "members";
  const [members, invites] = await Promise.all([
    db.teamMember.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ role: "asc" }, { name: "asc" }] }),
    db.invite.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const manage = can(member.role, "team");
  const origin = await appOrigin();
  const now = new Date();

  return (
    <>
      <PageTopbar title="Team" showPeriod={false}>
        {manage && (
          <ModalForm
            trigger={<><UserPlus size={17} /><span className="btn-label">Invite member</span></>}
            title={`Invite to ${workspace.name}`}
            icon={<UserPlus size={20} />}
            tone="blue"
            width={480}
            action={inviteMembers}
            submitLabel="Send invite"
            footerNote={<><Link2 size={16} /> You’ll get a link to share</>}
          >
            <InviteFields members={members.map((m) => ({ initials: initials(m.name) }))} seats={SEATS} />
          </ModalForm>
        )}
      </PageTopbar>
      <div className="content">
        <section className="card">
          <div className="card-head">
            <div className="grow">
              <div className="row">
                <h2 className="card-title">Team members</h2>
                <span className="count-badge">{members.length} of {SEATS} seats</span>
              </div>
              <p className="card-sub">People who can sign in to {workspace.name}. Customers live under User Management.</p>
            </div>
          </div>
          <LinkTabs
            active={tab}
            items={[{ key: "members", label: "Members", count: members.length }, { key: "pending", label: "Pending invites", count: invites.length }]}
            build={(k) => href("/settings/users", {}, { tab: k === "members" ? null : k })}
          />
          <div className="table-wrap">
            {tab === "members" ? (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "auto", paddingLeft: 24 }}>Member</th>
                    <th>Role</th>
                    <th>Two-factor</th>
                    <th>Last active</th>
                    <th style={{ width: 130 }} />
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const editable = manage && m.role !== "OWNER" && m.id !== member.id;
                    return (
                      <tr key={m.id} className="row">
                        <td style={{ width: "auto", paddingLeft: 24 }}>
                          <div className="cust">
                            <Avatar name={m.name} src={m.avatarUrl} />
                            <div>
                              <div className="cust-name">{m.name}{m.id === member.id && <span className="tag" style={{ marginLeft: 8 }}>You</span>}</div>
                              <div className="cust-email">{m.email}{m.title ? ` · ${m.title}` : ""}</div>
                            </div>
                          </div>
                        </td>
                        <td>{editable ? <RoleSelect id={m.id} role={m.role} name={m.name} /> : <span className="tag">{titleCase(m.role)}</span>}</td>
                        <td><span className={`pill ${m.twoFactor ? "active" : "inactive"}`}>{m.twoFactor ? "On" : "Off"}</span></td>
                        <td>{relative(m.lastActiveAt)}</td>
                        <td style={{ width: 130 }}>
                          {editable && (
                            <div className="row-actions">
                              <ActionButton action={removeMember} fields={{ id: m.id }} confirmLabel="Confirm remove">Remove</ActionButton>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "auto", paddingLeft: 24 }}>Email</th>
                    <th>Role</th>
                    <th>Invited by</th>
                    <th>Expires</th>
                    <th style={{ width: 300 }} />
                  </tr>
                </thead>
                <tbody>
                  {invites.length === 0 && (
                    <EmptyRow colSpan={5} icon={Mail} title="No pending invites" text="People you invite show up here until they accept. Each link works for 7 days." />
                  )}
                  {invites.map((inv) => {
                    const expired = inv.expiresAt < now;
                    return (
                      <tr key={inv.id} className="row">
                        <td style={{ width: "auto", paddingLeft: 24 }}>{inv.email}</td>
                        <td><span className="tag">{titleCase(inv.role)}</span></td>
                        <td>{inv.invitedBy}</td>
                        <td>{expired ? <span className="pill expired">Expired</span> : shortDate(inv.expiresAt)}</td>
                        <td style={{ width: 300 }}>
                          {manage && (
                            <div className="row-actions">
                              {!expired && <CopyButton value={`${origin}/invite/${inv.token}`} label="Copy link" />}
                              <ActionButton action={resendInvite} fields={{ id: inv.id }}>{expired ? "Renew" : "Resend"}</ActionButton>
                              <ActionButton action={revokeInvite} fields={{ id: inv.id }} confirmLabel="Confirm">Revoke</ActionButton>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ height: 8 }} />
        </section>

        <section className="card">
          <CardHead title="Roles and permissions" />
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th style={{ width: "auto", paddingLeft: 24 }}>Can…</th>
                  {["Owner", "Admin", "Developer", "Viewer"].map((r) => <th key={r} style={{ textAlign: "center", width: 100 }}>{r}</th>)}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map(([label, ...allowed]) => (
                  <tr key={label} className="row">
                    <td style={{ width: "auto", paddingLeft: 24 }}>{label}</td>
                    {allowed.map((a, i) => (
                      <td key={i} style={{ textAlign: "center", width: 100, paddingRight: 12 }}>
                        {a ? <Check size={16} color="var(--green)" aria-label="Yes" /> : <Minus size={16} color="var(--faint)" aria-label="No" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ height: 8 }} />
        </section>
      </div>
    </>
  );
}
