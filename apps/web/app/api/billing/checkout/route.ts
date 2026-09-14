import { billingPlans, billingConfiguration, isStripePriceId, parseBillingPlan } from "@claimgrid/core";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const expectedOrigin = request.nextUrl.origin;
  if (request.headers.get("origin") !== expectedOrigin) return NextResponse.json({ error: "Invalid checkout origin." }, { status: 403 });
  const form = await request.formData();
  const plan = parseBillingPlan(form.get("plan"));
  if (!plan) return NextResponse.json({ error: "Select a valid ClaimGrid plan." }, { status: 400 });

  const configuration = billingConfiguration(process.env);
  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env[billingPlans[plan].priceEnvironmentKey];
  if (!configuration.ready || !secret || !isStripePriceId(priceId)) {
    return NextResponse.json({ error: "Secure checkout is not configured yet. No payment was attempted." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${expectedOrigin}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${expectedOrigin}/pricing?checkout=cancelled`,
    allow_promotion_codes: "true"
  });
  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store"
    });
    const payload = await response.json() as { url?: string; error?: { message?: string } };
    if (!response.ok || !payload.url || !payload.url.startsWith("https://checkout.stripe.com/")) throw new Error("Stripe checkout creation failed.");
    return NextResponse.redirect(payload.url, 303);
  } catch {
    return NextResponse.json({ error: "Checkout is temporarily unavailable. No payment was completed." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
