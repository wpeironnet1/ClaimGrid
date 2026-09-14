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


export const arizonaWorkflow: StateWorkflow = {
  state: "AZ",
  title: "Arizona claim-location research checklist",
  reviewedAt: "2026-09-14",
  notice: "This checklist organizes official sources; it does not determine mineral-entry status, validate discovery, or certify compliance. Arizona State Trust Land is not federal public land and uses a different authorization system.",
  steps: [
    { id: "az-records", phase: "research", title: "Verify ownership and mineral-entry status", description: "Identify the legal description, surface manager, mineral estate, withdrawals, closures, and existing claims using current BLM records and title documents. Do not infer availability from an empty map area.", verification: "Save source dates and confirm uncertain status with the responsible BLM office." },
    { id: "az-state-land", phase: "research", title: "Exclude State Trust Land from the federal workflow", description: "Use the Arizona State Land Department parcel information to distinguish State Trust Land. State mineral rights require state permits or leases; a federal mining claim workflow does not apply.", verification: "Confirm both surface and mineral ownership before field activity." },
    { id: "az-county", phase: "research", title: "Confirm county and claim-type requirements", description: "Identify the county containing the claim and review the current Arizona statutes for the applicable lode, placer, mill-site, or tunnel-site location method, notice, map, monument, fee, and recording rules.", verification: "Confirm current document standards, fees, and receipt methods with that county recorder." },
    { id: "az-discovery", phase: "field", title: "Inspect the site and discovery evidence", description: "Check access, prior monuments, conflicting occupation, protected resources, and evidence of a valuable locatable mineral before treating research as a location.", verification: "Map screening cannot complete discovery or field verification." },
    { id: "az-monuments", phase: "field", title: "Mark and document the physical location", description: "Follow the current Arizona location method for the claim type. Preserve the actual date, notice details, boundary and monument evidence, coordinates, and photographs without disturbing protected resources.", verification: "Compare the field plan with current Title 27 requirements immediately before acting." },
    { id: "az-county-record", phase: "county", title: "Record the location notice and map", description: "Prepare and record the required notice and map or plat with the correct county within the applicable Arizona deadline. Ensure the legal description and field evidence agree.", verification: "Keep the recorder-stamped copy, receipt, and proof of timely delivery." },
    { id: "az-blm-record", phase: "federal", title: "Record with BLM", description: "Submit the required recorded location document, map, claimant information, and current fees to BLM within 90 days after physical location.", verification: "Confirm BLM receipt, serial number, and the resulting MLRS record." }
  ],
  sources: [
    { label: "Arizona Revised Statutes — Title 27", authority: "Arizona Legislature", checkedAt: "2026-09-14", url: "https://www.azleg.gov/arsDetail/?title=27" },
    { label: "Arizona Geological Survey — Mineral Rights", authority: "Arizona Geological Survey", checkedAt: "2026-09-14", url: "https://azgs.arizona.edu/mineral-resources/mineral-rights" },
    { label: "BLM — Locatable Minerals and Mining Claims", authority: "U.S. Bureau of Land Management", checkedAt: "2026-09-14", url: "https://www.blm.gov/programs/energy-and-minerals/mining-and-minerals/locatable-minerals/mining-claims" },
    { label: "Mineral & Land Records System", authority: "U.S. Bureau of Land Management", checkedAt: "2026-09-14", url: "https://mlrs.blm.gov/" }
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
