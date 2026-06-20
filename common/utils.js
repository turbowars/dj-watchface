// Shared helpers used by the app (and available to the companion).

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
];

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Add a leading zero to single-digit numbers. */
export function zeroPad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Format a date as "FRI 20 JUN". */
export function formatDate(date) {
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}
