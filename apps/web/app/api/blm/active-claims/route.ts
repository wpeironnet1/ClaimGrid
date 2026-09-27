import { NextRequest, NextResponse } from "next/server";
import { buildActiveClaimsQuery, createBlmResultMetadata, createSafeServerErrorEvent, sanitizeActiveClaimsGeoJson, validateResearchBounds } from "@claimgrid/core";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const validation = validateResearchBounds({ west: params.get("west") ?? "", south: params.get("south") ?? "", east: params.get("east") ?? "", north: params.get("north") ?? "" });
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  try {
    const response = await fetch(buildActiveClaimsQuery(validation.bounds), { headers: { Accept: "application/geo+json, application/json" }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!response.ok) { const error = new Error(); error.name = "BlmUpstreamHttpError"; throw error; }
    const geojson: unknown = await response.json();
    const retrievedAt = new Date().toISOString();
    const sanitized = sanitizeActiveClaimsGeoJson(geojson);
    if (!sanitized.ok) { const error = new Error(); error.name = "BlmPayloadValidationError"; throw error; }
    const collection = sanitized.collection;
    return NextResponse.json({ type: "FeatureCollection", features: collection.features, metadata: createBlmResultMetadata(collection, retrievedAt) }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch (error) {
    console.error(JSON.stringify(createSafeServerErrorEvent({ error, method: "GET", route: "/api/blm/active-claims", routeType: "route", release: process.env.VERCEL_GIT_COMMIT_SHA })));
    return NextResponse.json({ error: "The official BLM layer is temporarily unavailable. No availability conclusion can be drawn." }, { status: 502 });
  }
}
