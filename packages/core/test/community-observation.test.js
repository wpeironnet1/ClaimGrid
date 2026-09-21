const test = require("node:test");
const assert = require("node:assert/strict");
const { addCommunityObservationDraft, COMMUNITY_OBSERVATION_CAVEAT, createCommunityObservationDraft, parseCommunityObservationDrafts } = require("../dist/community-observation.js");

const now = new Date("2026-09-21T18:00:00Z");

test("creates only private unverified moderation-required community drafts", () => {
  const draft = createCommunityObservationDraft({ kind: "access-change", summary: "Gate installed across the signed access road.", sourceAttribution: "Observed in person", latitude: 40.1, longitude: -115.2, observedAt: "2026-09-21T17:00:00Z" }, "draft-1", now);
  assert.equal(draft.visibility, "private-draft");
  assert.equal(draft.verificationState, "unverified-community-report");
  assert.equal(draft.moderationRequired, true);
  assert.match(draft.caveat, /not an official record/i);
  assert.equal(draft.caveat, COMMUNITY_OBSERVATION_CAVEAT);
});

test("rejects incomplete coordinates and future community observations", () => {
  assert.throws(() => createCommunityObservationDraft({ kind: "hazard", summary: "Deep open excavation beside the trail.", latitude: 40, observedAt: "2026-09-21T17:00:00Z" }, "bad-coords", now), /complete valid/i);
  assert.throws(() => createCommunityObservationDraft({ kind: "hazard", summary: "Deep open excavation beside the trail.", observedAt: "2026-09-22T17:00:00Z" }, "future", now), /future/i);
});

test("stored community drafts fail closed when safety fields are altered", () => {
  const safe = createCommunityObservationDraft({ kind: "monument-seen", summary: "Weathered post with an unreadable metal tag.", observedAt: "2026-09-21T17:00:00Z" }, "safe", now);
  const unsafe = { ...safe, visibility: "public", caveat: "verified" };
  assert.deepEqual(parseCommunityObservationDrafts(JSON.stringify([safe, unsafe]), now), [safe]);
});

test("community drafts deduplicate and keep the newest record first", () => {
  const old = createCommunityObservationDraft({ kind: "other", summary: "Initial field observation awaiting verification.", observedAt: "2026-09-21T16:00:00Z" }, "same", now);
  const replacement = { ...old, summary: "Updated field observation awaiting verification." };
  assert.deepEqual(addCommunityObservationDraft([old], replacement), [replacement]);
});
