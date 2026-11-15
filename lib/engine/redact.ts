// Reversible redaction. Before text goes to an external AI we replace private
// values with placeholders like [NAME_1]. The placeholder map stays on the
// server and is used to restore the AI's answer afterwards.
import type { EngineFact } from "./types";

export type RedactionLevel = "full" | "confidential_only";
export type RedactionResult = { text: string; map: Record<string, string>; count: number };

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?<![\d₹.,])(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;
const INTERNAL_CODE = /\b[A-Z]{2,}-\d+\b/g;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Every way a confidential fact's value (or its product name) might be written in a draft. */
export function confidentialTerms(fact: EngineFact): string[] {
  const terms = new Set<string>();
  for (const alias of [fact.label, ...fact.aliases]) {
    if (alias.trim().split(/\s+/).length >= 2) terms.add(alias.trim()); // multi-word names only ("Winter Blend")
  }
  for (const v of fact.versions) {
    terms.add(v.displayValue);
    if (fact.valueType === "price") {
      for (const prefix of ["₹", "₹ ", "Rs ", "Rs. ", "Rs.", "INR "]) terms.add(`${prefix}${v.value}`);
    } else if (fact.valueType === "date") {
      const m = v.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        const day = String(Number(m[3]));
        const month = MONTHS[Number(m[2]) - 1];
        const short = month.slice(0, 3);
        for (const mo of [month, short]) {
          terms.add(`${day} ${mo} ${m[1]}`);
          terms.add(`${day} ${mo}`);
          terms.add(`${mo} ${day}, ${m[1]}`);
          terms.add(`${mo} ${day}`);
        }
        terms.add(v.value);
      }
    } else if (v.value.length >= 3) {
      terms.add(v.value);
    }
  }
  return [...terms].filter((t) => t.length >= 3);
}

/**
 * Replace private values with placeholders.
 * - "confidential_only": only values of confidential facts (used for Public drafts).
 * - "full": also emails, phone numbers, person names and internal codes (Internal drafts).
 */
export function redact(text: string, options: { level: RedactionLevel; personNames: string[]; facts: EngineFact[] }): RedactionResult {
  const map: Record<string, string> = {};
  const counters: Record<string, number> = {};
  const seen = new Map<string, string>(); // same original → same placeholder
  let count = 0;

  const substitute = (input: string, re: RegExp, label: string) =>
    input.replace(re, (match) => {
      count++;
      const key = `${label}:${match.toLowerCase()}`;
      const existing = seen.get(key);
      if (existing) return existing;
      counters[label] = (counters[label] ?? 0) + 1;
      const placeholder = `[${label}_${counters[label]}]`;
      seen.set(key, placeholder);
      map[placeholder] = match;
      return placeholder;
    });

  let out = text;

  // Confidential fact values first, longest first, so "1 Dec 2026" wins over "1 Dec".
  const secretTerms = options.facts
    .filter((f) => f.tier === "confidential")
    .flatMap(confidentialTerms)
    .sort((a, b) => b.length - a.length);
  for (const term of secretTerms) {
    out = substitute(out, new RegExp(`(?<![A-Za-z0-9])${escapeRegex(term)}(?![A-Za-z0-9])`, "gi"), "FACT");
  }

  if (options.level === "full") {
    out = substitute(out, EMAIL, "EMAIL");
    out = substitute(out, PHONE, "PHONE");
    out = substitute(out, INTERNAL_CODE, "CODE");
    // Full names first, then first names.
    const names = [...new Set(options.personNames.flatMap((n) => [n, n.split(/\s+/)[0]]))].filter((n) => n.length >= 3).sort((a, b) => b.length - a.length);
    for (const name of names) {
      out = substitute(out, new RegExp(`(?<![A-Za-z])${escapeRegex(name)}(?![A-Za-z])`, "gi"), "NAME");
    }
  }

  return { text: out, map, count };
}

/** Put the original values back into text that came from the AI. */
export function restore(text: string, map: Record<string, string>): string {
  return text.replace(/\[(?:FACT|EMAIL|PHONE|CODE|NAME)_\d+\]/g, (placeholder) => map[placeholder] ?? placeholder);
}
