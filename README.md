# DJ Watchface

A DJ / turntable-themed clock face for Fitbit, built with the Fitbit OS SDK.

Shows time, date, live heart rate, and step count over a turntable-platter motif.

## Project layout

```
app/index.js        # Device-side clock face logic
common/utils.js     # Shared helpers (date formatting, padding)
resources/
  index.gui         # SVG layout
  styles.css        # Styling (auto-applied)
  icon.png          # App icon (80x80)
package.json        # Fitbit app manifest + dependencies
```

## Getting started

```bash
npm install              # install the Fitbit SDK + CLI
npx fitbit-build         # build the .fba package
npx fitbit               # open the interactive CLI shell
```

In the `fitbit` shell:

```
build-and-install        # build and push to a connected device / simulator
```

You'll need to be signed in (`login`) and have the Fitbit Simulator running or a
device connected via the Fitbit mobile app's Developer Bridge.

## Customizing

- **Colors / fonts** — edit `resources/styles.css`. The accent color is
  `#1db954`; change it everywhere to re-theme.
- **Layout** — edit `resources/index.gui`. Positions use percentages relative to
  the 336×336 Versa 4 screen.
- **Data** — `app/index.js` reads steps from `user-activity` and BPM from the
  `heart-rate` sensor. Add more fields (calories, distance, floors) from
  `today.adjusted.*`.

## ⚠️ A note on Versa 4 support

The public Fitbit OS SDK officially targets devices up to **Versa 3 / Sense**
(build target `atlas` = Versa 3, which is binary-compatible and the closest
supported target). At the time of writing Fitbit has **not** released a public
SDK build target or App Gallery clock-face support for **Versa 4 / Sense 2**, so
this project cannot be side-loaded onto a retail Versa 4 through the normal
developer flow. It builds and runs in the simulator and on Versa 3 / Sense.

If/when Fitbit ships a Versa 4 build target, update `buildTargets` in
`package.json` accordingly.
