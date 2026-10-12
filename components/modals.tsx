import { Banknote, Plus, ShieldCheck, UserPlus } from "lucide-react";
import { ModalForm } from "@/components/ui/client";
import { createCustomer } from "@/app/actions/customers";
import { recordPayment } from "@/app/actions/transactions";

export function AddCustomerModal({
  plans,
  triggerClass = "btn btn-primary",
  label = "Add user",
}: {
  plans: { id: string; name: string }[];
  triggerClass?: string;
  label?: string;
}) {
  return (
    <ModalForm
      trigger={<><Plus size={17} /><span className="btn-label">{label}</span></>}
      triggerClass={triggerClass}
      title="Add customer"
      subtitle="They’ll appear under User Management right away"
      icon={<UserPlus size={20} />}
      tone="blue"
      action={createCustomer}
      submitLabel="Add customer"
    >
      <div className="field">
        <label htmlFor="c-name">Full name</label>
        <input id="c-name" name="name" className="input" placeholder="Asha Mushi" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="c-email">Email</label>
        <input id="c-email" name="email" type="email" className="input" placeholder="asha@example.com" required />
      </div>
      <div className="row-2">
        <div className="field">
          <label htmlFor="c-plan">Plan</label>
          <select id="c-plan" name="planId" className="select">
            {plans.length === 0 && <option value="">No plan yet</option>}
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {plans.length === 0 && <span className="hint">Create plans under Checkout.</span>}
        </div>
        <div className="field">
          <label htmlFor="c-status">Start as</label>
          <select id="c-status" name="status" className="select">
            <option value="SUBSCRIBED">Subscribed</option>
            <option value="TRIAL">Trial</option>
          </select>
        </div>
      </div>
    </ModalForm>
  );
}

export function RecordPaymentModal({
  customer,
  context,
  suggested,
}: {
  customer: { id: string; name: string; avatarColor: string };
  context: string;
  suggested?: string;
}) {
  return (
    <ModalForm
      trigger={<><Banknote size={16} /> Record payment</>}
      triggerClass="btn"
      title="Record payment"
      subtitle="For M-Pesa, cash or bank transfers received outside tiun."
      icon={<Banknote size={20} />}
      tone="amber"
      action={recordPayment}
      submitLabel="Record payment"
      footerNote={<><ShieldCheck size={16} /> No card is charged</>}
    >
      <input type="hidden" name="customerId" value={customer.id} />
      <div className="amount-block">
        <label htmlFor="pay-amount" className="label">Amount received (USD)</label>
        <input id="pay-amount" name="amount" type="number" step="0.01" min="0.01" inputMode="decimal" className="amount-input" placeholder="0.00" defaultValue={suggested} required />
        <span className="ctx-chip">
          <span className="dot" style={{ background: customer.avatarColor }} />
          {customer.name} · {context}
        </span>
      </div>
      <div className="seg-big" role="radiogroup" aria-label="Payment method">
        <label><input type="radio" name="method" value="MPESA" defaultChecked /> M-Pesa</label>
        <label><input type="radio" name="method" value="CASH" /> Cash</label>
        <label><input type="radio" name="method" value="BANK" /> Bank transfer</label>
      </div>
      <div className="field">
        <label htmlFor="pay-ref" className="sr-only">Reference</label>
        <div className="soft-input">
          <input id="pay-ref" name="reference" placeholder="Transaction reference, e.g. QJK4H7TZ2P" autoComplete="off" />
        </div>
        <span className="hint">Needed for M-Pesa and bank transfers so you can reconcile later.</span>
      </div>
      <div className="field">
        <label htmlFor="pay-note">Note (optional)</label>
        <input id="pay-note" name="note" className="input" placeholder="e.g. October subscription" />
      </div>
    </ModalForm>
  );
}
