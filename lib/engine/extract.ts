// Local claim extraction: sentence split + regex. This is the fallback when AI
// is off, and also the base that AI claims are merged into.
import type { AiClaim, Claim, ClaimType } from "./types";

export type Sentence = { text: string; start: number; end: number };

const ABBREVIATIONS = new Set(["co", "rs", "no", "mr", "mrs", "ms", "dr", "st", "vs", "e.g", "i.e", "approx"]);

/** Split text into sentences, keeping character offsets. "Kesar & Co." and "Rs. 499" do not end a sentence. */
export function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  let start = 0;
  const push = (end: number) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) sentences.push({ text: trimmed, start: start + lead, end: start + lead + trimmed.length });
    start = end;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n") {
      push(i + 1);
    } else if (ch === "!" || ch === "?" || ch === "।") {
      // keep runs like "!!" together
      if (!/[!?।]/.test(text[i + 1] ?? "")) push(i + 1);
    } else if (ch === ".") {
      const next = text[i + 1] ?? "";
      if (next !== "" && !/\s/.test(next)) continue; // "4.5", "kesarco.example"
      const wordBefore = text.slice(Math.max(0, i - 8), i).match(/([A-Za-z.]+)$/)?.[1]?.toLowerCase() ?? "";
      if (ABBREVIATIONS.has(wordBefore)) continue;
      push(i + 1);
    }
  }
  push(text.length);
  return sentences;
}

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DURATION_UNIT = "(?:business days?|working days?|days?|din|दिन|hours?|hrs?|ghante|घंटे|weeks?|hafte|minutes?|mins?)";
const BIG_UNIT = "(?:lakhs?|lac|crores?|million|thousand|hazaar|k\\b|लाख|करोड़)";
const D = "[\\d०-९]"; // ASCII or Devanagari digit

// Higher in the list = higher priority when two patterns overlap.
const PATTERNS: { type: ClaimType; re: RegExp }[] = [
  {
    type: "certification",
    re: new RegExp(
      `(?:100\\s?%\\s*)?(?:certified\\s+)?organic(?![- ]sourced|ally)(?:\\s+certified)?|\\bcertified\\b|\\bfssai[- ]?(?:certified|approved)|(?:100\\s?%\\s*)?(?:ऑर्गेनिक|जैविक|प्रमाणित)`,
      "giu",
    ),
  },
  {
    type: "superlative",
    re: /india'?s\s*(?:#|no\.?\s*|number\s*)\s*(?:1|one)\b|(?:#|\bno\.?\s*|\bnumber\s*)\s*(?:1|one)\b(?:\s+in\s+(?:india|the world))?|\bbest in the world\b|\bworld'?s best\b|\bbest[- ]selling\b|\bsabse\s+(?:accha|achha|acha|behtar|best|behtareen)\b|सबसे\s+(?:अच्छा|अच्छी|बेहतरीन|बढ़िया)|नंबर\s*(?:1|१|वन)/giu,
  },
  {
    type: "price",
    re: new RegExp(`(?:₹|\\brs\\.?|\\binr)\\s?${D}[\\d०-९,]*(?:\\.\\d+)?(?:\\s?${BIG_UNIT})?(?:/-)?|${D}[\\d०-९,]*\\s?(?:rupees|rupaye|rupay|रुपये|रुपए)`, "giu"),
  },
  { type: "percent", re: new RegExp(`${D}+(?:\\.\\d+)?\\s?(?:%|percent\\b|pratishat\\b|प्रतिशत)`, "giu") },
  {
    type: "duration",
    re: new RegExp(`${D}+\\s?(?:-|–|to|se)\\s?${D}+[- ]?${DURATION_UNIT}|${D}+[- ]?${DURATION_UNIT}`, "giu"),
  },
  {
    type: "date",
    re: new RegExp(
      `\\b\\d{1,2}(?:st|nd|rd|th)?\\s${MONTH}(?:,?\\s?\\d{4})?|\\b${MONTH}\\s\\d{1,2}(?:st|nd|rd|th)?\\b(?:,?\\s?\\d{4})?|\\b\\d{4}-\\d{2}-\\d{2}\\b`,
      "giu",
    ),
  },
  { type: "number", re: new RegExp(`${D}[\\d०-९,]*(?:\\.\\d+)?\\s?${BIG_UNIT}\\+?|\\b\\d{1,3}(?:,\\d{2,3})+\\+?|\\b\\d{5,}\\+?`, "giu") },
];

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

/** Regex-based claim extraction. Earlier patterns win when spans overlap. */
export function extractClaimsLocal(text: string): Claim[] {
  const claims: Claim[] = [];
  for (const { type, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const raw = m[0];
      const trimmed = raw.trim().replace(/[,.]+$/, ""); // "₹549," → "₹549", "20 Nov." → "20 Nov"
      if (!trimmed) continue;
      const start = m.index + raw.indexOf(trimmed);
      const candidate: Claim = { text: trimmed, start, end: start + trimmed.length, type };
      // A unit glued to a longer word is not a duration ("2 dinner").
      if (type === "duration" && /[A-Za-z]/.test(text[candidate.end] ?? "")) continue;
      if (!claims.some((c) => overlaps(c, candidate))) claims.push(candidate);
    }
  }
  return claims.sort((a, b) => a.start - b.start);
}

/**
 * Merge AI claims into the local ones. AI gives us text (not trusted offsets),
 * so we locate each claim in the draft ourselves and drop any we cannot find.
 * Local claims keep their precise spans; AI adds a subject hint and extra claims.
 */
export function mergeAiClaims(text: string, local: Claim[], aiClaims: AiClaim[]): Claim[] {
  const merged = local.map((c) => ({ ...c }));
  for (const ai of aiClaims) {
    const needle = ai.text.trim();
    if (!needle) continue;
    const start = text.indexOf(needle);
    if (start === -1) continue; // invalid span → drop
    const span = { start, end: start + needle.length };
    const hits = merged.filter((c) => overlaps(c, span));
    if (hits.length > 0) {
      for (const hit of hits) if (ai.subject && !hit.subject) hit.subject = ai.subject;
      continue;
    }
    // "other" claims carry no checkable value, so only keep factual types.
    if (ai.type !== "other") merged.push({ text: needle, ...span, type: ai.type, subject: ai.subject });
  }
  return merged.sort((a, b) => a.start - b.start);
}
