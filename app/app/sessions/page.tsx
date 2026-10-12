import Link from "next/link";
import { Activity, AlertTriangle, Download, SearchX, Server, Timer } from "lucide-react";
import { EmptyRow } from "@/components/ui/empty";
import type { Prisma, SessionStatus } from "@/lib/generated/prisma";
import { db } from "@/lib/db";
import { getContext } from "@/lib/context";
import { change, dateTime, duration, fmt, money } from "@/lib/format";
import { sessionsPerHour } from "@/lib/metrics";
import { PageTopbar } from "@/components/shell/PageTopbar";
import { KpiStrip } from "@/components/ui/Kpi";
import { Avatar, CardHead, Drawer, href, LinkTabs, Pagination, StatusPill } from "@/components/ui/bits";
import { BarChart } from "@/components/ui/charts";
import { CopyButton, SearchBox } from "@/components/ui/client";

export const metadata = { title: "Sessions" };

const PAGE_SIZE = 15;
const STATUSES = ["completed", "running", "failed"] as const;
type SP = { status?: string; q?: string; page?: string; id?: string };

async function monthStats(workspaceId: string, mode: "LIVE" | "TEST", start: Date, end: Date) {
  const where = { workspaceId, mode, startedAt: { gte: start, lt: end } };
  const [agg, failed] = await Promise.all([
    db.usageSession.aggregate({ where, _count: true, _avg: { durationMs: true } }),
    db.usageSession.count({ where: { ...where, status: "FAILED" } }),
  ]);
  return { count: agg._count, avg: agg._avg.durationMs ?? 0, errorRate: agg._count ? (failed / agg._count) * 100 : 0 };
}

export default async function SessionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { workspace, mode, month } = await getContext();
  const status = STATUSES.includes(sp.status as never) ? (sp.status!.toUpperCase() as SessionStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();

  const where: Prisma.UsageSessionWhereInput = {
    workspaceId: workspace.id,
    mode,
    ...(status && { status }),
    ...(q && { OR: [{ id: { startsWith: q } }, { customer: { name: { contains: q, mode: "insensitive" } } }, { feature: { contains: q, mode: "insensitive" } }] }),
  };

  const [cur, prev, running, hourly, counts, total, sessions] = await Promise.all([
    monthStats(workspace.id, mode, month.start, month.end),
    monthStats(workspace.id, mode, month.prevStart, month.start),
    db.usageSession.count({ where: { workspaceId: workspace.id, mode, status: "RUNNING" } }),
    sessionsPerHour(workspace.id, mode),
    db.usageSession.groupBy({ by: ["status"], where: { workspaceId: workspace.id, mode }, _count: true }),
    db.usageSession.count({ where }),
    db.usageSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { customer: { select: { id: true, name: true, avatarColor: true } } },
    }),
  ]);

  const all = counts.reduce((n, c) => n + c._count, 0);
  const current = { status: sp.status, q: sp.q, page: sp.page };
  const prevName = month.prevStart.toLocaleString("en-US", { month: "long", timeZone: "UTC" });

  return (
    <>
      <PageTopbar title="Sessions">
        <a className="btn" href="/api/export/sessions">
          <Download size={17} strokeWidth={1.7} />
          <span className="btn-label">Export</span>
        </a>
      </PageTopbar>
      <div className="content">
        <KpiStrip
          label="Session summary"
          items={[
            { label: "Sessions", icon: Server, value: fmt(cur.count), sub: `${fmt(prev.count)} in ${prevName}`, trend: change(cur.count, prev.count) },
            { label: "Avg duration", icon: Timer, value: duration(cur.avg), sub: `${duration(prev.avg)} in ${prevName}`, trend: change(cur.avg, prev.avg) },
            { label: "Error rate", icon: AlertTriangle, value: `${cur.errorRate.toFixed(1)}%`, sub: `${prev.errorRate.toFixed(1)}% in ${prevName}`, trend: { ...change(cur.errorRate, prev.errorRate), good: cur.errorRate <= prev.errorRate }, muted: true },
            { label: "Running now", icon: Activity, value: fmt(running), sub: "Sessions in progress" },
          ]}
        />

        <section className="card">
          <CardHead title="Sessions per hour" sub="Last 24 hours">
            <div className="legend"><span><i className="c1" />Completed</span><span><i className="c3" />Failed</span></div>
          </CardHead>
          <div className="card-body">
            <BarChart
              title="Sessions per hour"
              height={200}
              labels={hourly.map((h) => h.label)}
              series={[
                { name: "Completed", values: hourly.map((h) => h.ok), tone: "c1" },
                { name: "Failed", values: hourly.map((h) => h.failed), tone: "c3" },
              ]}
              fmt={(n) => fmt(Math.round(n))}
              empty="No sessions in the last 24 hours."
            />
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">All sessions</h2>
            <span className="count-badge">{fmt(all)}</span>
            <div className="card-tools">
              <SearchBox id="session-search" placeholder="Search ID, customer or feature" />
            </div>
          </div>
          <LinkTabs
            active={status ? sp.status! : "all"}
            items={[{ key: "all", label: "All", count: all }, ...STATUSES.map((s) => ({ key: s, label: s[0].toUpperCase() + s.slice(1), count: counts.find((c) => c.status === s.toUpperCase())?._count ?? 0 }))]}
            build={(k) => href("/app/sessions", current, { status: k === "all" ? null : k, page: null })}
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "auto", paddingLeft: 24 }}>Session</th>
                  <th>Customer</th>
                  <th>Started</th>
                  <th>Feature</th>
                  <th className="num">Duration</th>
                  <th className="num">Units</th>
                  <th className="num">Cost</th>
                  <th style={{ width: 130, textAlign: "left" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 &&
                  (all === 0 ? (
                    <EmptyRow
                      colSpan={8}
                      icon={Server}
                      title="No sessions yet"
                      text="Each time a customer uses your product, your backend records a session with POST /api/v1/sessions. They’ll show up here live."
                    >
                      <Link className="btn btn-ink" href="/app/setup/integration#quickstart">See the quickstart</Link>
                    </EmptyRow>
                  ) : (
                    <EmptyRow colSpan={8} icon={SearchX} title="No sessions match" text="Try a different search or status.">
                      <Link className="btn" href="/app/sessions">Clear filters</Link>
                    </EmptyRow>
                  ))}
                {sessions.map((s) => (
                  <tr key={s.id} className="row">
                    <td style={{ width: "auto", paddingLeft: 24 }}>
                      <Link className="row-link code" href={href("/app/sessions", current, { id: s.id })} scroll={false}>ses_{s.id.slice(0, 8)}</Link>
                    </td>
                    <td>
                      <div className="cust">
                        <Avatar name={s.customer.name} color={s.customer.avatarColor} size="sm" />
                        {s.customer.name}
                      </div>
                    </td>
                    <td>{dateTime(s.startedAt)}</td>
                    <td>{s.feature}</td>
                    <td className="num">{s.status === "RUNNING" ? "—" : duration(s.durationMs)}</td>
                    <td className="num">{fmt(s.units)}</td>
                    <td className="num">{money(s.costCents, workspace.currency)}</td>
                    <td style={{ textAlign: "left" }}><StatusPill status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} build={(p) => href("/app/sessions", current, { page: p })} />
        </section>
      </div>

      {sp.id && <SessionDrawer id={sp.id} closeHref={href("/app/sessions", current, { id: null })} />}
    </>
  );
}

async function SessionDrawer({ id, closeHref }: { id: string; closeHref: string }) {
  const { workspace } = await getContext();
  const s = await db.usageSession.findFirst({ where: { id, workspaceId: workspace.id }, include: { customer: true } });
  if (!s) return <Drawer title="Session not found" closeHref={closeHref}><p className="muted">This session may have been removed.</p></Drawer>;
  const ended = new Date(s.startedAt.getTime() + s.durationMs);
  return (
    <Drawer title={<span className="code">ses_{s.id.slice(0, 8)}</span>} closeHref={closeHref} actions={<CopyButton value={s.id} />}>
      <dl className="dl">
        <dt>Status</dt><dd><StatusPill status={s.status} /></dd>
        <dt>Customer</dt><dd><Link href={`/app/customers?id=${s.customer.id}`}>{s.customer.name}</Link></dd>
        <dt>Feature</dt><dd>{s.feature}</dd>
        <dt>Units</dt><dd>{fmt(s.units)}</dd>
        <dt>Cost</dt><dd>{money(s.costCents, workspace.currency)}</dd>
        <dt>Duration</dt><dd>{s.status === "RUNNING" ? "In progress" : duration(s.durationMs)}</dd>
        <dt>Session ID</dt><dd className="code">{s.id}</dd>
      </dl>
      <div>
        <h3 className="h-sub">Timeline</h3>
        <ol className="timeline">
          <li>Session started<small>{dateTime(s.startedAt)}</small></li>
          <li>First response streamed<small>{dateTime(new Date(s.startedAt.getTime() + Math.min(1200, s.durationMs / 4)))}</small></li>
          {s.status === "COMPLETED" && <li>Completed · {fmt(s.units)} units billed<small>{dateTime(ended)}</small></li>}
          {s.status === "FAILED" && <li className="bad">Failed: upstream model timed out<small>{dateTime(ended)}</small></li>}
          {s.status === "RUNNING" && <li>Still running…<small>Updated just now</small></li>}
        </ol>
      </div>
    </Drawer>
  );
}
