export const BLM_ACTIVE_CLAIMS_LAYER = "https://gis.blm.gov/nlsdb/rest/services/Mining_Claims/MiningClaims/MapServer/1";
export const BLM_CLOSED_CLAIMS_LAYER = "https://gis.blm.gov/nlsdb/rest/services/Mining_Claims/MiningClaims/MapServer/2";
export const BLM_SURFACE_MANAGEMENT_LAYER = "https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_LimitedScale/MapServer/1";
export const BLM_WITHDRAWALS_SERVICE = "https://gis.blm.gov/nlsdb/rest/services/Land_Tenure/Withdrawals_Case_Disp/MapServer";
export const BLM_PLSS_SERVICE = "https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer";
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

export function buildClosedClaimsQuery(bounds: Bounds): URL {
  const url = new URL(`${BLM_CLOSED_CLAIMS_LAYER}/query`);
  url.search = new URLSearchParams({ where: "1=1", geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`, geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "CSE_NR,CSE_NAME,CSE_DISP,BLM_PROD,QLTY,RCRD_ACRS,GEO_STATE,MC_PATENTED,MC_EXCLUDED,MC_CONVEYED", returnGeometry: "false", resultRecordCount: "500", f: "json" }).toString();
  return url;
}

export type PlssLayer = "township" | "section";
export function buildPlssQuery(bounds: Bounds, layer: PlssLayer): URL {
  const layerId = layer === "township" ? 1 : 2;
  const longitude = (bounds.west + bounds.east) / 2;
  const latitude = (bounds.south + bounds.north) / 2;
  const outFields = layer === "township"
    ? "STATEABBR,PRINMER,TWNSHPLAB,PLSSID,SRVNAME,SURVTYPTXT,SOURCEDATE,SOURCEREF,STEWARD"
    : "PLSSID,FRSTDIVID,FRSTDIVTXT,FRSTDIVNO,FRSTDIVLAB,SURVTYPTXT,SOURCEDATE,SOURCEREF";
  const url = new URL(`${BLM_PLSS_SERVICE}/${layerId}/query`);
  url.search = new URLSearchParams({ where: "1=1", geometry: `${longitude},${latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields, returnGeometry: "false", resultRecordCount: "5", f: "json" }).toString();
  return url;
}

export interface PlssReferenceRecord {
  kind: PlssLayer;
  plssId: string | null;
  label: string | null;
  state: string | null;
  principalMeridian: string | null;
  surveyName: string | null;
  divisionId: string | null;
  divisionType: string | null;
  sourceDate: string | null;
  sourceReference: string | null;
}

export function sanitizePlssResponse(value: unknown, kind: PlssLayer): PlssReferenceRecord[] | null {
  if (!value || typeof value !== "object") return null;
  const response = value as { features?: unknown; error?: unknown };
  if (response.error || !Array.isArray(response.features) || response.features.length > 5) return null;
  const records: PlssReferenceRecord[] = [];
  const seen = new Set<string>();
  for (const feature of response.features) {
    if (!feature || typeof feature !== "object") return null;
    const attributes = (feature as { attributes?: unknown }).attributes;
    if (!attributes || typeof attributes !== "object") return null;
    const source = attributes as Record<string, unknown>;
    const rawDate = source.SOURCEDATE;
    const sourceDate = typeof rawDate === "number" && Number.isFinite(rawDate) && rawDate >= 0 && rawDate <= 8_640_000_000_000_000 ? new Date(rawDate).toISOString() : null;
    const record: PlssReferenceRecord = {
      kind,
      plssId: boundedText(source.PLSSID, 50),
      label: boundedText(kind === "township" ? source.TWNSHPLAB : source.FRSTDIVLAB, 20),
      state: kind === "township" ? boundedText(source.STATEABBR, 2) : null,
      principalMeridian: kind === "township" ? boundedText(source.PRINMER, 40) : null,
      surveyName: kind === "township" ? boundedText(source.SRVNAME, 60) : null,
      divisionId: kind === "section" ? boundedText(source.FRSTDIVID, 50) : null,
      divisionType: kind === "section" ? boundedText(source.FRSTDIVTXT, 50) : boundedText(source.SURVTYPTXT, 50),
      sourceDate,
      sourceReference: boundedText(source.SOURCEREF, 100),
    };
    const key = `${kind}:${record.plssId ?? ""}:${record.divisionId ?? ""}:${record.label ?? ""}`;
    if (!seen.has(key)) { seen.add(key); records.push(record); }
  }
  return records;
}

export interface ClosedClaimRecord { caseNumber: string | null; name: string | null; disposition: string | null; product: string | null; dataQuality: string | null; recordedAcres: number | null; state: string | null; patented: string | null; excluded: string | null; conveyed: string | null }

export function sanitizeClosedClaimsResponse(value: unknown): { records: ClosedClaimRecord[]; exceededLimit: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const response = value as { features?: unknown; exceededTransferLimit?: unknown; error?: unknown };
  if (response.error || !Array.isArray(response.features) || response.features.length > 500) return null;
  const records: ClosedClaimRecord[] = []; const seen = new Set<string>();
  for (const feature of response.features) {
    if (!feature || typeof feature !== "object") return null;
    const attributes = (feature as { attributes?: unknown }).attributes;
    if (!attributes || typeof attributes !== "object") return null;
    const source = attributes as Record<string, unknown>;
    const acres = typeof source.RCRD_ACRS === "number" && Number.isFinite(source.RCRD_ACRS) && source.RCRD_ACRS >= 0 ? source.RCRD_ACRS : null;
    const record = { caseNumber: boundedText(source.CSE_NR,255), name: boundedText(source.CSE_NAME,255), disposition: boundedText(source.CSE_DISP,255), product: boundedText(source.BLM_PROD,255), dataQuality: boundedText(source.QLTY,255), recordedAcres: acres, state: boundedText(source.GEO_STATE,2), patented: boundedText(source.MC_PATENTED,1), excluded: boundedText(source.MC_EXCLUDED,1), conveyed: boundedText(source.MC_CONVEYED,1) };
    const key = record.caseNumber ?? JSON.stringify(record); if (!seen.has(key)) { seen.add(key); records.push(record); }
  }
  return { records, exceededLimit: response.exceededTransferLimit === true || response.features.length === 500 };
}

export function buildSurfaceManagementQuery(bounds: Bounds): URL {
  const url = new URL(`${BLM_SURFACE_MANAGEMENT_LAYER}/query`);
  url.search = new URLSearchParams({ where: "1=1", geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`, geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "ADMIN_AGENCY_CODE,ADMIN_UNIT_NAME,ADMIN_UNIT_TYPE,ADMIN_ST", returnGeometry: "false", returnDistinctValues: "true", resultRecordCount: "200", f: "json" }).toString();
  return url;
}

export interface SurfaceManagementRecord {
  agencyCode: string | null;
  unitName: string | null;
  unitType: string | null;
  state: string | null;
}

export interface SurfaceManagementSummary {
  records: SurfaceManagementRecord[];
  exceededLimit: boolean;
}

const boundedText = (value: unknown, maximum: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : null;

export function sanitizeSurfaceManagementResponse(value: unknown): SurfaceManagementSummary | null {
  if (!value || typeof value !== "object") return null;
  const response = value as { features?: unknown; exceededTransferLimit?: unknown; error?: unknown };
  if (response.error || !Array.isArray(response.features) || response.features.length > 200) return null;
  const records: SurfaceManagementRecord[] = [];
  const seen = new Set<string>();
  for (const feature of response.features) {
    if (!feature || typeof feature !== "object") return null;
    const attributes = (feature as { attributes?: unknown }).attributes;
    if (!attributes || typeof attributes !== "object") return null;
    const source = attributes as Record<string, unknown>;
    const record = { agencyCode: boundedText(source.ADMIN_AGENCY_CODE, 16), unitName: boundedText(source.ADMIN_UNIT_NAME, 255), unitType: boundedText(source.ADMIN_UNIT_TYPE, 255), state: boundedText(source.ADMIN_ST, 2) };
    const key = JSON.stringify(record);
    if (!seen.has(key)) { seen.add(key); records.push(record); }
  }
  return { records, exceededLimit: response.exceededTransferLimit === true || response.features.length === 200 };
}

export type WithdrawalStatus = "authorized-interim" | "pending";
export interface WithdrawalRecord {
  status: WithdrawalStatus;
  caseNumber: string | null;
  name: string | null;
  disposition: string | null;
  mineralSegregation: string | null;
  surfaceSegregation: string | null;
  dataQuality: string | null;
  state: string | null;
}

export function buildWithdrawalsQuery(bounds: Bounds, status: WithdrawalStatus): URL {
  const layer = status === "authorized-interim" ? 0 : 1;
  const url = new URL(`${BLM_WITHDRAWALS_SERVICE}/${layer}/query`);
  url.search = new URLSearchParams({ where: "1=1", geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`, geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "CSE_NR,CSE_NAME,CSE_DISP,SEG_MIN,SEG_SUR,QLTY,GEO_STATE", returnGeometry: "false", resultRecordCount: "500", f: "json" }).toString();
  return url;
}

export function sanitizeWithdrawalResponse(value: unknown, status: WithdrawalStatus): { records: WithdrawalRecord[]; exceededLimit: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const response = value as { features?: unknown; exceededTransferLimit?: unknown; error?: unknown };
  if (response.error || !Array.isArray(response.features) || response.features.length > 500) return null;
  const records: WithdrawalRecord[] = [];
  const seen = new Set<string>();
  for (const feature of response.features) {
    if (!feature || typeof feature !== "object") return null;
    const attributes = (feature as { attributes?: unknown }).attributes;
    if (!attributes || typeof attributes !== "object") return null;
    const source = attributes as Record<string, unknown>;
    const record: WithdrawalRecord = { status, caseNumber: boundedText(source.CSE_NR, 255), name: boundedText(source.CSE_NAME, 255), disposition: boundedText(source.CSE_DISP, 255), mineralSegregation: boundedText(source.SEG_MIN, 255), surfaceSegregation: boundedText(source.SEG_SUR, 255), dataQuality: boundedText(source.QLTY, 255), state: boundedText(source.GEO_STATE, 2) };
    const key = `${status}:${record.caseNumber ?? JSON.stringify(record)}`;
    if (!seen.has(key)) { seen.add(key); records.push(record); }
  }
  return { records, exceededLimit: response.exceededTransferLimit === true || response.features.length === 500 };
}


export interface SanitizedClaimFeature {
  type: "Feature";
  id?: string | number;
  properties: Record<string, string | number | boolean | null>;
  geometry: { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] };
}
export interface SanitizedClaimCollection { type: "FeatureCollection"; features: SanitizedClaimFeature[]; exceededTransferLimit: boolean }
export interface BlmResultMetadata {
  source: "U.S. Bureau of Land Management — MLRS Active Mining Claims";
  sourceUrl: typeof BLM_ACTIVE_CLAIMS_LAYER;
  retrievedAt: string;
  resultLimit: 1000;
  exceededLimit: boolean;
  screeningOnly: true;
  warning: string;
}
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

export function createBlmResultMetadata(collection: SanitizedClaimCollection, retrievedAt: string): BlmResultMetadata {
  if (!Number.isFinite(Date.parse(retrievedAt))) throw new Error("The BLM retrieval timestamp is invalid.");
  return {
    source: "U.S. Bureau of Land Management — MLRS Active Mining Claims",
    sourceUrl: BLM_ACTIVE_CLAIMS_LAYER,
    retrievedAt,
    resultLimit: 1000,
    exceededLimit: collection.exceededTransferLimit || collection.features.length === 1000,
    screeningOnly: true,
    warning: "A missing map feature does not establish that land is open to mineral entry. Verify land status, withdrawals, official records, and existing monuments on the ground."
  };
}


export interface BlmLayerAssessment {
  compatible: boolean;
  issues: string[];
  layerName: string | null;
  serviceVersion: number | null;
  upstreamLastEditedAt: string | null;
}

export interface ArcGisLayerContract {
  layerName: string;
  geometryType: string;
  requiredFields: readonly string[];
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

export function assessArcGisLayerMetadata(input: unknown, contract: ArcGisLayerContract): BlmLayerAssessment {
  const issues: string[] = [];
  if (!input || typeof input !== "object") return { compatible: false, issues: ["Metadata was not an object."], layerName: null, serviceVersion: null, upstreamLastEditedAt: null };
  const value = input as Record<string, unknown>;
  const layerName = typeof value.name === "string" ? value.name : null;
  const serviceVersion = typeof value.currentVersion === "number" && Number.isFinite(value.currentVersion) ? value.currentVersion : null;
  if (layerName !== contract.layerName) issues.push("Unexpected layer name.");
  if (value.type !== "Feature Layer") issues.push("Expected a feature layer.");
  if (value.geometryType !== contract.geometryType) issues.push(`Expected ${contract.geometryType} geometry.`);
  if (typeof value.capabilities !== "string" || !value.capabilities.split(",").map(item => item.trim()).includes("Query")) issues.push("Query capability is unavailable.");
  const fieldNames = new Set(Array.isArray(value.fields) ? value.fields.flatMap(field => field && typeof field === "object" && typeof (field as Record<string, unknown>).name === "string" ? [(field as Record<string, unknown>).name as string] : []) : []);
  const missingFields = contract.requiredFields.filter(field => !fieldNames.has(field));
  if (missingFields.length) issues.push(`Missing required fields: ${missingFields.join(", ")}.`);
  const editingInfo = value.editingInfo && typeof value.editingInfo === "object" ? value.editingInfo as Record<string, unknown> : null;
  const lastEdit = editingInfo && typeof editingInfo.lastEditDate === "number" && Number.isFinite(editingInfo.lastEditDate) ? editingInfo.lastEditDate : null;
  return { compatible: issues.length === 0, issues, layerName, serviceVersion, upstreamLastEditedAt: lastEdit === null ? null : new Date(lastEdit).toISOString() };
}

export function assessBlmLayerMetadata(input: unknown): BlmLayerAssessment {
  return assessArcGisLayerMetadata(input, { layerName: "Active Mining Claims", geometryType: "esriGeometryPolygon", requiredFields: REQUIRED_BLM_FIELDS });
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
