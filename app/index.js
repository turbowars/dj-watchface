/*
 * Neon City — Fitbit Versa 4 clock face (device app).
 *
 * What this file does, top to bottom:
 *   1. grabs handles to every SVG node it will update,
 *   2. paints the hero HH:MM time plus the stacked "glow" copies behind it,
 *   3. refreshes the date and activity stats (steps, calories, distance, battery),
 *   4. streams heart rate from the optical sensor,
 *   5. swaps between the bright "live" face and the dimmed "always-on" (AOD)
 *      face, stopping the heart-rate sensor while dimmed to save power.
 *
 * The matching SVG ids live in resources/index.gui, the styling in
 * resources/styles.css, and the pure string/number helpers in common/utils.js.
 */

import clock from "clock";
import document from "document";
import { preferences } from "user-settings";
import { HeartRateSensor } from "heart-rate";
import { today } from "user-activity";
import { battery } from "power";
import { display } from "display";
import * as util from "../common/utils";

// --- Element handles -------------------------------------------------------
// Look every node up once, here: getElementById is comparatively expensive, so
// it must never run inside the per-tick render path.

// The two top-level groups we show/hide (bright live face vs. dimmed AOD face).
const live = document.getElementById("live");
const aod = document.getElementById("aod");

// Live face — crisp time digits + the three faux-bloom copies sitting behind
// them, then the date / stats / micro-row text nodes.
const hh = document.getElementById("hh");
const mm = document.getElementById("mm");
const timeGlow1 = document.getElementById("timeGlow1"); // brighter, tighter cyan bloom
const timeGlow2 = document.getElementById("timeGlow2"); // dimmer, wider cyan bloom
const colonGlow = document.getElementById("colonGlow"); // magenta bloom (only the colon reads through)
const dateVal = document.getElementById("dateVal");
const stepsVal = document.getElementById("stepsVal");
const hrVal = document.getElementById("hrVal");
const calVal = document.getElementById("calVal");
const microRow = document.getElementById("microRow");

// Always-on face — a thinner, dimmer time plus a single heart-rate line.
const aodHh = document.getElementById("aodHh");
const aodMm = document.getElementById("aodMm");
const aodHr = document.getElementById("aodHr");

// Weather and SpO2 have no clock-face API on Fitbit, so they stay static. The
// temperature is written once here and never changes.
const SPO2 = "98%";
const WEATHER_F = "64°";
document.getElementById("tempVal").text = WEATHER_F;

// The face shows only HH:MM, so we wake once a minute instead of once a second
// (~60x fewer JS-runtime wake-ups, i.e. meaningfully better battery life).
clock.granularity = "minutes";

// --- Time ------------------------------------------------------------------
// Format the current time per the user's 12h/24h preference and push it into
// whichever face is currently visible.
function renderTime(now) {
  // 12h convention: 1–12 with no leading zero. 24h: 00–23, zero-padded.
  // Both branches yield a string so the assignments below are type-consistent.
  const hours =
    preferences.clockDisplay === "12h"
      ? `${now.getHours() % 12 || 12}`
      : util.zeroPad(now.getHours());
  const mins = util.zeroPad(now.getMinutes());

  // While dimmed, only the always-on time is visible — refresh it and bail out
  // early; redrawing the hidden live face would be wasted work.
  if (display.aodActive) {
    aodHh.text = hours;
    aodMm.text = mins;
    return;
  }

  hh.text = hours;
  mm.text = mins;
  // The glow layers are plain "HH:MM" copies kept in lockstep with the crisp
  // foreground time, so the stacked faux-bloom lines up exactly.
  timeGlow1.text = timeGlow2.text = colonGlow.text = `${hours}:${mins}`;

  dateVal.text = util.formatShortDate(now);
  updateStats();
}

clock.ontick = (evt) => renderTime(evt.date);

// --- Activity stats --------------------------------------------------------
// Refresh the big trio (steps / calories) and the hairline micro-row below it.
function updateStats() {
  const a = today.adjusted;
  stepsVal.text = util.commas(a.steps || 0);
  calVal.text = util.commas(a.calories || 0);

  const mi = util.miles(a.distance || 0);
  const batt = Math.round(battery.chargeLevel);
  microRow.text = `${mi} MI    SpO2 ${SPO2}    BATT ${batt}%`;
}

// --- Heart rate ------------------------------------------------------------
// HeartRateSensor is undefined on devices/builds without the sensor or the
// permission, so guard before constructing it.
let hrm;
if (HeartRateSensor) {
  hrm = new HeartRateSensor({ frequency: 1 });
  hrm.addEventListener("reading", () => {
    // heartRate is null between valid readings — show "--" instead of "null".
    const bpm = hrm.heartRate || "--";
    hrVal.text = `${bpm}`; // live face: number only (the "BPM" label is static)
    aodHr.text = `${bpm} BPM`; // always-on face: number + unit on one line
  });
}

// --- Always-on display + power management ----------------------------------
// Opt into AOD where the device/build supports it. NOTE: access_aod is
// authorization-gated by Fitbit and never activates on a sideloaded build, so
// the live face is the universal fallback (see README).
if (display.aodAvailable) {
  display.aodAllowed = true;
}

// Show the correct face for the current display state and gate the HR sensor.
// Runs on every display "change" event and once at startup.
function applyMode() {
  const dim = display.aodActive;

  // Exactly one group is visible at a time.
  live.style.display = dim ? "none" : "inline";
  aod.style.display = dim ? "inline" : "none";

  // Only sample heart rate on the bright, interactive face; stop it whenever
  // the screen is off or dimmed, to conserve battery.
  if (hrm) {
    if (display.on && !dim) {
      hrm.start();
    } else {
      hrm.stop();
    }
  }

  // Repaint immediately so the newly shown face isn't stuck on stale text until
  // the next minute tick.
  renderTime(new Date());
}

display.addEventListener("change", applyMode);
applyMode();
