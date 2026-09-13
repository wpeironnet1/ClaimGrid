import { calculateFederalDeadline, supportedStates, type ClaimType } from "./index";

export type ClaimStage = "research" | "located";

export interface ClaimDraft {
  version: 1;
  name: string;
  state: (typeof supportedStates)[number];
  county: string;
  claimType: ClaimType;
  stage: ClaimStage;
  locationDate: string | null;
  federalRecordingDeadline: string | null;
  savedAt: string;
}

export interface ClaimDraftInput {
  name: string;
  state: string;
  county: string;
  claimType: ClaimType;
  stage: ClaimStage;
  locationDate?: string;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

export function createClaimDraft(input: ClaimDraftInput, now = new Date()): ClaimDraft {
  const name = input.name.trim();
  const county = input.county.trim();
  if (!name) throw new Error("A project name is required.");
  if (!supportedStates.includes(input.state as ClaimDraft["state"])) throw new Error("Choose a supported state.");

  let locationDate: string | null = null;
  let federalRecordingDeadline: string | null = null;
  if (input.stage === "located") {
    if (!input.locationDate || !isIsoDate(input.locationDate)) throw new Error("Enter the physical location date.");
    const today = now.toISOString().slice(0, 10);
    if (input.locationDate > today) throw new Error("The physical location date cannot be in the future.");
    locationDate = input.locationDate;
    federalRecordingDeadline = calculateFederalDeadline(locationDate);
  }

  return {
    version: 1,
    name,
    state: input.state as ClaimDraft["state"],
    county,
    claimType: input.claimType,
    stage: input.stage,
    locationDate,
    federalRecordingDeadline,
    savedAt: now.toISOString()
  };
}

export function parseClaimDraft(raw: string | null): ClaimDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as ClaimDraft;
    if (value.version !== 1 || !value.name || !supportedStates.includes(value.state) || !["research", "located"].includes(value.stage)) return null;
    return value;
  } catch {
    return null;
  }
}
