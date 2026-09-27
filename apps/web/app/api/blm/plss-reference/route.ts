import { NextRequest, NextResponse } from "next/server";
import { BLM_PLSS_SERVICE, buildPlssQuery, createSafeServerErrorEvent, sanitizePlssResponse, validateResearchBounds } from "@claimgrid/core";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const validation = validateResearchBounds({ west: params.get("west") ?? "", south: params.get("south") ?? "", east: params.get("east") ?? "", north: params.get("north") ?? "" });
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  try {
    const fetchLayer = async (kind: "township" | "section") => {
      const response = await fetch(buildPlssQuery(validation.bounds, kind), { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
      if (!response.ok) { const error = new Error(); error.name = "BlmPlssHttpError"; throw error; }
      const records = sanitizePlssResponse(await response.json(), kind);
      if (!records) { const error = new Error(); error.name = "BlmPlssPayloadError"; throw error; }
      return records;
    };
    const [townships, sections] = await Promise.all([fetchLayer("township"), fetchLayer("section")]);
    return NextResponse.json({
      center: { longitude: (validation.bounds.west + validation.bounds.east) / 2, latitude: (validation.bounds.south + validation.bounds.north) / 2 },
      townships,
      sections,
      metadata: {
        source: "U.S. Bureau of Land Management — National Public Land Survey System",
        sourceUrl: BLM_PLSS_SERVICE,
        retrievedAt: new Date().toISOString(),
        referenceOnly: true,
        warning: "PLSS GIS references are screening aids, not surveys, boundary determinations, title evidence, or filing-ready legal descriptions. Verify the controlling survey plat, field monuments, legal description, county and BLM records, and any special or non-rectangular survey with the responsible cadastral authority.",
      },
    }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch (error) {
    console.error(JSON.stringify(createSafeServerErrorEvent({ error, method: "GET", route: "/api/blm/plss-reference", routeType: "route", release: process.env.VERCEL_GIT_COMMIT_SHA })));
    return NextResponse.json({ error: "The official BLM PLSS reference layers are temporarily unavailable. Do not infer a legal description or boundary from this failure." }, { status: 502 });
  }
}
