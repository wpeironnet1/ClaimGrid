import { billingConfiguration } from "./billing";
import { normalizePublicSiteOrigin } from "./site-discovery";

export interface LaunchReadinessCheck {
  id: "canonical-origin" | "billing" | "accounts" | "release-traceability";
  status: "ready" | "action-required";
  summary: string;
}

export function assessLaunchReadiness(environment: Record<string, string | undefined>): {
  status: "ready" | "action-required";
  checks: LaunchReadinessCheck[];
} {
  const originReady = normalizePublicSiteOrigin(
    environment.NEXT_PUBLIC_SITE_URL ?? environment.VERCEL_PROJECT_PRODUCTION_URL ?? environment.VERCEL_URL
  ) !== null;
  const billingReady = billingConfiguration(environment).ready;
  const accountsReady = billingConfiguration(environment).accountConfigured;
  const releaseReady = typeof environment.VERCEL_GIT_COMMIT_SHA === "string" && /^[a-f0-9]{7,64}$/i.test(environment.VERCEL_GIT_COMMIT_SHA);
  const checks: LaunchReadinessCheck[] = [
    { id: "canonical-origin", status: originReady ? "ready" : "action-required", summary: originReady ? "A validated HTTPS production origin is configured." : "Configure NEXT_PUBLIC_SITE_URL or a Vercel production URL." },
    { id: "billing", status: billingReady ? "ready" : "action-required", summary: billingReady ? "Stripe checkout, webhook verification, prices, and entitlement fulfillment are configured." : "Stripe credentials, both price IDs, webhook signing, and durable entitlement fulfillment are required before paid access." },
    { id: "accounts", status: accountsReady ? "ready" : "action-required", summary: accountsReady ? "Checkout can verify an authenticated account through the configured server-side session service." : "Connect a server-side account session verifier before checkout can accept payment." },
    { id: "release-traceability", status: releaseReady ? "ready" : "action-required", summary: releaseReady ? "Deployment errors can be correlated to a release commit." : "Expose the deployment commit SHA for release-level monitoring." }
  ];
  return { status: checks.every(check => check.status === "ready") ? "ready" : "action-required", checks };
}
