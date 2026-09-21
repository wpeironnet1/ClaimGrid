const test = require("node:test");
const assert = require("node:assert/strict");
const { createSafeServerErrorEvent } = require("../dist/monitoring.js");

test("creates deterministic privacy-safe server error events", () => {
  const error = new Error("secret user content must never be logged");
  const input = { error, method: "post", route: "/api/billing/webhook", routeType: "route", release: "abc123", now: new Date("2026-09-21T00:00:00Z") };
  const first = createSafeServerErrorEvent(input);
  const second = createSafeServerErrorEvent(input);
  assert.deepEqual(first, second);
  assert.equal(first.errorKind, "Error");
  assert.equal(first.method, "POST");
  assert.equal(first.privacy, "no-request-content");
  assert.equal(JSON.stringify(first).includes(error.message), false);
  assert.equal("stack" in first, false);
  assert.equal("headers" in first, false);
});

test("rejects unsafe monitoring labels instead of echoing them", () => {
  const event = createSafeServerErrorEvent({
    error: { message: "private" },
    method: "GET\nAuthorization: secret",
    route: "/claim/123?email=person@example.com",
    routeType: "route",
    release: "bad release!"
  });
  assert.equal(event.errorKind, "UnknownError");
  assert.equal(event.method, "UNKNOWN");
  assert.equal(event.route, "unknown-route");
  assert.equal(event.release, "unknown");
});
