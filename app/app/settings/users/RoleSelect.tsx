"use client";

import { useActionState, useRef } from "react";
import { changeRole } from "@/app/actions/account";

/** Inline role picker that saves as soon as it changes. */
export function RoleSelect({ id, role, name }: { id: string; role: string; name: string }) {
  const [state, action, pending] = useActionState(changeRole, null);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <input type="hidden" name="id" value={id} />
      <select
        name="role"
        defaultValue={role}
        className="select"
        style={{ width: 140, height: 34 }}
        aria-label={`Role for ${name}`}
        disabled={pending}
        onChange={() => form.current?.requestSubmit()}
      >
        <option value="ADMIN">Admin</option>
        <option value="DEVELOPER">Developer</option>
        <option value="VIEWER">Viewer</option>
      </select>
      {state?.error && <span className="hint" style={{ color: "var(--red)" }} role="alert">{state.error}</span>}
    </form>
  );
}
