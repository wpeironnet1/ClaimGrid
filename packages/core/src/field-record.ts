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

export function createFieldObservation(input: FieldObservationInput, id = `field-${Date.now()}`): FieldObservation {
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) throw new Error("Latitude is outside the valid range.");
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) throw new Error("Longitude is outside the valid range.");
  const accuracy = input.horizontalAccuracyMeters ?? null;
  if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) throw new Error("GPS accuracy must be a positive distance.");
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(capturedAt))) throw new Error("Capture time is invalid.");
  return {
    id,
    kind: input.kind,
    note: (input.note ?? "").trim().slice(0, 2000),
    latitude: input.latitude,
    longitude: input.longitude,
    horizontalAccuracyMeters: accuracy,
    altitudeMeters: input.altitudeMeters ?? null,
    capturedAt,
    photoUri: input.photoUri?.trim() || null,
    deviceReadingOnly: true
  };
}

export function describeGpsQuality(accuracy: number | null): "unknown" | "strong" | "moderate" | "weak" {
  if (accuracy === null || !Number.isFinite(accuracy)) return "unknown";
  if (accuracy <= 10) return "strong";
  if (accuracy <= 30) return "moderate";
  return "weak";
}

export function parseFieldObservations(raw: string | null): FieldObservation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((record): record is FieldObservation =>
      typeof record?.id === "string" &&
      typeof record?.kind === "string" &&
      typeof record?.latitude === "number" && record.latitude >= -90 && record.latitude <= 90 &&
      typeof record?.longitude === "number" && record.longitude >= -180 && record.longitude <= 180 &&
      typeof record?.capturedAt === "string" && !Number.isNaN(Date.parse(record.capturedAt)) &&
      record.deviceReadingOnly === true
    ).slice(0, 250);
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

const FIELD_EVIDENCE_IMPORT_MAX_BYTES = 1_000_000;
const fieldObservationKinds: readonly FieldObservationKind[] = ["site", "monument", "corner-candidate", "sample", "access", "hazard"];

function isImportedObservation(value: unknown): value is FieldObservation {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<FieldObservation>;
  return typeof record.id === "string" && record.id.length > 0 && record.id.length <= 200 &&
    fieldObservationKinds.includes(record.kind as FieldObservationKind) &&
    typeof record.note === "string" && record.note.length <= 2000 &&
    typeof record.latitude === "number" && Number.isFinite(record.latitude) && record.latitude >= -90 && record.latitude <= 90 &&
    typeof record.longitude === "number" && Number.isFinite(record.longitude) && record.longitude >= -180 && record.longitude <= 180 &&
    (record.horizontalAccuracyMeters === null || (typeof record.horizontalAccuracyMeters === "number" && Number.isFinite(record.horizontalAccuracyMeters) && record.horizontalAccuracyMeters >= 0)) &&
    (record.altitudeMeters === null || (typeof record.altitudeMeters === "number" && Number.isFinite(record.altitudeMeters))) &&
    typeof record.capturedAt === "string" && !Number.isNaN(Date.parse(record.capturedAt)) &&
    (record.photoUri === null || (typeof record.photoUri === "string" && record.photoUri.length <= 4000)) &&
    record.deviceReadingOnly === true;
}

export function parseFieldEvidenceImport(raw: string): FieldEvidenceImport {
  if (!raw.trim()) throw new Error("Paste a ClaimGrid field evidence backup first.");
  if (new TextEncoder().encode(raw).length > FIELD_EVIDENCE_IMPORT_MAX_BYTES) throw new Error("The backup is larger than the 1 MB import limit.");

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("The backup is not valid JSON."); }
  if (!parsed || typeof parsed !== "object") throw new Error("The backup must be a ClaimGrid field evidence object.");
  const packet = parsed as Partial<FieldEvidenceExport>;
  if (packet.schema !== "claimgrid-field-evidence-v1") throw new Error("The backup schema is not supported.");
  if (typeof packet.exportedAt !== "string" || Number.isNaN(Date.parse(packet.exportedAt))) throw new Error("The backup export time is invalid.");
  if (packet.caveat !== FIELD_EVIDENCE_CAVEAT) throw new Error("The backup safety statement is missing or altered.");
  if (!Array.isArray(packet.observations) || packet.observations.length > 250) throw new Error("The backup must contain no more than 250 observations.");
  if (!packet.observations.every(isImportedObservation)) throw new Error("One or more observations are malformed or unsafe to restore.");
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
