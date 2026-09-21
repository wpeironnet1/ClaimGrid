export type FieldObservationKind = "site" | "monument" | "corner-candidate" | "sample" | "access" | "hazard";

export interface FieldObservation {
  id: string;
  kind: FieldObservationKind;
  note: string;
  latitude: number;
  longitude: number;
  horizontalAccuracyMeters: number | null;
  altitudeMeters: number | null;
  capturedAt: string;
  photoUri: string | null;
  deviceReadingOnly: true;
}

export interface FieldObservationInput {
  kind: FieldObservationKind;
  note?: string;
  latitude: number;
  longitude: number;
  horizontalAccuracyMeters?: number | null;
  altitudeMeters?: number | null;
  capturedAt?: string;
  photoUri?: string | null;
}

const FIELD_EVIDENCE_IMPORT_MAX_BYTES = 1_000_000;
const FIELD_CAPTURE_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const FIELD_ACCURACY_MAX_METERS = 100_000;
const FIELD_ALTITUDE_MIN_METERS = -12_000;
const FIELD_ALTITUDE_MAX_METERS = 100_000;
const fieldObservationKinds: readonly FieldObservationKind[] = ["site", "monument", "corner-candidate", "sample", "access", "hazard"];

function isSafeCaptureTime(value: string, now: Date): boolean {
  const capturedAt = Date.parse(value);
  return Number.isFinite(capturedAt) && capturedAt <= now.getTime() + FIELD_CAPTURE_FUTURE_TOLERANCE_MS;
}

function isSafeAccuracy(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 0 && value <= FIELD_ACCURACY_MAX_METERS);
}

function isSafeAltitude(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= FIELD_ALTITUDE_MIN_METERS && value <= FIELD_ALTITUDE_MAX_METERS);
}

export function createFieldObservation(input: FieldObservationInput, id = `field-${Date.now()}`, now = new Date()): FieldObservation {
  if (!fieldObservationKinds.includes(input.kind)) throw new Error("Observation type is invalid.");
  const safeId = id.trim();
  if (!safeId || safeId.length > 200) throw new Error("Observation identifier is invalid.");
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) throw new Error("Latitude is outside the valid range.");
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) throw new Error("Longitude is outside the valid range.");
  const accuracy = input.horizontalAccuracyMeters ?? null;
  if (!isSafeAccuracy(accuracy)) throw new Error("GPS accuracy is outside the safe evidence range.");
  const altitude = input.altitudeMeters ?? null;
  if (!isSafeAltitude(altitude)) throw new Error("GPS altitude is outside the safe evidence range.");
  const capturedAt = input.capturedAt ?? now.toISOString();
  if (!isSafeCaptureTime(capturedAt, now)) throw new Error("Capture time is invalid or too far in the future.");
  return {
    id: safeId,
    kind: input.kind,
    note: (input.note ?? "").trim().slice(0, 2000),
    latitude: input.latitude,
    longitude: input.longitude,
    horizontalAccuracyMeters: accuracy,
    altitudeMeters: altitude,
    capturedAt,
    photoUri: input.photoUri?.trim().slice(0, 4000) || null,
    deviceReadingOnly: true
  };
}

export function describeGpsQuality(accuracy: number | null): "unknown" | "strong" | "moderate" | "weak" {
  if (accuracy === null || !Number.isFinite(accuracy)) return "unknown";
  if (accuracy <= 10) return "strong";
  if (accuracy <= 30) return "moderate";
  return "weak";
}

export function parseFieldObservations(raw: string | null, now = new Date()): FieldObservation[] {
  if (!raw) return [];
  if (new TextEncoder().encode(raw).length > FIELD_EVIDENCE_IMPORT_MAX_BYTES) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(record => isImportedObservation(record, now)).slice(0, 250);
  } catch {
    return [];
  }
}

export function addFieldObservation(records: readonly FieldObservation[], record: FieldObservation): FieldObservation[] {
  return [record, ...records.filter(existing => existing.id !== record.id)].slice(0, 250);
}

export interface FieldEvidenceExport {
  schema: "claimgrid-field-evidence-v1";
  exportedAt: string;
  caveat: string;
  observations: FieldObservation[];
}

export const FIELD_EVIDENCE_CAVEAT = "Device observations are not a legal survey, claim corner, mineral discovery, land-status determination, or proof of rights. Verify against authoritative records and field requirements.";

export function createFieldEvidenceExport(records: readonly FieldObservation[], now = new Date()): FieldEvidenceExport {
  return {
    schema: "claimgrid-field-evidence-v1",
    exportedAt: now.toISOString(),
    caveat: FIELD_EVIDENCE_CAVEAT,
    observations: records.slice(0, 250).map(record => ({ ...record, deviceReadingOnly: true }))
  };
}

export function serializeFieldEvidence(records: readonly FieldObservation[], now = new Date()): string {
  return JSON.stringify(createFieldEvidenceExport(records, now), null, 2);
}

export interface FieldEvidenceImport {
  exportedAt: string;
  observations: FieldObservation[];
  photoReferenceCount: number;
}

function isImportedObservation(value: unknown, now: Date): value is FieldObservation {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<FieldObservation>;
  return typeof record.id === "string" && record.id.length > 0 && record.id.length <= 200 &&
    fieldObservationKinds.includes(record.kind as FieldObservationKind) &&
    typeof record.note === "string" && record.note.length <= 2000 &&
    typeof record.latitude === "number" && Number.isFinite(record.latitude) && record.latitude >= -90 && record.latitude <= 90 &&
    typeof record.longitude === "number" && Number.isFinite(record.longitude) && record.longitude >= -180 && record.longitude <= 180 &&
    (record.horizontalAccuracyMeters === null || (typeof record.horizontalAccuracyMeters === "number" && isSafeAccuracy(record.horizontalAccuracyMeters))) &&
    (record.altitudeMeters === null || (typeof record.altitudeMeters === "number" && isSafeAltitude(record.altitudeMeters))) &&
    typeof record.capturedAt === "string" && isSafeCaptureTime(record.capturedAt, now) &&
    (record.photoUri === null || (typeof record.photoUri === "string" && record.photoUri.length <= 4000)) &&
    record.deviceReadingOnly === true;
}

export function parseFieldEvidenceImport(raw: string, now = new Date()): FieldEvidenceImport {
  if (!raw.trim()) throw new Error("Paste a ClaimGrid field evidence backup first.");
  if (new TextEncoder().encode(raw).length > FIELD_EVIDENCE_IMPORT_MAX_BYTES) throw new Error("The backup is larger than the 1 MB import limit.");

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("The backup is not valid JSON."); }
  if (!parsed || typeof parsed !== "object") throw new Error("The backup must be a ClaimGrid field evidence object.");
  const packet = parsed as Partial<FieldEvidenceExport>;
  if (packet.schema !== "claimgrid-field-evidence-v1") throw new Error("The backup schema is not supported.");
  if (typeof packet.exportedAt !== "string" || !isSafeCaptureTime(packet.exportedAt, now)) throw new Error("The backup export time is invalid or too far in the future.");
  if (packet.caveat !== FIELD_EVIDENCE_CAVEAT) throw new Error("The backup safety statement is missing or altered.");
  if (!Array.isArray(packet.observations) || packet.observations.length > 250) throw new Error("The backup must contain no more than 250 observations.");
  if (!packet.observations.every(record => isImportedObservation(record, now))) throw new Error("One or more observations are malformed or unsafe to restore.");
  if (new Set(packet.observations.map(record => record.id)).size !== packet.observations.length) throw new Error("The backup contains duplicate observation IDs.");

  return {
    exportedAt: packet.exportedAt,
    observations: packet.observations.map(record => ({ ...record, deviceReadingOnly: true })),
    photoReferenceCount: packet.observations.filter(record => record.photoUri !== null).length
  };
}

export function mergeFieldEvidence(current: readonly FieldObservation[], imported: readonly FieldObservation[]): FieldObservation[] {
  return imported.reduceRight((records, record) => addFieldObservation(records, record), [...current]);
}
