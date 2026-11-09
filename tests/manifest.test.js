// Checks that manifest.json is valid and every file it points to exists.
// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

test("uses Manifest V3", () => {
  assert.strictEqual(manifest.manifest_version, 3);
});

test("only asks for the storage permission and Gmail access", () => {
  assert.deepStrictEqual(manifest.permissions, ["storage"]);
  assert.deepStrictEqual(manifest.host_permissions, ["https://mail.google.com/*"]);
});

test("every file referenced in the manifest exists", () => {
  const files = [manifest.options_page, manifest.background.service_worker];
  for (const cs of manifest.content_scripts) files.push(...cs.js, ...(cs.css || []));
  for (const f of files) {
    assert.ok(fs.existsSync(path.join(root, f)), `missing file: ${f}`);
  }
});
