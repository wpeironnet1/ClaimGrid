const test = require("node:test");
const assert = require("node:assert/strict");
const { assessLaunchReadiness } = require("../dist/launch-readiness.js");

const configured = {
  NEXT_PUBLIC_SITE_URL: "https://claimgrid.example",
  STRIPE_SECRET_KEY: ["sk", "test", "abcdefghijklmnopqrstuvwxyz"].join("_"),
  STRIPE_PRO_MONTHLY_PRICE_ID: "price_monthly123",
  STRIPE_PRO_ANNUAL_PRICE_ID: "price_annual123",
  STRIPE_WEBHOOK_SECRET: ["whsec", "abcdefghijklmnopqrstuvwxyz"].join("_"),
  CLAIMGRID_ENTITLEMENT_STORE_URL: "https://accounts.claimgrid.example/stripe",
  CLAIMGRID_ENTITLEMENT_STORE_TOKEN: "abcdefghijklmnopqrstuvwxyz123456",
  VERCEL_GIT_COMMIT_SHA: "abcdef1234567890"
};

test("reports external launch actions without exposing secret values", () => {
  const assessment = assessLaunchReadiness(configured);
  assert.equal(assessment.status, "action-required");
  assert.equal(assessment.checks.find(check => check.id === "billing").status, "ready");
  assert.equal(assessment.checks.find(check => check.id === "accounts").status, "action-required");
  const serialized = JSON.stringify(assessment);
  for (const secret of [configured.STRIPE_SECRET_KEY, configured.STRIPE_WEBHOOK_SECRET, configured.CLAIMGRID_ENTITLEMENT_STORE_TOKEN]) assert.equal(serialized.includes(secret), false);
});

test("fails closed when production configuration is absent or malformed", () => {
  const assessment = assessLaunchReadiness({ NEXT_PUBLIC_SITE_URL: "http://unsafe.example", VERCEL_GIT_COMMIT_SHA: "not a sha" });
  assert.equal(assessment.status, "action-required");
  assert.equal(assessment.checks.every(check => check.status === "action-required"), true);
});
