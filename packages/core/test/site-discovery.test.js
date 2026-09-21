const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizePublicSiteOrigin, PUBLIC_SITE_PATHS } = require("../dist/site-discovery.js");

test("normalizes only path-free HTTPS production origins", () => {
  assert.equal(normalizePublicSiteOrigin("claimgrid.example"), "https://claimgrid.example");
  assert.equal(normalizePublicSiteOrigin("https://claimgrid.example/"), "https://claimgrid.example");
  assert.equal(normalizePublicSiteOrigin("http://claimgrid.example"), null);
  assert.equal(normalizePublicSiteOrigin("https://claimgrid.example/path"), null);
  assert.equal(normalizePublicSiteOrigin("https://user:secret@claimgrid.example"), null);
});

test("public discovery routes never expose API endpoints", () => {
  assert.ok(PUBLIC_SITE_PATHS.includes("/explore"));
  assert.ok(PUBLIC_SITE_PATHS.includes("/legal"));
  assert.ok(PUBLIC_SITE_PATHS.includes("/claim/oregon"));
  assert.ok(PUBLIC_SITE_PATHS.includes("/claim/utah"));
  assert.ok(PUBLIC_SITE_PATHS.includes("/documents/blm"));
  assert.equal(PUBLIC_SITE_PATHS.some(path => path.startsWith("/api/")), false);
  assert.equal(new Set(PUBLIC_SITE_PATHS).size, PUBLIC_SITE_PATHS.length);
});
