import Link from "next/link";
import { CreditCard, Plus, Ticket } from "lucide-react";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { getContext } from "@/lib/context";
import { fmt, money, relative, shortDate } from "@/lib/format";
import { PageTopbar } from "@/components/shell/PageTopbar";
import { CardHead } from "@/components/ui/bits";
import { ActionButton, ModalForm } from "@/components/ui/client";
import { EmptyRow, EmptyState, ProgressRing } from "@/components/ui/empty";
import { createCoupon, createPlan, deleteCoupon, setPlanActive } from "@/app/actions/setup";

export const metadata = { title: "Checkout" };

function CreatePlanModal({ currency, triggerClass = "btn btn-primary" }: { currency: string; triggerClass?: string }) {
  return (
    <ModalForm
      trigger={<><Plus size={17} /><span className="btn-label">Create plan</span></>}
      triggerClass={triggerClass}
      title="Create plan"
      subtitle="Customers pick from your active plans at checkout"
      icon={<CreditCard size={20} />}
      tone="violet"
      action={createPlan}
      submitLabel="Create plan"
    >
      <div className="field">
        <label htmlFor="p-name">Plan name</label>
        <input id="p-name" name="name" className="input" placeholder="e.g. Growth" required autoFocus />
      </div>
      <div className="row-2">
        <div className="field">
          <label htmlFor="p-model">Pricing model</label>
          <select id="p-model" name="model" className="select">
            <option value="MONTHLY">Monthly subscription</option>
            <option value="PER_USE">Per use (metered)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="p-price">Price ({currency})</label>
          <input id="p-price" name="price" type="number" min="0" step="0.01" className="input" placeholder="19.00" required />
          <span className="hint">Per month, or per unit for metered plans</span>
        </div>
      </div>
      <div className="field">
        <label htmlFor="p-trial">Free trial (days)</label>
        <input id="p-trial" name="trialDays" type="number" min="0" max="90" defaultValue={14} className="input" style={{ width: 120 }} />
      </div>
    </ModalForm>
  );
}

export default async function CheckoutPage() {
  const { workspace, mode, member } = await getContext();
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [plans, byStatus, usageRevenue, coupons] = await Promise.all([
    db.plan.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ active: "desc" }, { priceCents: "asc" }] }),
    db.customer.groupBy({ by: ["planId", "status"], where: { workspaceId: workspace.id, mode }, _count: true }),
    db.transaction.findMany({
      where: { workspaceId: workspace.id, mode, status: "SUCCEEDED", createdAt: { gte: since30 } },
      select: { amountCents: true, customer: { select: { planId: true } } },
    }),
    db.coupon.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const edit = can(member.role, "checkout");
  const now = new Date();

  const count = (planId: string, status?: string) =>
    byStatus.filter((r) => r.planId === planId && (!status || r.status === status)).reduce((n, r) => n + r._count, 0);
  const revenue30 = (planId: string) => usageRevenue.filter((t) => t.customer.planId === planId).reduce((n, t) => n + t.amountCents, 0);

  return (
    <>
      <PageTopbar title="Checkout" showPeriod={false}>
        <Link href="/setup/checkout/appearance" className="btn">Appearance</Link>
        {edit && plans.length > 0 && <CreatePlanModal currency={workspace.currency} />}
      </PageTopbar>
      <div className="content">
        {plans.length === 0 ? (
          <section className="card">
            <EmptyState
              icon={CreditCard}
              title="Create your first plan"
              text="Plans set what customers pay: a monthly subscription, or a price per unit of usage. You can add as many as you need and archive old ones later."
            >
              {edit ? <CreatePlanModal currency={workspace.currency} triggerClass="btn btn-ink" /> : <span className="hint">Ask an admin to create plans.</span>}
            </EmptyState>
          </section>
        ) : (
          <div className="card-grid">
            {plans.map((p) => {
              const ever = count(p.id);
              const churned = count(p.id, "CHURNED");
              const subscribed = count(p.id, "SUBSCRIBED");
              const trials = count(p.id, "TRIAL");
              const retention = ever ? Math.round(((ever - churned) / ever) * 100) : 0;
              const mrr = p.model === "MONTHLY" ? subscribed * p.priceCents : revenue30(p.id);
              return (
                <article className="pcard" key={p.id}>
                  <div className="pcard-head">
                    <span className="ltile">{p.name.slice(0, 2).toUpperCase()}</span>
                    <div className="grow">
                      <h3>{p.name}</h3>
                      <span className={`status-line ${p.active ? "good" : "idle"}`}>{p.active ? "Active" : "Archived"}</span>
                    </div>
                    {ever > 0 ? (
                      <ProgressRing value={retention} tone={retention >= 80 ? "good" : "warn"} label={String(retention)} />
                    ) : (
                      <ProgressRing value={0} label="—" />
                    )}
                  </div>
                  <div className="pcard-strip">
                    <code>PLN-{p.id.slice(-4).toUpperCase()}</code>
                    <span>{p.model === "PER_USE" ? `${money(p.priceCents, p.currency)} per unit` : `${money(p.priceCents, p.currency)} / month`}</span>
                    <span className="right">{ever ? `${retention}% retained` : "no customers yet"}</span>
                  </div>
                  <div className="stat-row">
                    <div><small>Customers</small><b>{fmt(subscribed)}</b></div>
                    <div><small>Trials</small><b>{fmt(trials)}</b></div>
                    <div><small>{p.model === "MONTHLY" ? "MRR" : "Rev 30d"}</small><b>{money(mrr, p.currency)}</b></div>
                  </div>
                  <div className="mono-tags">
                    <span>{p.model === "MONTHLY" ? "monthly" : "metered"}</span>
                    <span>{p.trialDays ? `${p.trialDays}d trial` : "no trial"}</span>
                  </div>
                  <div className="pcard-foot">
                    <span className="note">Created {relative(p.createdAt)}</span>
                    {edit && (
                      <ActionButton action={setPlanActive} fields={{ id: p.id, active: String(!p.active) }} className="btn" confirmLabel={p.active ? "Confirm archive" : undefined}>
                        {p.active ? "Archive" : "Restore"}
                      </ActionButton>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <section className="card">
          <CardHead title="Coupons" sub="Discount codes customers enter at checkout">
            {edit && coupons.length > 0 && <CreateCouponModal />}
          </CardHead>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "auto", paddingLeft: 24 }}>Code</th>
                  <th>Discount</th>
                  <th>Redemptions</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {coupons.length === 0 && (
                  <EmptyRow colSpan={6} icon={Ticket} title="No coupons yet" text="Create a code like LAUNCH20 to give new customers a percentage off.">
                    {edit && <CreateCouponModal triggerClass="btn btn-ink" />}
                  </EmptyRow>
                )}
                {coupons.map((c) => {
                  const expired = (c.expiresAt && c.expiresAt < now) || (c.maxRedemptions !== null && c.redemptions >= c.maxRedemptions);
                  return (
                    <tr key={c.id} className="row">
                      <td style={{ width: "auto", paddingLeft: 24 }}><code>{c.code}</code></td>
                      <td>{c.percentOff}% off</td>
                      <td>{fmt(c.redemptions)}{c.maxRedemptions ? ` / ${fmt(c.maxRedemptions)}` : ""}</td>
                      <td>{c.expiresAt ? shortDate(c.expiresAt) : "Never"}</td>
                      <td><span className={`pill ${expired ? "expired" : "active"}`}>{expired ? "Expired" : "Active"}</span></td>
                      <td style={{ width: 120 }}>
                        {edit && (
                          <div className="row-actions">
                            <ActionButton action={deleteCoupon} fields={{ id: c.id }} confirmLabel="Confirm delete">Delete</ActionButton>
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
      </div>
    </>
  );
}

function CreateCouponModal({ triggerClass = "btn" }: { triggerClass?: string }) {
  return (
    <ModalForm
      trigger={<><Plus size={15} /> New coupon</>}
      triggerClass={triggerClass}
      title="Create coupon"
      subtitle="Percentage off the customer’s first payment"
      icon={<Ticket size={20} />}
      tone="amber"
      action={createCoupon}
      submitLabel="Create coupon"
    >
      <div className="row-2">
        <div className="field">
          <label htmlFor="cp-code">Code</label>
          <input id="cp-code" name="code" className="input" placeholder="WELCOME10" required autoFocus style={{ textTransform: "uppercase" }} />
        </div>
        <div className="field">
          <label htmlFor="cp-pct">Discount (%)</label>
          <input id="cp-pct" name="percentOff" type="number" min="1" max="100" className="input" required />
        </div>
      </div>
      <div className="row-2">
        <div className="field">
          <label htmlFor="cp-max">Max redemptions</label>
          <input id="cp-max" name="maxRedemptions" type="number" min="1" className="input" placeholder="Unlimited" />
        </div>
        <div className="field">
          <label htmlFor="cp-exp">Expires on</label>
          <input id="cp-exp" name="expiresAt" type="date" className="input" />
        </div>
      </div>
    </ModalForm>
  );
}
