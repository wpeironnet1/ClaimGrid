import { billingConfiguration } from "@claimgrid/core";
import "./pricing.css";

export const metadata = { title: "Pricing — ClaimGrid", description: "Compare ClaimGrid's free research tools and planned Pro workspace." };

export default function PricingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const configured = billingConfiguration(process.env);
  return <main className="pricingPage"><nav><a href="/">← ClaimGrid</a><a href="/privacy">Privacy</a></nav><section className="pricingIntro"><span>PLANS</span><h1>Research stays open.<br/><em>Organization goes Pro.</em></h1><p>Use official-source screening and educational workflows free. Pro is for researchers who need durable project organization, field evidence, filing preparation, and reminders.</p></section>
    <section className="plans">
      <article><small>FREE</small><h2>$0</h2><p>For careful early research.</p><ul><li>Live BLM active-claim screening</li><li>Nationwide custom research areas</li><li>Official-source safety guidance</li><li>State workflow previews</li></ul><a href="/explore">Open the map</a></article>
      <article className="pro"><small>PRO · PLANNED</small><h2>$19 <span>/ month</span></h2><p>Or $180 annually. Pricing remains clearly labeled as planned until billing and account delivery are verified.</p><ul><li>Saved project synchronization</li><li>Document preparation workspaces</li><li>Field evidence backup</li><li>Deadline monitoring</li></ul>
      {configured.ready ? <div className="checkoutChoices"><form action="/api/billing/checkout" method="post"><input type="hidden" name="plan" value="monthly"/><button>Choose monthly</button></form><form action="/api/billing/checkout" method="post"><input type="hidden" name="plan" value="annual"/><button>Choose annual — save $48</button></form></div> : <div className="notReady" role="status"><b>Checkout is not open yet.</b><span>No payment can be submitted until ClaimGrid’s Stripe account, products, webhook fulfillment, and account access are verified.</span></div>}
      </article>
    </section><aside><b>Payment safety boundary</b><p>ClaimGrid will not call a payment successful or unlock Pro from a return URL alone. Subscription access must be fulfilled from a verified Stripe webhook and tied to an authenticated account before launch.</p></aside></main>;
}
