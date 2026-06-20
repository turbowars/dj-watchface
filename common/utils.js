// Shared helpers used by the app (and the preview mirrors these).

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Add a leading zero to single-digit numbers. */
export function zeroPad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Thousands separators: 38640 -> "38,640". */
export function commas(n) {
  // Insert a comma at every non-word-boundary position that is followed by a
  // multiple of three digits (and not more digits after that) — i.e. between
  // each group of three from the right. Rounds first so floats become integers.
  return `${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Short date for the top row: "SAT 20". */
export function formatShortDate(date) {
  return `${DAYS[date.getDay()]} ${date.getDate()}`;
}

/** Meters -> miles string with one decimal: 6280 -> "3.9". */
export function miles(meters) {
  return (meters / 1609.34).toFixed(1);
}
