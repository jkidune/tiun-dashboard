/* Static product illustrations for the marketing page. Example data, drawn with HTML/SVG. */
import { ArrowLeftRight, Check, Code, CreditCard, House, Server, Sparkles, Users } from "lucide-react";

const bars = [38, 52, 45, 60, 58, 72, 66, 80, 74, 88, 84, 100];

export function DashboardMock() {
  const nav = [
    { icon: House, label: "Home" },
    { icon: Sparkles, label: "Analytics" },
    { icon: Server, label: "Sessions" },
    { icon: Users, label: "Customers", active: true },
    { icon: ArrowLeftRight, label: "Transactions" },
    { icon: Code, label: "APIs" },
  ];
  const rows = [
    { n: "Asha Mushi", e: "asha@kilimo.co.tz", s: "Subscribed", p: "Monthly", v: "TSh 25,000", c: "#3f6f68" },
    { n: "Baraka Njau", e: "baraka@shamba.ai", s: "Subscribed", p: "Per use", v: "TSh 61,200", c: "#2f5d7c" },
    { n: "Neema Swai", e: "neema@duka.app", s: "Trial", p: "Pro", v: "TSh 0", c: "#7a3a5c" },
    { n: "Juma Said", e: "juma@safari.io", s: "Paused", p: "Monthly", v: "TSh 0", c: "#b0703f" },
  ];
  return (
    <div className="mk-dash" aria-hidden>
      <div className="mk-dash-side">
        <div className="mk-dash-brand"><b>tiun.</b></div>
        <div className="mk-dash-ws"><span>KA</span> Kilimo AI</div>
        {nav.map((n) => (
          <div key={n.label} className={`mk-dash-nav${n.active ? " on" : ""}`}><n.icon size={13} /> {n.label}</div>
        ))}
      </div>
      <div className="mk-dash-main">
        <div className="mk-dash-top">
          <b>User Management</b>
          <span className="mk-seg"><i /> Live <em>Sandbox</em></span>
        </div>
        <div className="mk-dash-kpis">
          {[["Active subscribers", "1,284", "+6.0%"], ["New subscribers", "118", "+3.1%"], ["Churned", "26", "−2.1%"], ["Net new", "92", "+8.0%"]].map(([l, v, t]) => (
            <div key={l}>
              <small>{l}</small>
              <b>{v}</b>
              <span>{t}</span>
            </div>
          ))}
        </div>
        <div className="mk-dash-chart">
          {bars.map((h, i) => <i key={i} style={{ height: `${h}%` }} className={i === bars.length - 1 ? "last" : ""} />)}
        </div>
        <div className="mk-dash-table">
          {rows.map((r) => (
            <div key={r.n} className="mk-dash-row">
              <span className="mk-av" style={{ background: r.c }}>{r.n.split(" ").map((x) => x[0]).join("")}</span>
              <span className="mk-who"><b>{r.n}</b><small>{r.e}</small></span>
              <span className={`mk-pill ${r.s.toLowerCase()}`}>{r.s}</span>
              <span className="mk-dim">{r.p}</span>
              <span className="mk-num">{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PlansMock() {
  return (
    <div className="mk-frame" aria-hidden>
      <div className="mk-plans">
        {[["Starter", "TSh 25,000", "/ month", "412", 92], ["Pro", "TSh 120,000", "/ month", "87", 81], ["Per use", "TSh 50", "/ request", "230", 74]].map(([n, p, u, c, r]) => (
          <div key={n as string} className="mk-plan">
            <div className="mk-plan-head"><span className="mk-tile">{(n as string).slice(0, 2).toUpperCase()}</span><b>{n}</b><Ring v={r as number} /></div>
            <div className="mk-plan-price">{p} <small>{u}</small></div>
            <div className="mk-plan-stats"><span><small>CUSTOMERS</small>{c}</span><span><small>RETAINED</small>{r}%</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UsageMock() {
  const days = [22, 30, 28, 41, 38, 46, 52, 49, 61, 58, 66, 72, 69, 80];
  return (
    <div className="mk-frame" aria-hidden>
      <div className="mk-card">
        <div className="mk-card-head"><b>Sessions per day</b><span className="mk-dim">Last 14 days</span></div>
        <div className="mk-usage">
          {days.map((d, i) => <i key={i} style={{ height: `${d}%` }}><em style={{ height: `${Math.max(4, 100 - d) / 12}%` }} /></i>)}
        </div>
        <div className="mk-usage-legend"><span><i className="a" />Completed</span><span><i className="b" />Failed</span><b>48,210 units metered</b></div>
      </div>
    </div>
  );
}

export function PaymentMock() {
  return (
    <div className="mk-frame" aria-hidden>
      <div className="mk-pay">
        <div className="mk-pay-head"><span className="mk-pay-icon"><CreditCard size={16} /></span><b>Record payment</b></div>
        <small className="mk-dim">Amount received</small>
        <div className="mk-pay-amount">TSh 120,000</div>
        <span className="mk-chip"><i style={{ background: "#2f5d7c" }} />Baraka Njau · Pro plan</span>
        <div className="mk-pay-seg"><span className="on">M-Pesa</span><span>Cash</span><span>Bank</span></div>
        <div className="mk-pay-ref">Ref · QJK4H7TZ2P</div>
        <div className="mk-pay-btn">Record payment</div>
      </div>
    </div>
  );
}

export function AnalyticsMock() {
  const pts = [20, 26, 25, 33, 38, 36, 45, 52, 50, 61, 68, 76];
  const path = pts.map((p, i) => `${i ? "L" : "M"}${(i / (pts.length - 1)) * 300},${100 - p}`).join(" ");
  return (
    <div className="mk-frame" aria-hidden>
      <div className="mk-card">
        <div className="mk-card-head"><b>Monthly revenue</b><span className="mk-up">+12.4%</span></div>
        <svg viewBox="0 -4 300 108" className="mk-line">
          {[0, 25, 50, 75].map((y) => <line key={y} x1="0" x2="300" y1={y + 4} y2={y + 4} />)}
          <path d={`${path} L300,104 L0,104 Z`} className="area" />
          <path d={path} className="stroke" />
          <circle cx="300" cy={100 - pts[pts.length - 1]} r="4" />
        </svg>
        <div className="mk-heat">
          {[[100, 92, 88, 85], [100, 90, 86], [100, 94]].map((row, r) => (
            <div key={r}>{row.map((v, i) => <span key={i} style={{ opacity: 0.25 + (v - 80) / 26 }}>{v}%</span>)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OrbitMock() {
  const chips = ["M-Pesa", "Airtel Money", "Visa", "Mastercard", "Bank", "Cash"];
  return (
    <div className="mk-orbit" aria-hidden>
      <span className="mk-orbit-core">tiun.</span>
      {chips.map((c, i) => {
        const a = (i / chips.length) * Math.PI * 2 - Math.PI / 2;
        return <span key={c} className="mk-orbit-chip" style={{ left: `${50 + Math.cos(a) * 40}%`, top: `${50 + Math.sin(a) * 38}%` }}>{c}</span>;
      })}
    </div>
  );
}

export function ApiMock() {
  return (
    <div className="mk-api" aria-hidden>
      <div className="mk-api-bar"><i /><i /><i /> <span>POST /api/v1/sessions</span></div>
      <pre>{`{
  "customer": "cus_8f2a",
  "feature": "Chat completion",
  "units": 1840
}`}</pre>
      <div className="mk-api-ok"><span>201</span> Recorded · 84 ms</div>
    </div>
  );
}

export function InsightMock() {
  return (
    <div className="mk-insight" aria-hidden>
      <div className="mk-insight-head"><b>Needs attention</b><span>3</span></div>
      {[["Payment of TSh 25,000 failed", "Juma Said · M-Pesa"], ["Trial ends in 2 days", "Neema Swai · Pro"], ["Churn up 2% on Starter", "October vs September"]].map(([t, s]) => (
        <div key={t} className="mk-insight-row"><span className="mk-check"><Check size={11} strokeWidth={3} /></span><span><b>{t}</b><small>{s}</small></span></div>
      ))}
    </div>
  );
}

export function GrowthCurve() {
  return (
    <svg className="mk-curve" viewBox="0 0 600 300" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="mk-curve-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0,290 C200,285 330,260 420,200 C500,148 545,80 600,8 L600,300 L0,300 Z" fill="url(#mk-curve-fill)" />
      <path d="M0,290 C200,285 330,260 420,200 C500,148 545,80 600,8" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function Ring({ v }: { v: number }) {
  const r = 14, c = 2 * Math.PI * r;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="mk-ring">
      <circle cx="18" cy="18" r={r} className="t" />
      <circle cx="18" cy="18" r={r} className="f" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform="rotate(-90 18 18)" />
      <text x="18" y="22" textAnchor="middle">{v}</text>
    </svg>
  );
}
