export function parseAmount(value) {
  if (value === null || value === undefined) return 0;
  const text = String(value)
    .replace(/\/-/g, "")
    .replace(/\/=/g, "")
    .replace(/,/g, "")
    .replace(/[₹$€£]/g, " ")
    .replace(/\b(inr|rs\.?|rupees?)\b/gi, " ");
  const match = text.match(/[-+]?\d+(?:\.\d+)?/);
  const amount = match ? Number(match[0]) : 0;
  const suffix = match ? text.slice(match.index + match[0].length).trim().toLowerCase() : "";
  const multiplier = /^cr(?:ore)?\b/.test(suffix)
    ? 10000000
    : /^(lac|lakh)\b/.test(suffix)
    ? 100000
    : /^k\b/.test(suffix)
    ? 1000
    : 1;
  return Number.isFinite(amount) ? amount * multiplier : 0;
}

export function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function startOfDay(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

export function isWithinDateRange(value, range = {}) {
  if (!range.from && !range.to) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const from = startOfDay(range.from);
  const to = endOfDay(range.to);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}
