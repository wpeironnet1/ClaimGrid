const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assessBlmLayerMetadata,
  buildActiveClaimsQuery,
  describeSourceFreshness,
  sanitizeActiveClaimsGeoJson,
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
  arizonaWorkflow,
  californiaWorkflow,
  nevadaWorkflow,
  oregonWorkflow,
  utahWorkflow,
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
  parseBillingPlan,
  parseStripeSignatureHeader,
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
  assert.equal(snapshot.savedAt, "2026-09-13T18:00:00.000Z");
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

test("parses Stripe signatures without accepting malformed digests", () => {
  const good = "a".repeat(64);
  assert.deepEqual(
    parseStripeSignatureHeader(`t=1789430400,v1=${good},v0=old`),
    { timestamp: 1789430400, signatures: [good] },
  );
  assert.equal(parseStripeSignatureHeader("t=bad,v1=short"), null);
  assert.equal(parseStripeSignatureHeader(null), null);
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
test("rejects unsafe saved research evidence", () => { assert.deepEqual(parseResearchSnapshots(JSON.stringify([{ id:"bad", label:"Invalid", bounds:{west:-120,south:38,east:-110,north:39}, activeClaimCount:-1, sourceCheckedAt:"never", savedAt:"never", screeningOnly:true }])), []); assert.throws(() => createResearchSnapshot({ label:"Oversized", bounds:{west:-120,south:38,east:-110,north:39}, activeClaimCount:0, sourceCheckedAt:"2026-09-20T20:00:00Z" }), /five degrees/i); });
test("claim bookmark storage rejects invalid bounds and timestamps", () => { const valid=createClaimBookmark({recordKey:"NV-1",areaLabel:"Test",bounds:{west:-120,south:38,east:-119,north:39},details:{caseNumber:"NV-1",claimName:null,disposition:null,commodity:null,quality:null,recordedAcres:null,state:"NV"},sourceCheckedAt:"2026-09-20T20:00:00Z"},new Date("2026-09-20T21:00:00Z")); assert.deepEqual(parseClaimBookmarks(JSON.stringify([{...valid,sourceCheckedAt:"invalid"}])),[]); assert.deepEqual(parseClaimBookmarks(JSON.stringify([{...valid,bounds:{west:-120,south:38,east:-110,north:39}}])),[]); });
