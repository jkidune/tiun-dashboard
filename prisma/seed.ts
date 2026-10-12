/**
 * Seeds one workspace ("Akoya AI") with ~14 months of customers, usage sessions,
 * transactions and API traffic. Deterministic: same seed → same shape of data,
 * anchored to the current date.
 *
 *   npx prisma db seed
 */
import { PrismaClient, type CustomerStatus, type Mode, type Prisma, type TxStatus } from "../lib/generated/prisma";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const db = new PrismaClient();
const DAY = 86_400_000;
const now = Date.now();

// ---------- deterministic randomness ----------
let state = 20260912;
const rand = () => {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const weighted = <T,>(items: [T, number][]) => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[items.length - 1][0];
};
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// ---------- reference data ----------
const FIRST = ["Asha", "Baraka", "Neema", "Juma", "Rehema", "Elia", "Zuhura", "Musa", "Halima", "Peter", "Grace", "Hamisi", "Faith", "Kassim", "Mwanaidi", "Daniel", "Upendo", "Salim", "Agnes", "Omari", "Lucy", "Ibrahim", "Esther", "Yusuf", "Anna", "Frank", "Mary", "Hassan", "Joyce", "Rashid", "Sophia", "Kelvin", "Mariam", "Godfrey", "Irene", "Abdul", "Prisca", "Victor", "Sarah", "Emmanuel"];
const LAST = ["Mushi", "Mrema", "Kweka", "Massawe", "Mollel", "Njau", "Lyimo", "Shirima", "Kimaro", "Mwakyusa", "Mfinanga", "Temba", "Swai", "Urio", "Minja", "Mbwana", "Juma", "Said", "Ally", "Mohamed", "Okello", "Wanjiru", "Otieno", "Mensah", "Bailey", "Schneider", "Wilson", "Branson", "Doe", "May"];
const COLORS = ["#3f6f68", "#5b5650", "#7a3a5c", "#2f5d7c", "#8a5a3c", "#b0703f", "#3d4f73", "#2f7a64", "#6a4c93", "#9a4d3a", "#4b6b3a", "#355c7d"];
const FEATURES: [string, number][] = [["Chat completion", 46], ["Transcription", 18], ["Embeddings", 14], ["Image generation", 12], ["Agent run", 10]];
const METHODS: [[string, () => string], number][] = [
  [["Visa", () => String(int(1000, 9999))], 45],
  [["Mastercard", () => String(int(1000, 9999))], 30],
  [["M-Pesa", () => String(int(1000, 9999))], 20],
  [["Airtel Money", () => String(int(1000, 9999))], 5],
];

// The eight customers from the original design, kept so the first page looks familiar.
const FEATURED: { name: string; status: CustomerStatus; plan: "Monthly" | "Per use"; minsAgo: number }[] = [
  { name: "Melissa Ann", status: "SUBSCRIBED", plan: "Monthly", minsAgo: 20 },
  { name: "Scott Christopher", status: "SUBSCRIBED", plan: "Per use", minsAgo: 29 },
  { name: "Emily Wilson", status: "TRIAL", plan: "Per use", minsAgo: 31 },
  { name: "John Doe", status: "SUBSCRIBED", plan: "Monthly", minsAgo: 32 },
  { name: "Eduard Bailey", status: "SUBSCRIBED", plan: "Per use", minsAgo: 33 },
  { name: "Rodney Branson", status: "PAUSED", plan: "Monthly", minsAgo: 34 },
  { name: "Leo Schneider", status: "SUBSCRIBED", plan: "Monthly", minsAgo: 60 * 22 },
  { name: "Charlotte May", status: "CHURNED", plan: "Per use", minsAgo: 60 * 28 },
];

async function insertMany<T>(label: string, rows: T[], fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += 2000) await fn(rows.slice(i, i + 2000));
  console.log(`  ${label}: ${rows.length}`);
}

/** This script deletes every workspace first, so only allow it against a local database. */
function assertSafeTarget() {
  let host = "";
  try {
    host = new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    /* unparsable: treated as remote below */
  }
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
  if (local && process.env.NODE_ENV !== "production") return;
  if (process.env.SEED_ALLOW_REMOTE === "yes-delete-everything") {
    console.warn(`⚠ Seeding remote database ${host}: all existing data will be deleted.`);
    return;
  }
  console.error(
    `Refusing to seed ${host || "this database"}: the seed deletes ALL workspaces, customers and payments.\n` +
      `It only runs against localhost. To override for a throwaway database, set SEED_ALLOW_REMOTE=yes-delete-everything.`,
  );
  process.exit(1);
}

async function main() {
  assertSafeTarget();
  console.log("Clearing existing data…");
  await db.workspace.deleteMany();

  const password = process.env.SEED_PASSWORD || "tiun-demo-2026";
  const passwordHash = await bcrypt.hash(password, 10);

  const ws = await db.workspace.create({
    data: {
      name: "Akoya AI",
      slug: "akoya-ai",
      publishableKey: `pk_live_${randomBytes(12).toString("base64url")}`,
      authSettings: {
        providers: { email: true, magicLink: true, google: true, github: false, apple: false, saml: false },
        providerConfig: { google: { clientId: "1043-akoya.apps.googleusercontent.com" } },
        sessionDays: 30,
        minPasswordLength: 10,
        requireSymbols: true,
        mfa: "optional",
        allowedDomains: "",
        botProtection: true,
      },
      checkoutSettings: {
        brandColor: "#6c4cff",
        buttonStyle: "rounded",
        layout: "single",
        collectTaxId: false,
        collectAddress: true,
        allowPromoCodes: true,
        successUrl: "https://akoya.example/welcome",
        cancelUrl: "https://akoya.example/pricing",
      },
      notificationSettings: {
        failed_payment: { email: true, slack: true },
        new_subscriber: { email: true, slack: false },
        webhook_failure: { email: true, slack: true },
        weekly_report: { email: true, slack: false },
      },
      integrations: { slack: true, stripe: true, segment: false, zapier: false, hubspot: false },
    },
  });

  // ---------- team ----------
  const team = [
    { name: "Amina Mushi", email: "amina@akoya.test", role: "OWNER", title: "Founder & CEO", avatarUrl: "/avatars/amina.png", twoFactor: true },
    { name: "Neema Kweka", email: "neema@akoya.test", role: "ADMIN", title: "Customer Success Lead", avatarUrl: "/avatars/neema.png", twoFactor: true },
    { name: "Daudi Mrisho", email: "daudi@akoya.test", role: "DEVELOPER", title: "Backend Engineer", avatarUrl: null, twoFactor: false },
    { name: "Zawadi Said", email: "zawadi@akoya.test", role: "VIEWER", title: "Data Analyst", avatarUrl: null, twoFactor: false },
  ] as const;
  for (const [i, m] of team.entries()) {
    await db.teamMember.create({
      data: { ...m, workspaceId: ws.id, passwordHash, phone: "+255 7" + int(10000000, 99999999), lastActiveAt: new Date(now - i * 3 * 3600_000) },
    });
  }
  await db.invite.create({
    data: { workspaceId: ws.id, email: "omari@akoya.test", role: "DEVELOPER", token: randomBytes(18).toString("base64url"), invitedBy: "Amina Mushi", expiresAt: new Date(now + 6 * DAY) },
  });

  // ---------- plans ----------
  const planRows = [
    { name: "Monthly", model: "MONTHLY", priceCents: 999, trialDays: 14 },
    { name: "Pro", model: "MONTHLY", priceCents: 4900, trialDays: 14 },
    { name: "Team", model: "MONTHLY", priceCents: 19900, trialDays: 0 },
    { name: "Per use", model: "PER_USE", priceCents: 2, trialDays: 0 },
  ] as const;
  const plans = Object.fromEntries(
    await Promise.all(planRows.map(async (p) => [p.name, await db.plan.create({ data: { ...p, workspaceId: ws.id } })])),
  ) as Record<(typeof planRows)[number]["name"], { id: string; priceCents: number; name: string }>;

  // ---------- customers ----------
  type C = Prisma.CustomerCreateManyInput & { id: string; createdAt: Date; churnedAt: Date | null; planName: string };
  const customers: C[] = [];
  const emails = new Set<string>();
  const mkEmail = (name: string) => {
    let e = name.toLowerCase().replace(/\s+/g, ".") + "@mail.com";
    let n = 2;
    while (emails.has(e)) e = name.toLowerCase().replace(/\s+/g, ".") + n++ + "@mail.com";
    emails.add(e);
    return e;
  };

  const makeCustomer = (mode: Mode, idx: number, featured?: (typeof FEATURED)[number]): C => {
    const name = featured?.name ?? `${pick(FIRST)} ${pick(LAST)}`;
    const daysAgo = featured ? int(40, 300) : Math.floor(420 * (1 - Math.sqrt(rand())));
    const createdAt = new Date(now - daysAgo * DAY - int(0, DAY));
    let status: CustomerStatus;
    if (featured) status = featured.status;
    else if (daysAgo < 14 && rand() < 0.5) status = "TRIAL";
    else {
      const r = rand();
      status = r < 0.11 ? "CHURNED" : r < 0.16 ? "PAUSED" : "SUBSCRIBED";
    }
    const planName = featured?.plan ?? weighted<string>([["Monthly", 50], ["Pro", 14], ["Team", 4], ["Per use", 32]]);
    const churnedAt = status === "CHURNED" ? new Date(createdAt.getTime() + int(20, Math.max(21, daysAgo - 1)) * DAY) : null;
    const lastActiveAt = featured
      ? new Date(now - featured.minsAgo * 60_000)
      : churnedAt ?? new Date(now - Math.floor(-Math.log(1 - rand()) * 2.5 * DAY));
    return {
      id: randomUUID(),
      workspaceId: ws.id,
      mode,
      name,
      email: mkEmail(name),
      status,
      avatarColor: COLORS[idx % COLORS.length],
      planId: plans[planName as keyof typeof plans].id,
      planName,
      createdAt,
      churnedAt,
      lastActiveAt,
    };
  };

  FEATURED.forEach((f, i) => customers.push(makeCustomer("LIVE", i, f)));
  for (let i = 0; i < 252; i++) customers.push(makeCustomer("LIVE", i + 8));
  for (let i = 0; i < 24; i++) customers.push(makeCustomer("TEST", i));

  // ---------- usage sessions (last 60 days) ----------
  const sessions: Prisma.UsageSessionCreateManyInput[] = [];
  const lastSeen = new Map<string, number>();
  for (const c of customers) {
    const rate = { Monthly: 1.1, Pro: 2.6, Team: 4, "Per use": 0.8 }[c.planName] ?? 1;
    const from = Math.max(c.createdAt.getTime(), now - 60 * DAY);
    const to = c.churnedAt ? c.churnedAt.getTime() : c.status === "PAUSED" ? now - 21 * DAY : now;
    for (let day = from; day < to; day += DAY) {
      const count = Math.floor(rand() * rate * 2 * (c.status === "TRIAL" ? 0.6 : 1));
      for (let k = 0; k < count; k++) {
        const startedAt = new Date(Math.min(day + rand() * DAY, to - 60_000));
        const feature = weighted(FEATURES);
        const units = feature === "Image generation" ? int(1, 8) * 1000 : int(200, 24000);
        const recent = now - startedAt.getTime() < 8 * 60_000;
        sessions.push({
          id: randomUUID(),
          workspaceId: ws.id,
          mode: c.mode,
          customerId: c.id,
          feature,
          startedAt,
          durationMs: Math.round(2000 + Math.pow(rand(), 3) * 900_000),
          units,
          costCents: Math.max(1, Math.round(units * 0.002)),
          status: recent ? "RUNNING" : rand() < 0.04 ? "FAILED" : "COMPLETED",
        });
        lastSeen.set(c.id, Math.max(lastSeen.get(c.id) ?? 0, startedAt.getTime()));
      }
    }
  }
  // Keep "last activity" consistent with usage for non-featured customers.
  const featuredNames = new Set(FEATURED.map((f) => f.name));
  for (const c of customers) {
    const seen = lastSeen.get(c.id);
    if (seen && !featuredNames.has(c.name)) c.lastActiveAt = new Date(seen);
  }

  // ---------- transactions ----------
  const txs: Prisma.TransactionCreateManyInput[] = [];
  for (const c of customers) {
    if (c.status === "TRIAL") continue;
    const plan = plans[c.planName as keyof typeof plans];
    const trial = c.planName === "Monthly" || c.planName === "Pro" ? 14 * DAY : 0;
    const end = c.churnedAt?.getTime() ?? now;
    for (let t = c.createdAt.getTime() + trial; t < end; t += 30 * DAY) {
      const amount = c.planName === "Per use" ? int(80, 6400) : plan.priceCents;
      const age = now - t;
      const status: TxStatus =
        age < 2 * DAY && rand() < 0.35 ? "PENDING" : rand() < 0.035 ? "FAILED" : rand() < 0.02 ? "REFUNDED" : "SUCCEEDED";
      const [brand, last4] = weighted(METHODS);
      const label = new Date(t).toLocaleString("en-US", { month: "short", year: "numeric" });
      txs.push({
        id: randomUUID(),
        workspaceId: ws.id,
        mode: c.mode,
        customerId: c.id,
        amountCents: amount,
        refundedCents: status === "REFUNDED" ? amount : 0,
        feeCents: Math.round(amount * 0.029 + 30),
        status,
        description: c.planName === "Per use" ? `Usage · ${label}` : `${plan.name} plan · ${label}`,
        methodBrand: brand,
        methodLast4: last4(),
        createdAt: new Date(t),
      });
    }
  }

  // ---------- API keys + requests ----------
  const keyRow = (mode: Mode, name: string, scopes: string[], extra: Partial<Prisma.ApiKeyCreateManyInput> = {}) => {
    const raw = `sk_${mode === "LIVE" ? "live" : "test"}_${randomBytes(24).toString("base64url")}`;
    return { id: randomUUID(), workspaceId: ws.id, mode, name, scopes, keyHash: sha(raw), prefix: `${raw.slice(0, 8)}••••${raw.slice(-4)}`, ...extra };
  };
  const allScopes = ["customers:read", "customers:write", "sessions:read", "sessions:write", "transactions:read"];
  const keys = [
    keyRow("LIVE", "Production server", allScopes, { createdAt: new Date(now - 190 * DAY), lastUsedAt: new Date(now - 40_000) }),
    keyRow("LIVE", "Analytics export", ["customers:read", "transactions:read"], { createdAt: new Date(now - 75 * DAY), lastUsedAt: new Date(now - 5 * 3600_000) }),
    keyRow("LIVE", "Old staging key", allScopes, { createdAt: new Date(now - 320 * DAY), revokedAt: new Date(now - 120 * DAY), lastUsedAt: new Date(now - 121 * DAY) }),
    keyRow("TEST", "Local development", allScopes, { createdAt: new Date(now - 30 * DAY), lastUsedAt: new Date(now - 2 * 3600_000) }),
  ];

  const ENDPOINTS: [[string, string], number][] = [
    [["GET", "/v1/customers"], 30], [["POST", "/v1/sessions"], 34], [["GET", "/v1/transactions"], 14],
    [["POST", "/v1/customers"], 8], [["GET", "/v1/plans"], 9], [["GET", "/v1/sessions"], 5],
  ];
  const requests: Prisma.ApiRequestCreateManyInput[] = [];
  for (let d = 30; d >= 0; d--) {
    const perDay = int(70, 110) * (d === 0 ? (new Date().getHours() + 1) / 24 : 1);
    for (let k = 0; k < perDay; k++) {
      const [method, path] = weighted(ENDPOINTS);
      const r = rand();
      const statusCode = r < 0.007 ? pick([500, 502, 503]) : r < 0.045 ? pick([400, 401, 404, 422, 429]) : method === "POST" ? 201 : 200;
      const key = rand() < 0.85 ? keys[0] : keys[1];
      requests.push({
        workspaceId: ws.id,
        mode: "LIVE",
        apiKeyId: key.id,
        method,
        path,
        statusCode,
        latencyMs: Math.round(35 + Math.pow(rand(), 2.5) * 900),
        createdAt: new Date(Math.min(now - d * DAY + rand() * DAY, now - 1000)),
        requestBody: method === "POST" ? { customer: "cus_" + randomBytes(5).toString("hex"), feature: "Chat completion", units: int(100, 9000) } : undefined,
        responseBody: statusCode >= 400 ? { error: { status: statusCode, message: statusCode === 429 ? "Rate limit exceeded" : statusCode >= 500 ? "Upstream error" : "Invalid request" } } : { ok: true },
      });
    }
  }

  console.log("Inserting…");
  await insertMany("customers", customers.map(({ planName, ...c }) => c), (chunk) => db.customer.createMany({ data: chunk }));
  await insertMany("sessions", sessions, (chunk) => db.usageSession.createMany({ data: chunk }));
  await insertMany("transactions", txs, (chunk) => db.transaction.createMany({ data: chunk }));
  await db.apiKey.createMany({ data: keys });
  await insertMany("api requests", requests, (chunk) => db.apiRequest.createMany({ data: chunk }));

  await db.webhook.createMany({
    data: [
      { workspaceId: ws.id, url: "https://hooks.akoya.example/tiun", events: ["customer.created", "subscription.updated"], status: "ENABLED", lastDeliveryAt: new Date(now - 5 * 60_000) },
      { workspaceId: ws.id, url: "https://api.akoya.example/billing/webhook", events: ["transaction.succeeded", "transaction.failed", "transaction.refunded"], status: "FAILING", lastDeliveryAt: new Date(now - 47 * 60_000) },
      { workspaceId: ws.id, url: "https://relay.akoya.example/slack", events: ["session.completed"], status: "DISABLED", lastDeliveryAt: new Date(now - 12 * DAY) },
    ],
  });
  await db.coupon.createMany({
    data: [
      { workspaceId: ws.id, code: "LAUNCH20", percentOff: 20, redemptions: 143, maxRedemptions: 500, expiresAt: new Date(now + 40 * DAY) },
      { workspaceId: ws.id, code: "DVV2026", percentOff: 15, redemptions: 37, maxRedemptions: 100, expiresAt: new Date(now + 80 * DAY) },
      { workspaceId: ws.id, code: "STUDENT50", percentOff: 50, redemptions: 61, maxRedemptions: null, expiresAt: new Date(now - 10 * DAY) },
    ],
  });

  // ---------- activity feed (derived from the data above) ----------
  const live = customers.filter((c) => c.mode === "LIVE");
  const activity: Prisma.ActivityCreateManyInput[] = [
    ...live.filter((c) => now - c.createdAt.getTime() < 7 * DAY).map((c) => ({ type: "signup", message: `${c.name} signed up on ${c.planName}`, actorName: c.name, createdAt: c.createdAt })),
    ...live.filter((c) => c.churnedAt && now - c.churnedAt.getTime() < 14 * DAY).map((c) => ({ type: "churn", message: `${c.name} cancelled their subscription`, actorName: c.name, createdAt: c.churnedAt! })),
    ...txs.filter((t) => t.mode === "LIVE" && t.status === "FAILED" && now - new Date(t.createdAt).getTime() < 10 * DAY).map((t) => {
      const c = live.find((x) => x.id === t.customerId)!;
      return { type: "payment_failed", message: `Payment of $${(t.amountCents / 100).toFixed(2)} from ${c.name} failed`, actorName: c.name, createdAt: t.createdAt };
    }),
    { type: "api_key", message: "Daudi Mrisho created the API key “Analytics export”", actorName: "Daudi Mrisho", createdAt: new Date(now - 3 * DAY) },
    { type: "invite", message: "Amina Mushi invited omari@akoya.test as Developer", actorName: "Amina Mushi", createdAt: new Date(now - 1 * DAY) },
  ].map((a) => ({ ...a, workspaceId: ws.id, mode: "LIVE" as Mode }));
  await db.activity.createMany({ data: activity });
  console.log(`  activity: ${activity.length}`);

  console.log(`\nDone. Sign in as amina@akoya.test (Owner) with the SEED_PASSWORD from your .env.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
