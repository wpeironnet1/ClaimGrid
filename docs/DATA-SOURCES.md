# Data-source plan

## Phase 1 official layers

- BLM MLRS active and closed mining claim services
- BLM national Surface Management Agency query data (screening context only; not mineral ownership, withdrawal status, access, or availability)
- BLM MLRS authorized/interim and pending withdrawal case layers, including source data-quality caveats and warnings about unmapped cases
- Automated schema monitoring for the active-claims, surface-management, and both withdrawal layers; partial failures report degraded source health
- BLM Public Land Survey System data
- BLM withdrawals and land-status research links
- USFS land and authoritative state/county recording resources

## Data rules

- Display source, retrieval timestamp, and data-quality field wherever possible.
- Preserve upstream identifiers and link back to authoritative case information.
- Cache for performance but never hide freshness.
- Do not infer legal availability from absence in a single layer.
- Treat community pins as observations, not authoritative claims.

## API boundary

The production ingestion service will query official ArcGIS REST endpoints, normalize geometries into PostGIS, and store source metadata. Map clients receive bounded, simplified vector tiles rather than nationwide raw GeoJSON.
