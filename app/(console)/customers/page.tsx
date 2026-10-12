import Link from "next/link";
import { Download, SearchX, TrendingUp, UserMinus, UserPlus, Users } from "lucide-react";
import type { CustomerStatus, Prisma } from "@/lib/generated/prisma";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { getContext } from "@/lib/context";
import { change, dateTime, dayLabel, fmt, initials, money, timeOfDay } from "@/lib/format";
import { monthsEnding, subscriberSeries } from "@/lib/metrics";
import { PageTopbar } from "@/components/shell/PageTopbar";
import { KpiStrip } from "@/components/ui/Kpi";
import { Avatar, Drawer, href, LinkTabs, Pagination, StatusPill } from "@/components/ui/bits";
import { ActionButton, FilterSelect, SearchBox } from "@/components/ui/client";
import { EmptyRow } from "@/components/ui/empty";
import { AddCustomerModal, RecordPaymentModal } from "@/components/modals";
import { setCustomerStatus } from "@/app/actions/customers";
import { CustomersTable, type CustomerRow } from "./CustomersTable";

export const metadata = { title: "User Management" };

const PAGE_SIZE = 10;
const STATUSES = ["subscribed", "trial", "paused", "churned"] as const;
const ACTIVE = { "7": "Active in 7 days", "30": "Active in 30 days", "90": "Active in 90 days" } as const;
type SP = { status?: string; q?: string; page?: string; id?: string; plan?: string; active?: string };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const { workspace, mode, month, member } = ctx;
  const status = STATUSES.includes(sp.status as never) ? (sp.status!.toUpperCase() as CustomerStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();

  const where: Prisma.CustomerWhereInput = {
    workspaceId: workspace.id,
    mode,
    ...(status && { status }),
    ...(sp.plan && { planId: sp.plan }),
    ...(sp.active && sp.active in ACTIVE && { lastActiveAt: { gte: new Date(Date.now() - Number(sp.active) * 86_400_000) } }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }),
  };
  const filtered = !!(status || sp.plan || sp.active || q);
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const months = monthsEnding(month.start, 6);

  const [counts, total, customers, series, plans] = await Promise.all([
    db.customer.groupBy({ by: ["status"], where: { workspaceId: workspace.id, mode }, _count: true }),
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      orderBy: { lastActiveAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { plan: { select: { name: true } } },
    }),
    subscriberSeries(workspace.id, mode, months),
    db.plan.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ active: "desc" }, { priceCents: "asc" }] }),
  ]);

  const ids = customers.map((c) => c.id);
  const [sessionCounts, spend] = await Promise.all([
    db.usageSession.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, startedAt: { gte: since30 } }, _count: true }),
    db.transaction.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, status: "SUCCEEDED", createdAt: { gte: since30 } }, _sum: { amountCents: true } }),
  ]);
  const sessionsBy = new Map(sessionCounts.map((s) => [s.customerId, s._count]));
  const spendBy = new Map(spend.map((s) => [s.customerId, s._sum.amountCents ?? 0]));

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const all = counts.reduce((n, c) => n + c._count, 0);
  const cur = series[series.length - 1];
  const prev = series[series.length - 2];
  const prevLabel = prev.start.toLocaleString("en-US", { month: "long", timeZone: "UTC" });

  const current = { status: sp.status, q: sp.q, page: sp.page, plan: sp.plan, active: sp.active };
  const activePlans = plans.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }));
  const rows: CustomerRow[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    status: c.status,
    plan: c.plan?.name ?? "—",
    sessions: sessionsBy.get(c.id) ?? 0,
    spend: money(spendBy.get(c.id) ?? 0, workspace.currency),
    last: dayLabel(c.lastActiveAt) === "Today" || dayLabel(c.lastActiveAt) === "Yesterday" ? timeOfDay(c.lastActiveAt) : dateTime(c.lastActiveAt),
    group: dayLabel(c.lastActiveAt),
    color: c.avatarColor,
    initials: initials(c.name),
    avatarUrl: null,
    href: href("/customers", current, { id: c.id }),
  }));

  const manage = can(member.role, "manageCustomers");

  return (
    <>
      <PageTopbar title="User Management">
        {manage && <AddCustomerModal plans={activePlans} />}
      </PageTopbar>

      <div className="content">
        <KpiStrip
          label="Subscriber summary"
          items={[
            { label: "Active subscribers", icon: Users, value: fmt(cur.active), sub: `${fmt(prev.active)} in ${prevLabel}`, trend: change(cur.active, prev.active), bars: series.map((s) => s.active) },
            { label: "New subscribers", icon: UserPlus, value: fmt(cur.added), sub: `${fmt(prev.added)} in ${prevLabel}`, trend: change(cur.added, prev.added), bars: series.map((s) => s.added) },
            { label: "Churned", icon: UserMinus, value: fmt(cur.churned), sub: `${fmt(prev.churned)} in ${prevLabel}`, trend: { ...change(cur.churned, prev.churned), good: cur.churned <= prev.churned }, bars: series.map((s) => s.churned), muted: true, operator: "−" },
            { label: "Net new", icon: TrendingUp, value: fmt(cur.net), sub: `${fmt(prev.net)} in ${prevLabel}`, trend: change(cur.net, prev.net), bars: series.map((s) => Math.max(0, s.net)), operator: "=" },
          ]}
        />

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Customers</h2>
            <span className="count-badge">{fmt(all)}</span>
          </div>

          <LinkTabs
            active={sp.status && STATUSES.includes(sp.status as never) ? sp.status : "all"}
            items={[{ key: "all", label: "All", count: all }, ...STATUSES.map((s) => ({ key: s, label: s[0].toUpperCase() + s.slice(1), count: countOf(s.toUpperCase()) }))]}
            build={(k) => href("/customers", current, { status: k === "all" ? null : k, page: null })}
          />

          {all > 0 && (
            <div className="toolbar">
              <SearchBox id="customer-search" placeholder="Search name or email" />
              {plans.length > 0 && <FilterSelect param="plan" label="All plans" options={plans.map((p) => ({ value: p.id, label: p.name }))} />}
              <FilterSelect param="active" label="Any activity" options={Object.entries(ACTIVE).map(([value, label]) => ({ value, label }))} />
              <span className="spacer" />
              <a className="btn btn-sm" href={`/api/export/customers${status ? `?status=${sp.status}` : ""}`}>
                <Download size={15} strokeWidth={1.7} /> Export CSV
              </a>
            </div>
          )}

          <CustomersTable
            rows={rows}
            canManage={manage}
            empty={
              all === 0 ? (
                <EmptyRow
                  colSpan={8}
                  icon={Users}
                  title="No customers yet"
                  text="Customers appear here when you add them by hand or when your app creates them through the API."
                >
                  {manage && <AddCustomerModal plans={activePlans} label="Add your first customer" triggerClass="btn btn-ink" />}
                  <Link className="btn" href="/setup/integration#quickstart">Connect via API</Link>
                </EmptyRow>
              ) : (
                <EmptyRow colSpan={8} icon={SearchX} title="No customers match" text={filtered ? "Try a different search, tab or filter." : "Nothing here yet."}>
                  {filtered && <Link className="btn" href="/customers">Clear filters</Link>}
                </EmptyRow>
              )
            }
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} build={(p) => href("/customers", current, { page: p })} />
        </section>
      </div>

      {sp.id && <CustomerDrawer id={sp.id} closeHref={href("/customers", current, { id: null })} canManage={manage} />}
    </>
  );
}

async function CustomerDrawer({ id, closeHref, canManage }: { id: string; closeHref: string; canManage: boolean }) {
  const { workspace } = await getContext();
  const c = await db.customer.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      plan: true,
      sessions: { orderBy: { startedAt: "desc" }, take: 5 },
      transactions: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!c) return <Drawer title="Customer not found" closeHref={closeHref}><p className="muted">This customer may have been deleted.</p></Drawer>;
  const lifetime = await db.transaction.aggregate({ where: { customerId: id, status: "SUCCEEDED" }, _sum: { amountCents: true } });

  return (
    <Drawer title={c.name} closeHref={closeHref}>
      <div className="cust">
        <Avatar name={c.name} color={c.avatarColor} />
        <div>
          <div className="cust-name">{c.email}</div>
          <div className="cust-email">Customer since {c.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
        </div>
      </div>
      <dl className="dl">
        <dt>Status</dt><dd><StatusPill status={c.status} /></dd>
        <dt>Plan</dt><dd>{c.plan ? `${c.plan.name} · ${c.plan.model === "PER_USE" ? `${money(c.plan.priceCents, c.plan.currency)}/unit` : `${money(c.plan.priceCents, c.plan.currency)}/month`}` : "—"}</dd>
        <dt>Lifetime spend</dt><dd>{money(lifetime._sum.amountCents ?? 0, workspace.currency)}</dd>
        <dt>Last activity</dt><dd>{dateTime(c.lastActiveAt)}</dd>
        {c.churnedAt && (<><dt>Cancelled</dt><dd>{dateTime(c.churnedAt)}</dd></>)}
      </dl>

      {canManage && (
        <div className="row">
          <RecordPaymentModal
            customer={{ id: c.id, name: c.name, avatarColor: c.avatarColor }}
            context={c.plan ? `${c.plan.name} plan` : "No plan"}
            suggested={c.plan && c.plan.model === "MONTHLY" ? (c.plan.priceCents / 100).toFixed(2) : undefined}
          />
          {c.status === "PAUSED" || c.status === "CHURNED" ? (
            <ActionButton action={setCustomerStatus} fields={{ id: c.id, status: "SUBSCRIBED" }} className="btn">Reactivate</ActionButton>
          ) : (
            <ActionButton action={setCustomerStatus} fields={{ id: c.id, status: "PAUSED" }} className="btn">Pause</ActionButton>
          )}
          {c.status !== "CHURNED" && (
            <ActionButton action={setCustomerStatus} fields={{ id: c.id, status: "CHURNED" }} className="btn" confirmLabel="Confirm cancel">Cancel subscription</ActionButton>
          )}
        </div>
      )}

      <div>
        <h3 className="h-sub">Recent sessions</h3>
        {c.sessions.length === 0 ? <p className="muted">No sessions yet.</p> : (
          <ul className="feed">
            {c.sessions.map((s) => (
              <li key={s.id}>
                <div className="text">
                  <Link href={`/sessions?id=${s.id}`}>{s.feature}</Link>
                  <small>{fmt(s.units)} units · {money(s.costCents, workspace.currency)}</small>
                </div>
                <span className="when">{dateTime(s.startedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="h-sub">Recent transactions</h3>
        {c.transactions.length === 0 ? <p className="muted">No transactions yet.</p> : (
          <ul className="feed">
            {c.transactions.map((t) => (
              <li key={t.id}>
                <div className="text">
                  <Link href={`/transactions?id=${t.id}`}>{money(t.amountCents, t.currency)}</Link>
                  <small>{t.description}</small>
                </div>
                <StatusPill status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  );
}
