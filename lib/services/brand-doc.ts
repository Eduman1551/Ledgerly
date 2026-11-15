// "Import from brand doc" (workflow step 1). Proposes rules and facts from a
// pasted guideline document. NOTHING is saved here: the admin reviews the
// proposals and ticks which ones to add.
import { z } from "zod";
import { RULE_KINDS, VALUE_TYPES } from "@/lib/db/schema";

export const proposalsSchema = z.object({
  rules: z
    .array(
      z.object({
        kind: z.enum(RULE_KINDS),
        title: z.string().min(2).max(120),
        body: z.string().min(5).max(1000),
        terms: z.array(z.string()).max(30).optional().describe("For banned_term rules: the banned phrases. For tone rules: slang words to avoid."),
      }),
    )
    .max(20),
  facts: z
    .array(
      z.object({
        label: z.string().min(2).max(120),
        valueType: z.enum(VALUE_TYPES),
        value: z.string().min(1).max(200),
        sourceName: z.string().max(120).optional(),
      }),
    )
    .max(20),
});

export type DocProposals = z.infer<typeof proposalsSchema>;

const quoted = (line: string) => [...line.matchAll(/["“']([^"”']{2,40})["”']/g)].map((m) => m[1].trim());

/**
 * Simple local parser (the no-AI fallback). It understands lines such as:
 *   Never say "miracle" or "cure".            → banned-term rule
 *   Always write "Kesar & Co."                → required-term rule
 *   Avoid slang like "bro".                   → tone rule
 *   Gift box price: ₹899                      → fact (price)
 *   Delivery time: 3-5 business days          → fact (duration)
 */
export function parseBrandDocLocally(text: string, sourceName = "Imported brand doc"): DocProposals {
  const rules: DocProposals["rules"] = [];
  const facts: DocProposals["facts"] = [];
  const lines = text
    .split(/\n|(?<=[.!?])\s+(?=[A-Z])/)
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, "").trim())
    .filter((l) => l.length >= 5);

  for (const line of lines) {
    const terms = quoted(line);

    // "Label: value" lines with a number are facts.
    const pair = line.match(/^([A-Za-z][^:]{2,60}):\s*(.+)$/);
    if (pair && /\d/.test(pair[2]) && pair[2].length <= 80) {
      const value = pair[2].replace(/\.$/, "");
      const valueType = /₹|rs\.?\s?\d|inr/i.test(value) ? "price" : /%/.test(value) ? "percent" : /\b(days?|hours?|weeks?|din)\b/i.test(value) ? "duration" : /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\d{4}-\d{2}-\d{2}/i.test(value) ? "date" : "number";
      facts.push({ label: pair[1].trim(), valueType, value, sourceName });
      continue;
    }

    if (/\b(never|don'?t|do not|avoid|banned|must not)\b/i.test(line) && terms.length > 0) {
      const isTone = /\b(slang|casual|tone|informal)\b/i.test(line);
      rules.push({ kind: isTone ? "tone" : "banned_term", title: isTone ? "Tone: words to avoid" : "Banned terms (imported)", body: line, terms });
    } else if (/\b(always|must|exactly|spell)\b/i.test(line) && terms.length > 0) {
      rules.push({ kind: "required_term", title: `Spelling: ${terms[0]}`, body: line, terms: [terms[0]] });
    } else if (/\b(alt text|screen reader|accessib)/i.test(line)) {
      rules.push({ kind: "accessibility", title: "Accessibility (imported)", body: line });
    } else if (/\b(hinglish|hindi|english|devanagari)\b/i.test(line) && /\b(only|allowed|not|never)\b/i.test(line)) {
      rules.push({ kind: "language", title: "Language (imported)", body: line });
    } else if (/\b(tone|voice|sound|emoji|caps)\b/i.test(line)) {
      rules.push({ kind: "tone", title: "Tone (imported)", body: line, terms });
    }
  }
  return { rules: rules.slice(0, 20), facts: facts.slice(0, 20) };
}

/** Engine config for an imported rule, so it actually runs in checks once the admin adds it. */
export function configForProposal(rule: DocProposals["rules"][number]): Record<string, unknown> {
  const terms = rule.terms ?? [];
  if (rule.kind === "banned_term") return { terms };
  if (rule.kind === "required_term") return terms[0] ? { term: terms[0], variants: [] } : {};
  if (rule.kind === "tone") return { slang: terms, no_all_caps: false, max_emojis: 99 };
  return {};
}
