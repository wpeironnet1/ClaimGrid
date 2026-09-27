export const billingPlans = {
  monthly: { label: "Monthly", displayPrice: "$19", cadence: "month", priceEnvironmentKey: "STRIPE_PRO_MONTHLY_PRICE_ID" },
  annual: { label: "Annual", displayPrice: "$180", cadence: "year", priceEnvironmentKey: "STRIPE_PRO_ANNUAL_PRICE_ID" }
} as const;

export type BillingPlan = keyof typeof billingPlans;

export function parseBillingPlan(value: unknown): BillingPlan | null {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(billingPlans, value) ? value as BillingPlan : null;
}

export function isStripePriceId(value: unknown): value is string {
  return typeof value === "string" && /^price_[A-Za-z0-9]+$/.test(value);
}

export type StripeMode = "test" | "live";

export function stripeSecretMode(value: unknown): StripeMode | null {
  if (typeof value !== "string") return null;
  const match = /^sk_(test|live)_[A-Za-z0-9]+$/.exec(value);
  return match ? match[1] as StripeMode : null;
}

function isHttpsServiceEndpoint(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

export function parseAccountSessionToken(value: unknown): string | null {
  return typeof value === "string" && value.length >= 32 && value.length <= 512 && /^[A-Za-z0-9._~-]+$/.test(value) ? value : null;
}

export interface VerifiedAccountSession {
  accountId: string;
  email: string;
}

export function parseVerifiedAccountSession(value: unknown): VerifiedAccountSession | null {
  if (!value || typeof value !== "object") return null;
  const session = value as { active?: unknown; accountId?: unknown; email?: unknown };
  if (session.active !== true || typeof session.accountId !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(session.accountId)) return null;
  if (typeof session.email !== "string" || session.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(session.email)) return null;
  return { accountId: session.accountId, email: session.email };
}

export function billingConfiguration(environment: Record<string, string | undefined>) {
  const secretConfigured = stripeSecretMode(environment.STRIPE_SECRET_KEY) !== null;
  const monthlyConfigured = isStripePriceId(environment.STRIPE_PRO_MONTHLY_PRICE_ID);
  const annualConfigured = isStripePriceId(environment.STRIPE_PRO_ANNUAL_PRICE_ID);
  const webhookConfigured = typeof environment.STRIPE_WEBHOOK_SECRET === "string" && /^whsec_[A-Za-z0-9]+$/.test(environment.STRIPE_WEBHOOK_SECRET);
  const fulfillmentUrl = environment.CLAIMGRID_ENTITLEMENT_STORE_URL;
  const fulfillmentConfigured = isHttpsServiceEndpoint(fulfillmentUrl) && typeof environment.CLAIMGRID_ENTITLEMENT_STORE_TOKEN === "string" && environment.CLAIMGRID_ENTITLEMENT_STORE_TOKEN.length >= 32;
  const accountSessionUrl = environment.CLAIMGRID_ACCOUNT_SESSION_URL;
  const accountConfigured = isHttpsServiceEndpoint(accountSessionUrl) && typeof environment.CLAIMGRID_ACCOUNT_SESSION_TOKEN === "string" && environment.CLAIMGRID_ACCOUNT_SESSION_TOKEN.length >= 32;
  return { ready: secretConfigured && monthlyConfigured && annualConfigured && webhookConfigured && fulfillmentConfigured && accountConfigured, secretConfigured, monthlyConfigured, annualConfigured, webhookConfigured, fulfillmentConfigured, accountConfigured };
}

export function parseStripeSignatureHeader(header: string | null) {
  if (!header) return null;
  const values = header.split(",").map(item => item.trim().split("=", 2));
  const timestampValue = values.find(([key]) => key === "t")?.[1];
  const signatures = values.filter(([key, value]) => key === "v1" && /^[a-f0-9]{64}$/.test(value ?? "")).map(([, value]) => value);
  const timestamp = Number(timestampValue);
  return Number.isSafeInteger(timestamp) && timestamp > 0 && signatures.length ? { timestamp, signatures } : null;
}

export const fulfilledStripeEventTypes = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed"
]);

export interface StripeWebhookEnvelope {
  id: string;
  type: string;
  livemode: boolean;
  created: number;
  objectType: string;
}

const fulfillmentObjectTypes: Record<string, string> = {
  "checkout.session.completed": "checkout.session",
  "customer.subscription.created": "subscription",
  "customer.subscription.updated": "subscription",
  "customer.subscription.deleted": "subscription",
  "invoice.payment_failed": "invoice"
};

export function parseStripeWebhookEnvelope(value: unknown): StripeWebhookEnvelope | null {
  if (!value || typeof value !== "object") return null;
  const event = value as { id?: unknown; type?: unknown; livemode?: unknown; created?: unknown; data?: unknown };
  if (typeof event.id !== "string" || !/^evt_[A-Za-z0-9]{1,240}$/.test(event.id)) return null;
  if (typeof event.type !== "string" || event.type.length > 120 || !/^[a-z0-9_.]+$/.test(event.type)) return null;
  if (typeof event.livemode !== "boolean" || !Number.isSafeInteger(event.created) || (event.created as number) <= 0) return null;
  if (!event.data || typeof event.data !== "object") return null;
  const object = (event.data as { object?: unknown }).object;
  if (!object || typeof object !== "object") return null;
  const objectType = (object as { object?: unknown }).object;
  if (typeof objectType !== "string" || !/^[a-z0-9_.]+$/.test(objectType)) return null;
  return { id: event.id, type: event.type, livemode: event.livemode, created: event.created as number, objectType };
}

export function isStripeFulfillmentEventSafe(event: StripeWebhookEnvelope, secretKey: unknown): boolean {
  const mode = stripeSecretMode(secretKey);
  if (!mode || event.livemode !== (mode === "live")) return false;
  const expectedObject = fulfillmentObjectTypes[event.type];
  return typeof expectedObject === "string" && event.objectType === expectedObject;
}
