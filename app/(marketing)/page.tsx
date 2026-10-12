import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, CreditCard, Gauge, KeyRound, ListChecks, Plus, ScrollText, ShieldCheck, Users } from "lucide-react";
import { getCurrentMember } from "@/lib/auth";
import { AnalyticsMock, ApiMock, DashboardMock, GrowthCurve, InsightMock, OrbitMock, PaymentMock, PlansMock, UsageMock } from "@/components/marketing/mocks";
import { AudienceTabs, Carousel, FeatureNav, MarketingNav, PricingGrid, type Audience } from "@/components/marketing/interactive";
import "./marketing.css";

export const metadata: Metadata = {
  title: { absolute: "tiun. · Billing for African SaaS & AI startups" },
  description: "Subscriptions, usage metering and payment tracking for African startups, with M-Pesa, mobile money, bank and card payments in one dashboard.",
};

const FEATURES = [
  {
    id: "subscriptions",
    label: "Subscriptions",
    icon: ListChecks,
    title: "Plans your customers understand.",
    text: "Monthly plans, pay-per-use pricing, free trials and coupons. See who’s subscribed, on trial, paused or gone, and why.",
    mock: <PlansMock />,
  },
  {
    id: "usage",
    label: "Usage metering",
    icon: Gauge,
    title: "Meter every API call and session.",
    text: "Your app reports usage with one API call. tiun. turns it into units, cost and revenue per customer, live.",
    mock: <UsageMock />,
  },
  {
    id: "payments",
    label: "Payments",
    icon: CreditCard,
    title: "M-Pesa, mobile money, bank and cards in one ledger.",
    text: "Record payments as they arrive, match them to customers and refund in two clicks. No more reconciling five spreadsheets on Friday.",
    mock: <PaymentMock />,
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    title: "Revenue, churn and retention without the formulas.",
    text: "MRR, the revenue bridge month to month and cohort retention, ready the moment your data is.",
    mock: <AnalyticsMock />,
  },
];

const AUDIENCES: Audience[] = [
  {
    key: "founders",
    tab: "Founders",
    title: "Know your numbers before the board meeting does.",
    text: "Revenue, active subscribers and churn on one screen, updated as payments land.",
    points: ["Monthly revenue and growth at a glance", "Spot failed payments and expiring trials early", "Share a read-only seat with investors"],
    image: "/avatars/amina.png",
  },
  {
    key: "finance",
    tab: "Finance & ops",
    title: "Reconcile M-Pesa and bank payments without the copy-paste.",
    text: "Every payment lives next to the customer and plan it belongs to, with references you can search.",
    points: ["One ledger for mobile money, bank, cash and cards", "Refunds with an audit trail", "CSV export for your accountant"],
    image: "/banners/payments.png",
  },
  {
    key: "developers",
    tab: "Developers",
    title: "Meter usage with one API call.",
    text: "Create customers and record sessions from your backend. Sandbox keys let you test without touching live data.",
    points: ["REST API with scoped keys", "Every request logged with status and latency", "Separate Live and Sandbox modes"],
    code: `curl -X POST https://your-app/api/v1/sessions \\
  -H "Authorization: Bearer sk_test_…" \\
  -d '{"customer":"cus_8f2a",
       "feature":"Chat completion",
       "units":1840}'

→ 201 Created · 84 ms`,
  },
  {
    key: "support",
    tab: "Customer success",
    title: "Answer “why was I charged?” in seconds.",
    text: "Find any customer and see their plan, sessions and payments in one panel.",
    points: ["Search by name or email", "Pause, reactivate or cancel in one click", "Record a payment while on the phone"],
    image: "/avatars/neema.png",
  },
  {
    key: "agritech",
    tab: "Agritech & marketplaces",
    title: "Bill farmers, co-ops and buyers the way they pay.",
    text: "Charge per delivery, per month or per use, and take payment by mobile money or in cash at the collection point.",
    points: ["Pay-per-use and monthly plans side by side", "Cash and mobile money recorded in one place", "Works on any phone with a browser"],
    image: "/banners/dairy.png",
  },
];

const CHANGELOG = [
  { date: "Oct 2026", title: "Sign-in protection", text: "Repeated failed sign-ins are paused for 15 minutes to keep accounts safe." },
  { date: "Oct 2026", title: "Phone-friendly dashboard", text: "Every page now works on a 375-pixel phone screen, menus included." },
  { date: "Oct 2026", title: "Onboarding for new workspaces", text: "A four-step checklist and helpful empty states from day one." },
  { date: "Oct 2026", title: "Record mobile money payments", text: "Log M-Pesa, Airtel Money, bank and cash payments against a customer." },
];

const FAQ = [
  ["Is there a free plan?", "Yes. The Free plan covers your first 100 customers and two team seats, with no card required. Upgrade when you outgrow it."],
  ["Does tiun. process M-Pesa or card payments for me?", "Not yet. Today you record payments you receive by M-Pesa, Airtel Money, bank transfer or cash, and your app reports usage through the API. Collecting payments directly is on our roadmap."],
  ["How do I connect my app?", "Create an API key in the dashboard, then call our REST API to create customers and record usage sessions. Sandbox keys let you test safely first."],
  ["Can my whole team use it?", "Yes. Invite teammates as Admin, Developer or Viewer. Each role only sees the actions it’s allowed to take, and permissions are checked on the server."],
  ["Is there a test mode?", "Every workspace has Live and Sandbox modes with separate data and keys, so you can try things without touching real customers."],
  ["Where is my data stored?", "In a managed PostgreSQL database with automatic backups. Passwords are hashed with bcrypt and API keys are stored only as hashes."],
];

function Eyebrow({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return <span className={`mk-eyebrow${dark ? " dark" : ""}`}><i />{children}</span>;
}

function Placeholder({ children = "Placeholder" }: { children?: React.ReactNode }) {
  return <span className="mk-placeholder" title="Replace with real content before launch">{children}</span>;
}

export default async function MarketingPage() {
  const signedIn = !!(await getCurrentMember());

  return (
    <div className="mk">
      <MarketingNav signedIn={signedIn} />

      <main>
        {/* ---------- Hero ---------- */}
        <section className="mk-hero mk-wrap">
          <Eyebrow>Built for African SaaS & AI startups</Eyebrow>
          <h1>
            The billing platform for African startups <span>that turns M-Pesa, cards and usage into real answers</span>
          </h1>
          <p className="mk-lead">Subscriptions, usage metering and payment tracking in one dashboard your whole team can use.</p>
          <div className="mk-hero-cta">
            <Link href={signedIn ? "/app" : "/signup"} className="mk-btn mk-btn-dark mk-btn-lg">{signedIn ? "Open dashboard" : "Start free"} <ArrowRight size={16} /></Link>
            <a href="#product" className="mk-btn mk-btn-light mk-btn-lg">See how it works</a>
          </div>
          <p className="mk-fine">Free for your first 100 customers · No card required</p>
        </section>

        <section className="mk-wrap">
          <div className="mk-showcase">
            <DashboardMock />
          </div>
        </section>

        {/* ---------- Logo strip (placeholders) ---------- */}
        <section className="mk-wrap mk-logos" aria-label="Customer logos">
          <Placeholder>Placeholder: customer logos</Placeholder>
          <div className="mk-logo-row">
            {["Your logo", "Your logo", "Your logo", "Your logo", "Your logo", "Your logo"].map((l, i) => <span key={i}>{l}</span>)}
          </div>
        </section>

        {/* ---------- Four capabilities ---------- */}
        <section className="mk-section" id="product">
          <div className="mk-wrap">
            <Eyebrow>Platform</Eyebrow>
            <h2 className="mk-h2">Everything your team needs in one place. <span>Four core capabilities, built to work together.</span></h2>
            <div className="mk-features">
              <FeatureNav items={FEATURES.map((f) => ({ id: f.id, label: f.label }))} />
              <div className="mk-feature-list">
                {FEATURES.map((f) => (
                  <article key={f.id} id={f.id} className="mk-feature">
                    <div className="mk-feature-text">
                      <span className="mk-feature-icon"><f.icon size={18} /></span>
                      <p><b>{f.title}</b> {f.text}</p>
                    </div>
                    {f.mock}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Who it's for (dark) ---------- */}
        <section className="mk-section mk-dark" id="solutions">
          <div className="mk-wrap">
            <div className="mk-center">
              <Eyebrow dark>Solutions</Eyebrow>
              <h2 className="mk-h2">Who it’s for, and what they get</h2>
            </div>
            <AudienceTabs items={AUDIENCES} />
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="mk-section">
          <div className="mk-wrap">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mk-h2 mk-h2-wide">tiun. connects your payments, meters your usage, <span>and shows the numbers behind every decision.</span></h2>
            <div className="mk-steps">
              <div className="mk-step">
                <OrbitMock />
                <h3>Connect your payments</h3>
                <p>Bring mobile money, bank, cash and card payments into one ledger, matched to customers.</p>
              </div>
              <div className="mk-step">
                <ApiMock />
                <h3>Meter your usage</h3>
                <p>Your app sends usage as it happens. We turn it into units and revenue per customer.</p>
              </div>
              <div className="mk-step">
                <InsightMock />
                <h3>Decide with confidence</h3>
                <p>See failed payments, expiring trials and churn before they become surprises.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Testimonials (placeholders) ---------- */}
        <section className="mk-section mk-soft">
          <div className="mk-wrap">
            <div className="mk-row-between">
              <div>
                <Eyebrow>Customer stories</Eyebrow>
                <h2 className="mk-h2">Trusted by teams <span>that can’t afford to guess</span></h2>
              </div>
              <Placeholder>Placeholder: add real customer stories</Placeholder>
            </div>
            <Carousel>
              <article className="mk-quote mk-quote-main">
                <div className="mk-quote-img"><Image src="/banners/processing.png" alt="" fill sizes="(max-width: 860px) 90vw, 360px" /></div>
                <div className="mk-quote-body">
                  <b className="mk-quote-logo">Company name</b>
                  <blockquote>“Your customer’s quote goes here: one or two sentences about the result they got with tiun.”</blockquote>
                  <div className="mk-quote-foot">
                    <span><b>Customer name</b><small>Role · Company</small></span>
                    <span className="mk-quote-stat"><b>00%</b><small>Result metric</small></span>
                  </div>
                </div>
              </article>
              {["Company name", "Company name", "Company name"].map((c, i) => (
                <article key={i} className="mk-quote mk-quote-small">
                  <b className="mk-quote-logo">{c}</b>
                  <blockquote>“Another short customer quote about what changed for their team.”</blockquote>
                  <span><b>Customer name</b><small>Role · Company</small></span>
                </article>
              ))}
            </Carousel>
          </div>
        </section>

        {/* ---------- Scale (placeholder metrics) ---------- */}
        <section className="mk-section mk-scale">
          <div className="mk-wrap">
            <div className="mk-row-between">
              <div>
                <Eyebrow>Scale</Eyebrow>
                <h2 className="mk-h2">Run at any scale. <span>Production-grade for your team and your app.</span></h2>
              </div>
              <Placeholder>Placeholder: replace with real numbers</Placeholder>
            </div>
            <div className="mk-metrics">
              {[["000+", "Teams billing with tiun."], ["00M", "Usage events metered"], ["00.0%", "Uptime over 90 days"], ["00+", "Countries served"]].map(([v, l]) => (
                <div key={l}><b>{v}</b><small>{l}</small></div>
              ))}
            </div>
            <GrowthCurve />
          </div>
        </section>

        {/* ---------- Security (dark) ---------- */}
        <section className="mk-section mk-dark" id="security">
          <div className="mk-wrap">
            <div className="mk-center">
              <Eyebrow dark>Security</Eyebrow>
              <h2 className="mk-h2">Your data stays yours</h2>
              <p className="mk-lead">Safe defaults from day one, not an add-on.</p>
            </div>
            <div className="mk-sec-grid">
              {[
                [KeyRound, "Hashed passwords and keys", "Passwords are hashed with bcrypt. API keys are shown once and stored only as a hash."],
                [Users, "Role-based access", "Owner, Admin, Developer and Viewer roles, enforced on the server for every action."],
                [ScrollText, "Every API call logged", "Status, latency and payload for each request, so you can trace any charge."],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof KeyRound;
                return (
                  <div key={t as string} className="mk-sec">
                    <span className="mk-sec-icon"><I size={22} /></span>
                    <h3>{t as string}</h3>
                    <p>{d as string}</p>
                  </div>
                );
              })}
            </div>
            <div className="mk-works">
              <div className="mk-works-text">
                <ShieldCheck size={22} />
                <h3>Works with the stack you already have</h3>
                <p>A REST API, Sandbox mode and CSV exports connect tiun. to your app, your accountant and your spreadsheets.</p>
                <Link href={signedIn ? "/app/setup/integration" : "/signup"} className="mk-btn mk-btn-white">See the quickstart <ArrowRight size={16} /></Link>
              </div>
              <div className="mk-works-term" aria-hidden>
                <div className="mk-api-bar"><i /><i /><i /> <span>GET /api/v1/transactions</span></div>
                <pre>{`{
  "data": [{
    "amount": 120000,
    "currency": "tzs",
    "status": "succeeded",
    "method": "M-Pesa"
  }],
  "has_more": false
}`}</pre>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Pricing ---------- */}
        <section className="mk-section" id="pricing">
          <div className="mk-wrap">
            <div className="mk-center">
              <Eyebrow>Pricing</Eyebrow>
              <h2 className="mk-h2">Start free. <span>Upgrade when you grow.</span></h2>
              <Placeholder>Draft pricing: confirm prices and limits before launch</Placeholder>
            </div>
            <PricingGrid />
          </div>
        </section>

        {/* ---------- Changelog ---------- */}
        <section className="mk-section mk-soft" id="changelog">
          <div className="mk-wrap">
            <Eyebrow>Changelog</Eyebrow>
            <h2 className="mk-h2">Always improving</h2>
            <div className="mk-changelog">
              {CHANGELOG.map((c) => (
                <article key={c.title}>
                  <small>{c.date}</small>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="mk-section" id="faq">
          <div className="mk-wrap mk-faq">
            <h2 className="mk-h2">Have questions? <span>Find answers.</span></h2>
            <div className="mk-faq-list">
              {FAQ.map(([q, a], i) => (
                <details key={q} open={i === 0}>
                  <summary>{q}<Plus size={18} aria-hidden /></summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ---------- CTA + footer (dark) ---------- */}
      <footer className="mk-footer mk-dark" id="contact">
        <div className="mk-wrap">
          <div className="mk-cta">
            <h2>Ready to automate your billing?</h2>
            <div className="mk-cta-side">
              <p>Create a workspace in a minute. Your first 100 customers are free.</p>
              <div className="mk-hero-cta">
                <Link href={signedIn ? "/app" : "/signup"} className="mk-btn mk-btn-white">{signedIn ? "Open dashboard" : "Start free"}</Link>
                {!signedIn && <Link href="/login" className="mk-btn mk-btn-outline">Sign in</Link>}
              </div>
            </div>
          </div>
          <div className="mk-foot-cols">
            <div className="mk-foot-brand">
              <span className="mk-logo"><span className="mk-logo-mark" aria-hidden>t</span>tiun.</span>
              <p>Billing for African SaaS & AI startups.</p>
              <p className="mk-dim-dark">Contact: <Placeholder>add your email</Placeholder></p>
            </div>
            <div>
              <h4>Product</h4>
              <a href="#product">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#changelog">Changelog</a>
              <a href="#security">Security</a>
            </div>
            <div>
              <h4>Solutions</h4>
              <a href="#solutions">Founders</a>
              <a href="#solutions">Finance & ops</a>
              <a href="#solutions">Developers</a>
              <a href="#solutions">Agritech</a>
            </div>
            <div>
              <h4>Account</h4>
              <Link href="/signup">Create workspace</Link>
              <Link href="/login">Sign in</Link>
              <a href="#faq">FAQ</a>
            </div>
          </div>
          <div className="mk-foot-base">
            <span>© {new Date().getFullYear()} tiun.</span>
            <span>Made for teams across Africa</span>
          </div>
        </div>
        <div className="mk-wordmark" aria-hidden>tiun.</div>
      </footer>
    </div>
  );
}
