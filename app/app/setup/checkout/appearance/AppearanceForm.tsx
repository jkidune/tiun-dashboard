"use client";

import { useActionState, useState } from "react";
import type { CheckoutSettings } from "@/lib/settings";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { saveCheckoutAppearance } from "@/app/actions/setup";

const RADIUS = { rounded: 9, square: 2, pill: 999 } as const;
const SWATCHES = ["#6c4cff", "#1d8a4c", "#2f6fdc", "#c26a00", "#c43c2c", "#1c1b19"];

export function AppearanceForm({ initial, workspace, canEdit }: { initial: CheckoutSettings; workspace: string; canEdit: boolean }) {
  const [state, action] = useActionState(saveCheckoutAppearance, null);
  const [s, setS] = useState(initial);
  const set = <K extends keyof CheckoutSettings>(k: K, v: CheckoutSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const radius = RADIUS[s.buttonStyle];

  return (
    <form action={action} className="grid grid-main">
      <div className="stack" style={{ gap: 24 }}>
        <section className="card">
          <div className="card-head pb"><h2 className="card-title">Branding</h2></div>
          <div className="card-body">
            <div className="setting-row" style={{ flexWrap: "wrap" }}>
              <div className="text">
                <div className="title">Brand colour</div>
                <div className="desc">Used for buttons and highlights.</div>
              </div>
              <div className="row">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Use ${c}`}
                    onClick={() => set("brandColor", c)}
                    disabled={!canEdit}
                    style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: s.brandColor === c ? "2px solid var(--fg)" : "2px solid transparent", cursor: "pointer" }}
                  />
                ))}
                <input type="color" name="brandColor" value={s.brandColor} onChange={(e) => set("brandColor", e.target.value)} className="input" aria-label="Custom brand colour" disabled={!canEdit} />
              </div>
            </div>
            <div className="setting-row">
              <div className="text"><div className="title">Button style</div></div>
              <select name="buttonStyle" value={s.buttonStyle} onChange={(e) => set("buttonStyle", e.target.value as CheckoutSettings["buttonStyle"])} className="select" style={{ width: 150 }} aria-label="Button style" disabled={!canEdit}>
                <option value="rounded">Rounded</option>
                <option value="square">Square</option>
                <option value="pill">Pill</option>
              </select>
            </div>
            <div className="setting-row">
              <div className="text"><div className="title">Layout</div><div className="desc">Split shows the order summary beside the payment form.</div></div>
              <select name="layout" value={s.layout} onChange={(e) => set("layout", e.target.value as CheckoutSettings["layout"])} className="select" style={{ width: 150 }} aria-label="Layout" disabled={!canEdit}>
                <option value="single">Single column</option>
                <option value="split">Split</option>
              </select>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head pb"><h2 className="card-title">Checkout options</h2></div>
          <div className="card-body">
            {(
              [
                ["collectAddress", "Collect billing address", "Needed for some tax rules"],
                ["collectTaxId", "Collect tax ID", "Shows a TIN / VAT number field for businesses"],
                ["allowPromoCodes", "Allow promo codes", "Customers can enter coupons from the Plans page"],
              ] as const
            ).map(([k, title, desc]) => (
              <div className="setting-row" key={k}>
                <div className="text"><div className="title">{title}</div><div className="desc">{desc}</div></div>
                <input type="checkbox" className="toggle" name={k} checked={s[k]} onChange={(e) => set(k, e.target.checked)} aria-label={title} disabled={!canEdit} />
              </div>
            ))}
            <div className="row-2" style={{ marginTop: 16 }}>
              <div className="field">
                <label htmlFor="successUrl">Success URL</label>
                <input id="successUrl" name="successUrl" type="url" className="input" value={s.successUrl} onChange={(e) => set("successUrl", e.target.value)} placeholder="https://yourapp.com/welcome" disabled={!canEdit} />
              </div>
              <div className="field">
                <label htmlFor="cancelUrl">Cancel URL</label>
                <input id="cancelUrl" name="cancelUrl" type="url" className="input" value={s.cancelUrl} onChange={(e) => set("cancelUrl", e.target.value)} placeholder="https://yourapp.com/pricing" disabled={!canEdit} />
              </div>
            </div>
          </div>
        </section>
        <FormMessage state={state} />
        {canEdit && (
          <div className="row">
            <SubmitButton>Save changes</SubmitButton>
            <button type="button" className="btn" onClick={() => setS(initial)}>Reset</button>
          </div>
        )}
      </div>

      <section className="card" style={{ alignSelf: "start" }}>
        <div className="card-head"><div className="grow"><h2 className="card-title">Preview</h2><p className="card-sub">What customers see at checkout</p></div></div>
        <div className="card-body">
          <div className="preview-frame">
            <div className="preview-card" style={{ maxWidth: s.layout === "split" ? 360 : 320 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <b style={{ fontWeight: 600 }}>{workspace}</b>
                <span className="hint">Pro plan</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 500 }}>$49.00 <span className="hint">/ month</span></div>
              <div className="preview-input" style={{ borderRadius: radius === 999 ? 999 : radius }}>Email</div>
              <div className="preview-input" style={{ borderRadius: radius === 999 ? 999 : radius }}>Card or M-Pesa number</div>
              {s.collectAddress && <div className="preview-input" style={{ borderRadius: radius === 999 ? 999 : radius }}>Billing address</div>}
              {s.collectTaxId && <div className="preview-input" style={{ borderRadius: radius === 999 ? 999 : radius }}>Tax ID (optional)</div>}
              {s.allowPromoCodes && <span className="hint" style={{ color: s.brandColor }}>Add promo code</span>}
              <div className="preview-btn primary" style={{ background: s.brandColor, borderRadius: radius }}>Subscribe</div>
            </div>
          </div>
        </div>
      </section>
    </form>
  );
}
