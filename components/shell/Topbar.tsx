"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Calendar, ChevronDown, Menu, Search } from "lucide-react";
import { setMode, setMonth } from "@/app/actions/session";
import { useShell } from "./Shell";

export function Topbar({
  title,
  mode,
  month,
  months,
  alerts,
  showPeriod = true,
  children,
}: {
  title: string;
  mode: "LIVE" | "TEST";
  month: string;
  months: { key: string; label: string }[];
  alerts: number;
  showPeriod?: boolean;
  children?: React.ReactNode;
}) {
  const { openNav } = useShell();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const label = months.find((m) => m.key === month)?.label ?? month;

  return (
    <header className="topbar" aria-busy={pending}>
      <button className="btn btn-icon menu-btn" aria-label="Open navigation" onClick={openNav}>
        <Menu size={18} />
      </button>
      <h1>{title}</h1>

      <div className="segmented" role="radiogroup" aria-label="Environment">
        <button role="radio" aria-checked={mode === "LIVE"} className={mode === "LIVE" ? "on" : ""} onClick={() => start(() => setMode("live"))}>
          <span className="live-dot" /> Live
        </button>
        <button role="radio" aria-checked={mode === "TEST"} className={mode === "TEST" ? "on" : ""} onClick={() => start(() => setMode("test"))}>
          Sandbox
        </button>
      </div>

      {showPeriod && (
        <>
          <span className="divider" />
          <label className="btn month-select">
            <Calendar size={17} strokeWidth={1.7} />
            <span className="btn-label">{label}</span>
            <ChevronDown size={15} />
            <select aria-label="Reporting month" value={month} onChange={(e) => start(() => setMonth(e.target.value))}>
              {months.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </label>
        </>
      )}

      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) router.push(`/customers?q=${encodeURIComponent(query.trim())}`);
        }}
      >
        <Search size={17} strokeWidth={1.7} />
        <input id="global-search" placeholder="Search customers" value={query} onChange={(e) => setQuery(e.target.value)} />
      </form>

      <Link href="/#attention" className="btn btn-icon" aria-label={`Notifications: ${alerts} need attention`}>
        <Bell size={17} strokeWidth={1.7} />
        {alerts > 0 && <span className="badge-dot" />}
      </Link>
      {children}
    </header>
  );
}
