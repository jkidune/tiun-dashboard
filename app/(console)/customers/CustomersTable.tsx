"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Ellipsis } from "lucide-react";
import { bulkCustomers } from "@/app/actions/customers";

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  plan: string;
  sessions: number;
  spend: string;
  last: string;
  group: string;
  color: string;
  initials: string;
  avatarUrl: string | null;
  href: string;
};

export function CustomersTable({ rows, canManage, empty }: { rows: CustomerRow[]; canManage: boolean; empty: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const head = useRef<HTMLInputElement>(null);

  // Drop selections that are no longer on the page (after filtering or paging).
  useEffect(() => {
    setSelected((prev) => new Set([...prev].filter((id) => rows.some((r) => r.id === id))));
  }, [rows]);

  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const some = rows.some((r) => selected.has(r.id));
  useEffect(() => {
    if (head.current) head.current.indeterminate = some && !all;
  }, [some, all]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulk = (op: "pause" | "resume" | "delete") =>
    start(async () => {
      const res = await bulkCustomers([...selected], op);
      setMessage(res?.error ?? res?.message ?? null);
      if (res?.ok) setSelected(new Set());
    });

  const groups = rows.reduce<{ name: string; items: CustomerRow[] }[]>((acc, r) => {
    const g = acc.find((x) => x.name === r.group);
    if (g) g.items.push(r);
    else acc.push({ name: r.group, items: [r] });
    return acc;
  }, []);

  return (
    <>
      {(selected.size > 0 || message) && (
        <div className="bulk-bar" role="status">
          <span>{selected.size > 0 ? `${selected.size} selected` : message}</span>
          {selected.size > 0 && canManage && (
            <>
              <button className="btn btn-sm" disabled={pending} onClick={() => bulk("pause")}>Pause</button>
              <button className="btn btn-sm" disabled={pending} onClick={() => bulk("resume")}>Resume</button>
              <button className="btn btn-sm btn-danger" disabled={pending} onClick={() => bulk("delete")}>Delete</button>
            </>
          )}
          {selected.size > 0 && <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>}
          {selected.size === 0 && <button className="btn btn-sm btn-ghost" onClick={() => setMessage(null)}>Dismiss</button>}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  ref={head}
                  type="checkbox"
                  className="checkbox"
                  aria-label="Select all on this page"
                  checked={all}
                  onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
                />
              </th>
              <th>Customer</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Sessions 30d</th>
              <th>Spend 30d</th>
              <th>Last activity</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && empty}
            {groups.map((g) => (
              <Fragment key={g.name}>
                <tr className="group">
                  <td colSpan={8}>
                    {g.name}
                    <small>{g.items.length}</small>
                  </td>
                </tr>
                {g.items.map((c) => (
                  <tr key={c.id} className={`row${selected.has(c.id) ? " selected" : ""}`}>
                    <td>
                      <input type="checkbox" className="checkbox" aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                    </td>
                    <td>
                      <Link href={c.href} className="cust row-link" scroll={false}>
                        <span className="avatar" style={{ background: c.color }}>
                          {c.avatarUrl ? <Image src={c.avatarUrl} alt="" fill sizes="42px" /> : c.initials}
                        </span>
                        <div>
                          <div className="cust-name">{c.name}</div>
                          <div className="cust-email">{c.email}</div>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <span className={`pill ${c.status.toLowerCase()}`}>{c.status[0] + c.status.slice(1).toLowerCase()}</span>
                    </td>
                    <td>{c.plan}</td>
                    <td>{c.sessions}</td>
                    <td>{c.spend}</td>
                    <td>{c.last}</td>
                    <td>
                      <Link href={c.href} className="icon-btn" style={{ marginLeft: "auto", width: "fit-content" }} aria-label={`Open ${c.name}`} scroll={false}>
                        <Ellipsis size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
