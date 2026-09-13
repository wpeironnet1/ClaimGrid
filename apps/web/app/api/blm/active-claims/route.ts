import { NextRequest, NextResponse } from "next/server";
import { buildActiveClaimsQuery, validateResearchBounds } from "@claimgrid/core";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const validation = validateResearchBounds({ west: params.get("west") ?? "", south: params.get("south") ?? "", east: params.get("east") ?? "", north: params.get("north") ?? "" });
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  try {
    const response = await fetch(buildActiveClaimsQuery(validation.bounds), { headers: { Accept: "application/geo+json, application/json" }, next: { revalidate: 900 }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`BLM returned ${response.status}`);
    const geojson = await response.json();
    if (!geojson || geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) throw new Error("Unexpected BLM response");
    return NextResponse.json({ type: "FeatureCollection", features: geojson.features, metadata: { source: "U.S. Bureau of Land Management — MLRS Active Mining Claims", sourceUrl: "https://gis.blm.gov/nlsdb/rest/services/Mining_Claims/MiningClaims/MapServer/1", retrievedAt: new Date().toISOString(), resultLimit: 1000, exceededLimit: geojson.exceededTransferLimit === true || geojson.features.length === 1000, screeningOnly: true, warning: "A missing map feature does not establish that land is open to mineral entry. Verify land status, withdrawals, official records, and existing monuments on the ground." } }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch (error) {
    console.error("BLM active claims request failed", error);
    return NextResponse.json({ error: "The official BLM layer is temporarily unavailable. No availability conclusion can be drawn." }, { status: 502 });
  }
}
