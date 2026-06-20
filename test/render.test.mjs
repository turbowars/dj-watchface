// Structural "does it render correctly" tests for the Neon City watch face.
//
// These can't run the Fitbit runtime, but they guard the things that silently
// break a clock face: a value element the app updates that doesn't exist in the
// layout, a referenced image asset that's missing, or a CSS class with no rule.
//
// Run: npm test   (or: node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const gui = read("resources/index.gui");
const css = read("resources/styles.css");
const app = read("app/index.js");

const idsIn = (s) => new Set([...s.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const guiIds = idsIn(gui);

test("layout defines every element the design needs", () => {
  const required = [
    "hh", "mm", "timeGlow1", "timeGlow2", "colonGlow",
    "dateVal", "tempVal", "stepsVal", "hrVal", "calVal", "microRow",
    // always-on view
    "aodHh", "aodMm", "aodHr",
  ];
  for (const id of required) {
    assert.ok(guiIds.has(id), `index.gui is missing element id="${id}"`);
  }
});

test("every id the app updates exists in the layout", () => {
  const used = [...app.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map((m) => m[1]);
  assert.ok(used.length >= 8, "expected the app to wire up several elements");
  for (const id of used) {
    assert.ok(guiIds.has(id), `app/index.js uses #${id} but it's not in index.gui`);
  }
});

test("every image referenced in the layout exists on disk", () => {
  const refs = [...gui.matchAll(/href="([^"]+\.png)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 4, "expected the scanlines + 3 stat icons");
  for (const ref of refs) {
    assert.ok(existsSync(join(root, "resources", ref)), `missing asset resources/${ref}`);
  }
});

test("every CSS class used in the layout has a rule", () => {
  const defined = new Set([...css.matchAll(/\.([A-Za-z][\w-]*)\s*\{/g)].map((m) => m[1]));
  const used = new Set();
  for (const m of gui.matchAll(/class="([^"]+)"/g)) {
    m[1].split(/\s+/).forEach((c) => c && used.add(c));
  }
  for (const c of used) {
    assert.ok(defined.has(c), `class "${c}" is used in index.gui but not defined in styles.css`);
  }
});

test("the neon palette is present in the styles", () => {
  for (const hex of ["#1fe3ff", "#ff2e88", "#5c6675"]) {
    assert.ok(css.toLowerCase().includes(hex), `styles.css should use ${hex}`);
  }
});
