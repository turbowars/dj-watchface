# Neon City — Fitbit Versa 4 Watchface

A cyberpunk **cyan × magenta** clock face for the Fitbit Versa 4 (336×336 AMOLED),
built for Dheeraj. Deep negative space on a true-black ground, a hero digital time
with a layered cyan bloom and a magenta colon, a cyan→magenta accent rule, and a
supporting trio of steps / heart rate / calories over a hairline micro-row
(distance · SpO₂ · battery). Ships a dimmed **Always-On** variant.

![Neon City watchface preview](preview/screenshot.png)

## Project layout

```
app/index.js          # Device-side clock face logic (time, stats, HR, AOD)
common/utils.js       # Shared helpers (zeroPad, commas, date, miles)
resources/
  index.gui           # SVG layout — #live + #aod groups
  styles.css          # Styling (auto-applied)
  *.png               # Generated assets (see scripts/gen-assets.js)
scripts/gen-assets.js # Procedurally generates all PNGs (icons, scanlines, app icon)
preview/index.html    # Browser preview of the face (live + AOD, with toggles)
test/                 # Structural (render) + unit (utils) tests, run with node --test
package.json          # Fitbit app manifest + dependencies
```

## Getting started

```bash
npm install              # install the Fitbit SDK + CLI
npm run gen-assets       # (re)generate resources/*.png
npm test                 # run structural + unit tests
npx fitbit-build         # build the .fba package
npx fitbit               # open the interactive CLI shell (build-and-install)
```

You'll need to be signed in (`login`) with the Fitbit Simulator running or a device
connected via the Fitbit mobile app's Developer Bridge.

## Design tokens

| Role | Value |
|------|-------|
| Base | `#05060A` (radial center `#0A0D14`) |
| Cyan | `#1FE3FF` |
| Magenta | `#FF2E88` |
| Text | `#EAF6FF` |
| Muted | `#5C6675` |

The palette lives in `scripts/gen-assets.js` (icon colors) and `resources/styles.css`
(text colors); the preview mirrors it in its `:root`. A `render.test` assertion guards
that the core hexes stay present in the stylesheet.

## On-device fidelity notes

Fitbit OS is more limited than the browser, so the device build approximates the
design in a few documented ways:

- **Glow** — there is no SVG blur / `text-shadow`, so the cyan/magenta bloom is faked
  with stacked low-opacity copies of the time (`.glow1` / `.glow2` / `.colonGlow`).
- **Font** — arbitrary TTFs aren't supported without a bundled bitmap font, so the
  squared "Chakra Petch" look is rendered with built-in `System-Bold`. The browser
  preview uses the real Chakra Petch via Google Fonts.
- **Accent rule** — a real `<gradientRect>` (Fitbit's gradient primitive), squared ends.
- **Weather** — no clock-face API exposes it; a companion would push it over the
  Messaging API. Until real data arrives the **entire weather section is hidden**
  (no stale placeholder) — see `setWeather()` in `app/index.js`. **SpO₂** stays a
  static placeholder for now.

## Always-On display (AOD)

The dimmed AOD view (thin ~50%-luminance time + heart rate only, no magenta, no glow
or scanlines) is wired via the `display` API and the `access_aod` permission.

> ⚠️ **AOD is authorization-gated by Fitbit.** `access_aod` requires special
> authorization and only activates in the Fitbit OS Simulator or an authorized App
> Gallery build — AOD clock faces **cannot be sideloaded**. On any build where AOD
> isn't authorized, `display.aodActive` stays `false` and the normal live face is
> shown. That fallback is by design, not a bug.

## Customizing

- **Colors** — edit the palette in `scripts/gen-assets.js` (then `npm run gen-assets`)
  and `resources/styles.css`.
- **Layout** — edit `resources/index.gui` (absolute coordinates on the 336×336 screen).
- **Icons** — the steps / heart / flame / weather glyphs are drawn procedurally in
  `scripts/gen-assets.js`; tweak the shape predicates and regenerate.
- **Data** — `app/index.js` reads steps/calories/distance from `user-activity`, BPM
  from the `heart-rate` sensor, and battery from `power`.
