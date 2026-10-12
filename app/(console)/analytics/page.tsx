import Link from "next/link";
import { CircleDollarSign, CreditCard, Percent, UserRoundCheck, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { getContext, type Ctx } from "@/lib/context";
import { change, fmt, money } from "@/lib/format";
import { monthsEnding, revenueByMonth, sessionsPerDay, subscriberSeries } from "@/lib/metrics";
import { PageTopbar } from "@/components/shell/PageTopbar";
import { KpiStrip } from "@/components/ui/Kpi";
import { CardHead, href, LinkTabs } from "@/components/ui/bits";
import { BarChart, ChartEmpty, CohortHeatmap, HBars, LineChart, Waterfall } from "@/components/ui/charts";
import { EmptyRow } from "@/components/ui/empty";

export const metadata = { title: "Analytics" };

const TABS = ["revenue", "subscribers", "retention", "usage"] as const;
type SP = { tab?: string; compare?: string };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const tab = TABS.includes(sp.tab as never) ? (sp.tab as (typeof TABS)[number]) : "revenue";
  const compare = sp.compare === "1";
  const current = { tab: sp.tab, compare: sp.compare };

  return (
    <>
      <PageTopbar title="Analytics">
        <a className="btn" href="/api/export/transactions"><span className="btn-label">Export</span></a>
      </PageTopbar>
      <div className="content">
        <section className="card">
          <div className="card-head">
            <div className="grow">
              <h2 className="card-title">Growth for {ctx.month.label}</h2>
              <p className="card-sub">Figures use {ctx.mode === "LIVE" ? "live" : "sandbox"} data. Change the month in the top bar.</p>
            </div>
            {(tab === "revenue" || tab === "subscribers") && (
              <Link className={`btn${compare ? " btn-primary" : ""}`} href={href("/analytics", current, { compare: compare ? null : "1" })} scroll={false}>
                {compare ? "Comparing to previous year" : "Compare to previous year"}
              </Link>
            )}
          </div>
          <LinkTabs
            active={tab}
            items={TABS.map((t) => ({ key: t, label: t[0].toUpperCase() + t.slice(1) }))}
            build={(k) => href("/analytics", current, { tab: k === "revenue" ? null : k })}
          />
        </section>

        {tab === "revenue" && <RevenueTab ctx={ctx} compare={compare} />}
        {tab === "subscribers" && <SubscribersTab ctx={ctx} compare={compare} />}
        {tab === "retention" && <RetentionTab ctx={ctx} />}
        {tab === "usage" && <UsageTab ctx={ctx} />}
      </div>
    </>
  );
}

async function RevenueTab({ ctx, compare }: { ctx: Ctx; compare: boolean }) {
  const { workspace, mode, month } = ctx;
  const ws = workspace.id;
  const cur = workspace.currency;
  const months = monthsEnding(month.start, 12);
  const yearBefore = monthsEnding(new Date(Date.UTC(month.start.getUTCFullYear() - 1, month.start.getUTCMonth(), 1)), 12);
  const [revenue, subs, txs, plans] = await Promise.all([
    revenueByMonth(ws, mode, yearBefore[0].start),
    subscriberSeries(ws, mode, months.slice(-2)),
    db.transaction.findMany({
      where: { workspaceId: ws, mode, status: { in: ["SUCCEEDED", "REFUNDED"] }, createdAt: { gte: month.prevStart, lt: month.end } },
      select: { customerId: true, amountCents: true, refundedCents: true, createdAt: true, customer: { select: { planId: true } } },
    }),
    db.plan.findMany({ where: { workspaceId: ws }, include: { _count: { select: { customers: { where: { mode, status: "SUBSCRIBED" } } } } } }),
  ]);

  const values = months.map((m) => revenue.get(m.key) ?? 0);
  const previous = yearBefore.map((m) => revenue.get(m.key) ?? 0);
  const total = values[values.length - 1];
  const prevTotal = values[values.length - 2];

  // Revenue bridge: last month → this month, split by customer.
  const perCustomer = new Map<string, { prev: number; cur: number }>();
  for (const t of txs) {
    const e = perCustomer.get(t.customerId) ?? { prev: 0, cur: 0 };
    const net = t.amountCents - t.refundedCents;
    if (t.createdAt >= month.start) e.cur += net;
    else e.prev += net;
    perCustomer.set(t.customerId, e);
  }
  const firsts = await db.transaction.groupBy({
    by: ["customerId"],
    where: { customerId: { in: [...perCustomer.keys()] }, status: { in: ["SUCCEEDED", "REFUNDED"] } },
    _min: { createdAt: true },
  });
  const firstBy = new Map(firsts.map((f) => [f.customerId, f._min.createdAt!]));
  let added = 0, lost = 0, other = 0;
  for (const [id, e] of perCustomer) {
    if (e.prev === 0 && e.cur > 0 && firstBy.get(id)! >= month.start) added += e.cur;
    else if (e.cur === 0 && e.prev > 0) lost -= e.prev;
    else other += e.cur - e.prev;
  }
  const prevName = months[months.length - 2].label;

  const revenueByPlan = new Map<string, number>();
  for (const t of txs) {
    if (t.createdAt < month.start || !t.customer.planId) continue;
    revenueByPlan.set(t.customer.planId, (revenueByPlan.get(t.customer.planId) ?? 0) + t.amountCents - t.refundedCents);
  }
  const activeNow = subs[subs.length - 1].active;
  const activePrev = subs[0].active;

  return (
    <>
      <KpiStrip
        label="Revenue summary"
        items={[
          { label: "Revenue", icon: CircleDollarSign, value: money(total, cur), sub: `${money(prevTotal, cur)} in ${prevName}`, trend: change(total, prevTotal), bars: values.slice(-6) },
          { label: "ARPU", icon: Wallet, value: money(activeNow ? total / activeNow : 0, cur), sub: `${money(activePrev ? prevTotal / activePrev : 0, cur)} in ${prevName}`, trend: change(activeNow ? total / activeNow : 0, activePrev ? prevTotal / activePrev : 0) },
          { label: "New revenue", icon: UserRoundCheck, value: money(added, cur), sub: "From first-time payers" },
          { label: "Lost revenue", icon: Percent, value: money(-lost, cur), sub: `${prevTotal ? ((-lost / prevTotal) * 100).toFixed(1) : "0.0"}% of ${prevName}`, muted: true },
        ]}
      />
      <div className="grid grid-2">
        <section className="card">
          <CardHead title="Monthly revenue" sub="Net of refunds, last 12 months">
            {compare && <div className="legend"><span><i className="c1" />This year</span><span><i className="prev" />Year before</span></div>}
          </CardHead>
          <div className="card-body">
            <LineChart title="Monthly revenue" labels={months.map((m) => m.label)} values={values} previous={compare ? previous : undefined} fmt={(n) => money(n, cur, true)} />
          </div>
        </section>
        <section className="card">
          <CardHead title="Revenue bridge" sub={`What moved revenue from ${prevName} to ${months[months.length - 1].label}`} />
          <div className="card-body">
            <Waterfall
              title="Revenue bridge"
              fmt={(n) => money(n, cur, true)}
              steps={[
                { label: prevName, value: prevTotal, kind: "total" },
                { label: "New", value: added, kind: "delta" },
                { label: "Expansion & other", value: other, kind: "delta" },
                { label: "Lost", value: lost, kind: "delta" },
                { label: months[months.length - 1].label, value: total, kind: "total" },
              ]}
            />
          </div>
        </section>
      </div>
      <section className="card">
        <CardHead title="Plan breakdown" sub={`Subscribers today and revenue in ${month.label}`} />
        <div className="table-wrap">
          <table style={{ minWidth: 560 }}>
            <thead>
              <tr><th>Plan</th><th>Pricing</th><th className="num">Subscribers</th><th className="num">Revenue</th><th className="num">Share</th></tr>
            </thead>
            <tbody>
              {plans.length === 0 && (
                <EmptyRow colSpan={5} icon={CreditCard} title="No plans yet" text="Revenue is broken down by plan once you create plans and customers subscribe.">
                  <Link className="btn" href="/setup/checkout">Create a plan</Link>
                </EmptyRow>
              )}
              {plans.map((p) => {
                const r = revenueByPlan.get(p.id) ?? 0;
                return (
                  <tr key={p.id}>
                    <td style={{ width: "auto", paddingLeft: 24 }}>{p.name}</td>
                    <td>{p.model === "PER_USE" ? `${money(p.priceCents, p.currency)} per unit` : `${money(p.priceCents, p.currency)} / month`}</td>
                    <td className="num">{fmt(p._count.customers)}</td>
                    <td className="num">{money(r, cur)}</td>
                    <td className="num">{total ? ((r / total) * 100).toFixed(1) : "0.0"}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

async function SubscribersTab({ ctx, compare }: { ctx: Ctx; compare: boolean }) {
  const { workspace, mode, month } = ctx;
  const months = monthsEnding(month.start, 12);
  const before = monthsEnding(new Date(Date.UTC(month.start.getUTCFullYear() - 1, month.start.getUTCMonth(), 1)), 12);
  const [series, prior] = await Promise.all([
    subscriberSeries(workspace.id, mode, months),
    compare ? subscriberSeries(workspace.id, mode, before) : Promise.resolve(null),
  ]);
  return (
    <div className="grid grid-2">
      <section className="card">
        <CardHead title="Active subscribers" sub="At the end of each month">
          {compare && <div className="legend"><span><i className="c1" />This year</span><span><i className="prev" />Year before</span></div>}
        </CardHead>
        <div className="card-body">
          <LineChart title="Active subscribers" labels={months.map((m) => m.label)} values={series.map((s) => s.active)} previous={prior?.map((s) => s.active)} fmt={(n) => fmt(Math.round(n))} />
        </div>
      </section>
      <section className="card">
        <CardHead title="New vs churned" sub="Subscribers gained and lost each month">
          <div className="legend"><span><i className="pos" />New</span><span><i className="c3" />Churned</span></div>
        </CardHead>
        <div className="card-body">
          <BarChart
            grouped
            title="New and churned subscribers"
            labels={months.map((m) => m.label)}
            series={[
              { name: "New", values: series.map((s) => s.added), tone: "pos" },
              { name: "Churned", values: series.map((s) => s.churned), tone: "c3" },
            ]}
            fmt={(n) => fmt(Math.round(n))}
          />
        </div>
      </section>
    </div>
  );
}

async function RetentionTab({ ctx }: { ctx: Ctx }) {
  const { workspace, mode, month } = ctx;
  const months = monthsEnding(month.start, 6);
  const customers = await db.customer.findMany({
    where: { workspaceId: workspace.id, mode, status: { not: "TRIAL" }, createdAt: { gte: months[0].start, lt: month.end } },
    select: { createdAt: true, churnedAt: true },
  });
  const now = Date.now();
  const cohorts = months.map((m, i) => {
    const members = customers.filter((c) => c.createdAt >= m.start && c.createdAt < m.end);
    const retained = months.slice(i).map((_, k) => {
      const at = new Date(Date.UTC(m.start.getUTCFullYear(), m.start.getUTCMonth() + k + 1, 1));
      if (k > 0 && at.getTime() - 30 * 86_400_000 > now) return null;
      if (!members.length) return null;
      const alive = members.filter((c) => !c.churnedAt || c.churnedAt >= at).length;
      return Math.round((alive / members.length) * 100);
    });
    return { label: `${m.label} ${m.start.getUTCFullYear()}`, size: members.length, retained };
  });
  return (
    <section className="card">
      <CardHead title="Cohort retention" sub="Share of each signup month still subscribed after N months" />
      <div className="card-body">
        {cohorts.some((c) => c.size > 0) ? (
          <CohortHeatmap cohorts={cohorts} />
        ) : (
          <ChartEmpty text="Retention appears once customers have been subscribed for at least a month." />
        )}
      </div>
    </section>
  );
}

async function UsageTab({ ctx }: { ctx: Ctx }) {
  const { workspace, mode, month } = ctx;
  const [daily, features] = await Promise.all([
    sessionsPerDay(workspace.id, mode, 30),
    db.usageSession.groupBy({
      by: ["feature"],
      where: { workspaceId: workspace.id, mode, startedAt: { gte: month.start, lt: month.end } },
      _count: true,
      _sum: { units: true },
      orderBy: { _count: { feature: "desc" } },
    }),
  ]);
  return (
    <div className="grid grid-main">
      <section className="card">
        <CardHead title="Sessions per day" sub="Last 30 days" />
        <div className="card-body">
          <BarChart title="Sessions per day" labels={daily.map((d) => d.label)} series={[{ name: "Sessions", values: daily.map((d) => d.value), tone: "c1" }]} fmt={(n) => fmt(Math.round(n))} />
        </div>
      </section>
      <section className="card">
        <CardHead title="Top features" sub={`Sessions in ${month.label}`} />
        <div className="card-body">
          {features.length ? (
            <HBars rows={features.map((f) => ({ label: f.feature, value: f._count }))} fmt={fmt} />
          ) : (
            <p className="muted">No sessions in this month.</p>
          )}
        </div>
      </section>
    </div>
  );
}
