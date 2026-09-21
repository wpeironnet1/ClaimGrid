export type ClaimType = "lode" | "placer" | "mill" | "tunnel";

export type ResearchConfidence = "unverified" | "screened" | "field-checked";

export interface ClaimProject {
  id: string;
  name: string;
  state: string;
  county?: string;
  type?: ClaimType;
  confidence: ResearchConfidence;
  locationDate?: string;
  filingDeadline?: string;
  sourceCheckedAt?: string;
}

export const supportedStates = [
  "AK", "AZ", "AR", "CA", "CO", "FL", "ID", "LA", "MS", "MT",
  "NE", "NV", "NM", "ND", "OR", "SD", "UT", "WA", "WY"
] as const;

export const federalWorkflow = [
  { id: "research", title: "Research land status", description: "Review current federal records, withdrawals, ownership, existing claims, and state requirements." },
  { id: "field", title: "Verify in the field", description: "Inspect the site for prior monuments and confirm access and conditions." },
  { id: "discovery", title: "Establish discovery", description: "A valid claim requires discovery of a valuable locatable mineral, not merely selecting an empty-looking area." },
  { id: "stake", title: "Mark the claim", description: "Mark boundaries and monuments exactly as the applicable state requires." },
  { id: "county", title: "Record with the county", description: "File the location notice within the applicable state/county deadline." },
  { id: "blm", title: "Record with BLM", description: "Submit the recorded notice, map, required information, and current fees within 90 days of location." },
  { id: "maintain", title: "Maintain the claim", description: "Track annual maintenance fees, waivers, assessment work, and address or ownership changes." }
] as const;

export const BLM_ACTIVE_CLAIMS_SERVICE =
  "https://gis.blm.gov/nlsdb/rest/services/Mining_Claims/MiningClaims/MapServer/1";

export * from "./blm";
export * from "./research";
export * from "./claim-draft";
export * from "./state-workflows";
export * from "./field-record";
export * from "./deadline";
export * from "./document-packet";
export * from "./security";
export * from "./local-data";
export * from "./billing";
export * from "./legal";
export * from "./site-discovery";
export * from "./monitoring";

export function calculateFederalDeadline(locationDate: string): string {
  const date = new Date(`${locationDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 90);
  return date.toISOString().slice(0, 10);
}
