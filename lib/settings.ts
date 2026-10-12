/** Typed views over the JSON settings columns on Workspace, with defaults for missing keys. */

export const PROVIDERS = [
  { key: "email", name: "Email + password", desc: "Classic sign-in with a password", needsClient: false, color: "#5b5650" },
  { key: "magicLink", name: "Magic link", desc: "One-time sign-in link by email", needsClient: false, color: "#6c4cff" },
  { key: "google", name: "Google", desc: "Sign in with a Google account", needsClient: true, color: "#2f6fdc" },
  { key: "github", name: "GitHub", desc: "For developer audiences", needsClient: true, color: "#24292f" },
  { key: "apple", name: "Apple", desc: "Required for many iOS apps", needsClient: true, color: "#111111" },
  { key: "saml", name: "SAML SSO", desc: "Okta, Azure AD and other IdPs", needsClient: true, color: "#2f7a64" },
] as const;

export type ProviderKey = (typeof PROVIDERS)[number]["key"];

export type AuthSettings = {
  providers: Record<ProviderKey, boolean>;
  providerConfig: Partial<Record<ProviderKey, { clientId?: string }>>;
  sessionDays: number;
  minPasswordLength: number;
  requireSymbols: boolean;
  mfa: "off" | "optional" | "required";
  allowedDomains: string;
  botProtection: boolean;
};

export function readAuth(json: unknown): AuthSettings {
  const j = (json ?? {}) as Partial<AuthSettings>;
  return {
    providers: { email: true, magicLink: false, google: false, github: false, apple: false, saml: false, ...j.providers },
    providerConfig: j.providerConfig ?? {},
    sessionDays: j.sessionDays ?? 30,
    minPasswordLength: j.minPasswordLength ?? 10,
    requireSymbols: j.requireSymbols ?? true,
    mfa: j.mfa ?? "optional",
    allowedDomains: j.allowedDomains ?? "",
    botProtection: j.botProtection ?? true,
  };
}

export type CheckoutSettings = {
  brandColor: string;
  buttonStyle: "rounded" | "square" | "pill";
  layout: "single" | "split";
  collectTaxId: boolean;
  collectAddress: boolean;
  allowPromoCodes: boolean;
  successUrl: string;
  cancelUrl: string;
};

export function readCheckout(json: unknown): CheckoutSettings {
  const j = (json ?? {}) as Partial<CheckoutSettings>;
  return {
    brandColor: j.brandColor ?? "#6c4cff",
    buttonStyle: j.buttonStyle ?? "rounded",
    layout: j.layout ?? "single",
    collectTaxId: j.collectTaxId ?? false,
    collectAddress: j.collectAddress ?? true,
    allowPromoCodes: j.allowPromoCodes ?? true,
    successUrl: j.successUrl ?? "",
    cancelUrl: j.cancelUrl ?? "",
  };
}

export const NOTIFICATION_EVENTS = [
  { key: "failed_payment", title: "Failed payment", desc: "A customer’s card or mobile money payment is declined" },
  { key: "new_subscriber", title: "New subscriber", desc: "Someone starts a paid plan" },
  { key: "webhook_failure", title: "Webhook failure", desc: "An endpoint fails 3 deliveries in a row" },
  { key: "weekly_report", title: "Weekly report", desc: "Revenue and growth summary every Monday" },
] as const;

export type NotificationSettings = Record<string, { email: boolean; slack: boolean }>;

export function readNotifications(json: unknown): NotificationSettings {
  const j = (json ?? {}) as NotificationSettings;
  return Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e.key, { email: j[e.key]?.email ?? true, slack: j[e.key]?.slack ?? false }]));
}

export const INTEGRATIONS = [
  { key: "slack", name: "Slack", desc: "Alerts in your team channels", color: "#4a154b" },
  { key: "stripe", name: "Stripe", desc: "Card processing and payouts", color: "#635bff" },
  { key: "segment", name: "Segment", desc: "Send events to your warehouse", color: "#52bd94" },
  { key: "zapier", name: "Zapier", desc: "Automate with 6,000+ apps", color: "#ff4f00" },
  { key: "hubspot", name: "HubSpot", desc: "Sync customers to your CRM", color: "#ff7a59" },
] as const;
