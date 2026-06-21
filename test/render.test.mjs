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

const view = read("resources/index.view");
const css = read("resources/styles.css");
const app = read("app/index.js");

const idsIn = (s) => new Set([...s.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const viewIds = idsIn(view);

test("layout defines every element the design needs", () => {
  const required = [
    "h1", "h2", "m1", "m2",
    "dateVal", "tempVal", "stepsVal", "hrVal", "calVal", "microRow",
    // always-on view
    "aodTime", "aodHr",
  ];
  for (const id of required) {
    assert.ok(viewIds.has(id), `index.view is missing element id="${id}"`);
  }
});

test("every id the app updates exists in the layout", () => {
  const used = [...app.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map((m) => m[1]);
  assert.ok(used.length >= 8, "expected the app to wire up several elements");
  for (const id of used) {
    assert.ok(viewIds.has(id), `app/index.js uses #${id} but it's not in index.view`);
  }
});

test("every image referenced in the layout exists on disk", () => {
  const refs = [...view.matchAll(/href="([^"]+\.png)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 4, "expected the scanlines + 3 stat icons");
  for (const ref of refs) {
    assert.ok(existsSync(join(root, "resources", ref)), `missing asset resources/${ref}`);
  }
});

test("every CSS class used in the layout has a rule", () => {
  const defined = new Set([...css.matchAll(/\.([A-Za-z][\w-]*)\s*\{/g)].map((m) => m[1]));
  const used = new Set();
  for (const m of view.matchAll(/class="([^"]+)"/g)) {
    m[1].split(/\s+/).forEach((c) => c && used.add(c));
  }
  for (const c of used) {
    assert.ok(defined.has(c), `class "${c}" is used in index.view but not defined in styles.css`);
  }
});

test("the full Chakra Petch time-glyph set exists on disk", () => {
  // The four digit slots swap href at runtime, so most glyphs aren't referenced
  // in the static layout — guard that all ten digits + the colon are present.
  for (let d = 0; d <= 9; d++) {
    assert.ok(existsSync(join(root, "resources", `digit-${d}.png`)), `missing resources/digit-${d}.png`);
  }
  assert.ok(existsSync(join(root, "resources", "colon.png")), "missing resources/colon.png");
});

test("the neon palette is present in the styles", () => {
  for (const hex of ["#1fe3ff", "#ff2e88", "#5c6675"]) {
    assert.ok(css.toLowerCase().includes(hex), `styles.css should use ${hex}`);
  }
});

test("the layout links styles.css inside <defs> (Fitbit OS does not auto-apply it)", () => {
  // Regression guard for a real on-device bug: without a stylesheet <link>, every
  // <text> renders with the default black fill — invisible on the dark background.
  // Fitbit requires the link to live inside the SVG's <defs>.
  const defs = view.match(/<defs[\s\S]*?<\/defs>/);
  assert.ok(defs, "index.view must have a <defs> block");

  // both attributes must be on the SAME <link> element, not merely present somewhere
  const linksStylesheet = (defs[0].match(/<link\b[^>]*>/g) || []).some(
    (tag) => /rel\s*=\s*"stylesheet"/.test(tag) && /href\s*=\s*"styles\.css"/.test(tag),
  );
  assert.ok(
    linksStylesheet,
    'index.view <defs> must contain <link rel="stylesheet" href="styles.css"> or text renders unstyled on-device',
  );
});
