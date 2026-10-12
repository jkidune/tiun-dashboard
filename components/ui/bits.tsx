import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { initials, titleCase } from "@/lib/format";

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${status.toLowerCase()}`}>{titleCase(status)}</span>;
}

export function Avatar({
  name,
  src,
  color = "#5b5650",
  size = "md",
}: {
  name: string;
  src?: string | null;
  color?: string;
  size?: "sm" | "md" | "xl";
}) {
  const px = size === "sm" ? 30 : size === "xl" ? 88 : 42;
  return (
    <span className={`avatar${size !== "md" ? ` avatar-${size}` : ""}`} style={{ background: color }}>
      {src ? <Image src={src} alt="" fill sizes={`${px}px`} /> : initials(name)}
    </span>
  );
}

export function CardHead({
  title,
  sub,
  count,
  children,
  divider,
}: {
  title: string;
  sub?: string;
  count?: string;
  children?: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <div className={`card-head${divider ? " pb" : ""}`}>
      <div className="grow">
        <div className="row">
          <h2 className="card-title">{title}</h2>
          {count && <span className="count-badge">{count}</span>}
        </div>
        {sub && <p className="card-sub">{sub}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

/** Builds a URL that keeps the current query and applies overrides (null removes a key). */
export function href(path: string, current: Record<string, string | undefined>, over: Record<string, string | number | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) if (v) p.set(k, v);
  for (const [k, v] of Object.entries(over)) {
    if (v === null || v === "") p.delete(k);
    else p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `${path}?${s}` : path;
}

export function LinkTabs({
  items,
  active,
  build,
}: {
  items: { key: string; label: string; count?: number }[];
  active: string;
  build: (key: string) => string;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <Link
          key={t.key}
          href={build(t.key)}
          role="tab"
          aria-selected={active === t.key}
          className={`tab${active === t.key ? " on" : ""}`}
          scroll={false}
        >
          {t.label}
          {t.count !== undefined && <small>{t.count.toLocaleString("en-US")}</small>}
        </Link>
      ))}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  build,
}: {
  page: number;
  pageSize: number;
  total: number;
  build: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  // 1 … around current … last
  const nums = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  if (page <= 3) [2, 3, 4].forEach((n) => n <= pages && nums.add(n));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => n >= 1 && nums.add(n));
  const sorted = [...nums].sort((a, b) => a - b);

  return (
    <div className="card-foot">
      <span>
        Showing <b>{from}–{to}</b> of {total.toLocaleString("en-US")}
      </span>
      {pages > 1 && (
        <nav className="pages" aria-label="Pagination">
          <Link className="arrow" href={build(Math.max(1, page - 1))} aria-disabled={page === 1} aria-label="Previous page" scroll={false}>‹</Link>
          {sorted.map((n, i) => (
            <span key={n} style={{ display: "contents" }}>
              {i > 0 && n - sorted[i - 1] > 1 && <span aria-hidden>…</span>}
              <Link href={build(n)} aria-current={n === page ? "page" : undefined} scroll={false}>{n}</Link>
            </span>
          ))}
          <Link className="arrow" href={build(Math.min(pages, page + 1))} aria-disabled={page === pages} aria-label="Next page" scroll={false}>›</Link>
        </nav>
      )}
    </div>
  );
}

/** Server-rendered side panel, opened with ?id=… and closed by linking back without it. */
export function Drawer({ title, closeHref, children, actions }: { title: React.ReactNode; closeHref: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <>
      <Link href={closeHref} className="drawer-scrim" aria-label="Close panel" scroll={false} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <h2>{title}</h2>
          {actions}
          <Link href={closeHref} className="icon-btn" aria-label="Close" scroll={false}>
            <X size={18} />
          </Link>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}

export function Banner({ src, title, text }: { src: string; title: string; text: string }) {
  return (
    <section className="banner">
      <Image src={src} alt="" fill priority sizes="(max-width: 920px) 100vw, 1200px" />
      <div className="banner-text">
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </section>
  );
}

export function codeClass(status: number) {
  return status >= 500 ? "code-err" : status >= 400 ? "code-warn" : "code-ok";
}
