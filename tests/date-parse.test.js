// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const { parse, parseTime } = require("../src/date-parse.js");

// Monday, Nov 9, 2026, 2:15 PM local time.
const NOW = new Date(2026, 10, 9, 14, 15, 0, 0);

// Shows a result as "YYYY-MM-DD HH:MM" in local time, or null.
function p(text, now = NOW) {
  const d = parse(text, now);
  if (!d) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test("relative times", () => {
  assert.strictEqual(p("2h"), "2026-11-09 16:15");
  assert.strictEqual(p("30m"), "2026-11-09 14:45");
  assert.strictEqual(p("in 2 hours"), "2026-11-09 16:15");
  assert.strictEqual(p("3d"), "2026-11-12 08:00");
  assert.strictEqual(p("1w"), "2026-11-16 08:00");
  assert.strictEqual(p("2 days"), "2026-11-11 08:00");
});

test("times on their own", () => {
  assert.strictEqual(p("5pm"), "2026-11-09 17:00");
  assert.strictEqual(p("9am"), "2026-11-10 09:00", "already passed today, so tomorrow");
  assert.strictEqual(p("4:30pm"), "2026-11-09 16:30");
  assert.strictEqual(p("noon"), "2026-11-10 12:00");
  assert.strictEqual(p("tonight"), "2026-11-09 20:00");
  assert.strictEqual(p("later today"), "2026-11-09 17:00");
});

test("tomorrow", () => {
  assert.strictEqual(p("tomorrow"), "2026-11-10 08:00");
  assert.strictEqual(p("tmrw 9am"), "2026-11-10 09:00");
  assert.strictEqual(p("tomorrow at 3"), "2026-11-10 15:00", "bare 3 means 3pm");
  assert.strictEqual(p("tomorrow 10"), "2026-11-10 10:00");
  assert.strictEqual(p("Tomorrow 2:30 PM"), "2026-11-10 14:30");
});

test("weekdays: always the next one", () => {
  assert.strictEqual(p("mon"), "2026-11-16 08:00", "today is Monday, so next Monday");
  assert.strictEqual(p("tue"), "2026-11-10 08:00");
  assert.strictEqual(p("friday 2pm"), "2026-11-13 14:00");
  assert.strictEqual(p("next fri"), "2026-11-13 08:00");
  assert.strictEqual(p("thurs"), "2026-11-12 08:00");
});

test("named periods", () => {
  assert.strictEqual(p("this weekend"), "2026-11-14 08:00");
  assert.strictEqual(p("next week"), "2026-11-16 08:00");
});

test("dates", () => {
  assert.strictEqual(p("nov 20"), "2026-11-20 08:00");
  assert.strictEqual(p("nov 20 10am"), "2026-11-20 10:00");
  assert.strictEqual(p("20 nov"), "2026-11-20 08:00");
  assert.strictEqual(p("december 3rd"), "2026-12-03 08:00");
  assert.strictEqual(p("11/20"), "2026-11-20 08:00");
  assert.strictEqual(p("jan 5"), "2027-01-05 08:00", "passed this year, so next year");
  assert.strictEqual(p("11/1"), "2027-11-01 08:00");
  assert.strictEqual(p("1/5/2028 9am"), "2028-01-05 09:00");
});

test("things that aren't dates return null", () => {
  for (const bad of ["", "asdf", "feb 31", "13/40", "25:00", "mo", "today 9am", "nov 2025", "1/1/2020"]) {
    assert.strictEqual(p(bad), null, bad);
  }
});

test("parseTime", () => {
  assert.deepStrictEqual(parseTime("12am"), [0, 0]);
  assert.deepStrictEqual(parseTime("12pm"), [12, 0]);
  assert.deepStrictEqual(parseTime("21:00"), [21, 0]);
  assert.deepStrictEqual(parseTime("8"), [8, 0]);
  assert.strictEqual(parseTime("13pm"), null);
});

test("Saturday: this weekend means next Saturday", () => {
  const sat = new Date(2026, 10, 14, 10, 0);
  assert.strictEqual(p("this weekend", sat), "2026-11-21 08:00");
});
