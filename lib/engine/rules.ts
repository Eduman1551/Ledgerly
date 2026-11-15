// Local rule checks: banned terms, brand spelling, slang, emojis, ALL-CAPS,
// language per channel, sentence length, alt text. No AI involved.
import type { Channel, Language } from "@/lib/db/schema";
import { splitSentences } from "./extract";
import { firstHindiWord } from "./language";
import type { EngineIssue, EngineRule } from "./types";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const asNumber = (v: unknown, fallback: number) => (typeof v === "number" ? v : fallback);

/** Regex for a term that tolerates extra spaces and straight/curly apostrophes, with word-ish boundaries. */
function termRegex(term: string): RegExp {
  const body = escapeRegex(term.trim())
    .replace(/\s+/g, "\\s+")
    .replace(/'/g, "['’]?");
  return new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`, "giu");
}

function issueFromRule(rule: EngineRule, partial: Omit<EngineIssue, "claimStatus" | "factVersionId" | "ruleVersionId" | "severity" | "state"> & { severity?: EngineIssue["severity"] }): EngineIssue {
  return {
    claimStatus: null,
    factVersionId: null,
    ruleVersionId: rule.versionId,
    state: "open",
    ...partial,
    severity: partial.severity ?? rule.severity,
  };
}

const ruleRef = (rule: EngineRule) => `"${rule.title}" v${rule.versionNo}`;

export function checkBannedTerms(text: string, rule: EngineRule): EngineIssue[] {
  const issues: EngineIssue[] = [];
  for (const term of asStrings(rule.config.terms)) {
    for (const m of text.matchAll(termRegex(term))) {
      issues.push(
        issueFromRule(rule, {
          kind: "term",
          spanStart: m.index,
          spanEnd: m.index + m[0].length,
          excerpt: m[0],
          explanation: `"${m[0]}" is on the banned-terms list (${ruleRef(rule)}).`,
          suggestion: `Remove "${m[0]}".`,
          replacement: "",
        }),
      );
    }
  }
  return issues;
}

/** Brand spelling: flags every variant that is not written exactly like config.term. */
export function checkRequiredTerm(text: string, rule: EngineRule): EngineIssue[] {
  const term = typeof rule.config.term === "string" ? rule.config.term : "";
  if (!term) return [];
  const pattern = typeof rule.config.pattern === "string" ? rule.config.pattern : "";
  const variants = asStrings(rule.config.variants);
  let re: RegExp | null = null;
  try {
    if (pattern) re = new RegExp(pattern, "giu");
    else if (variants.length) re = new RegExp(variants.map((v) => termRegex(v).source).join("|"), "giu");
  } catch {
    re = null; // a broken admin-entered pattern must not crash the check
  }
  if (!re) return [];

  const issues: EngineIssue[] = [];
  for (const m of text.matchAll(re)) {
    const found = m[0];
    const end = m.index + found.length;
    const before = text[m.index - 1] ?? "";
    const after = text[end] ?? "";
    if (/[@\w]/.test(before)) continue; // part of an email or longer word
    if (found.endsWith(".") && /\w/.test(after)) continue; // "kesarco.example"
    if (!found.endsWith(".") && after === "." && /\w/.test(text[end + 1] ?? "")) continue; // domain name
    if (found === term) continue;
    issues.push(
      issueFromRule(rule, {
        kind: "term",
        spanStart: m.index,
        spanEnd: end,
        excerpt: found,
        explanation: `The brand name must be written exactly "${term}" (${ruleRef(rule)}).`,
        suggestion: `Write "${term}".`,
        replacement: term,
      }),
    );
  }
  return issues;
}

/** Slang, emoji count and ALL-CAPS from the tone rule's config. */
export function checkTone(text: string, rule: EngineRule, channel: Channel): EngineIssue[] {
  const issues: EngineIssue[] = [];
  const config = rule.config;

  // Slang, minus anything explicitly allowed on this channel.
  const allowedHere = asStrings((config.allowed_slang_by_channel as Record<string, unknown> | undefined)?.[channel]).map((s) => s.toLowerCase());
  for (const word of asStrings(config.slang)) {
    if (allowedHere.includes(word.toLowerCase())) continue;
    for (const m of text.matchAll(termRegex(word))) {
      issues.push(
        issueFromRule(rule, {
          kind: "tone",
          spanStart: m.index,
          spanEnd: m.index + m[0].length,
          excerpt: m[0],
          explanation: `"${m[0]}" is casual slang, which the brand voice avoids (${ruleRef(rule)}).`,
          suggestion: `Remove "${m[0]}" or use a warmer, clearer word.`,
          replacement: "",
        }),
      );
    }
  }

  // Emojis above the limit: flag from the first extra emoji to the end of its run.
  const maxEmojis = asNumber(config.max_emojis, 3);
  const emojis = [...text.matchAll(/\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu)];
  if (emojis.length > maxEmojis) {
    const firstExtra = emojis[maxEmojis];
    let end = firstExtra.index + firstExtra[0].length;
    for (const e of emojis.slice(maxEmojis + 1)) {
      if (e.index === end) end = e.index + e[0].length;
      else break;
    }
    issues.push(
      issueFromRule(rule, {
        kind: "tone",
        spanStart: firstExtra.index,
        spanEnd: end,
        excerpt: text.slice(firstExtra.index, end),
        explanation: `The draft uses ${emojis.length} emojis; the brand voice allows at most ${maxEmojis} (${ruleRef(rule)}).`,
        suggestion: `Keep at most ${maxEmojis} emojis.`,
        replacement: "",
        severity: "low",
      }),
    );
  }

  // ALL-CAPS words (3+ letters), except known abbreviations.
  if (config.no_all_caps !== false) {
    const allowed = new Set(asStrings(config.allowed_caps).map((s) => s.toUpperCase()));
    for (const m of text.matchAll(/(?<![A-Za-z0-9-])[A-Z]{3,}(?![A-Za-z0-9-])/g)) {
      if (allowed.has(m[0])) continue;
      const fixed = m[0][0] + m[0].slice(1).toLowerCase();
      issues.push(
        issueFromRule(rule, {
          kind: "tone",
          spanStart: m.index,
          spanEnd: m.index + m[0].length,
          excerpt: m[0],
          explanation: `ALL-CAPS words read as shouting; the brand voice avoids them (${ruleRef(rule)}).`,
          suggestion: `Write "${fixed}".`,
          replacement: fixed,
          severity: "low",
        }),
      );
    }
  }
  return issues;
}

/** Hinglish / Devanagari is only allowed on the channels listed in the rule. */
export function checkLanguage(text: string, rule: EngineRule, channel: Channel, language: Language): EngineIssue[] {
  if (language === "english") return [];
  const allowed = asStrings(rule.config.allowed_channels);
  if (allowed.includes(channel)) return [];
  const anchor = firstHindiWord(text) ?? { start: 0, end: 0 };
  return [
    issueFromRule(rule, {
      kind: "language",
      spanStart: anchor.start,
      spanEnd: anchor.end,
      excerpt: text.slice(anchor.start, anchor.end) || "Whole draft",
      explanation: `This draft is in ${language}, but ${ruleRef(rule)} allows Hinglish and Devanagari only on: ${allowed.join(", ") || "no channels"}. This is a ${channel} draft.`,
      suggestion: "Rewrite this draft in English for this channel.",
      replacement: null,
    }),
  ];
}

/** Long sentences, emoji-only lines and missing alt text. */
export function checkAccessibility(text: string, rule: EngineRule, hasImage: boolean, imageAlt: string | null): EngineIssue[] {
  const issues: EngineIssue[] = [];
  const maxWords = asNumber(rule.config.max_sentence_words, 25);

  for (const s of splitSentences(text)) {
    const words = s.text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
    if (words.length > maxWords) {
      issues.push(
        issueFromRule(rule, {
          kind: "accessibility",
          spanStart: s.start,
          spanEnd: s.end,
          excerpt: s.text.length > 80 ? `${s.text.slice(0, 77)}…` : s.text,
          explanation: `This sentence has ${words.length} words. Sentences over ${maxWords} words are hard to read, especially on screen readers (${ruleRef(rule)}).`,
          suggestion: "Split this into two shorter sentences.",
          replacement: null,
          severity: "low",
        }),
      );
    } else if (words.length === 0 && /\p{Extended_Pictographic}/u.test(s.text) && rule.config.no_emoji_only_lines !== false) {
      issues.push(
        issueFromRule(rule, {
          kind: "accessibility",
          spanStart: s.start,
          spanEnd: s.end,
          excerpt: s.text,
          explanation: `A line with only emojis is read out one emoji at a time by screen readers (${ruleRef(rule)}).`,
          suggestion: "Add words to this line or remove it.",
          replacement: "",
          severity: "low",
        }),
      );
    }
  }

  if (hasImage && !imageAlt?.trim() && rule.config.require_alt_text !== false) {
    issues.push(
      issueFromRule(rule, {
        kind: "accessibility",
        spanStart: 0,
        spanEnd: 0,
        excerpt: "Attached image",
        explanation: `The attached image has no alt text, so screen-reader users cannot know what it shows (${ruleRef(rule)}).`,
        suggestion: "Add a short alt text that describes the image.",
        replacement: null,
        severity: "medium",
      }),
    );
  }
  return issues;
}

/** Run every local rule check that applies. */
export function runRuleChecks(input: {
  text: string;
  channel: Channel;
  language: Language;
  hasImage: boolean;
  imageAlt: string | null;
  rules: EngineRule[];
}): EngineIssue[] {
  const issues: EngineIssue[] = [];
  for (const rule of input.rules) {
    if (rule.kind === "banned_term") issues.push(...checkBannedTerms(input.text, rule));
    if (rule.kind === "required_term") issues.push(...checkRequiredTerm(input.text, rule));
    if (rule.kind === "tone") issues.push(...checkTone(input.text, rule, input.channel));
    if (rule.kind === "language") issues.push(...checkLanguage(input.text, rule, input.channel, input.language));
    if (rule.kind === "accessibility") issues.push(...checkAccessibility(input.text, rule, input.hasImage, input.imageAlt));
  }
  return issues;
}
