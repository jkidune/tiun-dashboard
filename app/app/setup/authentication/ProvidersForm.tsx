"use client";

import { useActionState, useState } from "react";
import { PROVIDERS, type AuthSettings, type ProviderKey } from "@/lib/settings";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { saveAuthProviders } from "@/app/actions/setup";

export function ProvidersForm({ initial, workspace, canEdit }: { initial: AuthSettings; workspace: string; canEdit: boolean }) {
  const [state, action] = useActionState(saveAuthProviders, null);
  const [on, setOn] = useState(initial.providers);
  const [dirty, setDirty] = useState(false);
  const social = PROVIDERS.filter((p) => p.needsClient && on[p.key]);

  const flip = (k: ProviderKey) => {
    setOn((o) => ({ ...o, [k]: !o[k] }));
    setDirty(true);
  };

  return (
    <form action={action} className="grid grid-main" onChange={() => setDirty(true)} onSubmit={() => setDirty(false)}>
      <section className="card">
        <div className="card-head">
          <div className="grow">
            <h2 className="card-title">Sign-in methods</h2>
            <p className="card-sub">Choose how your customers sign in to your app.</p>
          </div>
        </div>
        <div className="card-body stack">
          <div className="tile-grid">
            {PROVIDERS.map((p) => (
              <div className="tile" key={p.key}>
                <div className="tile-head">
                  <span className="tile-logo" style={{ background: p.color }}>{p.name[0]}</span>
                  <div className="grow">
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    <div className="desc">{p.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle"
                    name={`p_${p.key}`}
                    checked={on[p.key]}
                    onChange={() => flip(p.key)}
                    disabled={!canEdit}
                    aria-label={`Enable ${p.name}`}
                  />
                </div>
                {p.needsClient && (
                  <div className="field">
                    <label htmlFor={`c_${p.key}`} className="hint">Client ID</label>
                    <input
                      id={`c_${p.key}`}
                      name={`c_${p.key}`}
                      className="input"
                      defaultValue={initial.providerConfig[p.key]?.clientId ?? ""}
                      placeholder={p.key === "saml" ? "https://idp.example.com/metadata" : "Paste from the provider console"}
                      disabled={!canEdit}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <FormMessage state={state} />
          {canEdit && dirty && (
            <div className="save-bar">
              <span>You have unsaved changes</span>
              <button type="button" className="btn btn-sm" onClick={() => { setOn(initial.providers); setDirty(false); }}>Discard</button>
              <SubmitButton className="btn btn-sm btn-primary">Save changes</SubmitButton>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div className="grow">
            <h2 className="card-title">Preview</h2>
            <p className="card-sub">Updates as you switch methods on or off.</p>
          </div>
        </div>
        <div className="card-body">
          <div className="preview-frame">
            <div className="preview-card" aria-label="Sign-in screen preview">
              <h3>Sign in to {workspace}</h3>
              {social.map((p) => (
                <div key={p.key} className="preview-btn">Continue with {p.name}</div>
              ))}
              {social.length > 0 && (on.email || on.magicLink) && <div className="preview-or">or</div>}
              {(on.email || on.magicLink) && <div className="preview-input">you@example.com</div>}
              {on.email && <div className="preview-input">Password</div>}
              {(on.email || on.magicLink) && (
                <div className="preview-btn primary" style={{ background: "#6c4cff" }}>
                  {on.email ? "Sign in" : "Email me a link"}
                </div>
              )}
              {!Object.values(on).some(Boolean) && <p className="hint">No sign-in methods are on.</p>}
            </div>
          </div>
        </div>
      </section>
    </form>
  );
}
