const test = require("node:test");
const assert = require("node:assert/strict");
const {
  BLM_MAINTENANCE_SOURCE_REVIEWED_AT,
  BLM_MAINTENANCE_SOURCE_URL,
  createBlmMaintenanceDeadlines,
} = require("../dist/deadline.js");

test("creates a source-dated September fee reminder", () => {
  const deadlines = createBlmMaintenanceDeadlines({
    calendarYear: 2027,
    path: "fee",
  });
  assert.equal(deadlines.length, 1);
  assert.equal(deadlines[0].dueDate, "2027-09-01");
  assert.equal(deadlines[0].kind, "maintenance");
  assert.equal(deadlines[0].sourceUrl, BLM_MAINTENANCE_SOURCE_URL);
  assert.equal(deadlines[0].verifiedAt, BLM_MAINTENANCE_SOURCE_REVIEWED_AT);
  assert.match(deadlines[0].label, /verify amount and submit/i);
});

test("keeps waiver certification and follow-up as separate reminders", () => {
  const deadlines = createBlmMaintenanceDeadlines({
    calendarYear: 2027,
    path: "waiver",
    waiverEligibilityConfirmed: true,
  });
  assert.deepEqual(
    deadlines.map((item) => item.dueDate),
    ["2027-09-01", "2027-12-30"],
  );
  assert.match(deadlines[0].label, /verify eligibility/i);
  assert.match(deadlines[1].label, /assessment affidavit or notice of intent/i);
});

test("does not infer waiver eligibility", () => {
  assert.throws(
    () => createBlmMaintenanceDeadlines({ calendarYear: 2027, path: "waiver" }),
    /ownership limit/i,
  );
});

test("rejects malformed maintenance years and paths", () => {
  assert.throws(
    () => createBlmMaintenanceDeadlines({ calendarYear: 2027.5, path: "fee" }),
    /valid maintenance calendar year/i,
  );
  assert.throws(
    () => createBlmMaintenanceDeadlines({ calendarYear: 2027, path: "other" }),
    /maintenance-fee or waiver path/i,
  );
});
