import type { Bounds } from "./blm";

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
  const coordinateKey = [input.bounds.west, input.bounds.south, input.bounds.east, input.bounds.north].join(":");
  return { ...input, id: `${input.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${coordinateKey}`, savedAt: now.toISOString(), screeningOnly: true };
}

export function parseResearchSnapshots(value: string | null): SavedResearchArea[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item.id === "string" && typeof item.label === "string" && item.screeningOnly === true && Number.isFinite(item.activeClaimCount) && typeof item.sourceCheckedAt === "string" && typeof item.savedAt === "string" && item.bounds && [item.bounds.west, item.bounds.south, item.bounds.east, item.bounds.north].every(Number.isFinite));
  } catch { return []; }
}

export function upsertResearchSnapshot(snapshots: SavedResearchArea[], next: SavedResearchArea): SavedResearchArea[] {
  return [next, ...snapshots.filter(item => item.id !== next.id)].slice(0, 25);
}
