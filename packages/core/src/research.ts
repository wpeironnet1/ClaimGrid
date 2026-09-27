import { summarizeClaimProperties, validateResearchBounds, type Bounds, type ClaimRecordSummary } from "./blm";

export const RESEARCH_STORAGE_VERSION = 1;
export type ResearchResultCompleteness = "complete" | "truncated" | "unknown";
export type SavedResearchArea = {
  id: string;
  label: string;
  bounds: Bounds;
  activeClaimCount: number;
  closedClaimCount: number | null;
  surfaceManagementCount: number | null;
  withdrawalCaseCount: number | null;
  resultCompleteness: ResearchResultCompleteness;
  sourceCheckedAt: string;
  closedClaimsCheckedAt: string | null;
  surfaceManagementCheckedAt: string | null;
  withdrawalsCheckedAt: string | null;
  savedAt: string;
  screeningOnly: true;
};

type ResearchSnapshotInput = Omit<SavedResearchArea, "id" | "savedAt" | "screeningOnly" | "resultCompleteness" | "closedClaimCount" | "surfaceManagementCount" | "withdrawalCaseCount" | "closedClaimsCheckedAt" | "surfaceManagementCheckedAt" | "withdrawalsCheckedAt"> & {
  resultCompleteness?: ResearchResultCompleteness;
  surfaceManagementCount?: number | null;
  closedClaimCount?: number | null;
  withdrawalCaseCount?: number | null;
  surfaceManagementCheckedAt?: string | null;
  closedClaimsCheckedAt?: string | null;
  withdrawalsCheckedAt?: string | null;
};

export function createResearchSnapshot(input: ResearchSnapshotInput, now = new Date()): SavedResearchArea {
  const bounds = validateResearchBounds(input.bounds);
  if (!bounds.ok) throw new Error(bounds.error);
  const label = input.label.trim().slice(0, 80);
  if (!label) throw new Error("Name the research area before saving it.");
  if (!Number.isInteger(input.activeClaimCount) || input.activeClaimCount < 0 || input.activeClaimCount > 1000) throw new Error("The mapped claim count is outside the supported result range.");
  if (input.closedClaimCount !== undefined && input.closedClaimCount !== null && (!Number.isInteger(input.closedClaimCount) || input.closedClaimCount < 0 || input.closedClaimCount > 500)) throw new Error("The closed-claim count is outside the supported result range.");
  if (input.surfaceManagementCount !== undefined && input.surfaceManagementCount !== null && (!Number.isInteger(input.surfaceManagementCount) || input.surfaceManagementCount < 0 || input.surfaceManagementCount > 200)) throw new Error("The surface-management count is outside the supported result range.");
  if (input.withdrawalCaseCount !== undefined && input.withdrawalCaseCount !== null && (!Number.isInteger(input.withdrawalCaseCount) || input.withdrawalCaseCount < 0 || input.withdrawalCaseCount > 1000)) throw new Error("The withdrawal-case count is outside the supported result range.");
  if ((input.closedClaimCount != null) !== (input.closedClaimsCheckedAt != null)) throw new Error("Closed-claim evidence requires both a count and source timestamp.");
  if ((input.surfaceManagementCount != null) !== (input.surfaceManagementCheckedAt != null)) throw new Error("Surface-management evidence requires both a count and source timestamp.");
  if ((input.withdrawalCaseCount != null) !== (input.withdrawalsCheckedAt != null)) throw new Error("Withdrawal evidence requires both a count and source timestamp.");
  const resultCompleteness = input.resultCompleteness ?? "unknown";
  if (!["complete", "truncated", "unknown"].includes(resultCompleteness)) throw new Error("The research result completeness is invalid.");
  if (Number.isNaN(Date.parse(input.sourceCheckedAt)) || Number.isNaN(now.getTime())) throw new Error("The research source timestamp is invalid.");
  for (const timestamp of [input.closedClaimsCheckedAt, input.surfaceManagementCheckedAt, input.withdrawalsCheckedAt]) if (timestamp !== undefined && timestamp !== null && Number.isNaN(Date.parse(timestamp))) throw new Error("A research dependency timestamp is invalid.");
  const coordinateKey = [input.bounds.west, input.bounds.south, input.bounds.east, input.bounds.north].join(":");
  return { ...input, closedClaimCount: input.closedClaimCount ?? null, surfaceManagementCount: input.surfaceManagementCount ?? null, withdrawalCaseCount: input.withdrawalCaseCount ?? null, closedClaimsCheckedAt: input.closedClaimsCheckedAt ?? null, surfaceManagementCheckedAt: input.surfaceManagementCheckedAt ?? null, withdrawalsCheckedAt: input.withdrawalsCheckedAt ?? null, resultCompleteness, label, bounds: bounds.bounds, id: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${coordinateKey}`, savedAt: now.toISOString(), screeningOnly: true };
}

export function parseResearchSnapshots(value: string | null): SavedResearchArea[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      try {
        if (!item || typeof item.id !== "string" || item.id.length > 500 || item.screeningOnly !== true || typeof item.savedAt !== "string" || Number.isNaN(Date.parse(item.savedAt))) return [];
        return [{ ...createResearchSnapshot({ label: item.label, bounds: item.bounds, activeClaimCount: item.activeClaimCount, closedClaimCount: item.closedClaimCount, surfaceManagementCount: item.surfaceManagementCount, withdrawalCaseCount: item.withdrawalCaseCount, sourceCheckedAt: item.sourceCheckedAt, closedClaimsCheckedAt: item.closedClaimsCheckedAt, surfaceManagementCheckedAt: item.surfaceManagementCheckedAt, withdrawalsCheckedAt: item.withdrawalsCheckedAt, resultCompleteness: item.resultCompleteness ?? "unknown" }, new Date(item.savedAt)), id: item.id }];
      } catch { return []; }
    }).slice(0, 25);
  } catch { return []; }
}

export function upsertResearchSnapshot(snapshots: SavedResearchArea[], next: SavedResearchArea): SavedResearchArea[] {
  return [next, ...snapshots.filter(item => item.id !== next.id)].slice(0, 25);
}

export type EvidenceAge = "same-day" | "recheck" | "stale" | "unknown";

/** Classifies saved screening evidence without implying that a recent check proves legal currency. */
export function describeEvidenceAge(sourceCheckedAt: string, now = new Date().toISOString()): EvidenceAge {
  const checked = Date.parse(sourceCheckedAt);
  const current = Date.parse(now);
  if (!Number.isFinite(checked) || !Number.isFinite(current) || checked > current) return "unknown";
  const age = current - checked;
  if (age <= 86_400_000) return "same-day";
  if (age <= 7 * 86_400_000) return "recheck";
  return "stale";
}


export const CLAIM_BOOKMARK_STORAGE_VERSION = 1;
export interface SavedClaimRecord {
  id: string;
  areaLabel: string;
  bounds: Bounds;
  details: import("./blm").ClaimRecordSummary;
  sourceCheckedAt: string;
  savedAt: string;
  screeningOnly: true;
}

export function createClaimBookmark(input: Omit<SavedClaimRecord, "id" | "savedAt" | "screeningOnly"> & { recordKey: string }, now = new Date()): SavedClaimRecord {
  const recordKey = input.recordKey.trim().slice(0, 200);
  if (!recordKey) throw new Error("A stable BLM record identifier is required.");
  const bounds = validateResearchBounds(input.bounds);
  if (!bounds.ok) throw new Error(bounds.error);
  const areaLabel = input.areaLabel.trim().slice(0, 80);
  if (!areaLabel) throw new Error("The research area name is required.");
  if (Number.isNaN(Date.parse(input.sourceCheckedAt)) || Number.isNaN(now.getTime())) throw new Error("The bookmark timestamp is invalid.");
  const details = summarizeClaimProperties({ CSE_NR: input.details.caseNumber, CSE_NAME: input.details.claimName, CSE_DISP: input.details.disposition, BLM_PROD: input.details.commodity, QLTY: input.details.quality, RCRD_ACRS: input.details.recordedAcres, GEO_STATE: input.details.state });
  return { id: `${recordKey}:${bounds.bounds.west}:${bounds.bounds.south}:${bounds.bounds.east}:${bounds.bounds.north}`, areaLabel, bounds: bounds.bounds, details, sourceCheckedAt: input.sourceCheckedAt, savedAt: now.toISOString(), screeningOnly: true };
}

export function parseClaimBookmarks(value: string | null): SavedClaimRecord[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      try {
        if (!item || typeof item.id !== "string" || item.id.length > 700 || item.screeningOnly !== true || typeof item.savedAt !== "string" || Number.isNaN(Date.parse(item.savedAt))) return [];
        const record = createClaimBookmark({ recordKey: item.id.split(":")[0], areaLabel: item.areaLabel, bounds: item.bounds, details: item.details as ClaimRecordSummary, sourceCheckedAt: item.sourceCheckedAt }, new Date(item.savedAt));
        return [{ ...record, id: item.id }];
      } catch { return []; }
    }).slice(0,100);
  } catch { return []; }
}

export function upsertClaimBookmark(records: SavedClaimRecord[], next: SavedClaimRecord): SavedClaimRecord[] {
  return [next, ...records.filter(item => item.id !== next.id)].slice(0,100);
}
