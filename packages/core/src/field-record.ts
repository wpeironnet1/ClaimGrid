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
