const test = require("node:test");
const assert = require("node:assert/strict");
const { buildActiveClaimsQuery, validateResearchBounds } = require("../dist/blm.js");
test("accepts a bounded US viewport", () => assert.equal(validateResearchBounds({ west: -120, south: 38, east: -119, north: 39 }).ok, true));
test("rejects an oversized request", () => assert.match(validateResearchBounds({ west: -125, south: 30, east: -110, north: 40 }).error, /five degrees/i));
test("builds a constrained GeoJSON query", () => { const url = buildActiveClaimsQuery({ west: -120, south: 38, east: -119, north: 39 }); assert.equal(url.searchParams.get("f"), "geojson"); assert.equal(url.searchParams.get("resultRecordCount"), "1000"); assert.match(url.searchParams.get("outFields"), /QLTY/); });
