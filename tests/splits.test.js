// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const S = require("../src/splits.js");

const sample = [
  { id: "important", name: "Important", priority: 3, rules: [{ type: "query", value: "is:important" }] },
  { id: "datadog", name: "Datadog", priority: 1, rules: [{ type: "domain", value: "datadoghq.com" }] },
  { id: "empty", name: "Empty", priority: 2, rules: [] },
];

test("each rule type becomes the right Gmail search", () => {
  assert.strictEqual(S.ruleToQuery({ type: "sender", value: " Alerts@DatadogHQ.com " }), 'from:"alerts@datadoghq.com"');
  assert.strictEqual(S.ruleToQuery({ type: "domain", value: "@quo.com" }), "from:(@quo.com)");
  assert.strictEqual(
    S.ruleToQuery({ type: "involves", value: "help@x.com" }),
    '(from:"help@x.com" OR to:"help@x.com" OR cc:"help@x.com")'
  );
  assert.strictEqual(S.ruleToQuery({ type: "query", value: "is:important" }), "(is:important)");
  assert.strictEqual(S.ruleToQuery({ type: "sender", value: "  " }), "");
  assert.strictEqual(S.ruleToQuery({ type: "nonsense", value: "x" }), "");
});

test("several rules in one split are joined with OR", () => {
  const q = S.matchQuery({
    rules: [
      { type: "sender", value: "a@b.com" },
      { type: "domain", value: "c.com" },
    ],
  });
  assert.strictEqual(q, '(from:"a@b.com" OR from:(@c.com))');
});

test("a split leaves out mail claimed by higher-priority splits", () => {
  assert.strictEqual(S.tabQuery(sample, "datadog"), "in:inbox from:(@datadoghq.com)");
  assert.strictEqual(S.tabQuery(sample, "important"), "in:inbox (is:important) -from:(@datadoghq.com)");
});

test("a split with no rules has no search yet", () => {
  assert.strictEqual(S.tabQuery(sample, "empty"), "");
});

test("Other excludes every split that has rules", () => {
  assert.strictEqual(S.tabQuery(sample, S.OTHER_ID), "in:inbox -from:(@datadoghq.com) -(is:important)");
});

test("tabs keep display order and add Other last", () => {
  assert.deepStrictEqual(
    S.tabs(sample).map((t) => t.id),
    ["important", "datadog", "empty", "other"]
  );
});

test("URL hash round-trips, including Gmail's + for spaces", () => {
  const q = "in:inbox from:(@datadoghq.com)";
  assert.strictEqual(S.hashToQuery(S.searchHash(q)), q);
  assert.strictEqual(S.hashToQuery("#search/in%3Ainbox+from%3A(%40datadoghq.com)"), q);
  assert.strictEqual(S.hashToQuery("#inbox"), null);
  assert.strictEqual(S.hashToQuery("#search/" + S.searchHash(q).slice(8) + "/FMfcgz123"), q);
});

test("activeTabId finds the tab for the current URL", () => {
  assert.strictEqual(S.activeTabId(sample, S.searchHash(S.tabQuery(sample, "datadog"))), "datadog");
  assert.strictEqual(S.activeTabId(sample, S.searchHash(S.tabQuery(sample, "other"))), "other");
  assert.strictEqual(S.activeTabId(sample, "#search/something+else"), null);
  assert.strictEqual(S.activeTabId(sample, "#inbox"), null);
});

test("normalizeSplits repairs saved data", () => {
  const out = S.normalizeSplits([
    { name: "B", priority: 10, rules: [{ type: "sender", value: "x@y.com" }, { type: "bad", value: "z" }, null] },
    { name: "  " },
    { id: "other", name: "Other clash", priority: 2 },
    { name: "A", priority: 5 },
  ]);
  assert.deepStrictEqual(out.map((s) => s.name), ["B", "Other clash", "A"]);
  assert.deepStrictEqual(out.map((s) => s.priority), [3, 1, 2]);
  assert.notStrictEqual(out[1].id, "other");
  assert.deepStrictEqual(out[0].rules, [{ type: "sender", value: "x@y.com" }]);
  assert.strictEqual(out[0].id, "b");
});

test("normalizeSplits falls back to defaults when nothing is saved", () => {
  const out = S.normalizeSplits(undefined);
  assert.deepStrictEqual(
    out.map((s) => s.name),
    ["Important", "Calendar", "Matt Levine", "Customer support", "Quo", "Datadog"]
  );
});

test("default splits: Calendar claims before Important", () => {
  const d = S.normalizeSplits(S.DEFAULT_SPLITS);
  assert.ok(S.tabQuery(d, "important").includes('-((filename:invite.ics) OR from:"calendar-notification@google.com")'));
});

// ---- Shift+S / Shift+N ------------------------------------------------------

const base = () => S.normalizeSplits(S.DEFAULT_SPLITS);

test("addRule puts a sender into a split", () => {
  const r = S.addRule(base(), "datadog", { type: "domain", value: "@DatadogHQ.com " });
  const dd = r.splits.find((s) => s.id === "datadog");
  assert.deepStrictEqual(dd.rules, [{ type: "domain", value: "datadoghq.com" }]);
  assert.deepStrictEqual(r.movedFrom, []);
  assert.strictEqual(r.target, "Datadog");
  assert.strictEqual(S.tabQuery(r.splits, "datadog").startsWith("in:inbox from:(@datadoghq.com)"), true);
});

test("addRule moves a sender out of the split it was in", () => {
  let sp = S.addRule(base(), "quo", { type: "sender", value: "a@b.com" }).splits;
  const r = S.addRule(sp, "datadog", { type: "involves", value: "A@b.com" });
  assert.deepStrictEqual(r.movedFrom, ["Quo"]);
  assert.deepStrictEqual(r.splits.find((s) => s.id === "quo").rules, []);
  assert.deepStrictEqual(r.splits.find((s) => s.id === "datadog").rules, [{ type: "involves", value: "a@b.com" }]);
});

test("addRule on the same split twice doesn't duplicate", () => {
  let sp = S.addRule(base(), "quo", { type: "sender", value: "a@b.com" }).splits;
  const r = S.addRule(sp, "quo", { type: "sender", value: "a@b.com" });
  assert.strictEqual(r.splits.find((s) => s.id === "quo").rules.length, 1);
  assert.deepStrictEqual(r.movedFrom, []);
});

test("a domain rule and an address rule don't clash", () => {
  let sp = S.addRule(base(), "quo", { type: "domain", value: "b.com" }).splits;
  const r = S.addRule(sp, "datadog", { type: "sender", value: "x@b.com" });
  assert.deepStrictEqual(r.movedFrom, []);
});

test("ownersOf names the split a sender is in", () => {
  const sp = S.addRule(base(), "quo", { type: "sender", value: "a@b.com" }).splits;
  assert.deepStrictEqual(S.ownersOf(sp, { type: "sender", value: "A@B.com" }), ["Quo"]);
  assert.deepStrictEqual(S.ownersOf(sp, { type: "domain", value: "b.com" }), []);
});

test("addSplit adds a split that claims mail before Important", () => {
  const r = S.addSplit(base(), "Investors");
  const inv = r.splits.find((s) => s.id === r.id);
  const imp = r.splits.find((s) => s.id === "important");
  assert.strictEqual(r.id, "investors");
  assert.strictEqual(r.splits[r.splits.length - 1].name, "Investors", "shown last");
  assert.ok(inv.priority < imp.priority, "claims before Important");
  assert.throws(() => S.addSplit(r.splits, "investors"), /already a split/);
  assert.throws(() => S.addSplit(r.splits, "  "), /needs a name/);
});

test("addSplit can start with a raw search, and 'Other' is reserved", () => {
  assert.throws(() => S.addSplit(base(), "other"), /built in/);
  const r = S.addSplit(base(), "Newsletters", "label:x");
  assert.deepStrictEqual(r.splits.find((s) => s.id === r.id).rules, [{ type: "query", value: "label:x" }]);
});
