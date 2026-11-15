// Value normalisation: turns "₹1,499", "Rs. 499/-", "2 lakh+", "2 din",
// "3–5 business days" or "1 Dec 2026" into comparable numbers.
import type { ValueType } from "@/lib/db/schema";

/** A normalised value. Point values have min === max. */
export type Norm = { min: number; max: number; year?: number };

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  hazaar: 1_000,
  hazar: 1_000,
  lakh: 100_000,
  lac: 100_000,
  lakhs: 100_000,
  "लाख": 100_000,
  million: 1_000_000,
  crore: 10_000_000,
  crores: 10_000_000,
  "करोड़": 10_000_000,
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Devanagari digits (०-९) → ASCII digits. */
export function toAsciiDigits(text: string): string {
  return text.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
}

/** "1,499" → 1499, "2 lakh" → 200000, "1.5k" → 1500. Returns null when there is no number. */
export function parseNumber(raw: string): number | null {
  const text = toAsciiDigits(raw).toLowerCase();
  const m = text.match(/(\d[\d,]*(?:\.\d+)?)\s*(k\b|thousand|hazaar|hazar|lakhs?|lac|million|crores?|लाख|करोड़)?/);
  if (!m) return null;
  const base = Number(m[1].replace(/,/g, ""));
  if (Number.isNaN(base)) return null;
  const unit = m[2]?.trim();
  return unit ? base * (MULTIPLIERS[unit] ?? 1) : base;
}

/** Days per unit, so "48 hours" and "2 days" compare equal. */
function durationFactor(text: string): number {
  if (/hour|hr|ghante|घंटे/i.test(text)) return 1 / 24;
  if (/week|hafte|hafta|हफ्ते/i.test(text)) return 7;
  if (/min/i.test(text)) return 1 / 1440;
  return 1; // days, din, business days
}

/** "3-5", "3–5 business days", "3 to 5 din", "2 din" → range in days. */
export function parseDuration(raw: string): Norm | null {
  const text = toAsciiDigits(raw).toLowerCase();
  const factor = durationFactor(text);
  const range = text.match(/(\d+(?:\.\d+)?)\s*(?:-|–|—|to|se)\s*(\d+(?:\.\d+)?)/);
  if (range) return { min: Number(range[1]) * factor, max: Number(range[2]) * factor };
  const single = text.match(/\d+(?:\.\d+)?/);
  if (!single) return null;
  const n = Number(single[0]) * factor;
  return { min: n, max: n };
}

/** "1 Dec 2026", "Dec 1", "1st December", "2026-12-01" → month*100+day (+ year when given). */
export function parseDate(raw: string): Norm | null {
  const text = toAsciiDigits(raw).toLowerCase();
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const md = Number(iso[2]) * 100 + Number(iso[3]);
    return { min: md, max: md, year: Number(iso[1]) };
  }
  const monthIndex = MONTHS.findIndex((m) => new RegExp(`\\b${m}`).test(text));
  if (monthIndex === -1) return null;
  const withoutYear = text.replace(/\b(19|20)\d{2}\b/, " ");
  const day = withoutYear.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (!day) return null;
  const year = text.match(/\b((?:19|20)\d{2})\b/);
  const md = (monthIndex + 1) * 100 + Number(day[1]);
  return { min: md, max: md, year: year ? Number(year[1]) : undefined };
}

/** Normalise any claim or fact value according to its type. */
export function normalizeValue(raw: string, type: ValueType | "superlative" | "certification" | "other"): Norm | null {
  switch (type) {
    case "price":
    case "number":
    case "percent": {
      const n = parseNumber(raw);
      return n === null ? null : { min: n, max: n };
    }
    case "duration":
      return parseDuration(raw);
    case "date":
      return parseDate(raw);
    default:
      return null;
  }
}

/**
 * Does the claim agree with the fact?
 * Equal ranges agree. A single number also agrees with the top of a range
 * ("within 5 days" vs "3–5 days"). Dates compare day+month, and the year only
 * when both sides state one.
 */
export function valuesAgree(claim: Norm, fact: Norm): boolean {
  if (claim.year !== undefined && fact.year !== undefined && claim.year !== fact.year) return false;
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  if (close(claim.min, fact.min) && close(claim.max, fact.max)) return true;
  const claimIsPoint = close(claim.min, claim.max);
  const factIsRange = !close(fact.min, fact.max);
  return claimIsPoint && factIsRange && close(claim.min, fact.max);
}

/** Indian-style number formatting for suggestions: 549 → "549", 1499 → "1,499". */
export function formatIndianNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}
