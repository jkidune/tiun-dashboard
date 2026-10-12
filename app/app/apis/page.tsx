import Link from "next/link";
import { AlertTriangle, Check, Gauge, KeyRound, Plus, Repeat, Zap } from "lucide-react";
import { EmptyRow } from "@/components/ui/empty";
import { Prisma } from "@/lib/generated/prisma";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { getContext } from "@/lib/context";
import { change, dateTime, fmt, relative, shortDate } from "@/lib/format";
import { API_SCOPES } from "@/lib/keys";
import { requestsPerDay } from "@/lib/metrics";
import { PageTopbar } from "@/components/shell/PageTopbar";
import { KpiStrip } from "@/components/ui/Kpi";
import { CardHead, codeClass, Drawer, href, LinkTabs, Pagination } from "@/components/ui/bits";
import { BarChart } from "@/components/ui/charts";
import { ActionButton, ModalForm } from "@/components/ui/client";
import { createApiKey, revokeApiKey, rollApiKey } from "@/app/actions/developer";

export const metadata = { title: "APIs" };

const PAGE_SIZE = 15;
type SP = { log?: string; page?: string; id?: string };

async function windowStats(workspaceId: string, mode: "LIVE" | "TEST", from: Date, to: Date) {
  const [row] = await db.$queryRaw<{ n: bigint; errors: bigint; p95: number | null }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS n,
           COUNT(*) FILTER (WHERE "statusCode" >= 400)::bigint AS errors,
           percentile_cont(0.95) WITHIN GROUP (ORDER BY "latencyMs") AS p95
    FROM "ApiRequest"
    WHERE "workspaceId" = ${workspaceId} AND mode = ${mode}::"Mode" AND "createdAt" >= ${from} AND "createdAt" < ${to}`);
  const n = Number(row?.n ?? 0);
  return { n, errorRate: n ? (Number(row.errors) / n) * 100 : 0, p95: Math.round(row?.p95 ?? 0) };
}

export default async function ApisPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { workspace, mode, member } = await getContext();
  const page = Math.max(1, Number(sp.page) || 1);
  const errorsOnly = sp.log === "errors";
  const now = new Date();
  const d30 = new Date(Date.now() - 30 * 86_400_000);
  const d60 = new Date(Date.now() - 60 * 86_400_000);
  const logWhere: Prisma.ApiRequestWhereInput = { workspaceId: workspace.id, mode, ...(errorsOnly && { statusCode: { gte: 400 } }) };

  const [cur, prev, keys, daily, total, requests] = await Promise.all([
    windowStats(workspace.id, mode, d30, now),
    windowStats(workspace.id, mode, d60, d30),
    db.apiKey.findMany({ where: { workspaceId: workspace.id, mode }, orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }] }),
    requestsPerDay(workspace.id, mode, 14),
    db.apiRequest.count({ where: logWhere }),
    db.apiRequest.findMany({ where: logWhere, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { apiKey: { select: { name: true } } } }),
  ]);
  const activeKeys = keys.filter((k) => !k.revokedAt && (!k.expiresAt || k.expiresAt > now));
  const dev = can(member.role, "developer");
  const current = { log: sp.log, page: sp.page };

  const createKey = (triggerClass: string) =>
    dev && (
          <ModalForm
            trigger={<><Plus size={17} /><span className="btn-label">Create API key</span></>}
            triggerClass={triggerClass}
            title={`Create ${mode === "LIVE" ? "live" : "sandbox"} API key`}
            subtitle="The secret is shown once, right after you create it"
            icon={<KeyRound size={20} />}
            tone="violet"
            action={createApiKey}
            submitLabel="Create key"
          >
            <div className="field">
              <label htmlFor="k-name">Name</label>
              <input id="k-name" name="name" className="input" placeholder="e.g. Production server" required autoFocus />
            </div>
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ marginBottom: 8 }}>Permissions</legend>
              <div className="check-grid">
                {API_SCOPES.map((s) => (
                  <label key={s} className="check-row">
                    <input type="checkbox" className="checkbox" name="scopes" value={s} defaultChecked={s.endsWith(":read")} />
                    <code>{s}</code>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="k-exp">Expires</label>
              <select id="k-exp" name="expires" className="select" defaultValue="never">
                <option value="never">Never</option>
                <option value="30">In 30 days</option>
                <option value="90">In 90 days</option>
                <option value="365">In 1 year</option>
              </select>
            </div>
          </ModalForm>
    );

  return (
    <>
      <PageTopbar title="APIs" showPeriod={false}>
        {createKey("btn btn-primary")}
      </PageTopbar>
      <div className="content">
        <KpiStrip
          label="API summary"
          items={[
            { label: "Requests (30d)", icon: Zap, value: fmt(cur.n), sub: `${fmt(prev.n)} the 30 days before`, trend: change(cur.n, prev.n) },
            { label: "Error rate", icon: AlertTriangle, value: `${cur.errorRate.toFixed(2)}%`, sub: `${prev.errorRate.toFixed(2)}% before`, trend: { ...change(cur.errorRate, prev.errorRate), good: cur.errorRate <= prev.errorRate }, muted: true },
            { label: "p95 latency", icon: Gauge, value: `${fmt(cur.p95)} ms`, sub: `${fmt(prev.p95)} ms before`, trend: { ...change(cur.p95, prev.p95), good: cur.p95 <= prev.p95 }, muted: true },
            { label: "Active keys", icon: KeyRound, value: fmt(activeKeys.length), sub: `${keys.length - activeKeys.length} revoked or expired` },
          ]}
        />

        <section className="card">
          <CardHead title="API keys" sub={`${mode === "LIVE" ? "Live" : "Sandbox"} keys start with sk_${mode === "LIVE" ? "live" : "test"}_. Secrets are shown once, when created.`} />
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "auto", paddingLeft: 24 }}>Name</th>
                  <th>Key</th>
                  <th>Permissions</th>
                  <th>Created</th>
                  <th>Last used</th>
                  <th>Status</th>
                  <th style={{ width: 200 }} />
                </tr>
              </thead>
              <tbody>
                {keys.length === 0 && (
                  <EmptyRow
                    colSpan={7}
                    icon={KeyRound}
                    title={`No ${mode === "LIVE" ? "live" : "sandbox"} keys yet`}
                    text="Your backend uses a secret key to create customers and record usage. Start with a sandbox key while you build."
                  >
                    {createKey("btn btn-ink")}
                  </EmptyRow>
                )}
                {keys.map((k) => {
                  const expired = k.expiresAt && k.expiresAt < now;
                  const state = k.revokedAt ? "REVOKED" : expired ? "EXPIRED" : "ACTIVE";
                  return (
                    <tr key={k.id} className="row">
                      <td style={{ width: "auto", paddingLeft: 24, fontWeight: 500 }}>{k.name}</td>
                      <td><code>{k.prefix}</code></td>
                      <td><div className="tags">{k.scopes.map((s) => <span key={s} className="tag">{s}</span>)}</div></td>
                      <td>{shortDate(k.createdAt)}</td>
                      <td>{k.lastUsedAt ? relative(k.lastUsedAt) : "Never"}</td>
                      <td><span className={`pill ${state.toLowerCase()}`}>{state[0] + state.slice(1).toLowerCase()}</span></td>
                      <td style={{ width: 200 }}>
                        {dev && state === "ACTIVE" && (
                          <div className="row-actions">
                            <ModalForm trigger={<><Repeat size={14} /> Roll</>} triggerClass="btn btn-sm" title={`Roll “${k.name}”`} action={rollApiKey} submitLabel="Roll key" danger>
                              <input type="hidden" name="id" value={k.id} />
                              <p style={{ margin: 0 }}>Rolling creates a new secret and stops the current one working immediately. Update your servers right after.</p>
                            </ModalForm>
                            <ActionButton action={revokeApiKey} fields={{ id: k.id }} confirmLabel="Confirm revoke">Revoke</ActionButton>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <CardHead title="Requests" sub="Last 14 days by response class">
            <div className="legend"><span><i className="c1" />2xx</span><span><i className="c2" />4xx</span><span><i className="c3" />5xx</span></div>
          </CardHead>
          <div className="card-body">
            <BarChart
              title="API requests per day"
              labels={daily.map((d) => d.label)}
              series={[
                { name: "2xx", values: daily.map((d) => d.ok), tone: "c1" },
                { name: "4xx", values: daily.map((d) => d.c4), tone: "c2" },
                { name: "5xx", values: daily.map((d) => d.c5), tone: "c3" },
              ]}
              fmt={(n) => fmt(Math.round(n))}
              empty="Request volume appears here once your keys are in use."
            />
          </div>
        </section>

        <section className="card">
          <CardHead title="Request log" />
          <LinkTabs active={errorsOnly ? "errors" : "all"} items={[{ key: "all", label: "All requests" }, { key: "errors", label: "Errors only" }]} build={(k) => href("/app/apis", current, { log: k === "all" ? null : k, page: null })} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 90, paddingLeft: 24 }}>Method</th>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th className="num">Latency</th>
                  <th>Key</th>
                  <th style={{ width: 170, textAlign: "left" }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 && (
                  <EmptyRow
                    colSpan={6}
                    icon={errorsOnly ? Check : Zap}
                    title={errorsOnly ? "No errors" : "No requests yet"}
                    text={errorsOnly ? "Every request in this mode succeeded." : "Calls to /api/v1 made with your keys are logged here with their status and latency."}
                  >
                    {!errorsOnly && <Link className="btn" href="/app/setup/integration#quickstart">See the quickstart</Link>}
                  </EmptyRow>
                )}
                {requests.map((r) => (
                  <tr key={r.id} className="row">
                    <td style={{ width: 90, paddingLeft: 24 }}><span className="tag">{r.method}</span></td>
                    <td><Link className="row-link code" href={href("/app/apis", current, { id: r.id })} scroll={false}>{r.path}</Link></td>
                    <td><code className={codeClass(r.statusCode)}>{r.statusCode}</code></td>
                    <td className="num">{fmt(r.latencyMs)} ms</td>
                    <td className="muted">{r.apiKey?.name ?? "—"}</td>
                    <td style={{ textAlign: "left" }}>{dateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} build={(p) => href("/app/apis", current, { page: p })} />
        </section>
      </div>

      {sp.id && <RequestDrawer id={sp.id} closeHref={href("/app/apis", current, { id: null })} />}
    </>
  );
}

async function RequestDrawer({ id, closeHref }: { id: string; closeHref: string }) {
  const { workspace } = await getContext();
  const r = await db.apiRequest.findFirst({ where: { id, workspaceId: workspace.id }, include: { apiKey: true } });
  if (!r) return <Drawer title="Request not found" closeHref={closeHref}><p className="muted">Logs are kept for 30 days.</p></Drawer>;
  return (
    <Drawer title={<span className="code">{r.method} {r.path}</span>} closeHref={closeHref}>
      <dl className="dl">
        <dt>Status</dt><dd><code className={codeClass(r.statusCode)}>{r.statusCode}</code></dd>
        <dt>Latency</dt><dd>{fmt(r.latencyMs)} ms</dd>
        <dt>Time</dt><dd>{dateTime(r.createdAt)}</dd>
        <dt>API key</dt><dd>{r.apiKey ? `${r.apiKey.name} (${r.apiKey.prefix})` : "—"}</dd>
        <dt>Request ID</dt><dd className="code">req_{r.id}</dd>
      </dl>
      <div>
        <h3 className="h-sub">Request body</h3>
        <pre className="json">{r.requestBody ? JSON.stringify(r.requestBody, null, 2) : "(empty)"}</pre>
      </div>
      <div>
        <h3 className="h-sub">Response body</h3>
        <pre className="json">{r.responseBody ? JSON.stringify(r.responseBody, null, 2) : "(empty)"}</pre>
      </div>
    </Drawer>
  );
}
