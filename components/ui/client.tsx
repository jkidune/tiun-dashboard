"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Copy, Search, X } from "lucide-react";
import type { ActionState } from "@/lib/action";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function SubmitButton({ children, className = "btn btn-primary", pendingLabel }: { children: React.ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel ?? "Saving…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state?.error) return <div className="form-msg err" role="alert">{state.error}</div>;
  if (state?.ok && state.message) return <div className="form-msg ok" role="status">{state.message}</div>;
  return null;
}

/** A form bound to a server action, showing its success or error message underneath. */
export function ActionForm({
  action,
  children,
  className = "form",
  resetOnSuccess,
  onSuccess,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (s: ActionState) => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
    </form>
  );
}

/** Modal frame: coloured icon tile, title + subtitle, grey close button. */
export function ModalShell({
  title,
  subtitle,
  icon,
  tone = "violet",
  onClose,
  width,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "violet" | "amber" | "blue" | "green" | "red";
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        <div className="mhead">
          {icon && <span className={`micon ${tone}`}>{icon}</span>}
          <div className="grow">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="mclose" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Button that opens a modal holding a form. On success it closes, or shows a
 * one-time secret / a list of links returned by the action.
 */
export function ModalForm({
  trigger,
  triggerClass = "btn btn-primary",
  title,
  subtitle,
  icon,
  tone,
  action,
  submitLabel,
  danger,
  footerNote,
  width,
  children,
}: {
  trigger: React.ReactNode;
  triggerClass?: string;
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "violet" | "amber" | "blue" | "green" | "red";
  action: Action;
  submitLabel: string;
  danger?: boolean;
  footerNote?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionState>(null);
  const [key, setKey] = useState(0);

  const close = () => {
    setOpen(false);
    setResult(null);
    setKey((k) => k + 1); // fresh form next time
  };

  return (
    <>
      <button type="button" className={triggerClass} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      {open && (
        <ModalShell title={title} subtitle={subtitle} icon={icon} tone={tone} onClose={close} width={width}>
          {result?.secret || result?.links ? (
            <>
              <div className="mbody">
                {result.secret && (
                  <>
                    <div className="secret-box">Copy this key now. For your security it won’t be shown again.</div>
                    <CopyField value={result.secret} />
                  </>
                )}
                {result.links && (
                  <>
                    {result.message && <div className="form-msg ok">{result.message}</div>}
                    {result.links.map((l) => (
                      <div className="field" key={l.url}>
                        <span className="label">{l.label}</span>
                        <CopyField value={l.url} />
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="mfoot">
                <span className="note" />
                <button type="button" className="btn btn-ink btn-lg" onClick={close}>Done</button>
              </div>
            </>
          ) : (
            <ActionForm
              key={key}
              action={action}
              className=""
              onSuccess={(s) => (s?.secret || s?.links ? setResult(s) : close())}
            >
              <div className="mbody">{children}</div>
              <div className="mfoot">
                <span className="note">{footerNote}</span>
                <button type="button" className="btn btn-soft btn-lg" onClick={close}>Cancel</button>
                <SubmitButton className={danger ? "btn btn-danger btn-lg" : "btn btn-ink btn-lg"}>{submitLabel}</SubmitButton>
              </div>
            </ActionForm>
          )}
        </ModalShell>
      )}
    </>
  );
}

/** Toolbar filter: a button-looking native select that writes ?param= to the URL. */
export function FilterSelect({
  param,
  label,
  options,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(param) ?? "";
  const current = options.find((o) => o.value === value);
  return (
    <label className={`filter${current ? " on" : ""}`}>
      {current ? current.label : label}
      <ChevronDown size={14} />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set(param, e.target.value);
          else next.delete(param);
          next.delete("page");
          router.replace(`${pathname}?${next.toString()}`, { scroll: false });
        }}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** A one-button form for row actions (revoke, remove…). Optional two-step confirm. */
export function ActionButton({
  action,
  fields,
  children,
  className = "btn btn-sm",
  confirmLabel,
}: {
  action: Action;
  fields: Record<string, string>;
  children: React.ReactNode;
  className?: string;
  confirmLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmLabel && !armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
      style={{ display: "inline-flex" }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        className={armed ? "btn btn-sm btn-danger" : className}
        disabled={pending}
        title={state?.error ?? undefined}
      >
        {armed ? confirmLabel : children}
      </button>
      {state?.error && <span className="sr-only" role="alert">{state.error}</span>}
    </form>
  );
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={label ? "btn btn-sm" : "icon-btn"}
      aria-label={label ?? "Copy"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable: the value stays selectable */
        }
      }}
    >
      {done ? <Check size={15} /> : <Copy size={15} />}
      {label && (done ? "Copied" : label)}
    </button>
  );
}

export function CopyField({ value, display }: { value: string; display?: string }) {
  return (
    <div className="copy-field">
      <code title={display ?? value}>{display ?? value}</code>
      <CopyButton value={value} />
    </div>
  );
}

/** Search box that writes ?q= to the URL (debounced) so the server re-queries. */
export function SearchBox({ placeholder, param = "q", className = "search soft", id }: { placeholder: string; param?: string; className?: string; id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(param) ?? "");
  const [, start] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set(param, value.trim());
      else next.delete(param);
      next.delete("page");
      start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <label className={className}>
      <Search size={17} strokeWidth={1.7} />
      <input id={id} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
    </label>
  );
}

/** Light / Dark / System, stored per browser. */
export function ThemePicker() {
  const [theme, setTheme] = useState("system");
  useEffect(() => {
    try {
      setTheme(localStorage.getItem("tiun-theme") ?? "system");
    } catch {}
  }, []);
  const apply = (t: string) => {
    setTheme(t);
    try {
      if (t === "system") {
        localStorage.removeItem("tiun-theme");
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem("tiun-theme", t);
        document.documentElement.dataset.theme = t;
      }
    } catch {}
  };
  return (
    <div className="segmented" role="radiogroup" aria-label="Theme">
      {["light", "dark", "system"].map((t) => (
        <button key={t} type="button" role="radio" aria-checked={theme === t} className={theme === t ? "on" : ""} onClick={() => apply(t)}>
          {t[0].toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );
}

/** Shows a sticky save bar once any field inside changes. */
export function DirtyForm({ action, children }: { action: Action; children: React.ReactNode }) {
  const [state, formAction] = useActionState(action, null);
  const [dirty, setDirty] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);
  return (
    <form ref={ref} action={formAction} className="stack" onChange={() => setDirty(true)}>
      {children}
      <FormMessage state={state} />
      {dirty && (
        <div className="save-bar">
          <span>You have unsaved changes</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              ref.current?.reset();
              setDirty(false);
            }}
          >
            Discard
          </button>
          <SubmitButton className="btn btn-sm btn-primary">Save changes</SubmitButton>
        </div>
      )}
    </form>
  );
}
