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
