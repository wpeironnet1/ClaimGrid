const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");

test("Vercel builds the complete workspace from the repository root", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const rootPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

  assert.equal(config.framework, "nextjs");
  assert.equal(config.buildCommand, "npm run build");
  assert.equal(config.outputDirectory, "apps/web/.next");
  assert.deepEqual(rootPackage.workspaces, ["apps/*", "packages/*"]);
  assert.match(rootPackage.scripts.build, /@claimgrid\/core/);
  assert.match(rootPackage.scripts.build, /@claimgrid\/web/);
});
