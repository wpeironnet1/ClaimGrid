import { NextRequest, NextResponse } from "next/server";
import { BLM_WITHDRAWALS_SERVICE, buildWithdrawalsQuery, createSafeServerErrorEvent, sanitizeWithdrawalResponse, validateResearchBounds } from "@claimgrid/core";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const validation = validateResearchBounds({ west: params.get("west") ?? "", south: params.get("south") ?? "", east: params.get("east") ?? "", north: params.get("north") ?? "" });
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  try {
    const [authorizedResponse, pendingResponse] = await Promise.all(["authorized-interim", "pending"].map(status => fetch(buildWithdrawalsQuery(validation.bounds, status as "authorized-interim" | "pending"), { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12_000) })));
    if (!authorizedResponse.ok || !pendingResponse.ok) { const error = new Error(); error.name = "BlmWithdrawalsHttpError"; throw error; }
    const [authorized, pending] = await Promise.all([authorizedResponse.json(), pendingResponse.json()]);
    const authorizedSummary = sanitizeWithdrawalResponse(authorized, "authorized-interim");
    const pendingSummary = sanitizeWithdrawalResponse(pending, "pending");
    if (!authorizedSummary || !pendingSummary) { const error = new Error(); error.name = "BlmWithdrawalsPayloadError"; throw error; }
    return NextResponse.json({ records: [...authorizedSummary.records, ...pendingSummary.records], exceededLimit: authorizedSummary.exceededLimit || pendingSummary.exceededLimit, metadata: { source: "U.S. Bureau of Land Management — MLRS Withdrawal Cases", sourceUrl: BLM_WITHDRAWALS_SERVICE, retrievedAt: new Date().toISOString(), screeningOnly: true, warning: "Mapped withdrawal cases are incomplete screening evidence. Some MLRS cases cannot be geocoded, geometries have varying data quality, and case terms determine legal effect. Verify current case records, mineral segregation, legal descriptions, and land open to mineral entry with BLM and other responsible authorities." } }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch (error) {
    console.error(JSON.stringify(createSafeServerErrorEvent({ error, method: "GET", route: "/api/blm/withdrawals", routeType: "route", release: process.env.VERCEL_GIT_COMMIT_SHA })));
    return NextResponse.json({ error: "The official BLM withdrawal layers are temporarily unavailable. No withdrawal or mineral-entry conclusion can be drawn." }, { status: 502 });
  }
}
