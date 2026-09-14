import { NextResponse } from "next/server";
import { assessBlmLayerMetadata, BLM_ACTIVE_CLAIMS_LAYER } from "@claimgrid/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(){
  const checkedAt=new Date().toISOString();
  try{
    const response=await fetch(`${BLM_ACTIVE_CLAIMS_LAYER}?f=json`,{headers:{Accept:"application/json"},next:{revalidate:300},signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error(`BLM returned ${response.status}`);
    const assessment=assessBlmLayerMetadata(await response.json());
    return NextResponse.json({
      status:assessment.compatible?"operational":"degraded",
      source:"U.S. Bureau of Land Management — MLRS Active Mining Claims",
      sourceUrl:BLM_ACTIVE_CLAIMS_LAYER,
      checkedAt,
      schemaCompatible:assessment.compatible,
      layerName:assessment.layerName,
      serviceVersion:assessment.serviceVersion,
      upstreamLastEditedAt:assessment.upstreamLastEditedAt,
      issues:assessment.issues,
      freshnessCaveat:"Service availability and an edit timestamp do not establish legal currency, completeness, or land availability. Verify authoritative records and land status before acting."
    },{status:assessment.compatible?200:503,headers:{"Cache-Control":"public, s-maxage=300, stale-while-revalidate=300"}});
  }catch(error){
    console.error("BLM source health check failed",error);
    return NextResponse.json({status:"unavailable",source:"U.S. Bureau of Land Management — MLRS Active Mining Claims",sourceUrl:BLM_ACTIVE_CLAIMS_LAYER,checkedAt,schemaCompatible:false,issues:["The official source could not be verified."],freshnessCaveat:"No availability or legal conclusion can be drawn while the source is unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
