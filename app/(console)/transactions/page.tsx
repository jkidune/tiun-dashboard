import Link from "next/link";
import { AlertTriangle, CircleDollarSign, Download, Receipt, SearchX, Undo2, Wallet } from "lucide-react";
import { EmptyRow } from "@/components/ui/empty";
import type { Prisma, TxStatus } from "@/lib/generated/prisma";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { getContext } from "@/lib/context";
import { change, dateTime, fmt, money } from "@/lib/format";
import { PageTopbar } from "@/components/shell/PageTopbar";
import { KpiStrip } from "@/components/ui/Kpi";
import { Avatar, Drawer, href, LinkTabs, Pagination, StatusPill } from "@/components/ui/bits";
import { ActionForm, CopyButton, FilterSelect, SearchBox, SubmitButton } from "@/components/ui/client";
import { refundTransaction } from "@/app/actions/transactions";

export const metadata = { title: "Transactions" };

const PAGE_SIZE = 15;
const STATUSES = ["succeeded", "pending", "refunded", "failed"] as const;
const PERIODS = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days" } as const;
type SP = { status?: string; q?: string; page?: string; id?: string; method?: string; period?: string };

async function monthTotals(workspaceId: string, mode: "LIVE" | "TEST", start: Date, end: Date) {
  const where = { workspaceId, mode, createdAt: { gte: start, lt: end } };
  const [paid, failed] = await Promise.all([
    db.transaction.aggregate({ where: { ...where, status: { in: ["SUCCEEDED", "REFUNDED"] } }, _sum: { amountCents: true, refundedCents: true, feeCents: true } }),
    db.transaction.count({ where: { ...where, status: "FAILED" } }),
  ]);
  const gross = paid._sum.amountCents ?? 0;
  const refunds = paid._sum.refundedCents ?? 0;
  return { gross, refunds, net: gross - refunds - (paid._sum.feeCents ?? 0), failed };
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { workspace, mode, month } = await getContext();
  const cur = workspace.currency;
  const status = STATUSES.includes(sp.status as never) ? (sp.status!.toUpperCase() as TxStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();

  const where: Prisma.TransactionWhereInput = {
    workspaceId: workspace.id,
    mode,
    ...(status && { status }),
    ...(sp.method && { methodBrand: sp.method }),
    ...(sp.period && sp.period in PERIODS && { createdAt: { gte: new Date(Date.now() - Number(sp.period) * 86_400_000) } }),
    ...(q && { OR: [{ id: { startsWith: q } }, { description: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }] }),
  };
  const filtered = !!(status || sp.method || sp.period || q);

  const [now, prev, counts, methods, total, txs] = await Promise.all([
    monthTotals(workspace.id, mode, month.start, month.end),
    monthTotals(workspace.id, mode, month.prevStart, month.start),
    db.transaction.groupBy({ by: ["status"], where: { workspaceId: workspace.id, mode }, _count: true }),
    db.transaction.groupBy({ by: ["methodBrand"], where: { workspaceId: workspace.id, mode }, orderBy: { methodBrand: "asc" } }),
    db.transaction.count({ where }),
    db.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { customer: { select: { id: true, name: true, avatarColor: true } } },
    }),
  ]);

  const all = counts.reduce((n, c) => n + c._count, 0);
  const current = { status: sp.status, q: sp.q, page: sp.page, method: sp.method, period: sp.period };
  const prevName = month.prevStart.toLocaleString("en-US", { month: "long", timeZone: "UTC" });

  return (
    <>
      <PageTopbar title="Transactions" />
      <div className="content">
        <KpiStrip
          label="Payments summary"
          items={[
            { label: "Gross volume", icon: CircleDollarSign, value: money(now.gross, cur), sub: `${money(prev.gross, cur)} in ${prevName}`, trend: change(now.gross, prev.gross) },
            { label: "Net revenue", icon: Wallet, value: money(now.net, cur), sub: "After refunds and fees", trend: change(now.net, prev.net) },
            { label: "Refunds", icon: Undo2, value: money(now.refunds, cur), sub: `${money(prev.refunds, cur)} in ${prevName}`, trend: { ...change(now.refunds, prev.refunds), good: now.refunds <= prev.refunds }, muted: true },
            { label: "Failed payments", icon: AlertTriangle, value: fmt(now.failed), sub: `${fmt(prev.failed)} in ${prevName}`, trend: { ...change(now.failed, prev.failed), good: now.failed <= prev.failed }, muted: true },
          ]}
        />

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Payments</h2>
            <span className="count-badge">{fmt(all)}</span>
          </div>
          <LinkTabs
            active={status ? sp.status! : "all"}
            items={[{ key: "all", label: "All", count: all }, ...STATUSES.map((s) => ({ key: s, label: s[0].toUpperCase() + s.slice(1), count: counts.find((c) => c.status === s.toUpperCase())?._count ?? 0 }))]}
            build={(k) => href("/transactions", current, { status: k === "all" ? null : k, page: null })}
          />
          {all > 0 && (
            <div className="toolbar">
              <SearchBox id="tx-search" placeholder="Search customer, description or ID" />
              <FilterSelect param="method" label="All methods" options={methods.map((m) => ({ value: m.methodBrand, label: m.methodBrand }))} />
              <FilterSelect param="period" label="Any date" options={Object.entries(PERIODS).map(([value, label]) => ({ value, label }))} />
              <span className="spacer" />
              <a className="btn btn-sm" href="/api/export/transactions">
                <Download size={15} strokeWidth={1.7} /> Export CSV
              </a>
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="num" style={{ width: 130, paddingLeft: 24 }}>Amount</th>
                  <th>Status</th>
                  <th>Customer</th>
                  <th>Description</th>
                  <th>Method</th>
                  <th>Date</th>
                  <th style={{ width: 160, textAlign: "left" }}>ID</th>
                </tr>
              </thead>
              <tbody>
                {txs.length === 0 &&
                  (all === 0 ? (
                    <EmptyRow
                      colSpan={7}
                      icon={Receipt}
                      title="No payments yet"
                      text="Payments appear here when your app charges a customer, or when you record an M-Pesa, cash or bank payment from a customer’s page."
                    >
                      <Link className="btn btn-ink" href="/customers">Go to customers</Link>
                    </EmptyRow>
                  ) : (
                    <EmptyRow colSpan={7} icon={SearchX} title="No payments match" text="Try a different search, status or filter.">
                      {filtered && <Link className="btn" href="/transactions">Clear filters</Link>}
                    </EmptyRow>
                  ))}
                {txs.map((t) => (
                  <tr key={t.id} className="row">
                    <td className="num" style={{ width: 130, paddingLeft: 24 }}>
                      <Link className="row-link" href={href("/transactions", current, { id: t.id })} scroll={false}>
                        <b style={{ fontWeight: 500 }}>{money(t.amountCents, t.currency)}</b>
                      </Link>
                    </td>
                    <td><StatusPill status={t.status} /></td>
                    <td>
                      <div className="cust">
                        <Avatar name={t.customer.name} color={t.customer.avatarColor} size="sm" />
                        {t.customer.name}
                      </div>
                    </td>
                    <td className="muted">{t.description}</td>
                    <td>{t.methodBrand} {t.methodLast4 && <span className="muted">••{t.methodLast4}</span>}</td>
                    <td>{dateTime(t.createdAt)}</td>
                    <td style={{ textAlign: "left" }}>
                      <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                        <code className="muted">txn_{t.id.slice(0, 8)}</code>
                        <CopyButton value={t.id} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} build={(p) => href("/transactions", current, { page: p })} />
        </section>
      </div>

      {sp.id && <TransactionDrawer id={sp.id} closeHref={href("/transactions", current, { id: null })} />}
    </>
  );
}

async function TransactionDrawer({ id, closeHref }: { id: string; closeHref: string }) {
  const { workspace, member } = await getContext();
  const t = await db.transaction.findFirst({ where: { id, workspaceId: workspace.id }, include: { customer: true } });
  if (!t) return <Drawer title="Transaction not found" closeHref={closeHref}><p className="muted">This payment may have been removed.</p></Drawer>;
  const refundable = t.amountCents - t.refundedCents;
  const at = (ms: number) => dateTime(new Date(t.createdAt.getTime() + ms));
  return (
    <Drawer title={money(t.amountCents, t.currency)} closeHref={closeHref} actions={<StatusPill status={t.status} />}>
      <dl className="dl">
        <dt>Customer</dt><dd><Link href={`/customers?id=${t.customer.id}`}>{t.customer.name}</Link></dd>
        <dt>Description</dt><dd>{t.description}</dd>
        <dt>Method</dt><dd>{t.methodBrand}{t.methodLast4 ? ` ending ${t.methodLast4}` : ""}</dd>
        <dt>Transaction ID</dt><dd className="code">{t.id}</dd>
      </dl>
      <div>
        <h3 className="h-sub">Breakdown</h3>
        <dl className="dl">
          <dt>Amount</dt><dd>{money(t.amountCents, t.currency)}</dd>
          <dt>Processing fee</dt><dd>−{money(t.feeCents, t.currency)}</dd>
          <dt>Refunded</dt><dd>−{money(t.refundedCents, t.currency)}</dd>
          <dt>Net</dt><dd><b style={{ fontWeight: 500 }}>{money(t.status === "FAILED" ? 0 : t.amountCents - t.feeCents - t.refundedCents, t.currency)}</b></dd>
        </dl>
      </div>
      <div>
        <h3 className="h-sub">Timeline</h3>
        <ol className="timeline">
          <li>Payment created<small>{dateTime(t.createdAt)}</small></li>
          {t.status === "FAILED" ? (
            <li className="bad">Declined by issuer: insufficient funds<small>{at(2000)}</small></li>
          ) : (
            <>
              <li>Authorised<small>{at(1500)}</small></li>
              {t.status !== "PENDING" && <li>Captured<small>{at(4000)}</small></li>}
              {t.refundedCents > 0 && <li>Refunded {money(t.refundedCents, t.currency)}<small>After capture</small></li>}
            </>
          )}
        </ol>
      </div>
      {t.status === "SUCCEEDED" && refundable > 0 && can(member.role, "refund") && (
        <div>
          <h3 className="h-sub">Issue a refund</h3>
          <ActionForm action={refundTransaction}>
            <input type="hidden" name="id" value={t.id} />
            <div className="row-2">
              <div className="field">
                <label htmlFor="r-amount">Amount (USD)</label>
                <input id="r-amount" name="amount" type="number" step="0.01" min="0.01" max={(refundable / 100).toFixed(2)} defaultValue={(refundable / 100).toFixed(2)} className="input" required />
                <span className="hint">Up to {money(refundable, t.currency)}</span>
              </div>
              <div className="field">
                <label htmlFor="r-reason">Reason</label>
                <select id="r-reason" name="reason" className="select">
                  <option value="Requested by customer">Requested by customer</option>
                  <option value="Duplicate">Duplicate</option>
                  <option value="Fraudulent">Fraudulent</option>
                </select>
              </div>
            </div>
            <SubmitButton className="btn btn-danger" pendingLabel="Refunding…">Refund payment</SubmitButton>
          </ActionForm>
        </div>
      )}
    </Drawer>
  );
}
