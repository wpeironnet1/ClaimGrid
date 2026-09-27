import { NextResponse } from "next/server";
import { assessArcGisLayerMetadata, BLM_ACTIVE_CLAIMS_LAYER, BLM_SURFACE_MANAGEMENT_LAYER, BLM_WITHDRAWALS_SERVICE, createSafeServerErrorEvent } from "@claimgrid/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(){
  const checkedAt=new Date().toISOString();
  try{
    const definitions = [
      { id: "active-claims", source: "MLRS Active Mining Claims", sourceUrl: BLM_ACTIVE_CLAIMS_LAYER, layerName: "Active Mining Claims", requiredFields: ["OBJECTID","CSE_NR","CSE_NAME","CSE_DISP","BLM_PROD","QLTY","RCRD_ACRS","GEO_STATE"] },
      { id: "surface-management", source: "Surface Management Agency", sourceUrl: BLM_SURFACE_MANAGEMENT_LAYER, layerName: "Surface Management Agency", requiredFields: ["ADMIN_AGENCY_CODE","ADMIN_UNIT_NAME","ADMIN_UNIT_TYPE","ADMIN_ST"] },
      { id: "withdrawals-authorized", source: "MLRS Withdrawals — Authorized/Interim", sourceUrl: `${BLM_WITHDRAWALS_SERVICE}/0`, layerName: "Authorized/Interim", requiredFields: ["CSE_NR","CSE_NAME","CSE_DISP","SEG_MIN","SEG_SUR","QLTY","GEO_STATE"] },
      { id: "withdrawals-pending", source: "MLRS Withdrawals — Pending", sourceUrl: `${BLM_WITHDRAWALS_SERVICE}/1`, layerName: "Pending", requiredFields: ["CSE_NR","CSE_NAME","CSE_DISP","SEG_MIN","SEG_SUR","QLTY","GEO_STATE"] },
    ] as const;
    const results = await Promise.all(definitions.map(async definition => {
      try {
        const response=await fetch(`${definition.sourceUrl}?f=json`,{headers:{Accept:"application/json"},next:{revalidate:300},signal:AbortSignal.timeout(8000)});
        if(!response.ok) throw new Error();
        const assessment=assessArcGisLayerMetadata(await response.json(), { layerName: definition.layerName, geometryType: "esriGeometryPolygon", requiredFields: definition.requiredFields });
        return { id: definition.id, source: definition.source, sourceUrl: definition.sourceUrl, status: assessment.compatible ? "operational" : "degraded", schemaCompatible: assessment.compatible, layerName: assessment.layerName, serviceVersion: assessment.serviceVersion, upstreamLastEditedAt: assessment.upstreamLastEditedAt, issues: assessment.issues };
      } catch {
        return { id: definition.id, source: definition.source, sourceUrl: definition.sourceUrl, status: "unavailable", schemaCompatible: false, layerName: null, serviceVersion: null, upstreamLastEditedAt: null, issues: ["The official layer could not be verified."] };
      }
    }));
    const unavailable = results.filter(result => result.status === "unavailable").length;
    const degraded = results.filter(result => result.status === "degraded").length;
    const status = unavailable === results.length ? "unavailable" : unavailable || degraded ? "degraded" : "operational";
    return NextResponse.json({
      status,
      source:"U.S. Bureau of Land Management — live map dependencies",
      checkedAt,
      schemaCompatible:results.every(result => result.schemaCompatible),
      issues:results.flatMap(result => result.issues.map(issue => `${result.source}: ${issue}`)),
      sources:results,
      freshnessCaveat:"Service availability and an edit timestamp do not establish legal currency, completeness, or land availability. Verify authoritative records and land status before acting."
    },{status:status === "operational"?200:503,headers:{"Cache-Control":"public, s-maxage=300, stale-while-revalidate=300"}});
  }catch(error){
    console.error(JSON.stringify(createSafeServerErrorEvent({ error, method: "GET", route: "/api/health/sources", routeType: "route", release: process.env.VERCEL_GIT_COMMIT_SHA })));
    return NextResponse.json({status:"unavailable",source:"U.S. Bureau of Land Management — MLRS Active Mining Claims",sourceUrl:BLM_ACTIVE_CLAIMS_LAYER,checkedAt,schemaCompatible:false,issues:["The official source could not be verified."],freshnessCaveat:"No availability or legal conclusion can be drawn while the source is unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
