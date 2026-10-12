"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Menu, X } from "lucide-react";

/* ---------- Top navigation (sticky, with a phone menu) ---------- */
const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#solutions", label: "Solutions" },
  { href: "#pricing", label: "Pricing" },
  { href: "#changelog", label: "Changelog" },
  { href: "#faq", label: "FAQ" },
];

export function MarketingNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`mk-nav${scrolled ? " scrolled" : ""}${open ? " open" : ""}`}>
      <div className="mk-wrap mk-nav-inner">
        <Link href="/" className="mk-logo" aria-label="tiun. home">
          <span className="mk-logo-mark" aria-hidden>t</span>
          tiun.
        </Link>
        <nav className="mk-nav-links" aria-label="Main">
          {LINKS.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>)}
        </nav>
        <div className="mk-nav-cta">
          {signedIn ? (
            <Link href="/app" className="mk-btn mk-btn-dark">Open dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="mk-btn mk-btn-ghost">Sign in</Link>
              <Link href="/signup" className="mk-btn mk-btn-dark">Start free</Link>
            </>
          )}
        </div>
        <button type="button" className="mk-menu-btn" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <div className="mk-mobile-menu">
          {LINKS.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>)}
          <div className="mk-mobile-cta">
            {signedIn ? (
              <Link href="/app" className="mk-btn mk-btn-dark">Open dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="mk-btn mk-btn-light">Sign in</Link>
                <Link href="/signup" className="mk-btn mk-btn-dark">Start free</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

/* ---------- Sticky feature list that follows the scroll ---------- */
export function FeatureNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    items.forEach((i) => {
      const el = document.getElementById(i.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [items]);
  return (
    <nav className="mk-feature-nav" aria-label="Capabilities">
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} className={active === i.id ? "on" : ""} aria-current={active === i.id ? "true" : undefined}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}

/* ---------- "Who it's for" tabs ---------- */
export type Audience = { key: string; tab: string; title: string; text: string; points: string[]; image?: string; code?: string };

export function AudienceTabs({ items }: { items: Audience[] }) {
  const [i, setI] = useState(0);
  const a = items[i];
  return (
    <div className="mk-aud">
      <div className="mk-aud-tabs" role="tablist" aria-label="Audiences">
        {items.map((it, idx) => (
          <button key={it.key} type="button" role="tab" aria-selected={i === idx} className={i === idx ? "on" : ""} onClick={() => setI(idx)}>
            {it.tab}
          </button>
        ))}
      </div>
      <div className="mk-aud-panel" role="tabpanel" key={a.key}>
        <div className="mk-aud-text">
          <h3>{a.title}</h3>
          <p>{a.text}</p>
          <ul>
            {a.points.map((p) => <li key={p}><Check size={15} /> {p}</li>)}
          </ul>
        </div>
        <div className="mk-aud-media">
          {a.image ? (
            <Image src={a.image} alt="" fill sizes="(max-width: 860px) 100vw, 640px" />
          ) : (
            <pre className="mk-aud-code">{a.code}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Testimonials: scroll-snap row with arrows ---------- */
export function Carousel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="mk-carousel">
      <div className="mk-carousel-arrows">
        <button type="button" aria-label="Previous" onClick={() => move(-1)}><ArrowLeft size={16} /></button>
        <button type="button" aria-label="Next" onClick={() => move(1)}><ArrowRight size={16} /></button>
      </div>
      <div className="mk-carousel-track" ref={ref}>{children}</div>
    </div>
  );
}

/* ---------- Pricing (DRAFT: prices and limits are placeholders to adjust before launch) ---------- */
const TIERS = [
  {
    name: "Free",
    monthly: 0,
    blurb: "For getting started and testing with real customers.",
    cta: "Start free",
    features: ["Up to 100 customers", "2 team seats", "Record M-Pesa, Airtel Money, bank and cash payments", "REST API · 10,000 requests a month", "Sandbox mode for testing"],
  },
  {
    name: "Growth",
    monthly: 29,
    featured: true,
    blurb: "For startups billing customers every month.",
    cta: "Start free, upgrade later",
    features: ["Up to 2,000 customers", "10 team seats", "Analytics, revenue bridge and cohort retention", "CSV exports", "REST API · 250,000 requests a month", "Email support"],
  },
  {
    name: "Scale",
    monthly: null,
    blurb: "For high-volume usage billing and larger teams.",
    cta: "Talk to us",
    features: ["Unlimited customers and seats", "Volume pricing for metered usage", "Priority support", "Help migrating from spreadsheets"],
  },
];

export function PricingGrid() {
  const [yearly, setYearly] = useState(false);
  return (
    <>
      <div className="mk-switch" role="radiogroup" aria-label="Billing period">
        <button type="button" role="radio" aria-checked={!yearly} className={!yearly ? "on" : ""} onClick={() => setYearly(false)}>Monthly</button>
        <button type="button" role="radio" aria-checked={yearly} className={yearly ? "on" : ""} onClick={() => setYearly(true)}>Yearly <em>2 months free</em></button>
      </div>
      <div className="mk-pricing">
        {TIERS.map((t) => (
          <article key={t.name} className={`mk-tier${t.featured ? " featured" : ""}`}>
            <div className="mk-tier-head">
              <h3>{t.name}</h3>
              {t.featured && <span className="mk-badge-dark">Most popular</span>}
            </div>
            <p className="mk-tier-blurb">{t.blurb}</p>
            <div className="mk-price">
              {t.monthly === null ? (
                <b>Custom</b>
              ) : (
                <>
                  <b>${yearly ? t.monthly * 10 : t.monthly}</b>
                  <span>{t.monthly === 0 ? "forever" : yearly ? "per year" : "per month"}</span>
                </>
              )}
            </div>
            <Link href={t.monthly === null ? "#contact" : "/signup"} className={`mk-btn ${t.featured ? "mk-btn-dark" : "mk-btn-light"} mk-btn-block`}>{t.cta}</Link>
            <ul>
              {t.features.map((f) => <li key={f}><Check size={15} /> {f}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </>
  );
}
