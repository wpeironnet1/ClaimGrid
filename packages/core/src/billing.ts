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
  return { ready: secretConfigured && monthlyConfigured && annualConfigured, secretConfigured, monthlyConfigured, annualConfigured };
}
