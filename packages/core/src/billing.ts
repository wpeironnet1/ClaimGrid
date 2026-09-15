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

export function billingConfiguration(environment: Record<string, string | undefined>) {
  const secretConfigured = typeof environment.STRIPE_SECRET_KEY === "string" && /^sk_(test|live)_[A-Za-z0-9]+$/.test(environment.STRIPE_SECRET_KEY);
  const monthlyConfigured = isStripePriceId(environment.STRIPE_PRO_MONTHLY_PRICE_ID);
  const annualConfigured = isStripePriceId(environment.STRIPE_PRO_ANNUAL_PRICE_ID);
  const webhookConfigured = typeof environment.STRIPE_WEBHOOK_SECRET === "string" && /^whsec_[A-Za-z0-9]+$/.test(environment.STRIPE_WEBHOOK_SECRET);
  const fulfillmentUrl = environment.CLAIMGRID_ENTITLEMENT_STORE_URL;
  const fulfillmentConfigured = typeof fulfillmentUrl === "string" && /^https:\/\//.test(fulfillmentUrl) && typeof environment.CLAIMGRID_ENTITLEMENT_STORE_TOKEN === "string" && environment.CLAIMGRID_ENTITLEMENT_STORE_TOKEN.length >= 32;
  return { ready: secretConfigured && monthlyConfigured && annualConfigured && webhookConfigured && fulfillmentConfigured, secretConfigured, monthlyConfigured, annualConfigured, webhookConfigured, fulfillmentConfigured };
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
