const test = require("node:test");
const assert = require("node:assert/strict");
const { assessLaunchReadiness } = require("../dist/launch-readiness.js");
const { ACCOUNT_DELETION_CONFIRMATION, accountDeletionConfiguration, isAccountDeletionConfirmed, parseAccountDeletionAcknowledgement } = require("../dist/account-lifecycle.js");

const configured = {
  NEXT_PUBLIC_SITE_URL: "https://claimgrid.example",
  STRIPE_SECRET_KEY: ["sk", "test", "abcdefghijklmnopqrstuvwxyz"].join("_"),
  STRIPE_PRO_MONTHLY_PRICE_ID: "price_monthly123",
  STRIPE_PRO_ANNUAL_PRICE_ID: "price_annual123",
  STRIPE_WEBHOOK_SECRET: ["whsec", "abcdefghijklmnopqrstuvwxyz"].join("_"),
  CLAIMGRID_ENTITLEMENT_STORE_URL: "https://accounts.claimgrid.example/stripe",
  CLAIMGRID_ENTITLEMENT_STORE_TOKEN: "abcdefghijklmnopqrstuvwxyz123456",
  CLAIMGRID_ACCOUNT_SESSION_URL: "https://accounts.claimgrid.example/session",
  CLAIMGRID_ACCOUNT_SESSION_TOKEN: "zyxwvutsrqponmlkjihgfedcba654321",
  CLAIMGRID_ACCOUNT_DELETE_URL: "https://accounts.claimgrid.example/delete",
  CLAIMGRID_ACCOUNT_DELETE_TOKEN: "deleteaccounttokenabcdefghijklmn1234",
  VERCEL_GIT_COMMIT_SHA: "abcdef1234567890"
};

test("reports external launch actions without exposing secret values", () => {
  const assessment = assessLaunchReadiness(configured);
  assert.equal(assessment.status, "ready");
  assert.equal(assessment.checks.find(check => check.id === "billing").status, "ready");
  assert.equal(assessment.checks.find(check => check.id === "accounts").status, "ready");
  assert.equal(assessment.checks.find(check => check.id === "account-deletion").status, "ready");
  const serialized = JSON.stringify(assessment);
  for (const secret of [configured.STRIPE_SECRET_KEY, configured.STRIPE_WEBHOOK_SECRET, configured.CLAIMGRID_ENTITLEMENT_STORE_TOKEN, configured.CLAIMGRID_ACCOUNT_SESSION_TOKEN, configured.CLAIMGRID_ACCOUNT_DELETE_TOKEN]) assert.equal(serialized.includes(secret), false);
});

test("billing and accounts remain closed when session introspection is missing", () => {
  const { CLAIMGRID_ACCOUNT_SESSION_URL, CLAIMGRID_ACCOUNT_SESSION_TOKEN, ...withoutAccounts } = configured;
  const assessment = assessLaunchReadiness(withoutAccounts);
  assert.equal(assessment.status, "action-required");
  assert.equal(assessment.checks.find(check => check.id === "billing").status, "action-required");
  assert.equal(assessment.checks.find(check => check.id === "accounts").status, "action-required");
});

test("fails closed when production configuration is absent or malformed", () => {
  const assessment = assessLaunchReadiness({ NEXT_PUBLIC_SITE_URL: "http://unsafe.example", VERCEL_GIT_COMMIT_SHA: "not a sha" });
  assert.equal(assessment.status, "action-required");
  assert.equal(assessment.checks.every(check => check.status === "action-required"), true);
});

test("account deletion requires exact confirmation and exact backend acknowledgement", () => {
  assert.equal(accountDeletionConfiguration(configured).ready, true);
  assert.equal(accountDeletionConfiguration({ CLAIMGRID_ACCOUNT_DELETE_URL: "http://unsafe.test", CLAIMGRID_ACCOUNT_DELETE_TOKEN: "short" }).ready, false);
  assert.equal(isAccountDeletionConfirmed({ confirmation: ACCOUNT_DELETION_CONFIRMATION }), true);
  assert.equal(isAccountDeletionConfirmed({ confirmation: "delete" }), false);
  const acknowledged=parseAccountDeletionAcknowledgement({ accountId:"account_12345", deleted:true, deletedAt:"2026-09-27T16:00:00Z", extra:"discard" },"account_12345");
  assert.deepEqual(acknowledged,{accountId:"account_12345",deleted:true,deletedAt:"2026-09-27T16:00:00Z"});
  assert.equal(parseAccountDeletionAcknowledgement({ accountId:"account_other", deleted:true, deletedAt:"2026-09-27T16:00:00Z" },"account_12345"),null);
  assert.equal(parseAccountDeletionAcknowledgement({ accountId:"account_12345", deleted:false, deletedAt:"2026-09-27T16:00:00Z" },"account_12345"),null);
});
