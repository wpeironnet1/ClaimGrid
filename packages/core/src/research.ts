import { summarizeClaimProperties, validateResearchBounds, type Bounds, type ClaimRecordSummary } from "./blm";

export const RESEARCH_STORAGE_VERSION = 1;
export type SavedResearchArea = {
  id: string;
  label: string;
  bounds: Bounds;
  activeClaimCount: number;
  sourceCheckedAt: string;
  savedAt: string;
  screeningOnly: true;
};

export function createResearchSnapshot(input: Omit<SavedResearchArea, "id" | "savedAt" | "screeningOnly">, now = new Date()): SavedResearchArea {
  const bounds = validateResearchBounds(input.bounds);
  if (!bounds.ok) throw new Error(bounds.error);
  const label = input.label.trim().slice(0, 80);
  if (!label) throw new Error("Name the research area before saving it.");
  if (!Number.isInteger(input.activeClaimCount) || input.activeClaimCount < 0 || input.activeClaimCount > 1000) throw new Error("The mapped claim count is outside the supported result range.");
  if (Number.isNaN(Date.parse(input.sourceCheckedAt)) || Number.isNaN(now.getTime())) throw new Error("The research source timestamp is invalid.");
  const coordinateKey = [input.bounds.west, input.bounds.south, input.bounds.east, input.bounds.north].join(":");
  return { ...input, label, bounds: bounds.bounds, id: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${coordinateKey}`, savedAt: now.toISOString(), screeningOnly: true };
}

export function parseResearchSnapshots(value: string | null): SavedResearchArea[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      try {
        if (!item || typeof item.id !== "string" || item.id.length > 500 || item.screeningOnly !== true || typeof item.savedAt !== "string" || Number.isNaN(Date.parse(item.savedAt))) return [];
        return [{ ...createResearchSnapshot({ label: item.label, bounds: item.bounds, activeClaimCount: item.activeClaimCount, sourceCheckedAt: item.sourceCheckedAt }, new Date(item.savedAt)), id: item.id }];
      } catch { return []; }
    }).slice(0, 25);
  } catch { return []; }
}

export function upsertResearchSnapshot(snapshots: SavedResearchArea[], next: SavedResearchArea): SavedResearchArea[] {
  return [next, ...snapshots.filter(item => item.id !== next.id)].slice(0, 25);
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
