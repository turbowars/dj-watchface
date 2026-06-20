// Unit tests for the pure helpers in common/utils.js.
//
// utils.js uses ESM `export` syntax but the project root isn't `type: module`,
// so we load it via a data: URL (always parsed as ESM) — this keeps the tests
// runnable with zero dependencies and zero changes to the Fitbit build config.
//
// Run: npm test   (or: node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../common/utils.js", import.meta.url), "utf8");
const u = await import("data:text/javascript," + encodeURIComponent(src));

test("zeroPad pads single digits, leaves two-digit alone", () => {
  assert.equal(u.zeroPad(0), "00");
  assert.equal(u.zeroPad(5), "05");
  assert.equal(u.zeroPad(9), "09");
  assert.equal(u.zeroPad(10), "10");
  assert.equal(u.zeroPad(23), "23");
});

test("commas inserts thousands separators", () => {
  assert.equal(u.commas(0), "0");
  assert.equal(u.commas(999), "999");
  assert.equal(u.commas(1840), "1,840");
  assert.equal(u.commas(38640), "38,640");
  assert.equal(u.commas(1000000), "1,000,000");
});

test("commas rounds fractional input", () => {
  assert.equal(u.commas(8432.7), "8,433");
  assert.equal(u.commas(1839.2), "1,839");
});

test("formatShortDate renders WEEKDAY + day-of-month", () => {
  // 2026-06-20 is a Saturday
  assert.equal(u.formatShortDate(new Date(2026, 5, 20)), "SAT 20");
  // 2026-01-01 is a Thursday
  assert.equal(u.formatShortDate(new Date(2026, 0, 1)), "THU 1");
});

test("miles converts meters with one decimal", () => {
  assert.equal(u.miles(0), "0.0");
  assert.equal(u.miles(1609.34), "1.0");
  assert.equal(u.miles(6280), "3.9");
  assert.equal(u.miles(16093.4), "10.0");
});
