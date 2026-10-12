import Link from "next/link";
import { Check, Plus, Webhook } from "lucide-react";
import { EmptyRow } from "@/components/ui/empty";
import { db } from "@/lib/db";
import { appOrigin } from "@/lib/origin";
import { can } from "@/lib/auth";
import { getContext } from "@/lib/context";
import { relative } from "@/lib/format";
import { WEBHOOK_EVENTS } from "@/lib/keys";
import { INTEGRATIONS } from "@/lib/settings";
import { PageTopbar } from "@/components/shell/PageTopbar";
import { CardHead, StatusPill } from "@/components/ui/bits";
import { ActionButton, CopyField, ModalForm } from "@/components/ui/client";
import { CodeTabs } from "@/components/ui/CodeTabs";
import { createWebhook, deleteWebhook, setWebhookStatus, toggleIntegration } from "@/app/actions/developer";

export const metadata = { title: "Integration" };

export default async function IntegrationPage() {
  const { workspace, mode, member } = await getContext();
  const ws = workspace.id;
  const [activeKeys, anyRequest, anySession, hooks] = await Promise.all([
    db.apiKey.count({ where: { workspaceId: ws, mode, revokedAt: null } }),
    db.apiRequest.findFirst({ where: { workspaceId: ws, mode }, select: { id: true } }),
    db.usageSession.findFirst({ where: { workspaceId: ws, mode }, select: { id: true } }),
    db.webhook.findMany({ where: { workspaceId: ws }, orderBy: { createdAt: "asc" } }),
  ]);
  const dev = can(member.role, "developer");
  const apps = (workspace.integrations ?? {}) as Record<string, boolean>;
  const pk = mode === "LIVE" ? workspace.publishableKey : workspace.publishableKey.replace("pk_live_", "pk_test_");

  const steps = [
    { title: "Create a secret key", desc: "Server-side key for the API", done: activeKeys > 0, href: "/app/apis" },
    { title: "Install the SDK", desc: "Your first authenticated request", done: !!anyRequest, href: "#quickstart" },
    { title: "Send a usage event", desc: "Record a customer session", done: !!anySession, href: "#quickstart" },
    { title: "Verify a webhook", desc: "Receive events on your server", done: hooks.some((h) => h.status === "ENABLED" && h.lastDeliveryAt), href: "#webhooks" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const base = await appOrigin();

  return (
    <>
      <PageTopbar title="Integration" showPeriod={false}>
        {dev && <AddWebhook />}
      </PageTopbar>
      <div className="content">
        <section className="card">
          <CardHead title="Setup checklist" sub={`${doneCount} of ${steps.length} steps done`} />
          <div className="card-body stack">
            <div className="progress" aria-hidden><span style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
            <div className="checklist">
              {steps.map((s) => (
                <Link key={s.title} href={s.href} className={`check-item${s.done ? " done" : ""}`} style={{ color: "inherit", textDecoration: "none" }}>
                  <span className="check-dot"><Check size={13} strokeWidth={3} /></span>
                  <span>{s.title}<small>{s.done ? "Done" : s.desc}</small></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <div className="grid grid-main">
          <section className="card" id="quickstart">
            <CardHead title="Quickstart" sub="Record usage from your backend with the REST API" />
            <div className="card-body stack">
              <CodeTabs
                samples={[
                  { label: "cURL", code: `curl ${base}/api/v1/customers \\\n  -H "Authorization: Bearer sk_${mode === "LIVE" ? "live" : "test"}_..."` },
                  {
                    label: "Node.js",
                    code: `const res = await fetch("${base}/api/v1/customers", {\n  method: "POST",\n  headers: {\n    Authorization: \`Bearer \${process.env.TIUN_SECRET_KEY}\`,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify({ name: "Asha Mushi", email: "asha@mail.com" }),\n});\nconsole.log(await res.json());`,
                  },
                  {
                    label: "Python",
                    code: `import os, requests\n\nres = requests.get(\n    "${base}/api/v1/transactions",\n    headers={"Authorization": f"Bearer {os.environ['TIUN_SECRET_KEY']}"},\n)\nprint(res.json())`,
                  },
                ]}
              />
              <p className="hint" style={{ margin: 0 }}>
                Endpoints: <code>GET/POST /api/v1/customers</code>, <code>GET /api/v1/transactions</code>, <code>POST /api/v1/sessions</code>. Every call is logged on the <Link href="/app/apis">APIs</Link> page.
              </p>
            </div>
          </section>

          <section className="card">
            <CardHead title="Keys" sub={mode === "LIVE" ? "Live mode" : "Sandbox mode"} />
            <div className="card-body stack">
              <div className="field">
                <span className="label">Publishable key</span>
                <CopyField value={pk} />
                <span className="hint">Safe to use in browsers and mobile apps.</span>
              </div>
              <div className="field">
                <span className="label">Secret keys</span>
                <p style={{ margin: 0 }}>{activeKeys} active. Secrets are shown once when created.</p>
                <Link href="/app/apis" className="btn" style={{ width: "fit-content" }}>Manage secret keys</Link>
              </div>
            </div>
          </section>
        </div>

        <section className="card" id="webhooks">
          <CardHead title="Webhooks" sub="We POST signed JSON events to these endpoints" />
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "auto", paddingLeft: 24 }}>Endpoint</th>
                  <th>Events</th>
                  <th>Status</th>
                  <th>Last delivery</th>
                  <th style={{ width: 210 }} />
                </tr>
              </thead>
              <tbody>
                {hooks.length === 0 && (
                  <EmptyRow
                    colSpan={5}
                    icon={Webhook}
                    title="No webhooks yet"
                    text="Add an HTTPS endpoint and we’ll POST events like new customers and failed payments to it as they happen."
                  >
                    {dev && <AddWebhook triggerClass="btn btn-ink" />}
                  </EmptyRow>
                )}
                {hooks.map((h) => (
                  <tr key={h.id} className="row">
                    <td style={{ width: "auto", paddingLeft: 24 }}><code style={{ overflowWrap: "anywhere" }}>{h.url}</code></td>
                    <td><div className="tags">{h.events.map((e) => <span key={e} className="tag">{e}</span>)}</div></td>
                    <td><StatusPill status={h.status} /></td>
                    <td>{h.lastDeliveryAt ? relative(h.lastDeliveryAt) : "Never"}</td>
                    <td style={{ width: 210 }}>
                      {dev && (
                        <div className="row-actions">
                          <ActionButton action={setWebhookStatus} fields={{ id: h.id, status: h.status === "DISABLED" ? "ENABLED" : "DISABLED" }}>
                            {h.status === "DISABLED" ? "Enable" : "Disable"}
                          </ActionButton>
                          <ActionButton action={deleteWebhook} fields={{ id: h.id }} confirmLabel="Confirm delete">Delete</ActionButton>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <CardHead title="Connected apps" />
          <div className="card-body">
            <div className="tile-grid">
              {INTEGRATIONS.map((a) => {
                const on = !!apps[a.key];
                return (
                  <div className="tile" key={a.key}>
                    <div className="tile-head">
                      <span className="tile-logo" style={{ background: a.color }}>{a.name[0]}</span>
                      <div className="grow">
                        <div style={{ fontWeight: 500 }}>{a.name}</div>
                        <div className="desc">{a.desc}</div>
                      </div>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className={`pill ${on ? "active" : "inactive"}`}>{on ? "Connected" : "Not connected"}</span>
                      {dev && (
                        <ActionButton action={toggleIntegration} fields={{ app: a.key }} className={on ? "btn btn-sm" : "btn btn-sm btn-primary"} confirmLabel={on ? "Confirm" : undefined}>
                          {on ? "Disconnect" : "Connect"}
                        </ActionButton>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function AddWebhook({ triggerClass = "btn btn-primary" }: { triggerClass?: string }) {
  return (
    <ModalForm
      trigger={<><Plus size={17} /><span className="btn-label">Add webhook</span></>}
      triggerClass={triggerClass}
      title="Add webhook endpoint"
      subtitle="We sign every delivery so you can verify it"
      icon={<Webhook size={20} />}
      tone="green"
      action={createWebhook}
      submitLabel="Add endpoint"
    >
      <div className="field">
        <label htmlFor="w-url">Endpoint URL</label>
        <input id="w-url" name="url" type="url" className="input" placeholder="https://api.example.com/webhooks/tiun" required autoFocus />
      </div>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>Events to send</legend>
        <div className="check-grid">
          {WEBHOOK_EVENTS.map((e) => (
            <label key={e} className="check-row">
              <input type="checkbox" className="checkbox" name="events" value={e} />
              <code>{e}</code>
            </label>
          ))}
        </div>
      </fieldset>
    </ModalForm>
  );
}
