export const BLM_ACTIVE_CLAIMS_LAYER = "https://gis.blm.gov/nlsdb/rest/services/Mining_Claims/MiningClaims/MapServer/1";
export type Bounds = { west: number; south: number; east: number; north: number };
export type BoundsValidation = { ok: true; bounds: Bounds } | { ok: false; error: string };
const US_LIMITS: Bounds = { west: -180, south: 18, east: 180, north: 72 };

export function validateResearchBounds(input: Partial<Record<keyof Bounds, string | number>>): BoundsValidation {
  const bounds = { west: Number(input.west), south: Number(input.south), east: Number(input.east), north: Number(input.north) };
  if (Object.values(bounds).some(value => !Number.isFinite(value))) return { ok: false, error: "All four bounds must be valid numbers." };
  if (bounds.west >= bounds.east || bounds.south >= bounds.north) return { ok: false, error: "Bounds must form a positive west/east and south/north area." };
  if (bounds.west < US_LIMITS.west || bounds.east > US_LIMITS.east || bounds.south < US_LIMITS.south || bounds.north > US_LIMITS.north) return { ok: false, error: "Bounds must fall within the supported United States extent." };
  if (bounds.east - bounds.west > 5 || bounds.north - bounds.south > 5) return { ok: false, error: "Zoom into an area no larger than five degrees in either direction." };
  return { ok: true, bounds };
}

export function buildActiveClaimsQuery(bounds: Bounds): URL {
  const url = new URL(`${BLM_ACTIVE_CLAIMS_LAYER}/query`);
  url.search = new URLSearchParams({ where: "1=1", geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`, geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "OBJECTID,CSE_NR,CSE_NAME,CSE_DISP,BLM_PROD,QLTY,RCRD_ACRS,GEO_STATE", returnGeometry: "true", outSR: "4326", resultRecordCount: "1000", f: "geojson" }).toString();
  return url;
}


export interface SanitizedClaimFeature {
  type: "Feature";
  id?: string | number;
  properties: Record<string, string | number | boolean | null>;
  geometry: { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] };
}
export interface SanitizedClaimCollection { type: "FeatureCollection"; features: SanitizedClaimFeature[]; exceededTransferLimit: boolean }
export type ClaimsSanitization = { ok: true; collection: SanitizedClaimCollection } | { ok: false; error: string };
const CLAIM_PROPERTY_ALLOWLIST = ["OBJECTID","CSE_NR","CSE_NAME","CSE_DISP","BLM_PROD","QLTY","RCRD_ACRS","GEO_STATE"] as const;
const validPosition = (value: unknown): value is number[] => Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]) && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;
const validRing = (value: unknown): value is number[][] => Array.isArray(value) && value.length >= 4 && value.every(validPosition);
const validPolygon = (value: unknown): value is number[][][] => Array.isArray(value) && value.length > 0 && value.every(validRing);
const validMultiPolygon = (value: unknown): value is number[][][][] => Array.isArray(value) && value.length > 0 && value.every(validPolygon);

export function sanitizeActiveClaimsGeoJson(input: unknown): ClaimsSanitization {
  if (!input || typeof input !== "object") return { ok: false, error: "BLM response was not an object." };
  const candidate = input as Record<string, unknown>;
  if (candidate.type !== "FeatureCollection" || !Array.isArray(candidate.features)) return { ok: false, error: "BLM response was not a feature collection." };
  if (candidate.features.length > 1000) return { ok: false, error: "BLM response exceeded the feature safety limit." };
  let coordinateCount = 0;
  const features: SanitizedClaimFeature[] = [];
  for (const item of candidate.features) {
    if (!item || typeof item !== "object") return { ok: false, error: "BLM response contained an invalid feature." };
    const feature = item as Record<string, unknown>;
    const geometry = feature.geometry as Record<string, unknown> | null;
    if (feature.type !== "Feature" || !geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) return { ok: false, error: "BLM response contained unsupported geometry." };
    if (geometry.type === "Polygon" && !validPolygon(geometry.coordinates)) return { ok: false, error: "BLM response contained invalid polygon coordinates." };
    if (geometry.type === "MultiPolygon" && !validMultiPolygon(geometry.coordinates)) return { ok: false, error: "BLM response contained invalid multipolygon coordinates." };
    const coordinates = geometry.coordinates as number[][][] | number[][][][];
    const rings = geometry.type === "Polygon" ? coordinates as number[][][] : (coordinates as number[][][][]).flat();
    coordinateCount += rings.reduce((total, ring) => total + ring.length, 0);
    if (coordinateCount > 100000) return { ok: false, error: "BLM response exceeded the geometry safety limit." };
    const sourceProperties = feature.properties && typeof feature.properties === "object" ? feature.properties as Record<string, unknown> : {};
    const properties: SanitizedClaimFeature["properties"] = {};
    for (const key of CLAIM_PROPERTY_ALLOWLIST) {
      const value = sourceProperties[key];
      if (value === null || ["string","number","boolean"].includes(typeof value)) properties[key] = value as string | number | boolean | null;
    }
    const id = typeof feature.id === "string" || typeof feature.id === "number" ? feature.id : undefined;
    features.push({ type: "Feature", ...(id === undefined ? {} : { id }), properties, geometry: geometry.type === "Polygon" ? { type: "Polygon", coordinates: geometry.coordinates as number[][][] } : { type: "MultiPolygon", coordinates: geometry.coordinates as number[][][][] } });
  }
  return { ok: true, collection: { type: "FeatureCollection", features, exceededTransferLimit: candidate.exceededTransferLimit === true } };
}


export interface BlmLayerAssessment {
  compatible: boolean;
  issues: string[];
  layerName: string | null;
  serviceVersion: number | null;
  upstreamLastEditedAt: string | null;
}

export type SourceFreshness = "recent-edit" | "older-edit" | "unknown";

/** Describes an upstream edit marker's age without treating it as proof that every record is current. */
export function describeSourceFreshness(upstreamLastEditedAt: string | null, checkedAt: string, recentDays = 7): SourceFreshness {
  if (!upstreamLastEditedAt || recentDays <= 0) return "unknown";
  const edited = Date.parse(upstreamLastEditedAt);
  const checked = Date.parse(checkedAt);
  if (!Number.isFinite(edited) || !Number.isFinite(checked) || edited > checked) return "unknown";
  return checked - edited <= recentDays * 86_400_000 ? "recent-edit" : "older-edit";
}
const REQUIRED_BLM_FIELDS = ["OBJECTID","CSE_NR","CSE_NAME","CSE_DISP","BLM_PROD","QLTY","RCRD_ACRS","GEO_STATE"] as const;

export function assessBlmLayerMetadata(input: unknown): BlmLayerAssessment {
  const issues: string[] = [];
  if (!input || typeof input !== "object") return { compatible: false, issues: ["Metadata was not an object."], layerName: null, serviceVersion: null, upstreamLastEditedAt: null };
  const value = input as Record<string, unknown>;
  const layerName = typeof value.name === "string" ? value.name : null;
  const serviceVersion = typeof value.currentVersion === "number" && Number.isFinite(value.currentVersion) ? value.currentVersion : null;
  if (layerName !== "Active Mining Claims") issues.push("Unexpected layer name.");
  if (value.type !== "Feature Layer") issues.push("Expected a feature layer.");
  if (value.geometryType !== "esriGeometryPolygon") issues.push("Expected polygon geometry.");
  if (typeof value.capabilities !== "string" || !value.capabilities.split(",").map(item => item.trim()).includes("Query")) issues.push("Query capability is unavailable.");
  const fieldNames = new Set(Array.isArray(value.fields) ? value.fields.flatMap(field => field && typeof field === "object" && typeof (field as Record<string, unknown>).name === "string" ? [(field as Record<string, unknown>).name as string] : []) : []);
  const missingFields = REQUIRED_BLM_FIELDS.filter(field => !fieldNames.has(field));
  if (missingFields.length) issues.push(`Missing required fields: ${missingFields.join(", ")}.`);
  const editingInfo = value.editingInfo && typeof value.editingInfo === "object" ? value.editingInfo as Record<string, unknown> : null;
  const lastEdit = editingInfo && typeof editingInfo.lastEditDate === "number" && Number.isFinite(editingInfo.lastEditDate) ? editingInfo.lastEditDate : null;
  return { compatible: issues.length === 0, issues, layerName, serviceVersion, upstreamLastEditedAt: lastEdit === null ? null : new Date(lastEdit).toISOString() };
}


export interface ClaimRecordSummary {
  caseNumber: string | null;
  claimName: string | null;
  disposition: string | null;
  commodity: string | null;
  quality: string | null;
  recordedAcres: number | null;
  state: string | null;
}

const safeClaimText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : typeof value === "number" && Number.isFinite(value) ? String(value) : null;

export function summarizeClaimProperties(properties: unknown): ClaimRecordSummary {
  const value = properties && typeof properties === "object" ? properties as Record<string, unknown> : {};
  const acres = typeof value.RCRD_ACRS === "number" && Number.isFinite(value.RCRD_ACRS) && value.RCRD_ACRS >= 0 ? value.RCRD_ACRS : null;
  return {
    caseNumber: safeClaimText(value.CSE_NR),
    claimName: safeClaimText(value.CSE_NAME),
    disposition: safeClaimText(value.CSE_DISP),
    commodity: safeClaimText(value.BLM_PROD),
    quality: safeClaimText(value.QLTY),
    recordedAcres: acres,
    state: safeClaimText(value.GEO_STATE)
  };
}
