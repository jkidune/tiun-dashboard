import Link from "next/link";
import {
  AlertTriangle,
  CircleDollarSign,
  CreditCard,
  Download,
  Hourglass,
  KeyRound,
  Mail,
  Server,
  Undo2,
  UserMinus,
  UserPlus,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { getContext } from "@/lib/context";
import { change, fmt, money, relative } from "@/lib/format";
import { monthsEnding, revenueByMonth, sessionsPerDay, subscriberSeries } from "@/lib/metrics";
import { PageTopbar } from "@/components/shell/PageTopbar";
import { KpiStrip } from "@/components/ui/Kpi";
import { Banner, CardHead } from "@/components/ui/bits";
import { LineChart } from "@/components/ui/charts";
import { EmptyState, ProgressRing } from "@/components/ui/empty";
import { getSetup } from "@/lib/onboarding";
import { Activity as ActivityIcon, Check } from "lucide-react";

export const metadata = { title: "Home" };

const FEED: Record<string, { icon: LucideIcon; tone: string }> = {
  signup: { icon: UserPlus, tone: "good" },
  upgrade: { icon: CircleDollarSign, tone: "info" },
  payment: { icon: CircleDollarSign, tone: "good" },
  churn: { icon: UserMinus, tone: "warn" },
  refund: { icon: Undo2, tone: "warn" },
  payment_failed: { icon: AlertTriangle, tone: "bad" },
  api_key: { icon: KeyRound, tone: "info" },
  invite: { icon: Mail, tone: "info" },
};

export default async function HomePage() {
  const { workspace, member, mode, month } = await getContext();
  const ws = workspace.id;
  const months = monthsEnding(month.start, 12);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week = new Date(Date.now() - 7 * 86_400_000);

  const [setup, revenue, subs, daily, sessionsToday, failedCur, failedPrev, failedTx, expiringTrials, failingHooks, activity] = await Promise.all([
    getSetup(ws, mode),
    revenueByMonth(ws, mode, months[0].start),
    subscriberSeries(ws, mode, months.slice(-6)),
    sessionsPerDay(ws, mode, 7),
    db.usageSession.count({ where: { workspaceId: ws, mode, startedAt: { gte: today } } }),
    db.transaction.count({ where: { workspaceId: ws, mode, status: "FAILED", createdAt: { gte: month.start, lt: month.end } } }),
    db.transaction.count({ where: { workspaceId: ws, mode, status: "FAILED", createdAt: { gte: month.prevStart, lt: month.start } } }),
    db.transaction.findMany({ where: { workspaceId: ws, mode, status: "FAILED", createdAt: { gte: week } }, include: { customer: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.customer.findMany({ where: { workspaceId: ws, mode, status: "TRIAL", createdAt: { lte: new Date(Date.now() - 10 * 86_400_000) } }, orderBy: { createdAt: "asc" }, take: 3 }),
    db.webhook.findMany({ where: { workspaceId: ws, status: "FAILING" } }),
    db.activity.findMany({ where: { workspaceId: ws, mode }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const revValues = months.map((m) => revenue.get(m.key) ?? 0);
  const revCur = revValues[revValues.length - 1];
  const revPrev = revValues[revValues.length - 2];
  const revChange = change(revCur, revPrev);
  const subCur = subs[subs.length - 1];
  const subPrev = subs[subs.length - 2];
  const prevName = months[months.length - 2].start.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const attention = failedTx.length + expiringTrials.length + failingHooks.length;

  return (
    <>
      <PageTopbar title="Home">
        <a className="btn" href="/api/export/transactions">
          <Download size={17} strokeWidth={1.7} />
          <span className="btn-label">Export</span>
        </a>
      </PageTopbar>

      <div className="content">
        <Banner
          src="/banners/dairy.png"
          title={setup.hasPayments ? `${greeting}, ${member.name.split(" ")[0]}` : `Welcome to tiun., ${member.name.split(" ")[0]}`}
          text={
            setup.hasPayments
              ? `${month.label}: revenue is ${revChange.pct === "—" ? "flat" : `${revChange.dir} ${revChange.pct}`} on ${prevName}, and ${attention ? `${attention} item${attention === 1 ? " needs" : "s need"} your attention` : "nothing needs your attention"}.`
              : `${workspace.name} is ready. Work through the steps below and your numbers will start to fill in here.`
          }
        />

        {!setup.complete && (
          <section className="card">
            <CardHead title="Get set up" sub={`${setup.done} of ${setup.steps.length} done`} divider />
            <div className="card-body onboard">
              <ProgressRing value={(setup.done / setup.steps.length) * 100} size={88} tone="accent" label={`${setup.done}/${setup.steps.length}`} />
              <ol className="steps">
                {setup.steps.map((s) => (
                  <li key={s.key} className={s.done ? "done" : ""}>
                    <Link href={s.href}>
                      <span className="check-dot" style={s.done ? { background: "var(--green)", borderColor: "var(--green)", color: "#fff" } : undefined}>
                        <Check size={13} strokeWidth={3} />
                      </span>
                      <span>
                        <b>{s.title}</b>
                        <small>{s.done ? "Done" : s.desc}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        <KpiStrip
          label="Business summary"
          items={[
            { label: "Revenue", icon: CircleDollarSign, value: money(revCur, workspace.currency), sub: `${money(revPrev, workspace.currency)} in ${prevName}`, trend: revChange, bars: revValues.slice(-6) },
            { label: "Active subscribers", icon: Users, value: fmt(subCur.active), sub: `${fmt(subPrev.active)} in ${prevName}`, trend: change(subCur.active, subPrev.active), bars: subs.map((s) => s.active) },
            { label: "Sessions today", icon: Server, value: fmt(sessionsToday), sub: `${fmt(daily[daily.length - 2]?.value ?? 0)} yesterday`, trend: change(sessionsToday, daily[daily.length - 2]?.value ?? 0), bars: daily.map((d) => d.value) },
            { label: "Failed payments", icon: CreditCard, value: fmt(failedCur), sub: `${fmt(failedPrev)} in ${prevName}`, trend: { ...change(failedCur, failedPrev), good: failedCur <= failedPrev }, muted: true },
          ]}
        />

        <div className="grid grid-main">
          <section className="card">
            <CardHead title="Revenue" sub={`Net collected revenue, last 12 months to ${month.label}`} />
            <div className="card-body">
              <LineChart
                title="Monthly revenue"
                labels={months.map((m) => m.label)}
                values={revValues}
                fmt={(n) => money(n, workspace.currency, true)}
                empty="Your revenue trend appears here after the first successful payment."
              />
            </div>
          </section>

          <section className="card" id="attention">
            <CardHead title="Needs attention" count={String(attention)} />
            <div className="card-body">
              {attention === 0 ? (
                <p className="muted">All clear. Failed payments, expiring trials and webhook errors show up here.</p>
              ) : (
                <ul className="feed">
                  {failedTx.map((t) => (
                    <li key={t.id}>
                      <span className="feed-icon bad"><AlertTriangle size={15} /></span>
                      <div className="text">
                        <Link href={`/transactions?id=${t.id}`}>{money(t.amountCents, t.currency)} payment failed</Link>
                        <small>{t.customer.name} · {t.methodBrand} ••{t.methodLast4}</small>
                      </div>
                      <span className="when">{relative(t.createdAt)}</span>
                    </li>
                  ))}
                  {expiringTrials.map((c) => {
                    const daysLeft = Math.max(0, 14 - Math.floor((Date.now() - c.createdAt.getTime()) / 86_400_000));
                    return (
                      <li key={c.id}>
                        <span className="feed-icon warn"><Hourglass size={15} /></span>
                        <div className="text">
                          <Link href={`/customers?id=${c.id}`}>{c.name}’s trial ends {daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}</Link>
                          <small>{c.email}</small>
                        </div>
                      </li>
                    );
                  })}
                  {failingHooks.map((w) => (
                    <li key={w.id}>
                      <span className="feed-icon bad"><Webhook size={15} /></span>
                      <div className="text">
                        <Link href="/setup/integration">Webhook deliveries failing</Link>
                        <small style={{ overflowWrap: "anywhere" }}>{w.url}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <div className="grid grid-main">
          <section className="card">
            <CardHead title="Recent activity" />
            <div className="card-body">
              {activity.length === 0 ? (
                <EmptyState
                  compact
                  icon={ActivityIcon}
                  title="No activity yet"
                  text="New customers, payments, refunds and team changes will show up here as they happen."
                />
              ) : (
                <ul className="feed">
                  {activity.map((a) => {
                    const f = FEED[a.type] ?? FEED.upgrade;
                    return (
                      <li key={a.id}>
                        <span className={`feed-icon ${f.tone}`}><f.icon size={15} /></span>
                        <div className="text">{a.message}</div>
                        <span className="when">{relative(a.createdAt)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="card">
            <CardHead title="Quick actions" />
            <div className="card-body">
              <div className="quick">
                <Link href="/customers"><UserPlus size={18} /> Add user</Link>
                <Link href="/setup/checkout"><CreditCard size={18} /> Create plan</Link>
                <Link href="/apis"><KeyRound size={18} /> Create API key</Link>
                <Link href="/settings/users"><Mail size={18} /> Invite teammate</Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
