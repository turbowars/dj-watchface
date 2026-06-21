#!/usr/bin/env bash
# Regenerate the hero-time glyph PNGs (Chakra Petch SemiBold) used by index.view.
#
# Fitbit OS can't embed TTFs (only System-Regular/Light/Bold are available), so the
# HH:MM numerals are pre-rendered as images and app/index.js swaps each digit slot's
# href at runtime. Digits 0-9 are near-white (#EAF6FF); the colon is magenta
# (#FF2E88). Rendered at the device's 1:1 size with headless Chrome (the font is
# pulled from Google Fonts, so this needs network).
#
# Run: bash scripts/gen-time-font.sh
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

gen() { # glyph  width  color  outfile
  cat > /tmp/_glyph.html <<HTML
<!DOCTYPE html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:${2}px;height:96px}
.g{width:${2}px;height:96px;display:flex;align-items:center;justify-content:center;
font-family:'Chakra Petch';font-weight:600;font-size:82px;line-height:1;
font-variant-numeric:tabular-nums;color:${3}}</style>
</head><body><div class="g">${1}</div></body></html>
HTML
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --window-size="${2}",96 --virtual-time-budget=4000 \
    --screenshot="$4" "file:///tmp/_glyph.html" 2>/dev/null
}

for d in 0 1 2 3 4 5 6 7 8 9; do gen "$d" 48 "#EAF6FF" "resources/digit-$d.png"; done
gen ":" 28 "#FF2E88" "resources/colon.png"
rm -f /tmp/_glyph.html
echo "Generated resources/digit-0..9.png and resources/colon.png"
