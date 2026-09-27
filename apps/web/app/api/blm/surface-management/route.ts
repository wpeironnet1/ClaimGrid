import { NextRequest, NextResponse } from "next/server";
import { BLM_SURFACE_MANAGEMENT_LAYER, buildSurfaceManagementQuery, createSafeServerErrorEvent, sanitizeSurfaceManagementResponse, validateResearchBounds } from "@claimgrid/core";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const validation = validateResearchBounds({ west: params.get("west") ?? "", south: params.get("south") ?? "", east: params.get("east") ?? "", north: params.get("north") ?? "" });
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  try {
    const response = await fetch(buildSurfaceManagementQuery(validation.bounds), { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!response.ok) { const error = new Error(); error.name = "BlmSurfaceManagementHttpError"; throw error; }
    const summary = sanitizeSurfaceManagementResponse(await response.json());
    if (!summary) { const error = new Error(); error.name = "BlmSurfaceManagementPayloadError"; throw error; }
    return NextResponse.json({ ...summary, metadata: { source: "U.S. Bureau of Land Management — Surface Management Agency", sourceUrl: BLM_SURFACE_MANAGEMENT_LAYER, retrievedAt: new Date().toISOString(), screeningOnly: true, warning: "Surface management does not establish mineral ownership, land open to mineral entry, withdrawal status, access rights, or claim availability. Verify the mineral estate and current land-status records with every responsible authority." } }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch (error) {
    console.error(JSON.stringify(createSafeServerErrorEvent({ error, method: "GET", route: "/api/blm/surface-management", routeType: "route", release: process.env.VERCEL_GIT_COMMIT_SHA })));
    return NextResponse.json({ error: "The official BLM surface-management layer is temporarily unavailable. No land-status conclusion can be drawn." }, { status: 502 });
  }
}
