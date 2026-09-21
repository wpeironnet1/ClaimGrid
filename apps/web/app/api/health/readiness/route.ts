import { NextResponse } from "next/server";
import { assessLaunchReadiness } from "@claimgrid/core";

export const dynamic = "force-dynamic";

export function GET() {
  const assessment = assessLaunchReadiness(process.env);
  return NextResponse.json(
    {
      ...assessment,
      service: "claimgrid-web",
      checkedAt: new Date().toISOString(),
      note: "This endpoint reports configuration presence only. It never returns credentials and does not prove external services are operational."
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
