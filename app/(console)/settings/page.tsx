import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { getContext, type Ctx } from "@/lib/context";
import { fmt, money } from "@/lib/format";
import { NOTIFICATION_EVENTS, readNotifications } from "@/lib/settings";
import { PageTopbar } from "@/components/shell/PageTopbar";
import { CardHead, href, LinkTabs } from "@/components/ui/bits";
import { ActionForm, DirtyForm, SubmitButton, ThemePicker } from "@/components/ui/client";
import { saveNotifications, saveWorkspace, transferOwnership } from "@/app/actions/account";

export const metadata = { title: "Settings" };

const TABS = [
  { key: "general", label: "General" },
  { key: "billing", label: "Billing" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
  { key: "danger", label: "Danger zone" },
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "general";
  return (
    <>
      <PageTopbar title="Settings" showPeriod={false} />
      <div className="content">
        <section className="card">
          <LinkTabs active={tab} items={TABS} build={(k) => href("/settings", {}, { tab: k === "general" ? null : k })} />
        </section>
        {tab === "general" && <General ctx={ctx} />}
        {tab === "billing" && <Billing ctx={ctx} />}
        {tab === "notifications" && <Notifications ctx={ctx} />}
        {tab === "appearance" && (
          <section className="card">
            <CardHead title="Appearance" sub="Saved in this browser only" divider />
            <div className="card-body">
              <div className="setting-row">
                <div className="text"><div className="title">Theme</div><div className="desc">System follows your device’s light or dark setting.</div></div>
                <ThemePicker />
              </div>
            </div>
          </section>
        )}
        {tab === "danger" && <Danger ctx={ctx} />}
      </div>
    </>
  );
}

function General({ ctx }: { ctx: Ctx }) {
  const { workspace, member } = ctx;
  const disabled = !can(member.role, "workspace");
  return (
    <DirtyForm action={saveWorkspace}>
      <section className="card">
        <CardHead title="Workspace" sub={disabled ? "Only owners and admins can change these." : undefined} divider />
        <div className="card-body form">
          <div className="row-2">
            <div className="field">
              <label htmlFor="ws-name">Workspace name</label>
              <input id="ws-name" name="name" className="input" defaultValue={workspace.name} disabled={disabled} required />
            </div>
            <div className="field">
              <label htmlFor="ws-slug">Workspace URL</label>
              <input id="ws-slug" name="slug" className="input" defaultValue={workspace.slug} disabled={disabled} required />
              <span className="hint">tiun.app/{workspace.slug}</span>
            </div>
          </div>
          <div className="row-2">
            <div className="field">
              <label htmlFor="ws-tz">Timezone</label>
              <select id="ws-tz" name="timezone" className="select" defaultValue={workspace.timezone} disabled={disabled}>
                {["Africa/Dar_es_Salaam", "Africa/Nairobi", "Africa/Lagos", "Europe/Berlin", "Europe/London", "UTC", "America/New_York"].map((tz) => (
                  <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ws-cur">Default currency</label>
              <select id="ws-cur" name="currency" className="select" defaultValue={workspace.currency} disabled={disabled}>
                <option value="USD">USD · US dollar</option>
                <option value="TZS">TZS · Tanzanian shilling</option>
                <option value="KES">KES · Kenyan shilling</option>
                <option value="EUR">EUR · Euro</option>
              </select>
              <span className="hint">Existing amounts are stored in USD and are not converted.</span>
            </div>
          </div>
          <div className="field" style={{ maxWidth: 320 }}>
            <label htmlFor="ws-df">Date format</label>
            <select id="ws-df" name="dateFormat" className="select" defaultValue={workspace.dateFormat} disabled={disabled}>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
        </div>
      </section>
    </DirtyForm>
  );
}

async function Billing({ ctx }: { ctx: Ctx }) {
  const { workspace, month } = ctx;
  const [requests, sessions] = await Promise.all([
    db.apiRequest.count({ where: { workspaceId: workspace.id, createdAt: { gte: month.start, lt: month.end } } }),
    db.usageSession.count({ where: { workspaceId: workspace.id, startedAt: { gte: month.start, lt: month.end } } }),
  ]);
  const limits = { requests: 100_000, sessions: 50_000 };
  const invoices = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(month.start.getUTCFullYear(), month.start.getUTCMonth() - i, 1));
    return { id: `INV-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }), amount: 9900 };
  });
  const usage = [
    { label: "API requests", used: requests, limit: limits.requests },
    { label: "Usage sessions", used: sessions, limit: limits.sessions },
  ];
  return (
    <div className="grid">
      <section className="card">
        <CardHead title="Your tiun. plan" sub="Growth · $99 per month, renews on the 1st" divider />
        <div className="card-body stack">
          {usage.map((u) => (
            <div key={u.label} className="field">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="label">{u.label}</span>
                <span className="hint">{fmt(u.used)} of {fmt(u.limit)} in {month.label}</span>
              </div>
              <div className="progress"><span style={{ width: `${Math.min(100, (u.used / u.limit) * 100)}%` }} /></div>
            </div>
          ))}
          <div className="setting-row">
            <div className="text"><div className="title">Payment method</div><div className="desc">Visa ending 4242 · expires 08/28</div></div>
            <button className="btn btn-sm" disabled title="Billing changes are not available in this build">Update</button>
          </div>
        </div>
      </section>
      <section className="card">
        <CardHead title="Invoices" />
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table style={{ minWidth: 420 }}>
            <thead><tr><th style={{ width: "auto", paddingLeft: 24 }}>Invoice</th><th>Period</th><th className="num">Amount</th><th>Status</th></tr></thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr key={inv.id} className="row">
                  <td style={{ width: "auto", paddingLeft: 24 }}><code>{inv.id}</code></td>
                  <td className="nowrap">{inv.label}</td>
                  <td className="num">{money(inv.amount)}</td>
                  <td style={{ textAlign: "left" }}><span className={`pill ${i === 0 ? "pending" : "succeeded"}`}>{i === 0 ? "Upcoming" : "Paid"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Notifications({ ctx }: { ctx: Ctx }) {
  const prefs = readNotifications(ctx.workspace.notificationSettings);
  const disabled = !can(ctx.member.role, "workspace");
  return (
    <DirtyForm action={saveNotifications}>
      <section className="card">
        <CardHead title="Notifications" sub="Who hears about what, for the whole workspace" divider />
        <div className="card-body">
          <div className="setting-row" style={{ paddingTop: 0 }}>
            <div className="text" />
            <span className="hint" style={{ width: 44, textAlign: "center" }}>Email</span>
            <span className="hint" style={{ width: 44, textAlign: "center" }}>Slack</span>
          </div>
          {NOTIFICATION_EVENTS.map((e) => (
            <div className="setting-row" key={e.key}>
              <div className="text"><div className="title">{e.title}</div><div className="desc">{e.desc}</div></div>
              <span style={{ width: 44, display: "grid", placeItems: "center" }}>
                <input type="checkbox" className="toggle" name={`${e.key}_email`} defaultChecked={prefs[e.key].email} aria-label={`${e.title} by email`} disabled={disabled} />
              </span>
              <span style={{ width: 44, display: "grid", placeItems: "center" }}>
                <input type="checkbox" className="toggle" name={`${e.key}_slack`} defaultChecked={prefs[e.key].slack} aria-label={`${e.title} in Slack`} disabled={disabled} />
              </span>
            </div>
          ))}
        </div>
      </section>
    </DirtyForm>
  );
}

async function Danger({ ctx }: { ctx: Ctx }) {
  const { workspace, member } = ctx;
  const owner = member.role === "OWNER";
  const others = owner ? await db.teamMember.findMany({ where: { workspaceId: workspace.id, NOT: { id: member.id } }, orderBy: { name: "asc" } }) : [];
  return (
    <section className="card" style={{ borderColor: "var(--red)" }}>
      <CardHead title="Danger zone" sub={owner ? "These actions are hard to undo." : "Only the workspace owner can use these."} divider />
      <div className="card-body stack">
        <div>
          <div className="title" style={{ fontWeight: 500 }}>Transfer ownership</div>
          <p className="hint" style={{ margin: "4px 0 12px" }}>The new owner gets billing and team control. You become an admin.</p>
          {owner && (
            <ActionForm action={transferOwnership}>
              <div className="row-2">
                <div className="field">
                  <label htmlFor="t-member">New owner</label>
                  <select id="t-member" name="memberId" className="select">
                    {others.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.role[0] + m.role.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="t-confirm">Type <b>{workspace.name}</b> to confirm</label>
                  <input id="t-confirm" name="confirm" className="input" autoComplete="off" required />
                </div>
              </div>
              <SubmitButton className="btn btn-danger" pendingLabel="Transferring…">Transfer ownership</SubmitButton>
            </ActionForm>
          )}
        </div>
        <div className="setting-row" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="text">
            <div className="title">Delete workspace</div>
            <div className="desc">Permanently removes all customers, payments and keys. Disabled in this build; run <code>npm run db:reset</code> locally instead.</div>
          </div>
          <button className="btn btn-danger" disabled>Delete workspace</button>
        </div>
      </div>
    </section>
  );
}
