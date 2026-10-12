"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Book,
  ChevronDown,
  ChevronsUpDown,
  Code,
  CreditCard,
  House,
  LogOut,
  Moon,
  PanelLeft,
  Plug,
  Search,
  Server,
  Shield,
  SlidersVertical,
  Sparkles,
  Sun,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { initials } from "@/lib/format";

const ShellContext = createContext<{ openNav: () => void; openPalette: () => void }>({ openNav: () => {}, openPalette: () => {} });
export const useShell = () => useContext(ShellContext);

type Counts = { transactions: number; integration: number; team: number };
type NavLeaf = { label: string; href: string; icon: LucideIcon; count?: keyof Counts; alert?: boolean };
type NavParent = { label: string; icon: LucideIcon; base: string; children: { label: string; href: string }[] };

const PLATFORM: NavLeaf[] = [
  { label: "Home", href: "/", icon: House },
  { label: "Analytics", href: "/analytics", icon: Sparkles },
  { label: "Sessions", href: "/sessions", icon: Server },
  { label: "User Management", href: "/customers", icon: Users },
  { label: "Transactions", href: "/transactions", icon: ArrowLeftRight, count: "transactions", alert: true },
  { label: "APIs", href: "/apis", icon: Code },
];

const SETUP: (NavLeaf | NavParent)[] = [
  { label: "Integration", href: "/setup/integration", icon: Plug, count: "integration", alert: true },
  {
    label: "Authentication",
    icon: Shield,
    base: "/setup/authentication",
    children: [
      { label: "Providers", href: "/setup/authentication" },
      { label: "Policies", href: "/setup/authentication/policies" },
    ],
  },
  {
    label: "Checkout",
    icon: CreditCard,
    base: "/setup/checkout",
    children: [
      { label: "Plans & coupons", href: "/setup/checkout" },
      { label: "Appearance", href: "/setup/checkout/appearance" },
    ],
  },
];

const ACCOUNT: NavLeaf[] = [
  { label: "Documentation", href: "/setup/integration#quickstart", icon: Book },
  { label: "Settings", href: "/settings", icon: SlidersVertical },
  { label: "Team", href: "/settings/users", icon: UsersRound, count: "team" },
];

/** Every destination, for the command palette. */
const DESTINATIONS = [
  ...PLATFORM.map((p) => ({ label: p.label, href: p.href, icon: p.icon })),
  { label: "Integration", href: "/setup/integration", icon: Plug },
  { label: "Authentication providers", href: "/setup/authentication", icon: Shield },
  { label: "Authentication policies", href: "/setup/authentication/policies", icon: Shield },
  { label: "Plans & coupons", href: "/setup/checkout", icon: CreditCard },
  { label: "Checkout appearance", href: "/setup/checkout/appearance", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: SlidersVertical },
  { label: "Billing", href: "/settings?tab=billing", icon: SlidersVertical },
  { label: "Team members", href: "/settings/users", icon: UsersRound },
  { label: "Profile", href: "/profile", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/settings") return pathname === "/settings";
  return pathname === href || pathname.startsWith(href + "/");
}

function Leaf({ item, pathname, counts }: { item: NavLeaf; pathname: string; counts: Counts }) {
  const active = isActive(pathname, item.href.split("#")[0]);
  const n = item.count ? counts[item.count] : 0;
  return (
    <Link href={item.href} className={`nav-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined} title={item.label}>
      <item.icon size={19} strokeWidth={1.6} />
      <span className="rail-hide">{item.label}</span>
      {n > 0 && <span className={`nav-count${item.alert ? " alert" : ""}`} aria-label={`${n} need attention`}>{n}</span>}
    </Link>
  );
}

function Parent({ item, pathname }: { item: NavParent; pathname: string }) {
  const inside = pathname.startsWith(item.base);
  const [open, setOpen] = useState(inside);
  useEffect(() => {
    if (inside) setOpen(true);
  }, [inside]);
  return (
    <>
      <button type="button" className={`nav-item parent${inside ? " active" : ""}`} aria-expanded={open} title={item.label} onClick={() => setOpen((o) => !o)}>
        <item.icon size={19} strokeWidth={1.6} />
        <span className="rail-hide">{item.label}</span>
        <ChevronDown size={16} className={`trail rail-hide${open ? " open" : ""}`} />
      </button>
      {open && (
        <div className="nav-sub">
          {item.children.map((c) => (
            <Link key={c.href} href={c.href} className={pathname === c.href ? "active" : ""} aria-current={pathname === c.href ? "page" : undefined}>
              {c.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

type Me = { name: string; email: string; role: string; avatarUrl: string | null };

function MeCard({ me, logout }: { me: Me; logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const role = me.role[0] + me.role.slice(1).toLowerCase();
  return (
    <div ref={ref} className="me-card">
      <button type="button" className="me-btn" aria-haspopup="menu" aria-expanded={open} title={`${me.name} · ${role}`} onClick={() => setOpen((o) => !o)}>
        <span className="me-avatar">{me.avatarUrl ? <Image src={me.avatarUrl} alt="" fill sizes="38px" /> : initials(me.name)}</span>
        <span className="me-text rail-hide">
          <b>{me.name}</b>
          <small>{role} · {me.email}</small>
        </span>
        <ChevronsUpDown size={16} className="ws-chev rail-hide" />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="hint" style={{ padding: "6px 10px" }}>{me.email}</div>
          <Link href="/profile" role="menuitem" onClick={() => setOpen(false)}><UserRound size={16} /> Profile</Link>
          <Link href="/settings/users" role="menuitem" onClick={() => setOpen(false)}><UsersRound size={16} /> Team members</Link>
          <hr />
          <form action={logout}>
            <button type="submit" role="menuitem"><LogOut size={16} /> Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}

function ThemeSwitch() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    let t: string | null = null;
    try {
      t = localStorage.getItem("tiun-theme");
    } catch {}
    setTheme(t === "light" || t === "dark" ? t : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);
  const apply = (t: "light" | "dark") => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("tiun-theme", t);
    } catch {}
  };
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Theme">
      <button type="button" role="radio" aria-checked={theme === "dark"} aria-label="Dark" onClick={() => apply("dark")}><Moon size={15} /></button>
      <button type="button" role="radio" aria-checked={theme === "light"} aria-label="Light" onClick={() => apply("light")}><Sun size={15} /></button>
    </div>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const query = q.trim().toLowerCase();
  const pages = DESTINATIONS.filter((d) => !query || d.label.toLowerCase().includes(query));
  const items = [
    ...pages.map((p) => ({ ...p, hint: "Go to" })),
    ...(query ? [{ label: `Search customers for “${q.trim()}”`, href: `/customers?q=${encodeURIComponent(q.trim())}`, icon: Search, hint: "Customers" }] : []),
  ];
  useEffect(() => setSel(0), [q]);
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return (
    <div className="palette-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="palette-input">
          <Search size={18} />
          <input
            autoFocus
            id="palette-search"
            placeholder="Jump to a page or search customers…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              if (e.key === "Enter" && items[sel]) go(items[sel].href);
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
          />
        </div>
        <ul className="palette-list" id="palette-list" role="listbox">
          {items.length === 0 && <li className="palette-group">Nothing matches “{q}”.</li>}
          {items.map((it, i) => (
            <li key={it.href + it.label}>
              <button type="button" role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => go(it.href)}>
                <it.icon size={17} />
                {it.label}
                <small>{it.hint}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Shell({
  me,
  workspace,
  counts,
  logout,
  children,
}: {
  me: Me;
  workspace: string;
  counts: Counts;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [rail, setRail] = useState(false);
  const [palette, setPalette] = useState(false);
  const [shortcut, setShortcut] = useState("Ctrl K");

  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    try {
      setRail(localStorage.getItem("tiun-rail") === "1");
    } catch {}
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("⌘ K");
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleRail = () => {
    // On phones the same button closes the drawer.
    if (window.matchMedia("(max-width: 920px)").matches) return setNavOpen(false);
    setRail((r) => {
      try {
        localStorage.setItem("tiun-rail", r ? "0" : "1");
      } catch {}
      return !r;
    });
  };
  const openPalette = useCallback(() => setPalette(true), []);

  return (
    <ShellContext.Provider value={{ openNav: () => setNavOpen(true), openPalette }}>
      <div className={`shell${navOpen ? " nav-open" : ""}${rail ? " rail" : ""}`}>
        <aside className="sidebar">
          <div className="sb-top">
            <div className="sb-brand rail-hide">
              <b>tiun.</b>
              <span>Billing console</span>
            </div>
            <button className="icon-btn" aria-label={rail ? "Expand sidebar" : "Collapse sidebar"} title={rail ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleRail}>
              <PanelLeft size={18} strokeWidth={1.6} />
            </button>
          </div>

          <Link href="/settings" className="workspace" title={`${workspace} · Workspace settings`} style={{ color: "inherit", textDecoration: "none" }}>
            <span className="ws-avatar">{initials(workspace)}</span>
            <span className="ws-text rail-hide">
              <span className="ws-name">{workspace}</span>
              <span className="ws-sub">Workspace</span>
            </span>
            <ChevronsUpDown size={16} className="ws-chev rail-hide" />
          </Link>

          <button type="button" className="sb-search" onClick={openPalette} aria-label="Search" title={`Search (${shortcut})`}>
            <Search size={17} strokeWidth={1.7} />
            <span className="rail-hide">Search</span>
            <span className="kbd rail-hide">{shortcut}</span>
          </button>

          <nav className="nav-group" aria-label="Platform">
            <div className="nav-label rail-hide">Platform</div>
            {PLATFORM.map((item) => <Leaf key={item.href} item={item} pathname={pathname} counts={counts} />)}
          </nav>

          <nav className="nav-group" aria-label="Setup">
            <div className="nav-label rail-hide">Setup</div>
            {SETUP.map((item) =>
              "children" in item ? <Parent key={item.label} item={item} pathname={pathname} /> : <Leaf key={item.href} item={item} pathname={pathname} counts={counts} />,
            )}
          </nav>

          <div className="sidebar-footer">
            <nav className="nav-group" aria-label="Account">
              <div className="nav-label rail-hide">Account</div>
              {ACCOUNT.map((item) => <Leaf key={item.href} item={item} pathname={pathname} counts={counts} />)}
            </nav>
            <div className="sb-appearance">
              <span className="rail-hide">Appearance</span>
              <ThemeSwitch />
            </div>
            <MeCard me={me} logout={logout} />
          </div>
        </aside>
        {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
        <main className="main">{children}</main>
      </div>
      {palette && <Palette onClose={() => setPalette(false)} />}
    </ShellContext.Provider>
  );
}
