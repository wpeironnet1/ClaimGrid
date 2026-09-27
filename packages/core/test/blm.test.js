const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assessBlmLayerMetadata,
  assessArcGisLayerMetadata,
  buildActiveClaimsQuery,
  buildClosedClaimsQuery,
  buildSurfaceManagementQuery,
  buildWithdrawalsQuery,
  createBlmResultMetadata,
  describeSourceFreshness,
  sanitizeActiveClaimsGeoJson,
  sanitizeClosedClaimsResponse,
  sanitizeSurfaceManagementResponse,
  sanitizeWithdrawalResponse,
  summarizeClaimProperties,
  validateResearchBounds,
} = require("../dist/blm.js");
const {
  createClaimBookmark,
  createResearchSnapshot,
  describeEvidenceAge,
  parseClaimBookmarks,
  parseResearchSnapshots,
  upsertClaimBookmark,
  upsertResearchSnapshot,
} = require("../dist/research.js");
const { createClaimDraft, parseClaimDraft } = require("../dist/claim-draft.js");
const {
  alaskaWorkflow,
  arizonaWorkflow,
  californiaWorkflow,
  coloradoWorkflow,
  idahoWorkflow,
  montanaWorkflow,
  wyomingWorkflow,
  newMexicoWorkflow,
  nevadaWorkflow,
  oregonWorkflow,
  southDakotaWorkflow,
  washingtonWorkflow,
  utahWorkflow,
  getStateWorkflowPath,
  parseWorkflowProgress,
} = require("../dist/state-workflows.js");
const {
  addFieldObservation,
  createFieldEvidenceExport,
  createFieldObservation,
  describeGpsQuality,
  mergeFieldEvidence,
  parseFieldEvidenceImport,
  parseFieldObservations,
  serializeFieldEvidence,
} = require("../dist/field-record.js");
const { createDeadlineCalendar } = require("../dist/deadline.js");
const {
  createTrackedDeadline,
  daysUntilDeadline,
  deadlineStatus,
  parseTrackedDeadlines,
} = require("../dist/deadline.js");
const {
  parseFederalPacket,
  parseNevadaPacket,
  reviewFederalPacket,
  reviewNevadaPacket,
} = require("../dist/document-packet.js");
const { webSecurityHeaders } = require("../dist/security.js");
const {
  claimGridLocalRecords,
  collectLocalRecords,
  createLocalDataExport,
  parseLocalDataExport,
} = require("../dist/local-data.js");
const {
  billingConfiguration,
  createStripeEntitlementDelivery,
  isEntitlementDeliveryAcknowledged,
  isStripeFulfillmentEventSafe,
  parseAccountSessionToken,
  parseBillingPlan,
  parseStripeWebhookEnvelope,
  parseStripeSignatureHeader,
  parseVerifiedAccountSession,
} = require("../dist/billing.js");
const {
  LEGAL_NOTICE_REVIEWED_AT,
  legalNoticeHasRequiredSafeguards,
  legalNoticeSections,
} = require("../dist/legal.js");
test("accepts a bounded US viewport", () =>
  assert.equal(
    validateResearchBounds({ west: -120, south: 38, east: -119, north: 39 }).ok,
    true,
  ));
test("rejects an oversized request", () =>
  assert.match(
    validateResearchBounds({ west: -125, south: 30, east: -110, north: 40 })
      .error,
    /five degrees/i,
  ));
test("builds a constrained GeoJSON query", () => {
  const url = buildActiveClaimsQuery({
    west: -120,
    south: 38,
    east: -119,
    north: 39,
  });
  assert.equal(url.searchParams.get("f"), "geojson");
  assert.equal(url.searchParams.get("resultRecordCount"), "1000");
  assert.match(url.searchParams.get("outFields"), /QLTY/);
});
test("queries and sanitizes closed claims as non-geometric history", () => {
  const query=buildClosedClaimsQuery({west:-120,south:38,east:-119,north:39});
  assert.match(query.pathname,/MapServer\/2\/query$/); assert.equal(query.searchParams.get("returnGeometry"),"false");
  const summary=sanitizeClosedClaimsResponse({features:[{attributes:{CSE_NR:"NMC-1",CSE_NAME:"Old claim",CSE_DISP:"Closed",BLM_PROD:"Lode",QLTY:"2",RCRD_ACRS:20,GEO_STATE:"NM",MC_PATENTED:"N",SECRET:"drop"}},{attributes:{CSE_NR:"NMC-1",CSE_NAME:"Duplicate"}}]});
  assert.equal(summary.records.length,1); assert.equal(summary.records[0].disposition,"Closed"); assert.equal(summary.records[0].recordedAcres,20);
  assert.equal(sanitizeClosedClaimsResponse({error:{message:"failure"}}),null);
});
test("builds a bounded non-geometric surface-management query", () => {
  const url = buildSurfaceManagementQuery({ west: -120, south: 38, east: -119, north: 39 });
  assert.equal(url.searchParams.get("returnGeometry"), "false");
  assert.equal(url.searchParams.get("returnDistinctValues"), "true");
  assert.equal(url.searchParams.get("resultRecordCount"), "200");
  assert.match(url.searchParams.get("outFields"), /ADMIN_AGENCY_CODE/);
});
test("sanitizes surface-management records without treating them as land status", () => {
  assert.deepEqual(sanitizeSurfaceManagementResponse({ features: [
    { attributes: { ADMIN_AGENCY_CODE: "BLM", ADMIN_UNIT_NAME: "Example Field Office", ADMIN_UNIT_TYPE: "Field Office", ADMIN_ST: "NV", PRIVATE: "discard" } },
    { attributes: { ADMIN_AGENCY_CODE: "BLM", ADMIN_UNIT_NAME: "Example Field Office", ADMIN_UNIT_TYPE: "Field Office", ADMIN_ST: "NV" } },
  ] }), { records: [{ agencyCode: "BLM", unitName: "Example Field Office", unitType: "Field Office", state: "NV" }], exceededLimit: false });
  assert.equal(sanitizeSurfaceManagementResponse({ error: { message: "upstream failure" } }), null);
  assert.equal(sanitizeSurfaceManagementResponse({ features: [{ attributes: null }] }), null);
});
test("queries current withdrawal categories without requesting geometry", () => {
  const bounds = { west: -120, south: 38, east: -119, north: 39 };
  const authorized = buildWithdrawalsQuery(bounds, "authorized-interim");
  const pending = buildWithdrawalsQuery(bounds, "pending");
  assert.match(authorized.pathname, /MapServer\/0\/query$/);
  assert.match(pending.pathname, /MapServer\/1\/query$/);
  assert.equal(authorized.searchParams.get("returnGeometry"), "false");
  assert.match(authorized.searchParams.get("outFields"), /QLTY/);
});
test("withdrawal screening preserves category and data quality while deduplicating cases", () => {
  const summary = sanitizeWithdrawalResponse({ features: [
    { attributes: { CSE_NR: "NMC123", CSE_NAME: "Example withdrawal", CSE_DISP: "Authorized", SEG_MIN: "All minerals", SEG_SUR: "None", QLTY: "2", GEO_STATE: "NM", SECRET: "discard" } },
    { attributes: { CSE_NR: "NMC123", CSE_NAME: "Duplicate geometry", QLTY: "8" } },
  ] }, "authorized-interim");
  assert.deepEqual(summary, { records: [{ status: "authorized-interim", caseNumber: "NMC123", name: "Example withdrawal", disposition: "Authorized", mineralSegregation: "All minerals", surfaceSegregation: "None", dataQuality: "2", state: "NM" }], exceededLimit: false });
  assert.equal(sanitizeWithdrawalResponse({ error: { message: "failure" } }, "pending"), null);
});
test("creates source metadata from the actual BLM retrieval time", () => {
  const metadata = createBlmResultMetadata({ type: "FeatureCollection", features: [], exceededTransferLimit: false }, "2026-09-27T00:00:00.000Z");
  assert.equal(metadata.retrievedAt, "2026-09-27T00:00:00.000Z");
  assert.equal(metadata.exceededLimit, false);
  assert.equal(metadata.screeningOnly, true);
  assert.match(metadata.warning, /does not establish.*open to mineral entry/i);
  assert.throws(() => createBlmResultMetadata({ type: "FeatureCollection", features: [], exceededTransferLimit: false }, "not-a-date"), /timestamp/i);
});
test("BLM result metadata reports both explicit and exact-cap truncation", () => {
  const empty = { type: "FeatureCollection", features: [], exceededTransferLimit: true };
  assert.equal(createBlmResultMetadata(empty, "2026-09-27T00:00:00.000Z").exceededLimit, true);
  const capped = { type: "FeatureCollection", features: Array.from({ length: 1000 }, () => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,0]]] } })), exceededTransferLimit: false };
  assert.equal(createBlmResultMetadata(capped, "2026-09-27T00:00:00.000Z").exceededLimit, true);
});
test("creates an explicitly screening-only research snapshot", () => {
  const snapshot = createResearchSnapshot(
    {
      label: "Test Area",
      bounds: { west: -120, south: 38, east: -119, north: 39 },
      activeClaimCount: 12,
      sourceCheckedAt: "2026-09-13T17:00:00.000Z",
    },
    new Date("2026-09-13T18:00:00.000Z"),
  );
  assert.equal(snapshot.screeningOnly, true);
  assert.equal(snapshot.resultCompleteness, "unknown");
  assert.equal(snapshot.savedAt, "2026-09-13T18:00:00.000Z");
});
test("preserves capped-result provenance in saved research", () => {
  const snapshot = createResearchSnapshot({
    label: "Dense claim area",
    bounds: { west: -120, south: 38, east: -119, north: 39 },
    activeClaimCount: 1000,
    resultCompleteness: "truncated",
    sourceCheckedAt: "2026-09-26T20:00:00.000Z",
  });
  assert.equal(snapshot.resultCompleteness, "truncated");
  assert.equal(parseResearchSnapshots(JSON.stringify([snapshot]))[0].resultCompleteness, "truncated");
});
test("saved research preserves independent official-source evidence", () => {
  const snapshot = createResearchSnapshot({
    label: "Multi-source area", bounds: { west: -120, south: 38, east: -119, north: 39 }, activeClaimCount: 8,
    surfaceManagementCount: 2, withdrawalCaseCount: 3, sourceCheckedAt: "2026-09-27T10:00:00Z",
    closedClaimCount: 4, closedClaimsCheckedAt: "2026-09-27T10:00:00Z", surfaceManagementCheckedAt: "2026-09-27T10:00:01Z", withdrawalsCheckedAt: "2026-09-27T10:00:02Z"
  });
  const restored = parseResearchSnapshots(JSON.stringify([snapshot]))[0];
  assert.equal(restored.surfaceManagementCount, 2);
  assert.equal(restored.withdrawalCaseCount, 3);
  assert.equal(restored.closedClaimCount, 4);
  assert.equal(restored.withdrawalsCheckedAt, "2026-09-27T10:00:02Z");
  assert.deepEqual(parseResearchSnapshots(JSON.stringify([{ ...snapshot, withdrawalCaseCount: 1001 }])), []);
  assert.deepEqual(parseResearchSnapshots(JSON.stringify([{ ...snapshot, surfaceManagementCheckedAt: "invalid" }])), []);
  assert.deepEqual(parseResearchSnapshots(JSON.stringify([{ ...snapshot, withdrawalsCheckedAt: null }])), []);
});
test("marks legacy saved research completeness unknown and rejects altered values", () => {
  const legacy = createResearchSnapshot({ label: "Legacy", bounds: { west: -120, south: 38, east: -119, north: 39 }, activeClaimCount: 3, sourceCheckedAt: "2026-09-26T20:00:00.000Z" });
  const { resultCompleteness: ignored, ...withoutCompleteness } = legacy;
  const restoredLegacy = parseResearchSnapshots(JSON.stringify([withoutCompleteness]))[0];
  assert.equal(restoredLegacy.resultCompleteness, "unknown");
  assert.equal(restoredLegacy.surfaceManagementCount, null);
  assert.equal(restoredLegacy.closedClaimCount, null);
  assert.equal(restoredLegacy.withdrawalCaseCount, null);
  assert.deepEqual(parseResearchSnapshots(JSON.stringify([{ ...legacy, resultCompleteness: "complete-enough" }])), []);
});
test("ignores malformed persisted research data", () =>
  assert.deepEqual(parseResearchSnapshots("not json"), []));
test("updates matching areas instead of duplicating them", () => {
  const snapshot = createResearchSnapshot({
    label: "Test",
    bounds: { west: -120, south: 38, east: -119, north: 39 },
    activeClaimCount: 1,
    sourceCheckedAt: "2026-09-13T17:00:00.000Z",
  });
  assert.equal(
    upsertResearchSnapshot([snapshot], { ...snapshot, activeClaimCount: 2 })
      .length,
    1,
  );
});
test("saved screening evidence clearly ages into recheck and stale states", () => {
  assert.equal(describeEvidenceAge("2026-09-20T12:00:00Z","2026-09-21T11:59:59Z"),"same-day");
  assert.equal(describeEvidenceAge("2026-09-18T12:00:00Z","2026-09-21T12:00:00Z"),"recheck");
  assert.equal(describeEvidenceAge("2026-09-01T12:00:00Z","2026-09-21T12:00:00Z"),"stale");
  assert.equal(describeEvidenceAge("2026-09-22T12:00:00Z","2026-09-21T12:00:00Z"),"unknown");
  assert.equal(describeEvidenceAge("invalid","2026-09-21T12:00:00Z"),"unknown");
});
test("keeps research drafts separate from legal location", () => {
  const draft = createClaimDraft(
    {
      name: "  North wash ",
      state: "NV",
      county: "",
      claimType: "placer",
      stage: "research",
    },
    new Date("2026-09-13T18:00:00.000Z"),
  );
  assert.equal(draft.name, "North wash");
  assert.equal(draft.locationDate, null);
  assert.equal(draft.federalRecordingDeadline, null);
});
test("calculates the federal recording target from physical location", () => {
  const draft = createClaimDraft(
    {
      name: "North wash",
      state: "NV",
      county: "Nye",
      claimType: "placer",
      stage: "located",
      locationDate: "2026-09-01",
    },
    new Date("2026-09-13T18:00:00.000Z"),
  );
  assert.equal(draft.federalRecordingDeadline, "2026-11-30");
});
test("rejects future physical location dates", () =>
  assert.throws(
    () =>
      createClaimDraft(
        {
          name: "Test",
          state: "NV",
          county: "",
          claimType: "lode",
          stage: "located",
          locationDate: "2026-09-14",
        },
        new Date("2026-09-13T18:00:00.000Z"),
      ),
    /future/i,
  ));
test("ignores malformed persisted claim drafts", () =>
  assert.equal(parseClaimDraft('{"version":1}'), null));
test("Nevada workflow keeps authoritative source review dates", () => {
  assert.equal(nevadaWorkflow.state, "NV");
  assert.ok(
    nevadaWorkflow.sources.every((source) => source.checkedAt === "2026-09-13"),
  );
  assert.match(nevadaWorkflow.notice, /does not determine/i);
});
test("workflow progress accepts only known unique step identifiers", () =>
  assert.deepEqual(
    parseWorkflowProgress(
      '["records","fake","records","county"]',
      nevadaWorkflow.steps.map((step) => step.id),
    ),
    ["records", "county"],
  ));
test("workflow progress safely rejects malformed storage", () =>
  assert.deepEqual(parseWorkflowProgress("bad json", ["records"]), []));
test("creates an explicitly device-only field observation", () => {
  const record = createFieldObservation(
    {
      kind: "monument",
      note: "  Existing post  ",
      latitude: 38.9,
      longitude: -119.7,
      horizontalAccuracyMeters: 7,
      capturedAt: "2026-09-14T01:00:00.000Z",
      photoUri: " file:///photo.jpg ",
    },
    "field-test",
  );
  assert.equal(record.note, "Existing post");
  assert.equal(record.photoUri, "file:///photo.jpg");
  assert.equal(record.deviceReadingOnly, true);
  assert.equal(record.id, "field-test");
});
test("rejects impossible field coordinates", () =>
  assert.throws(
    () =>
      createFieldObservation({ kind: "site", latitude: 100, longitude: -119 }),
    /latitude/i,
  ));
test("classifies GPS readings without overstating precision", () => {
  assert.equal(describeGpsQuality(8), "strong");
  assert.equal(describeGpsQuality(24), "moderate");
  assert.equal(describeGpsQuality(80), "weak");
  assert.equal(describeGpsQuality(null), "unknown");
});
test("rejects corrupted and non-evidence field storage", () => {
  assert.deepEqual(parseFieldObservations("broken"), []);
  assert.deepEqual(
    parseFieldObservations(
      '[{"id":"fake","latitude":38,"longitude":-119,"capturedAt":"2026-09-14T01:00:00Z"}]',
    ),
    [],
  );
});
test("rejects unsafe field measurement metadata", () => {
  const now = new Date("2026-09-21T12:00:00Z");
  assert.throws(() => createFieldObservation({ kind: "site", latitude: 38, longitude: -119, horizontalAccuracyMeters: Infinity }, "bad-accuracy", now), /accuracy/i);
  assert.throws(() => createFieldObservation({ kind: "site", latitude: 38, longitude: -119, altitudeMeters: NaN }, "bad-altitude", now), /altitude/i);
  assert.throws(() => createFieldObservation({ kind: "site", latitude: 38, longitude: -119, capturedAt: "2026-09-22T12:00:00Z" }, "future", now), /future/i);
});
test("filters malformed and future-dated local field records", () => {
  const now = new Date("2026-09-21T12:00:00Z");
  const safe = createFieldObservation({ kind: "site", latitude: 38, longitude: -119, capturedAt: "2026-09-21T11:00:00Z" }, "safe", now);
  const unsafe = [
    { ...safe, id: "bad-kind", kind: "boundary" },
    { ...safe, id: "bad-note", note: 17 },
    { ...safe, id: "bad-accuracy", horizontalAccuracyMeters: 200000 },
    { ...safe, id: "future", capturedAt: "2026-09-22T12:00:00Z" },
  ];
  assert.deepEqual(parseFieldObservations(JSON.stringify([safe, ...unsafe]), now), [safe]);
});
test("deduplicates field records and keeps newest first", () => {
  const old = createFieldObservation(
    { kind: "site", latitude: 38, longitude: -119 },
    "same",
  );
  const replacement = { ...old, note: "updated" };
  assert.deepEqual(addFieldObservation([old], replacement), [replacement]);
});
test("exports versioned field evidence with its safety caveat", () => {
  const record = createFieldObservation(
    {
      kind: "access",
      latitude: 38,
      longitude: -119,
      capturedAt: "2026-09-14T01:00:00Z",
    },
    "export-me",
  );
  const packet = createFieldEvidenceExport(
    [record],
    new Date("2026-09-14T07:00:00Z"),
  );
  assert.equal(packet.schema, "claimgrid-field-evidence-v1");
  assert.match(packet.caveat, /not a legal survey/i);
  assert.equal(packet.observations[0].deviceReadingOnly, true);
  assert.deepEqual(
    JSON.parse(
      serializeFieldEvidence([record], new Date("2026-09-14T07:00:00Z")),
    ),
    packet,
  );
});
test("validates and merges a field evidence backup", () => {
  const old = createFieldObservation(
    { kind: "site", latitude: 38, longitude: -119 },
    "same",
  );
  const imported = createFieldObservation(
    {
      kind: "access",
      latitude: 39,
      longitude: -120,
      capturedAt: "2026-09-14T01:00:00Z",
      photoUri: "file:///evidence.jpg",
    },
    "same",
  );
  const fresh = createFieldObservation(
    {
      kind: "hazard",
      latitude: 40,
      longitude: -121,
      capturedAt: "2026-09-14T02:00:00Z",
    },
    "fresh",
  );
  const backup = serializeFieldEvidence(
    [imported, fresh],
    new Date("2026-09-14T07:00:00Z"),
  );
  const parsed = parseFieldEvidenceImport(backup);
  assert.equal(parsed.photoReferenceCount, 1);
  assert.deepEqual(mergeFieldEvidence([old], parsed.observations), [
    imported,
    fresh,
  ]);
});
test("rejects altered or malformed field evidence backups", () => {
  const record = createFieldObservation(
    { kind: "site", latitude: 38, longitude: -119 },
    "safe",
  );
  const packet = createFieldEvidenceExport([record]);
  assert.throws(
    () =>
      parseFieldEvidenceImport(
        JSON.stringify({ ...packet, caveat: "removed" }),
      ),
    /safety statement/i,
  );
  assert.throws(
    () =>
      parseFieldEvidenceImport(
        JSON.stringify({
          ...packet,
          observations: [{ ...record, latitude: 200 }],
        }),
      ),
    /malformed/i,
  );
  assert.throws(
    () =>
      parseFieldEvidenceImport(
        JSON.stringify({ ...packet, observations: [record, record] }),
      ),
    /duplicate/i,
  );
});
test("rejects future-dated field evidence backups", () => {
  const now = new Date("2026-09-21T12:00:00Z");
  const record = createFieldObservation({ kind: "site", latitude: 38, longitude: -119, capturedAt: "2026-09-21T11:00:00Z" }, "safe", now);
  const packet = createFieldEvidenceExport([record], new Date("2026-09-22T12:00:00Z"));
  assert.throws(() => parseFieldEvidenceImport(JSON.stringify(packet), now), /future/i);
});
test("classifies filing deadlines by urgency", () => {
  const today = new Date("2026-09-14T12:00:00Z");
  assert.equal(daysUntilDeadline("2026-09-20", today), 6);
  assert.equal(deadlineStatus("2026-09-13", today), "overdue");
  assert.equal(deadlineStatus("2026-09-20", today), "urgent");
  assert.equal(deadlineStatus("2026-10-14", today), "upcoming");
});
test("exports source-backed deadlines as calendar reminders", () => {
  const calendar = createDeadlineCalendar(
    [{ id: "federal-2026-12-13", kind: "federal", label: "BLM recording — 90-day maximum", dueDate: "2026-12-13", authority: "U.S. Bureau of Land Management", sourceUrl: "https://www.blm.gov/mining-claims", verifiedAt: "2026-09-14", manuallyVerified: true }],
    "Quartz, Ridge; Project",
    new Date("2026-09-20T20:00:00Z"),
  );
  assert.match(calendar, /BEGIN:VCALENDAR\r\nVERSION:2.0/);
  assert.match(calendar, /DTSTART;VALUE=DATE:20261213/);
  assert.match(calendar, /DTEND;VALUE=DATE:20261214/);
  assert.match(calendar, /SUMMARY:Quartz\\, Ridge\\; Project/);
  assert.match(calendar, /Source verified: 2026-09-14/);
  assert.match(calendar, /does not file\\, record\\, mail\\, or preserve/);
  assert.match(calendar, /URL:https:\/\/www.blm.gov\/mining-claims/);
});
test("calendar export rejects unverified county dates", () => {
  assert.throws(() => createDeadlineCalendar([{ id: "county-unsafe", kind: "county", label: "County deadline", dueDate: "2026-10-01", authority: "Recorder", sourceUrl: "https://example.gov", verifiedAt: "2026-09-20", manuallyVerified: false }]), /confirmed/i);
});
test("requires recorder verification for county deadlines", () =>
  assert.throws(
    () =>
      createTrackedDeadline({
        kind: "county",
        label: "County recording",
        dueDate: "2026-09-30",
        authority: "Nye County Recorder",
        sourceUrl: "https://example.gov",
        verifiedAt: "2026-09-14",
        manuallyVerified: false,
      }),
    /confirmed/i,
  ));
test("rejects unverified county deadlines from storage", () =>
  assert.deepEqual(
    parseTrackedDeadlines(
      '[{"id":"county-x","kind":"county","dueDate":"2026-09-30","sourceUrl":"https://example.gov","manuallyVerified":false}]',
    ),
    [],
  ));
test("never represents a complete packet worksheet as ready to file", () => {
  const review = reviewNevadaPacket({
    claimName: "North Wash",
    claimType: "placer",
    locatorNames: "Test Locator",
    mailingAddress: "1 Main St",
    county: "Nye",
    locationDate: "2026-09-01",
    landDescription: "T1N R2E Sec 3",
    mapHasNorthArrow: true,
    mapHasScale: true,
    mapHasClaimBoundaries: true,
    mapMatchesDescription: true,
  });
  assert.equal(review.status, "agency-review-required");
  assert.equal(review.completed, review.total);
  assert.match(review.warnings.join(" "), /does not generate/i);
});
test("identifies missing packet and map elements", () => {
  const review = reviewNevadaPacket({
    claimName: "",
    claimType: "placer",
    locatorNames: "",
    mailingAddress: "",
    county: "Nye",
    locationDate: "",
    landDescription: "",
    mapHasNorthArrow: false,
    mapHasScale: false,
    mapHasClaimBoundaries: false,
    mapMatchesDescription: false,
  });
  assert.equal(review.status, "incomplete");
  assert.ok(review.missing.includes("Map north arrow"));
});
test("safely rejects malformed packet drafts", () =>
  assert.equal(parseNevadaPacket('{"claimName":1}'), null));
test("federal packet remains agency-review-required when every worksheet field is present", () => {
  const review=reviewFederalPacket({claimName:"North Wash",claimType:"placer",locatorNames:"Example Locator",mailingAddress:"PO Box 1",state:"UT",county:"Tooele",locationDate:"2026-09-20",acreage:"20",landDescription:"T1S R2W Section 3",countyDocumentNumber:"2026-001",countyCopyReady:true,mapAttached:true,mapMatchesLocation:true,currentFeesChecked:true});
  assert.equal(review.status,"agency-review-required");
  assert.equal(review.completed,review.total);
  assert.match(review.warnings.join(" "),/does not create/i);
});
test("federal packet identifies missing county, map, acreage, and fee checks", () => {
  const review=reviewFederalPacket({claimName:"North Wash",claimType:"placer",locatorNames:"Example Locator",mailingAddress:"PO Box 1",state:"UT",county:"",locationDate:"2026-09-20",acreage:"0",landDescription:"T1S R2W Section 3",countyDocumentNumber:"",countyCopyReady:false,mapAttached:false,mapMatchesLocation:false,currentFeesChecked:false});
  assert.equal(review.status,"incomplete");
  assert.ok(review.missing.some(item=>/acreage/i.test(item)));
  assert.ok(review.missing.some(item=>/county recording/i.test(item)));
  assert.ok(review.missing.some(item=>/map/i.test(item)));
});
test("federal packet parser rejects malformed, oversized, and unsafe records", () => {
  assert.equal(parseFederalPacket('{"claimName":1}'),null);
  assert.equal(parseFederalPacket(JSON.stringify({claimName:"A",claimType:"placer",locatorNames:"L",mailingAddress:"M",state:"Utah",county:"C",locationDate:"2026-09-20",acreage:"20",landDescription:"D",countyDocumentNumber:"N",countyCopyReady:true,mapAttached:true,mapMatchesLocation:true,currentFeesChecked:true})),null);
  assert.equal(parseFederalPacket("x".repeat(20_001)),null);
});
test("defines each production security header once", () => {
  const names = webSecurityHeaders.map((header) => header.key.toLowerCase());
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes("content-security-policy"));
  assert.ok(names.includes("strict-transport-security"));
});
test("prevents framing and insecure active content", () => {
  const csp = webSecurityHeaders.find(
    (header) => header.key === "Content-Security-Policy",
  ).value;
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /upgrade-insecure-requests/);
});
test("denies unused sensitive browser capabilities", () => {
  const policy = webSecurityHeaders.find(
    (header) => header.key === "Permissions-Policy",
  ).value;
  assert.match(policy, /camera=\(\)/);
  assert.match(policy, /geolocation=\(\)/);
  assert.match(policy, /microphone=\(\)/);
  assert.match(policy, /payment=\(\)/);
});

test("collects only known ClaimGrid browser records", () => {
  const values = { "claimgrid:research:v1": "[]", "unrelated.secret": "nope" };
  const found = collectLocalRecords((key) => values[key] ?? null);
  assert.equal(found.length, 1);
  assert.equal(found[0].key, "claimgrid:research:v1");
});
test("creates a versioned exact-value local data export", () => {
  const records = [
    {
      key: "claimgrid.claim-draft.v1",
      label: "Claim project draft",
      value: '{\\"name\\":\\"Test\\"}',
    },
  ];
  const packet = createLocalDataExport(
    records,
    new Date("2026-09-14T15:00:00Z"),
  );
  assert.equal(packet.schema, "claimgrid-local-data-v1");
  assert.equal(packet.exportedAt, "2026-09-14T15:00:00.000Z");
  assert.deepEqual(packet.records, records);
});
test("keeps a unique registry for every browser record type", () => {
  const keys = claimGridLocalRecords.map((record) => record.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.every((key) => key.startsWith("claimgrid")));
});

test("Arizona workflow separates State Trust Land from federal claims", () => {
  assert.equal(arizonaWorkflow.state, "AZ");
  assert.match(arizonaWorkflow.notice, /State Trust Land/i);
  assert.ok(
    arizonaWorkflow.steps.some((step) => /State Trust Land/i.test(step.title)),
  );
});
test("Arizona workflow uses freshly reviewed authoritative sources", () => {
  assert.ok(
    arizonaWorkflow.sources.every(
      (source) => source.checkedAt === "2026-09-14",
    ),
  );
  assert.ok(
    arizonaWorkflow.sources.some(
      (source) => source.authority === "Arizona Legislature",
    ),
  );
  assert.ok(
    arizonaWorkflow.sources.every((source) =>
      source.url.startsWith("https://"),
    ),
  );
});
test("Arizona progress rejects Nevada and unknown gate identifiers", () => {
  const ids = arizonaWorkflow.steps.map((step) => step.id);
  assert.deepEqual(
    parseWorkflowProgress('["az-records","records","fake","az-records"]', ids),
    ["az-records"],
  );
});

test("sanitizes a valid BLM claim feature and strips unknown properties", () => {
  const result = sanitizeActiveClaimsGeoJson({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: 7,
        properties: { CSE_NAME: "Test", SECRET: "drop" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-120, 38],
              [-119, 38],
              [-119, 39],
              [-120, 38],
            ],
          ],
        },
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.collection.features[0].properties, {
    CSE_NAME: "Test",
  });
});
test("rejects malformed or out-of-range BLM geometry", () => {
  const result = sanitizeActiveClaimsGeoJson({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-220, 38],
              [-119, 38],
              [-119, 39],
              [-220, 38],
            ],
          ],
        },
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /coordinates/i);
});
test("rejects unsupported upstream geometry types", () => {
  const result = sanitizeActiveClaimsGeoJson({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [-120, 38] },
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /unsupported geometry/i);
});
test("rejects upstream feature counts above the public result cap", () => {
  const result = sanitizeActiveClaimsGeoJson({
    type: "FeatureCollection",
    features: Array.from({ length: 1001 }, () => ({})),
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /feature safety limit/i);
});

test("restores only known unique ClaimGrid backup records", () => {
  const raw = JSON.stringify({
    schema: "claimgrid-local-data-v1",
    storage: "browser-local",
    records: [
      {
        key: "claimgrid.claim-draft.v1",
        label: "spoofed",
        description: "spoofed",
        value: "{}",
      },
    ],
  });
  const result = parseLocalDataExport(raw);
  assert.equal(result.ok, true);
  assert.equal(result.records[0].label, "Claim project draft");
});
test("rejects unknown and duplicate backup storage keys", () => {
  const base = { schema: "claimgrid-local-data-v1", storage: "browser-local" };
  assert.equal(
    parseLocalDataExport(
      JSON.stringify({ ...base, records: [{ key: "other.key", value: "{}" }] }),
    ).ok,
    false,
  );
  const duplicate = { key: "claimgrid.claim-draft.v1", value: "{}" };
  assert.equal(
    parseLocalDataExport(
      JSON.stringify({ ...base, records: [duplicate, duplicate] }),
    ).ok,
    false,
  );
});
test("rejects malformed and oversized local backups", () => {
  assert.match(parseLocalDataExport("not json").error, /valid JSON/i);
  const large = JSON.stringify({
    schema: "claimgrid-local-data-v1",
    storage: "browser-local",
    records: [{ key: "claimgrid.claim-draft.v1", value: "x".repeat(1000001) }],
  });
  assert.match(parseLocalDataExport(large).error, /1 MB/i);
});

test("accepts compatible BLM layer metadata", () => {
  const result = assessBlmLayerMetadata({
    name: "Active Mining Claims",
    currentVersion: 11.5,
    type: "Feature Layer",
    geometryType: "esriGeometryPolygon",
    capabilities: "Map,Query,Data",
    fields: [
      "OBJECTID",
      "CSE_NR",
      "CSE_NAME",
      "CSE_DISP",
      "BLM_PROD",
      "QLTY",
      "RCRD_ACRS",
      "GEO_STATE",
    ].map((name) => ({ name })),
  });
  assert.equal(result.compatible, true);
  assert.equal(result.layerName, "Active Mining Claims");
});
test("validates surface-management and withdrawal layer contracts independently", () => {
  const base = { currentVersion: 11.5, type: "Feature Layer", geometryType: "esriGeometryPolygon", capabilities: "Map,Query,Data" };
  const surface = assessArcGisLayerMetadata({ ...base, name: "Surface Management Agency", fields: ["ADMIN_AGENCY_CODE", "ADMIN_UNIT_NAME", "ADMIN_UNIT_TYPE", "ADMIN_ST"].map(name => ({ name })) }, { layerName: "Surface Management Agency", geometryType: "esriGeometryPolygon", requiredFields: ["ADMIN_AGENCY_CODE", "ADMIN_UNIT_NAME", "ADMIN_UNIT_TYPE", "ADMIN_ST"] });
  assert.equal(surface.compatible, true);
  const withdrawal = assessArcGisLayerMetadata({ ...base, name: "Pending", fields: ["CSE_NR", "CSE_NAME", "CSE_DISP", "SEG_MIN", "SEG_SUR", "QLTY"].map(name => ({ name })) }, { layerName: "Pending", geometryType: "esriGeometryPolygon", requiredFields: ["CSE_NR", "CSE_NAME", "CSE_DISP", "SEG_MIN", "SEG_SUR", "QLTY", "GEO_STATE"] });
  assert.equal(withdrawal.compatible, false);
  assert.match(withdrawal.issues.join(" "), /GEO_STATE/);
});
test("detects a breaking BLM layer schema change", () => {
  const value = {
    name: "Active Mining Claims",
    currentVersion: 11.5,
    type: "Feature Layer",
    geometryType: "esriGeometryPolygon",
    capabilities: "Map,Query,Data",
    fields: [
      "OBJECTID",
      "CSE_NR",
      "CSE_NAME",
      "CSE_DISP",
      "BLM_PROD",
      "QLTY",
      "RCRD_ACRS",
      "GEO_STATE",
    ].map((name) => ({ name })),
  };
  value.geometryType = "esriGeometryPoint";
  value.capabilities = "Map";
  value.fields = value.fields.filter((field) => field.name !== "CSE_NR");
  const result = assessBlmLayerMetadata(value);
  assert.equal(result.compatible, false);
  assert.match(result.issues.join(" "), /polygon geometry/i);
  assert.match(result.issues.join(" "), /Query capability/i);
  assert.match(result.issues.join(" "), /CSE_NR/);
});
test("preserves an official upstream edit timestamp when provided", () => {
  const value = {
    name: "Active Mining Claims",
    currentVersion: 11.5,
    type: "Feature Layer",
    geometryType: "esriGeometryPolygon",
    capabilities: "Map,Query,Data",
    fields: [
      "OBJECTID",
      "CSE_NR",
      "CSE_NAME",
      "CSE_DISP",
      "BLM_PROD",
      "QLTY",
      "RCRD_ACRS",
      "GEO_STATE",
    ].map((name) => ({ name })),
  };
  value.editingInfo = { lastEditDate: 1789344000000 };
  const result = assessBlmLayerMetadata(value);
  assert.equal(result.upstreamLastEditedAt, "2026-09-14T00:00:00.000Z");
});
test("classifies upstream edit-marker age without making a legal freshness claim", () => {
  assert.equal(
    describeSourceFreshness("2026-09-18T00:00:00Z", "2026-09-20T00:00:00Z"),
    "recent-edit",
  );
  assert.equal(
    describeSourceFreshness("2026-08-01T00:00:00Z", "2026-09-20T00:00:00Z"),
    "older-edit",
  );
});
test("treats missing, invalid, and future edit markers as unknown", () => {
  assert.equal(
    describeSourceFreshness(null, "2026-09-20T00:00:00Z"),
    "unknown",
  );
  assert.equal(
    describeSourceFreshness("bad", "2026-09-20T00:00:00Z"),
    "unknown",
  );
  assert.equal(
    describeSourceFreshness("2026-09-21T00:00:00Z", "2026-09-20T00:00:00Z"),
    "unknown",
  );
});

test("California workflow preserves land-status and surface-use gates", () => {
  assert.equal(californiaWorkflow.state, "CA");
  assert.match(californiaWorkflow.notice, /Federal ownership alone/i);
  assert.ok(
    californiaWorkflow.steps.some((step) => /surface-use/i.test(step.title)),
  );
});
test("California workflow uses current authoritative sources", () => {
  assert.ok(
    californiaWorkflow.sources.every(
      (source) => source.checkedAt === "2026-09-14",
    ),
  );
  assert.ok(
    californiaWorkflow.sources.some(
      (source) => source.authority === "California Legislature",
    ),
  );
  assert.ok(
    californiaWorkflow.sources.every((source) =>
      source.url.startsWith("https://"),
    ),
  );
});
test("California progress rejects other-state and unknown gates", () => {
  const ids = californiaWorkflow.steps.map((step) => step.id);
  assert.deepEqual(
    parseWorkflowProgress('["ca-status","az-records","fake","ca-status"]', ids),
    ["ca-status"],
  );
});

test("Oregon workflow preserves land-status, access, and county gates", () => {
  assert.equal(oregonWorkflow.state, "OR");
  assert.match(oregonWorkflow.notice, /mapped gap/i);
  assert.ok(oregonWorkflow.steps.some((step) => /surface-use/i.test(step.title)));
  assert.ok(oregonWorkflow.steps.some((step) => step.phase === "county"));
});
test("Oregon workflow uses source-dated authoritative records", () => {
  assert.ok(oregonWorkflow.sources.every((source) => source.checkedAt === "2026-09-21"));
  assert.ok(oregonWorkflow.sources.some((source) => source.authority === "Oregon Legislature"));
  assert.ok(oregonWorkflow.sources.every((source) => source.url.startsWith("https://")));
});
test("Oregon progress rejects other-state and unknown gates", () => {
  const ids = oregonWorkflow.steps.map((step) => step.id);
  assert.deepEqual(parseWorkflowProgress('["or-status","ca-status","fake","or-status"]', ids), ["or-status"]);
});

test("Utah workflow preserves land-status, access, and recording gates", () => {
  assert.equal(utahWorkflow.state, "UT");
  assert.match(utahWorkflow.notice, /empty claim map/i);
  assert.ok(utahWorkflow.steps.some((step) => /surface-use/i.test(step.title)));
  assert.ok(utahWorkflow.steps.some((step) => step.phase === "county"));
});
test("Utah workflow uses source-dated authoritative records", () => {
  assert.ok(utahWorkflow.sources.every((source) => source.checkedAt === "2026-09-21"));
  assert.ok(utahWorkflow.sources.some((source) => source.authority === "Utah Legislature"));
  assert.ok(utahWorkflow.sources.every((source) => source.url.startsWith("https://")));
});
test("Utah progress rejects other-state and unknown gates", () => {
  const ids = utahWorkflow.steps.map((step) => step.id);
  assert.deepEqual(parseWorkflowProgress('["ut-status","or-status","fake","ut-status"]', ids), ["ut-status"]);
});

test("Colorado workflow preserves land-status, access, and recording gates", () => {
  assert.equal(coloradoWorkflow.state, "CO");
  assert.match(coloradoWorkflow.notice, /empty claim map/i);
  assert.ok(coloradoWorkflow.steps.some((step) => /surface-use/i.test(step.title)));
  assert.ok(coloradoWorkflow.steps.some((step) => step.phase === "county"));
  assert.ok(coloradoWorkflow.steps.some((step) => /discovery work/i.test(step.description)));
});
test("Colorado workflow uses source-dated authoritative records", () => {
  assert.ok(coloradoWorkflow.sources.every((source) => source.checkedAt === "2026-09-21"));
  assert.ok(coloradoWorkflow.sources.some((source) => source.authority === "Colorado General Assembly"));
  assert.ok(coloradoWorkflow.sources.every((source) => source.url.startsWith("https://")));
});
test("Colorado progress rejects other-state and unknown gates", () => {
  const ids = coloradoWorkflow.steps.map((step) => step.id);
  assert.deepEqual(parseWorkflowProgress('["co-status","ut-status","fake","co-status"]', ids), ["co-status"]);
});

test("Idaho workflow separates claim location from stream authorization", () => {
  assert.equal(idahoWorkflow.state, "ID");
  assert.match(idahoWorkflow.notice, /mapped gap/i);
  assert.ok(idahoWorkflow.steps.some((step) => /stream permits/i.test(step.title)));
  assert.ok(idahoWorkflow.steps.some((step) => /does not itself authorize/i.test(step.description)));
  assert.ok(idahoWorkflow.steps.some((step) => step.phase === "county"));
});
test("Idaho workflow uses source-dated authoritative records", () => {
  assert.ok(idahoWorkflow.sources.every((source) => source.checkedAt === "2026-09-21"));
  assert.ok(idahoWorkflow.sources.some((source) => source.authority === "Idaho Legislature"));
  assert.ok(idahoWorkflow.sources.some((source) => source.authority === "Idaho Department of Water Resources"));
  assert.ok(idahoWorkflow.sources.every((source) => source.url.startsWith("https://")));
});
test("Idaho progress rejects other-state and unknown gates", () => {
  const ids = idahoWorkflow.steps.map((step) => step.id);
  assert.deepEqual(parseWorkflowProgress('["id-status","co-status","fake","id-status"]', ids), ["id-status"]);
});

test("accepts a custom research viewport anywhere in the supported US extent", () => {
  const result = validateResearchBounds({
    west: "-106.5",
    south: "38.5",
    east: "-104.5",
    north: "40.5",
  });
  assert.equal(result.ok, true);
  assert.equal(result.bounds.west, -106.5);
});
test("rejects custom viewports outside the supported extent or with reversed edges", () => {
  assert.equal(
    validateResearchBounds({ west: -190, south: 30, east: -189, north: 31 }).ok,
    false,
  );
  assert.equal(
    validateResearchBounds({ west: -110, south: 40, east: -111, north: 41 }).ok,
    false,
  );
});

test("billing accepts only explicit ClaimGrid plans", () => {
  assert.equal(parseBillingPlan("monthly"), "monthly");
  assert.equal(parseBillingPlan("annual"), "annual");
  assert.equal(parseBillingPlan("enterprise"), null);
  assert.equal(parseBillingPlan({}), null);
});
test("billing remains disabled until every server secret and price is valid", () => {
  assert.equal(billingConfiguration({}).ready, false);
  assert.equal(
    billingConfiguration({
      STRIPE_SECRET_KEY: "sk_live_valid123",
      STRIPE_PRO_MONTHLY_PRICE_ID: "price_monthly1",
      STRIPE_PRO_ANNUAL_PRICE_ID: "price_annual1",
    }).ready,
    false,
  );
  assert.equal(
    billingConfiguration({
      STRIPE_SECRET_KEY: "sk_live_valid123",
      STRIPE_PRO_MONTHLY_PRICE_ID: "price_monthly1",
      STRIPE_PRO_ANNUAL_PRICE_ID: "price_annual1",
      STRIPE_WEBHOOK_SECRET: "whsec_valid123",
      CLAIMGRID_ENTITLEMENT_STORE_URL:
        "https://accounts.claimgrid.example/stripe",
      CLAIMGRID_ENTITLEMENT_STORE_TOKEN: "x".repeat(32),
      CLAIMGRID_ACCOUNT_SESSION_URL:
        "https://accounts.claimgrid.example/session",
      CLAIMGRID_ACCOUNT_SESSION_TOKEN: "y".repeat(32),
    }).ready,
    true,
  );
  assert.equal(
    billingConfiguration({
      STRIPE_SECRET_KEY: "pk_live_public",
      STRIPE_PRO_MONTHLY_PRICE_ID: "price_monthly1",
      STRIPE_PRO_ANNUAL_PRICE_ID: "price_annual1",
    }).ready,
    false,
  );
});

test("checkout account identity fails closed unless the server session is verified", () => {
  assert.equal(parseAccountSessionToken("short"), null);
  assert.equal(parseAccountSessionToken("x".repeat(32)), "x".repeat(32));
  assert.equal(parseAccountSessionToken(`${"x".repeat(31)}!`), null);
  assert.deepEqual(
    parseVerifiedAccountSession({ active: true, accountId: "account_12345", email: "miner@example.com" }),
    { accountId: "account_12345", email: "miner@example.com" },
  );
  assert.equal(parseVerifiedAccountSession({ active: false, accountId: "account_12345", email: "miner@example.com" }), null);
  assert.equal(parseVerifiedAccountSession({ active: true, accountId: "../unsafe", email: "miner@example.com" }), null);
  assert.equal(parseVerifiedAccountSession({ active: true, accountId: "account_12345", email: "invalid" }), null);
});

test("parses Stripe signatures without accepting malformed digests", () => {
  const good = "a".repeat(64);
  assert.deepEqual(
    parseStripeSignatureHeader(`t=1789430400,v1=${good},v0=old`),
    { timestamp: 1789430400, signatures: [good] },
  );
  assert.equal(parseStripeSignatureHeader("t=bad,v1=short"), null);
  assert.equal(parseStripeSignatureHeader(null), null);
});

test("Stripe entitlement events require a valid envelope and object type", () => {
  const event = parseStripeWebhookEnvelope({
    id: "evt_valid123",
    type: "checkout.session.completed",
    livemode: true,
    created: 1789430400,
    data: { object: { object: "checkout.session" } },
  });
  assert.deepEqual(event, {
    id: "evt_valid123",
    type: "checkout.session.completed",
    livemode: true,
    created: 1789430400,
    objectType: "checkout.session",
  });
  assert.equal(isStripeFulfillmentEventSafe(event, "sk_live_valid123"), true);
  assert.equal(isStripeFulfillmentEventSafe(event, "sk_test_valid123"), false);
  assert.equal(isStripeFulfillmentEventSafe({ ...event, objectType: "customer" }, "sk_live_valid123"), false);
});

test("Stripe entitlement events fail closed for malformed or incomplete payloads", () => {
  assert.equal(parseStripeWebhookEnvelope({ id: "bad", type: "checkout.session.completed" }), null);
  assert.equal(parseStripeWebhookEnvelope({ id: "evt_valid", type: "checkout.session.completed", livemode: true, created: 1, data: { object: {} } }), null);
  const unsupported = parseStripeWebhookEnvelope({ id: "evt_other", type: "customer.created", livemode: false, created: 1, data: { object: { object: "customer" } } });
  assert.ok(unsupported);
  assert.equal(isStripeFulfillmentEventSafe(unsupported, "sk_test_valid123"), false);
});

test("Stripe fulfillment emits only a minimal account-bound entitlement event", () => {
  const delivery = createStripeEntitlementDelivery({
    id: "evt_checkout123",
    type: "checkout.session.completed",
    livemode: true,
    created: 1789430400,
    data: { object: {
      object: "checkout.session",
      client_reference_id: "account_12345",
      customer: "cus_customer123",
      subscription: "sub_subscription123",
      customer_details: { name: "Private Name", address: { line1: "Private" } },
      metadata: { claimgrid_account_id: "account_12345", unrelated: "discard me" },
    } },
  }, "sk_live_valid123");
  assert.deepEqual(delivery, {
    schemaVersion: 1,
    eventId: "evt_checkout123",
    eventType: "checkout.session.completed",
    livemode: true,
    created: 1789430400,
    accountId: "account_12345",
    customerId: "cus_customer123",
    subscriptionId: "sub_subscription123",
    subscriptionStatus: null,
  });
  assert.equal(JSON.stringify(delivery).includes("Private"), false);
  assert.equal(createStripeEntitlementDelivery({
    id: "evt_mismatch",
    type: "checkout.session.completed",
    livemode: true,
    created: 1789430400,
    data: { object: { object: "checkout.session", client_reference_id: "account_12345", customer: "cus_customer123", subscription: "sub_subscription123", metadata: { claimgrid_account_id: "account_99999" } } },
  }, "sk_live_valid123"), null);
});

test("entitlement storage must explicitly acknowledge the same event", () => {
  assert.equal(isEntitlementDeliveryAcknowledged({ eventId: "evt_123", result: "applied" }, "evt_123"), true);
  assert.equal(isEntitlementDeliveryAcknowledged({ eventId: "evt_123", result: "duplicate" }, "evt_123"), true);
  assert.equal(isEntitlementDeliveryAcknowledged({ eventId: "evt_other", result: "applied" }, "evt_123"), false);
  assert.equal(isEntitlementDeliveryAcknowledged({ eventId: "evt_123", result: "ok" }, "evt_123"), false);
});

test("summarizes only supported BLM claim details", () => {
  const summary = summarizeClaimProperties({
    CSE_NR: " CAMC123 ",
    CSE_NAME: " Example ",
    CSE_DISP: "ACTIVE",
    BLM_PROD: "GOLD",
    QLTY: "Lode",
    RCRD_ACRS: 20.66,
    GEO_STATE: "CA",
    SECRET: "hidden",
  });
  assert.deepEqual(summary, {
    caseNumber: "CAMC123",
    claimName: "Example",
    disposition: "ACTIVE",
    commodity: "GOLD",
    quality: "Lode",
    recordedAcres: 20.66,
    state: "CA",
  });
  assert.equal(Object.prototype.hasOwnProperty.call(summary, "SECRET"), false);
});
test("claim summaries reject invalid acreage and tolerate missing properties", () => {
  assert.equal(summarizeClaimProperties({ RCRD_ACRS: -4 }).recordedAcres, null);
  assert.equal(summarizeClaimProperties(null).caseNumber, null);
});

test("creates screening-only BLM record bookmarks with source context", () => {
  const record = createClaimBookmark(
    {
      recordKey: "CAMC123",
      areaLabel: "Mother Lode",
      bounds: { west: -121, south: 38, east: -120, north: 39 },
      details: summarizeClaimProperties({
        CSE_NR: "CAMC123",
        CSE_NAME: "Test",
      }),
      sourceCheckedAt: "2026-09-15T01:00:00Z",
    },
    new Date("2026-09-15T02:00:00Z"),
  );
  assert.equal(record.screeningOnly, true);
  assert.match(record.id, /CAMC123/);
  assert.equal(record.savedAt, "2026-09-15T02:00:00.000Z");
});
test("claim bookmark storage rejects malformed records", () => {
  assert.deepEqual(parseClaimBookmarks("bad"), []);
  assert.deepEqual(
    parseClaimBookmarks('[{"id":"x","screeningOnly":false}]'),
    [],
  );
});
test("claim bookmarks update duplicates and keep the newest evidence", () => {
  const first = createClaimBookmark({
    recordKey: "CAMC1",
    areaLabel: "Area",
    bounds: { west: -121, south: 38, east: -120, north: 39 },
    details: summarizeClaimProperties({ CSE_NR: "CAMC1" }),
    sourceCheckedAt: "2026-09-15T01:00:00Z",
  });
  const next = { ...first, sourceCheckedAt: "2026-09-15T03:00:00Z" };
  assert.deepEqual(upsertClaimBookmark([first], next), [next]);
});

test("public legal notice preserves required no-availability safeguards", () => {
  assert.equal(legalNoticeHasRequiredSafeguards(), true);
  assert.ok(legalNoticeSections.length >= 6);
});
test("public legal notice has a valid review date", () =>
  assert.match(LEGAL_NOTICE_REVIEWED_AT, /^\d{4}-\d{2}-\d{2}$/));
test("Montana workflow separates claim location from operating permission", () => {
  assert.equal(montanaWorkflow.state, "MT");
  assert.equal(montanaWorkflow.steps.length, 7);
  assert.ok(montanaWorkflow.steps.some((step) => /Montana mining permits/i.test(step.title)));
  assert.ok(montanaWorkflow.steps.some((step) => /does not grant exclusive surface ownership/i.test(step.description)));
  assert.match(montanaWorkflow.notice, /do not establish legal availability/i);
});
test("Montana workflow preserves source dates and official authorities", () => {
  assert.equal(montanaWorkflow.reviewedAt, "2026-09-26");
  assert.ok(montanaWorkflow.sources.every((source) => source.checkedAt === "2026-09-26"));
  assert.ok(montanaWorkflow.sources.some((source) => source.authority === "Montana Department of Environmental Quality"));
  assert.ok(montanaWorkflow.sources.some((source) => /Montana\/Dakotas Mining Claim Packet/.test(source.label)));
});
test("Wyoming workflow separates claim location from state operating permits", () => {
  assert.equal(wyomingWorkflow.state, "WY");
  assert.equal(wyomingWorkflow.steps.length, 7);
  assert.ok(wyomingWorkflow.steps.some((step) => /Wyoming operating permits/i.test(step.title)));
  assert.ok(wyomingWorkflow.steps.some((step) => /does not include exclusive surface rights/i.test(step.description)));
  assert.match(wyomingWorkflow.notice, /do not establish legal availability/i);
});
test("Wyoming workflow preserves source dates and official authorities", () => {
  assert.equal(wyomingWorkflow.reviewedAt, "2026-09-26");
  assert.ok(wyomingWorkflow.sources.every((source) => source.checkedAt === "2026-09-26"));
  assert.ok(wyomingWorkflow.sources.some((source) => source.authority === "Wyoming Legislature"));
  assert.ok(wyomingWorkflow.sources.some((source) => source.authority === "Wyoming Department of Environmental Quality"));
});
test("New Mexico workflow separates claim location from exploration and mining permits", () => {
  assert.equal(newMexicoWorkflow.state, "NM");
  assert.equal(newMexicoWorkflow.steps.length, 7);
  assert.ok(newMexicoWorkflow.steps.some((step) => /New Mexico permits/i.test(step.title)));
  assert.ok(newMexicoWorkflow.steps.some((step) => /does not include exclusive surface rights/i.test(step.description)));
  assert.match(newMexicoWorkflow.notice, /do not establish legal availability/i);
});
test("New Mexico workflow preserves source dates and official authorities", () => {
  assert.equal(newMexicoWorkflow.reviewedAt, "2026-09-26");
  assert.ok(newMexicoWorkflow.sources.every((source) => source.checkedAt === "2026-09-26"));
  assert.ok(newMexicoWorkflow.sources.some((source) => source.authority === "New Mexico Energy, Minerals and Natural Resources Department"));
  assert.ok(newMexicoWorkflow.sources.some((source) => source.authority === "U.S. Bureau of Land Management"));
});
test("Alaska workflow separates state and federal mineral-location systems", () => {
  assert.equal(alaskaWorkflow.state, "AK");
  assert.equal(alaskaWorkflow.steps.length, 8);
  assert.ok(alaskaWorkflow.steps.some((step) => /land and mineral jurisdiction/i.test(step.title)));
  assert.ok(alaskaWorkflow.steps.some((step) => /Record an Alaska state location/i.test(step.title)));
  assert.ok(alaskaWorkflow.steps.some((step) => /Record a federal location with BLM/i.test(step.title)));
  assert.match(alaskaWorkflow.notice, /does not establish legal availability/i);
});
test("Alaska workflow preserves selected-land and annual-maintenance safeguards", () => {
  assert.equal(alaskaWorkflow.reviewedAt, "2026-09-26");
  assert.ok(alaskaWorkflow.sources.every((source) => source.checkedAt === "2026-09-26"));
  assert.ok(alaskaWorkflow.sources.some((source) => /State-selected Land/.test(source.label)));
  assert.ok(alaskaWorkflow.steps.some((step) => /automatic abandonment/i.test(step.description)));
  assert.ok(alaskaWorkflow.sources.some((source) => source.authority === "Alaska Department of Natural Resources"));
});
test("South Dakota workflow separates claim location from exploration and mining permission", () => {
  assert.equal(southDakotaWorkflow.state, "SD");
  assert.equal(southDakotaWorkflow.steps.length, 7);
  assert.ok(southDakotaWorkflow.steps.some((step) => /exploration and mine permits/i.test(step.title)));
  assert.ok(southDakotaWorkflow.steps.some((step) => /does not include exclusive surface rights/i.test(step.description)));
  assert.match(southDakotaWorkflow.notice, /do not establish legal availability/i);
});
test("South Dakota workflow preserves source dates and responsible authorities", () => {
  assert.equal(southDakotaWorkflow.reviewedAt, "2026-09-26");
  assert.ok(southDakotaWorkflow.sources.every((source) => source.checkedAt === "2026-09-26"));
  assert.ok(southDakotaWorkflow.sources.some((source) => source.authority === "South Dakota Department of Agriculture and Natural Resources"));
  assert.ok(southDakotaWorkflow.sources.some((source) => /Montana\/Dakotas Mining Claim Packet/.test(source.label)));
});
test("Washington workflow separates claim location from access and activity permission", () => {
  assert.equal(washingtonWorkflow.state, "WA");
  assert.equal(washingtonWorkflow.steps.length, 7);
  assert.ok(washingtonWorkflow.steps.some((step) => /Washington activity permits/i.test(step.title)));
  assert.ok(washingtonWorkflow.steps.some((step) => /does not authorize prospecting or placer work/i.test(step.description)));
  assert.match(washingtonWorkflow.notice, /do not establish legal availability/i);
});
test("Washington workflow preserves source dates and responsible authorities", () => {
  assert.equal(washingtonWorkflow.reviewedAt, "2026-09-26");
  assert.ok(washingtonWorkflow.sources.every((source) => source.checkedAt === "2026-09-26"));
  assert.ok(washingtonWorkflow.sources.some((source) => source.authority === "Washington State Legislature"));
  assert.ok(washingtonWorkflow.sources.some((source) => source.authority === "Washington Department of Fish and Wildlife"));
  assert.ok(washingtonWorkflow.sources.some((source) => /Oregon\/Washington Mining Claim Packet/.test(source.label)));
});
test("state workflow routing fails closed when a source-reviewed guide is unavailable", () => {
  assert.equal(getStateWorkflowPath("WA"), "/claim/washington");
  assert.equal(getStateWorkflowPath("NV"), "/claim/nevada");
  for (const state of ["AR", "FL", "LA", "MS", "ND", "NE", "", "__proto__"]) {
    assert.equal(getStateWorkflowPath(state), null);
  }
});
test("rejects unsafe saved research evidence", () => { assert.deepEqual(parseResearchSnapshots(JSON.stringify([{ id:"bad", label:"Invalid", bounds:{west:-120,south:38,east:-110,north:39}, activeClaimCount:-1, sourceCheckedAt:"never", savedAt:"never", screeningOnly:true }])), []); assert.throws(() => createResearchSnapshot({ label:"Oversized", bounds:{west:-120,south:38,east:-110,north:39}, activeClaimCount:0, sourceCheckedAt:"2026-09-20T20:00:00Z" }), /five degrees/i); });
test("claim bookmark storage rejects invalid bounds and timestamps", () => { const valid=createClaimBookmark({recordKey:"NV-1",areaLabel:"Test",bounds:{west:-120,south:38,east:-119,north:39},details:{caseNumber:"NV-1",claimName:null,disposition:null,commodity:null,quality:null,recordedAcres:null,state:"NV"},sourceCheckedAt:"2026-09-20T20:00:00Z"},new Date("2026-09-20T21:00:00Z")); assert.deepEqual(parseClaimBookmarks(JSON.stringify([{...valid,sourceCheckedAt:"invalid"}])),[]); assert.deepEqual(parseClaimBookmarks(JSON.stringify([{...valid,bounds:{west:-120,south:38,east:-110,north:39}}])),[]); });
