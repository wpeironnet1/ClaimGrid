import { createHmac, timingSafeEqual } from "node:crypto";
import { fulfilledStripeEventTypes, parseStripeSignatureHeader } from "@claimgrid/core";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const MAX_EVENT_BYTES = 1_000_000;
const MAX_AGE_SECONDS = 300;

function matchesSignature(expected: string, candidates: string[]) {
  const expectedBytes = Buffer.from(expected, "hex");
  return candidates.some(candidate => { const bytes=Buffer.from(candidate,"hex"); return bytes.length===expectedBytes.length && timingSafeEqual(bytes,expectedBytes); });
}

export async function POST(request: NextRequest) {
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !/^whsec_[A-Za-z0-9]+$/.test(secret)) return NextResponse.json({error:"Webhook unavailable."},{status:503});
  const declared=Number(request.headers.get("content-length") ?? "0");
  if (declared>MAX_EVENT_BYTES) return NextResponse.json({error:"Event too large."},{status:413});
  const raw=await request.text();
  if (Buffer.byteLength(raw,"utf8")>MAX_EVENT_BYTES) return NextResponse.json({error:"Event too large."},{status:413});
  const signature=parseStripeSignatureHeader(request.headers.get("stripe-signature"));
  if (!signature || Math.abs(Math.floor(Date.now()/1000)-signature.timestamp)>MAX_AGE_SECONDS) return NextResponse.json({error:"Invalid webhook signature."},{status:400});
  const expected=createHmac("sha256",secret).update(`${signature.timestamp}.${raw}`).digest("hex");
  if (!matchesSignature(expected,signature.signatures)) return NextResponse.json({error:"Invalid webhook signature."},{status:400});

  let event: { id?: unknown; type?: unknown };
  try { event=JSON.parse(raw); } catch { return NextResponse.json({error:"Invalid event body."},{status:400}); }
  if (typeof event.id!=="string" || typeof event.type!=="string") return NextResponse.json({error:"Invalid event shape."},{status:400});
  if (!fulfilledStripeEventTypes.has(event.type)) return NextResponse.json({received:true,handled:false});
  const destination=process.env.CLAIMGRID_ENTITLEMENT_STORE_URL;
  const token=process.env.CLAIMGRID_ENTITLEMENT_STORE_TOKEN;
  if (!destination || !destination.startsWith("https://") || !token || token.length<32) return NextResponse.json({error:"Durable entitlement fulfillment is unavailable; Stripe should retry."},{status:503});
  try {
    const response=await fetch(destination,{method:"POST",headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json","X-ClaimGrid-Stripe-Event":event.id},body:raw,cache:"no-store"});
    if (!response.ok) throw new Error("Fulfillment rejected");
    return NextResponse.json({received:true,handled:true});
  } catch {
    return NextResponse.json({error:"Entitlement fulfillment failed; Stripe should retry."},{status:503});
  }
}
