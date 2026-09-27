import { billingConfiguration, createSafeServerErrorEvent, parseAccountSessionToken, parseStripeBillingProfile, parseVerifiedAccountSession } from "@claimgrid/core";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const expectedOrigin = request.nextUrl.origin;
  if (request.headers.get("origin") !== expectedOrigin) return NextResponse.json({ error: "Invalid billing portal origin." }, { status: 403, headers: noStore });
  const configuration = billingConfiguration(process.env);
  if (!configuration.portalConfigured || !configuration.accountConfigured || !configuration.secretConfigured) return NextResponse.json({ error: "Subscription management is not configured yet." }, { status: 503, headers: noStore });
  const sessionToken = parseAccountSessionToken(request.cookies.get("claimgrid_session")?.value);
  if (!sessionToken) return NextResponse.json({ error: "Sign in to manage your subscription." }, { status: 401, headers: noStore });
  try {
    const sessionResponse = await fetch(process.env.CLAIMGRID_ACCOUNT_SESSION_URL!, { method: "POST", headers: { Authorization: `Bearer ${process.env.CLAIMGRID_ACCOUNT_SESSION_TOKEN}`, "Content-Type": "application/json", "X-ClaimGrid-Session": sessionToken }, body: "{}", cache: "no-store", signal: AbortSignal.timeout(5000) });
    const rawSession = await sessionResponse.text();
    if (!sessionResponse.ok || rawSession.length > 8192) throw new Error("Session verification failed");
    const account = parseVerifiedAccountSession(JSON.parse(rawSession));
    if (!account) throw new Error("Session verification failed");
    const profileResponse = await fetch(process.env.CLAIMGRID_BILLING_PROFILE_URL!, { method: "POST", headers: { Authorization: `Bearer ${process.env.CLAIMGRID_BILLING_PROFILE_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ schemaVersion: 1, accountId: account.accountId }), cache: "no-store", signal: AbortSignal.timeout(5000) });
    const rawProfile = await profileResponse.text();
    if (!profileResponse.ok || rawProfile.length > 8192) throw new Error("Billing profile lookup failed");
    const profile = parseStripeBillingProfile(JSON.parse(rawProfile), account.accountId);
    if (!profile) throw new Error("Billing profile lookup failed");
    const stripeResponse = await fetch("https://api.stripe.com/v1/billing_portal/sessions", { method: "POST", headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ customer: profile.customerId, return_url: `${expectedOrigin}/pricing` }), cache: "no-store", signal: AbortSignal.timeout(8000) });
    const rawPortal = await stripeResponse.text();
    if (!stripeResponse.ok || rawPortal.length > 16384) throw new Error("Stripe portal creation failed");
    const portal = JSON.parse(rawPortal) as { url?: unknown };
    if (typeof portal.url !== "string" || !portal.url.startsWith("https://billing.stripe.com/")) throw new Error("Stripe portal creation failed");
    return NextResponse.redirect(portal.url, 303);
  } catch (error) {
    console.error(JSON.stringify(createSafeServerErrorEvent({ error, method: "POST", route: "/api/billing/portal", routeType: "route", release: process.env.VERCEL_GIT_COMMIT_SHA })));
    return NextResponse.json({ error: "Subscription management is temporarily unavailable. No billing change was made." }, { status: 503, headers: noStore });
  }
}
