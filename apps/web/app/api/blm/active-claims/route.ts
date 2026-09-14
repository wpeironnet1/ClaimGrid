import { NextRequest, NextResponse } from "next/server";
import { buildActiveClaimsQuery, sanitizeActiveClaimsGeoJson, validateResearchBounds } from "@claimgrid/core";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const validation = validateResearchBounds({ west: params.get("west") ?? "", south: params.get("south") ?? "", east: params.get("east") ?? "", north: params.get("north") ?? "" });
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  try {
    const response = await fetch(buildActiveClaimsQuery(validation.bounds), { headers: { Accept: "application/geo+json, application/json" }, next: { revalidate: 900 }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`BLM returned ${response.status}`);
    const geojson: unknown = await response.json();
    const sanitized = sanitizeActiveClaimsGeoJson(geojson);
    if (!sanitized.ok) throw new Error(sanitized.error);
    const collection = sanitized.collection;
    return NextResponse.json({ type: "FeatureCollection", features: collection.features, metadata: { source: "U.S. Bureau of Land Management — MLRS Active Mining Claims", sourceUrl: "https://gis.blm.gov/nlsdb/rest/services/Mining_Claims/MiningClaims/MapServer/1", retrievedAt: new Date().toISOString(), resultLimit: 1000, exceededLimit: collection.exceededTransferLimit || collection.features.length === 1000, screeningOnly: true, warning: "A missing map feature does not establish that land is open to mineral entry. Verify land status, withdrawals, official records, and existing monuments on the ground." } }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch (error) {
    console.error("BLM active claims request failed", error);
    return NextResponse.json({ error: "The official BLM layer is temporarily unavailable. No availability conclusion can be drawn." }, { status: 502 });
  }
}
