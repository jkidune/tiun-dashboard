"use client";

import { useState } from "react";
import { X } from "lucide-react";

const ROLES = [
  { value: "ADMIN", title: "Admin", desc: "Customers, refunds, plans, settings and the team" },
  { value: "DEVELOPER", title: "Developer", desc: "API keys, webhooks and sign-in setup" },
  { value: "VIEWER", title: "Viewer", desc: "Read-only access to dashboards and data" },
];

const valid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** Invite form body: email chips with Add, role radio cards, seat summary. */
export function InviteFields({ members, seats }: { members: { initials: string }[]; seats: number }) {
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const parts = draft.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return;
    const bad = parts.find((p) => !valid(p));
    if (bad) return setError(`${bad} isn’t a valid email address.`);
    setEmails((prev) => [...new Set([...prev, ...parts])]);
    setDraft("");
    setError(null);
  };

  const all = [...emails, ...(valid(draft.trim()) ? [draft.trim().toLowerCase()] : [])];
  const left = Math.max(0, seats - members.length);

  return (
    <>
      <input type="hidden" name="emails" value={all.join(",")} />
      <div className="field">
        <label htmlFor="inv-email">Email</label>
        <div className="soft-input">
          <input
            id="inv-email"
            type="email"
            placeholder="name@company.com"
            value={draft}
            autoFocus
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add();
              }
            }}
          />
          <button type="button" className="btn btn-sm" onClick={add}>Add</button>
        </div>
        {error && <span className="hint" style={{ color: "var(--red)" }} role="alert">{error}</span>}
        {emails.length > 0 && (
          <div className="chips" aria-label="People to invite">
            {emails.map((e) => (
              <span className="chip" key={e}>
                {e}
                <button type="button" aria-label={`Remove ${e}`} onClick={() => setEmails((p) => p.filter((x) => x !== e))}><X size={13} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>Role</legend>
        <div className="radio-cards">
          {ROLES.map((r) => (
            <label className="radio-card" key={r.value}>
              <span className="grow">
                <b>{r.title}</b>
                <small>{r.desc}</small>
              </span>
              <input type="radio" name="role" value={r.value} defaultChecked={r.value === "DEVELOPER"} />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="seat-line">
        <span className="avatar-stack" aria-hidden>
          {members.slice(0, 3).map((m, i) => (
            <span key={i} className="avatar avatar-sm" style={{ background: ["#d9d3cb", "#cfd6e2", "#d6d0c4"][i], color: "#3a3834" }}>{m.initials}</span>
          ))}
        </span>
        {members.length} {members.length === 1 ? "person" : "people"} already here · {left} seat{left === 1 ? "" : "s"} left on your plan
      </div>
    </>
  );
}
