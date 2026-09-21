export type CommunityObservationKind = "access-change" | "hazard" | "monument-seen" | "surface-disturbance" | "other";

export interface CommunityObservationDraft {
  id: string;
  kind: CommunityObservationKind;
  summary: string;
  sourceAttribution: string;
  latitude: number | null;
  longitude: number | null;
  observedAt: string;
  createdAt: string;
  visibility: "private-draft";
  verificationState: "unverified-community-report";
  moderationRequired: true;
  caveat: typeof COMMUNITY_OBSERVATION_CAVEAT;
}

export const COMMUNITY_OBSERVATION_CAVEAT = "Unverified private draft. This observation is not an official record, survey, boundary, land-status determination, access authorization, or proof that a mining claim or right exists.";
const kinds: readonly CommunityObservationKind[] = ["access-change", "hazard", "monument-seen", "surface-disturbance", "other"];
const MAX_RECORDS = 100;
const MAX_STORAGE_BYTES = 1_000_000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface CommunityObservationInput {
  kind: CommunityObservationKind;
  summary: string;
  sourceAttribution?: string;
  latitude?: number | null;
  longitude?: number | null;
  observedAt: string;
}

function validTime(value: string, now: Date): boolean {
  const time = Date.parse(value);
  return Number.isFinite(time) && time <= now.getTime() + FUTURE_TOLERANCE_MS;
}

function validCoordinatePair(latitude: number | null, longitude: number | null): boolean {
  if (latitude === null || longitude === null) return latitude === null && longitude === null;
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export function createCommunityObservationDraft(input: CommunityObservationInput, id = `community-${Date.now()}`, now = new Date()): CommunityObservationDraft {
  const safeId = id.trim();
  const summary = input.summary.trim();
  const sourceAttribution = (input.sourceAttribution ?? "").trim();
  const latitude = input.latitude ?? null;
  const longitude = input.longitude ?? null;
  if (!safeId || safeId.length > 200) throw new Error("Observation identifier is invalid.");
  if (!kinds.includes(input.kind)) throw new Error("Choose a supported observation type.");
  if (summary.length < 10 || summary.length > 1000) throw new Error("Observation summary must contain 10 to 1,000 characters.");
  if (sourceAttribution.length > 300) throw new Error("Source attribution is too long.");
  if (!validCoordinatePair(latitude, longitude)) throw new Error("Coordinates must be a complete valid latitude and longitude pair.");
  if (!validTime(input.observedAt, now)) throw new Error("Observation time is invalid or too far in the future.");
  return { id: safeId, kind: input.kind, summary, sourceAttribution, latitude, longitude, observedAt: input.observedAt, createdAt: now.toISOString(), visibility: "private-draft", verificationState: "unverified-community-report", moderationRequired: true, caveat: COMMUNITY_OBSERVATION_CAVEAT };
}

function isDraft(value: unknown, now: Date): value is CommunityObservationDraft {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CommunityObservationDraft>;
  return typeof item.id === "string" && item.id.length > 0 && item.id.length <= 200 &&
    kinds.includes(item.kind as CommunityObservationKind) &&
    typeof item.summary === "string" && item.summary.trim().length >= 10 && item.summary.length <= 1000 &&
    typeof item.sourceAttribution === "string" && item.sourceAttribution.length <= 300 &&
    (item.latitude === null || typeof item.latitude === "number") && (item.longitude === null || typeof item.longitude === "number") &&
    validCoordinatePair(item.latitude ?? null, item.longitude ?? null) &&
    typeof item.observedAt === "string" && validTime(item.observedAt, now) &&
    typeof item.createdAt === "string" && validTime(item.createdAt, now) &&
    item.visibility === "private-draft" && item.verificationState === "unverified-community-report" &&
    item.moderationRequired === true && item.caveat === COMMUNITY_OBSERVATION_CAVEAT;
}

export function parseCommunityObservationDrafts(raw: string | null, now = new Date()): CommunityObservationDraft[] {
  if (!raw || new TextEncoder().encode(raw).length > MAX_STORAGE_BYTES) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => isDraft(item, now)).slice(0, MAX_RECORDS);
  } catch { return []; }
}

export function addCommunityObservationDraft(records: readonly CommunityObservationDraft[], draft: CommunityObservationDraft): CommunityObservationDraft[] {
  return [draft, ...records.filter(item => item.id !== draft.id)].slice(0, MAX_RECORDS);
}
