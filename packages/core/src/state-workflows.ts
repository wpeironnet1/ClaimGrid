export interface WorkflowSource {
  label: string;
  url: string;
  authority: string;
  checkedAt: string;
}

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  verification: string;
  phase: "research" | "field" | "county" | "federal";
}

export interface StateWorkflow {
  state: string;
  title: string;
  reviewedAt: string;
  notice: string;
  steps: readonly WorkflowStep[];
  sources: readonly WorkflowSource[];
}

export const nevadaWorkflow: StateWorkflow = {
  state: "NV",
  title: "Nevada claim-location research checklist",
  reviewedAt: "2026-09-13",
  notice: "This checklist organizes official guidance; it does not determine whether land is open, validate a mineral discovery, or replace the county recorder, BLM, or professional advice.",
  steps: [
    { id: "records", phase: "research", title: "Recheck current records and land status", description: "Review MLRS, the Master Title Plat and relevant withdrawals or closures. Search nearby claim names and serial records; a mapped gap is not proof that land is open.", verification: "Save source dates and confirm with the responsible BLM office." },
    { id: "county", phase: "research", title: "Confirm the county and its recording rules", description: "Identify the Nevada county containing the full claim and contact its recorder about current formatting, fees, accepted filing methods and deadlines.", verification: "Obtain instructions directly from that county recorder." },
    { id: "discovery", phase: "field", title: "Verify the site and discovery in the field", description: "Inspect for existing monuments, conflicting occupation, access restrictions and evidence of a valuable locatable mineral before treating the project as a location.", verification: "Map research cannot complete this step." },
    { id: "monuments", phase: "field", title: "Mark and document the location", description: "Follow current Nevada law for the applicable claim type. Record the actual location date, corner evidence, monument markings, coordinates and photographs without disturbing protected resources.", verification: "Compare the field plan against NRS 517 and current state forms before work." },
    { id: "certificate", phase: "county", title: "Prepare the certificate and location map", description: "Use the applicable Nevada certificate-of-location form or verify that a custom document contains all required information. Ensure the map and land description agree with the field location.", verification: "Have the county recorder confirm document and map requirements." },
    { id: "record-county", phase: "county", title: "Record with the county", description: "Record the required location documents and map in the county where the claim is situated within the applicable Nevada deadline.", verification: "Retain the recorder-stamped copy and receipt." },
    { id: "record-blm", phase: "federal", title: "Record with BLM", description: "Submit the notice or certificate, map, claimant information and current fees to BLM within 90 days after the physical location date.", verification: "Confirm receipt and the assigned serial number in MLRS." }
  ],
  sources: [
    { label: "Nevada Division of Minerals — Mining Claims", authority: "State of Nevada", checkedAt: "2026-09-13", url: "https://www.minerals.nv.gov/programs/mining/claims/" },
    { label: "Nevada Revised Statutes, Chapter 517", authority: "Nevada Legislature", checkedAt: "2026-09-13", url: "https://www.leg.state.nv.us/nrs/nrs-517.html" },
    { label: "BLM — Locatable Minerals and Mining Claims", authority: "U.S. Bureau of Land Management", checkedAt: "2026-09-13", url: "https://www.blm.gov/programs/energy-and-minerals/mining-and-minerals/locatable-minerals/mining-claims" },
    { label: "Mineral & Land Records System", authority: "U.S. Bureau of Land Management", checkedAt: "2026-09-13", url: "https://mlrs.blm.gov/" }
  ]
};

export function parseWorkflowProgress(raw: string | null, allowedIds: readonly string[]): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((value): value is string => typeof value === "string" && allowedIds.includes(value)))];
  } catch {
    return [];
  }
}
