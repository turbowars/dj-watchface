// Generates every PNG asset for the Neon City watch face — no image libraries,
// just raw RGBA pixel buffers hand-encoded to PNG with zlib. Re-run after any
// palette or icon-shape change:
//   node scripts/gen-assets.js        (or:  npm run gen-assets)
//
//   resources/ic_steps.png             cyan footprints   (steps)
//   resources/ic_heart.png             magenta heart     (heart rate, live face)
//   resources/ic_heart_aod.png         dim-cyan heart    (heart rate, always-on face)
//   resources/ic_flame.png             cyan flame        (calories)
//   resources/ic_wx_partly_cloudy.png  muted sun + cloud (weather)
//   resources/scanlines.png            faint cyan CRT scanline overlay (336x336)
//   resources/icon.png                 app / gallery icon (80x80)

const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "resources");

// --- Palette ---------------------------------------------------------------
const CYAN = [0x1f, 0xe3, 0xff];
const MAGENTA = [0xff, 0x2e, 0x88];
const BASE = [0x05, 0x06, 0x0a];
const MUTED = [0x5c, 0x66, 0x75];
const AOD_CYAN = [0x0f, 0x8f, 0xa0]; // ~50%-luminance dim cyan for the always-on view

// --- Tiny RGBA canvas ------------------------------------------------------
// A canvas is just width/height plus a flat RGBA byte array (4 bytes/pixel).
function canvas(w, h) {
  return { w, h, data: new Uint8Array(w * h * 4) };
}
// Paint one pixel, alpha-blending the new color over whatever is already there.
function setPx(c, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return; // clip out-of-bounds
  const o = (y * c.w + x) * 4; // byte offset of this pixel
  // standard source-over alpha compositing (sa = source alpha, da = dest alpha)
  const sa = a / 255;
  const da = c.data[o + 3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa === 0) return;
  c.data[o] = Math.round((r * sa + c.data[o] * da * (1 - sa)) / oa);
  c.data[o + 1] = Math.round((g * sa + c.data[o + 1] * da * (1 - sa)) / oa);
  c.data[o + 2] = Math.round((b * sa + c.data[o + 2] * da * (1 - sa)) / oa);
  c.data[o + 3] = Math.round(oa * 255);
}

// Supersampled fill: test 3x3 samples per pixel for cheap anti-aliasing.
function fill(c, color, inside) {
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      let hits = 0;
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          const px = x + (sx + 0.5) / 3;
          const py = y + (sy + 0.5) / 3;
          if (inside(px, py)) hits++;
        }
      }
      if (hits) setPx(c, x, y, color, Math.round((hits / 9) * 255));
    }
  }
}

// --- Icon generators -------------------------------------------------------
// Each returns a filled canvas. They work by handing fill() an "inside(px,py)"
// predicate that describes the shape mathematically.

function heartIcon(size, color) {
  const c = canvas(size, size);
  fill(c, color, (px, py) => {
    // Map pixel space to math space [-1.3, 1.3] with y pointing up.
    const x = (px / size) * 2.6 - 1.3;
    const y = 1.15 - (py / size) * 2.6;
    // Classic implicit heart curve: (x^2 + y^2 - 1)^3 - x^2*y^3 <= 0.
    const v = Math.pow(x * x + y * y - 1, 3) - x * x * Math.pow(y, 3);
    return v <= 0;
  });
  return c;
}

function flameIcon(size, color) {
  const c = canvas(size, size);
  const cx = size / 2;
  fill(c, color, (px, py) => {
    // rounded teardrop: lower circle + tapering top
    const lowerR = size * 0.30;
    const lowerCy = size * 0.66;
    const inLower = (px - cx) ** 2 + (py - lowerCy) ** 2 <= lowerR * lowerR;
    // top taper: triangle from circle shoulders up to an apex
    const apexY = size * 0.14;
    const half = lowerR * (1 - (lowerCy - py) / (lowerCy - apexY));
    const inTop = py <= lowerCy && py >= apexY && Math.abs(px - cx) <= Math.max(half, 0);
    return inLower || inTop;
  });
  return c;
}

function footprintIcon(size, color) {
  const c = canvas(size, size);
  // one foot = a tall sole ellipse + a heel dot below it
  const foot = (px, py, fx, fy, s) => {
    const sx = (px - fx) / (size * 0.12 * s);
    const sy = (py - fy) / (size * 0.18 * s);
    const inSole = sx * sx + sy * sy <= 1;
    const inHeel = (px - fx) ** 2 + (py - (fy + size * 0.24 * s)) ** 2 <= (size * 0.07 * s) ** 2;
    return inSole || inHeel;
  };
  fill(c, color, (px, py) => {
    // two offset footprints (a left step and a right step)
    return (
      foot(px, py, size * 0.36, size * 0.34, 0.95) ||
      foot(px, py, size * 0.62, size * 0.5, 0.95)
    );
  });
  return c;
}

function weatherIcon(size, color) {
  // partly_cloudy_day: a sun (core + rays) upper-left, a flat-bottomed cloud
  // lower-right partially occluding it. Monochrome muted silhouette.
  const c = canvas(size, size);
  const sunX = size * 0.38,
    sunY = size * 0.38,
    sunR = size * 0.15;

  // sun rays — 8 stubs in a ring just outside the core
  fill(c, color, (px, py) => {
    const dx = px - sunX,
      dy = py - sunY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < sunR * 1.35 || d > sunR * 1.95) return false;
    const seg = Math.atan2(dy, dx) / (Math.PI / 4); // 8 directions
    return Math.abs(seg - Math.round(seg)) < 0.17;
  });
  // sun core
  fill(c, color, (px, py) => (px - sunX) ** 2 + (py - sunY) ** 2 <= sunR * sunR);

  // cloud — union of three lobes on a flat base, clipped to a flat bottom
  const baseY = size * 0.74;
  const lobe = (px, py, lx, ly, lr) => (px - lx) ** 2 + (py - ly) ** 2 <= lr * lr;
  fill(c, color, (px, py) => {
    if (py > baseY) return false;
    const inLobes =
      lobe(px, py, size * 0.58, size * 0.6, size * 0.2) ||
      lobe(px, py, size * 0.42, size * 0.66, size * 0.14) ||
      lobe(px, py, size * 0.74, size * 0.64, size * 0.15);
    const inBase =
      px >= size * 0.42 && px <= size * 0.74 && py >= size * 0.58 && py <= baseY;
    return inLobes || inBase;
  });
  return c;
}

// --- Scanline overlay ------------------------------------------------------
function scanlines(w, h, color) {
  const c = canvas(w, h);
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x++) setPx(c, x, y, color, 14); // very faint
  }
  return c;
}

// --- App icon (80x80) ------------------------------------------------------
function appIcon(size) {
  const c = canvas(size, size);
  // base fill
  fill(c, BASE, () => true);
  // cyan rounded border
  const m = 6,
    r = 16;
  fill(c, CYAN, (px, py) => {
    const inRR = roundedRect(px, py, m, m, size - m, size - m, r);
    const inInner = roundedRect(px, py, m + 4, m + 4, size - m - 4, size - m - 4, r - 4);
    return inRR && !inInner;
  });
  // magenta center bar (a neon "colon" nod)
  fill(c, MAGENTA, (px, py) => Math.abs(px - size / 2) <= 4 && py >= size * 0.4 && py <= size * 0.6);
  return c;
}
function roundedRect(px, py, x0, y0, x1, y1, r) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const inx = px > x0 + r && px < x1 - r;
  const iny = py > y0 + r && py < y1 - r;
  if (inx || iny) return true;
  const cx = px < x0 + r ? x0 + r : x1 - r;
  const cy = py < y0 + r ? y0 + r : y1 - r;
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

// --- PNG encoding ----------------------------------------------------------
// Minimal hand-rolled PNG writer: just enough of the spec to emit a single
// truecolor-with-alpha image (no external dependencies).

// CRC-32 used to checksum each PNG chunk (standard polynomial 0xEDB88320).
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

// Wrap a payload as a PNG chunk: [4-byte length][4-byte type][data][4-byte CRC].
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

// Turn a canvas into PNG bytes: signature + IHDR (header) + IDAT (pixels) + IEND.
function encodePNG(c) {
  // Each scanline is prefixed with a 1-byte filter type; 0 = "None" (raw bytes).
  const raw = Buffer.alloc((c.w * 4 + 1) * c.h);
  for (let y = 0; y < c.h; y++) {
    raw[y * (c.w * 4 + 1)] = 0; // filter byte for this row
    for (let x = 0; x < c.w * 4; x++) raw[y * (c.w * 4 + 1) + 1 + x] = c.data[y * c.w * 4 + x];
  }
  // IHDR: width, height, bit depth (8), color type (6 = truecolor + alpha).
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0);
  ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8; // bits per channel
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic number
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)), // pixel data, zlib-compressed
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Encode a canvas and write it to resources/, logging name + dimensions.
function write(name, c) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, encodePNG(c));
  console.log(`  ${name}  (${c.w}x${c.h})`);
}

// --- Generate ---------------------------------------------------------------
const ICON = 32;
write("ic_steps.png", footprintIcon(ICON, CYAN));
write("ic_heart.png", heartIcon(ICON, MAGENTA));
write("ic_heart_aod.png", heartIcon(ICON, AOD_CYAN));
write("ic_flame.png", flameIcon(ICON, CYAN));
write("ic_wx_partly_cloudy.png", weatherIcon(ICON, MUTED));
write("scanlines.png", scanlines(336, 336, CYAN));
write("icon.png", appIcon(80));
console.log("Done.");
