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
 * The matching SVG ids live in resources/index.view, the styling in
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

// Live face — the hero time is four Chakra Petch digit images (Fitbit can't
// embed TTFs, so the numerals are pre-rendered PNG glyphs we swap by href),
// with three faux-bloom text copies behind them for the cyan glow.
const h1 = document.getElementById("h1"); // hours tens
const h2 = document.getElementById("h2"); // hours ones
const m1 = document.getElementById("m1"); // minutes tens
const m2 = document.getElementById("m2"); // minutes ones
const timeGlow1 = document.getElementById("timeGlow1"); // brighter, tighter cyan bloom
const timeGlow2 = document.getElementById("timeGlow2"); // dimmer, wider cyan bloom
const colonGlow = document.getElementById("colonGlow"); // magenta bloom (only the colon reads through)
const dateVal = document.getElementById("dateVal");
const stepsVal = document.getElementById("stepsVal");
const hrVal = document.getElementById("hrVal");
const calVal = document.getElementById("calVal");
const microRow = document.getElementById("microRow");

// Always-on face — a thinner, dimmer time plus a single heart-rate line.
const aodTime = document.getElementById("aodTime");
const aodHr = document.getElementById("aodHr");

hrVal.text = "--";
aodHr.text = "-- BPM";

// SpO2 has no clock-face API on Fitbit, so it stays a static placeholder.
const SPO2 = "98%";

// --- Weather ---------------------------------------------------------------
// Weather also has no native Fitbit API: a companion app would fetch it and
// push it to the watch over the Messaging API. Until a reading actually arrives
// we have no data, so we hide the ENTIRE weather group (icon + temperature)
// rather than show a stale or placeholder value. Wire a companion to call
// setWeather({ tempText: "64°" }) when real data comes through.
const weather = document.getElementById("weather");
const tempVal = document.getElementById("tempVal");

function setWeather(data) {
  const hasData = data && data.tempText;
  weather.style.display = hasData ? "inline" : "none";
  if (hasData) tempVal.text = data.tempText;
}

// No companion is connected, so no data comes through → weather starts hidden.
setWeather(null);

// The face shows only HH:MM, so we wake once a minute instead of once a second
// (~60x fewer JS-runtime wake-ups, i.e. meaningfully better battery life).
clock.granularity = "minutes";

// --- Time ------------------------------------------------------------------
// Format the current time per the user's 12h/24h preference and push it into
// whichever face is currently visible.
function renderTime(now) {
  // Always two digits so the four fixed digit slots stay filled (12h shows "09").
  const h = preferences.clockDisplay === "12h" ? now.getHours() % 12 || 12 : now.getHours();
  const hours = util.zeroPad(h);
  const mins = util.zeroPad(now.getMinutes());

  // While dimmed, only the always-on time is visible — refresh it and bail out
  // early; redrawing the hidden live face would be wasted work.
  if (display.aodActive) {
    aodTime.text = `${hours}:${mins}`;
    return;
  }

  // Point each digit slot at its glyph PNG (e.g. "2" -> digit-2.png).
  h1.href = `digit-${hours[0]}.png`;
  h2.href = `digit-${hours[1]}.png`;
  m1.href = `digit-${mins[0]}.png`;
  m2.href = `digit-${mins[1]}.png`;
  // The faint System-Bold glow copies behind the digits supply the cyan bloom.
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
  microRow.text = `${mi} MI · SpO2 ${SPO2} · BATT ${batt}%`;
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
// AOD is implemented but DISABLED for distribution: access_aod is omitted from
// package.json (it's authorization-gated by Fitbit and blocks sideloading). With
// the permission absent, display.aodActive never becomes true, so the live face
// always shows. To re-enable AOD: add "access_aod" back to requestedPermissions
// AND set `display.aodAllowed = true` here.

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
