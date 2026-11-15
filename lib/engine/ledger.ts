// Ledger matching: deterministic and local, so it works on every privacy tier.
// For each claim we find the most likely fact, then label the claim
// Supported / Outdated / Conflicting / Unsupported.
import type { ClaimStatus, Severity } from "@/lib/db/schema";
import type { Sentence } from "./extract";
import { formatIndianNumber, normalizeValue, valuesAgree, type Norm } from "./normalize";
import type { Claim, EngineFact, EngineFactVersion, EngineIssue, EngineRule } from "./types";

const NEGATION = /\b(?:not|no|non|never|isn't|aren't|nahi|nahin|bina)\b|नहीं|बिना/i;

/** Which fact value types a claim type can be checked against. */
function compatible(claim: Claim, fact: EngineFact): boolean {
  if (claim.type === "certification" || claim.type === "superlative") {
    return fact.valueType === "boolean" || fact.valueType === "text";
  }
  return claim.type === fact.valueType;
}

/** All places where one of the fact's names appears in the sentence (lower-cased search). */
function aliasHits(fact: EngineFact, haystack: string): { start: number; end: number }[] {
  const hits: { start: number; end: number }[] = [];
  for (const name of [fact.label, ...fact.aliases]) {
    const needle = name.toLowerCase().trim();
    if (needle.length < 2) continue;
    let from = 0;
    while (true) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      hits.push({ start: at, end: at + needle.length });
      from = at + needle.length;
    }
  }
  return hits;
}

function matchesAnyVersion(claimNorm: Norm | null, claim: Claim, fact: EngineFact): boolean {
  if (!claimNorm) return false;
  return fact.versions.some((v) => {
    const n = normalizeValue(v.value, fact.valueType);
    return n !== null && valuesAgree(claimNorm, n);
  });
}

/**
 * Pick the fact a claim is about. Score = distance between the claim and the
 * nearest mention of the fact (label or alias) in the same sentence. Mentions
 * after the claim count as further away, and a value that equals one of the
 * fact's versions pulls the fact closer.
 */
export function findFact(claim: Claim, sentence: Sentence, facts: EngineFact[]): EngineFact | null {
  const haystack = sentence.text.toLowerCase();
  const claimStart = claim.start - sentence.start;
  const claimEnd = claim.end - sentence.start;
  const claimNorm = normalizeValue(claim.text, claim.type);
  const subject = claim.subject?.toLowerCase() ?? "";

  let best: { fact: EngineFact; score: number } | null = null;
  for (const fact of facts.filter((f) => compatible(claim, f))) {
    let score = Infinity;
    for (const hit of aliasHits(fact, haystack)) {
      const overlapsClaim = hit.start < claimEnd && claimStart < hit.end;
      const distance = overlapsClaim ? 0 : hit.end <= claimStart ? claimStart - hit.end : (hit.start - claimEnd) * 2 + 4;
      score = Math.min(score, distance);
    }
    // The AI subject hint counts as a mention at a medium distance.
    if (subject && aliasHits(fact, subject).length > 0) score = Math.min(score, 20);
    if (score === Infinity) continue;
    if (matchesAnyVersion(claimNorm, claim, fact)) score = score / 4;
    if (!best || score < best.score) best = { fact, score };
  }
  if (best) return best.fact;

  // No mention at all: a price or big number that equals exactly one fact's
  // value (any version) is still a confident match, e.g. a bare "₹499".
  if (claim.type === "price" || claim.type === "number") {
    const sameValue = facts.filter((f) => compatible(claim, f) && matchesAnyVersion(claimNorm, claim, f));
    if (sameValue.length === 1) return sameValue[0];
  }
  return null;
}

/** Rewrite the claim text so it carries the current value, keeping the creator's style ("₹499" → "₹549"). */
export function buildReplacement(claim: Claim, fact: EngineFact, current: EngineFactVersion): string {
  const norm = normalizeValue(current.value, fact.valueType);
  const isPoint = norm !== null && norm.min === norm.max;
  if (isPoint && (fact.valueType === "price" || fact.valueType === "percent")) {
    return claim.text.replace(/[\d०-९][\d०-९,]*(?:\.\d+)?/u, formatIndianNumber(norm.min));
  }
  if (fact.valueType === "number") {
    // "2 lakh+" style values read best exactly as the ledger shows them.
    return current.displayValue;
  }
  if (fact.valueType === "duration") {
    const range = current.value.replace("-", "–");
    return `${range} ${fact.unit ?? "days"}`;
  }
  return current.displayValue;
}

const cite = (fact: EngineFact, v: EngineFactVersion) => `${fact.label}: ${v.displayValue} (${v.sourceName})`;

type MatchContext = { facts: EngineFact[]; claimPolicy: EngineRule | undefined };

/** Turn one claim into one issue (supported claims become "resolved" issues so the UI can show them in green). */
export function checkClaim(claim: Claim, sentence: Sentence, ctx: MatchContext): EngineIssue {
  const base = {
    kind: "claim" as const,
    spanStart: claim.start,
    spanEnd: claim.end,
    excerpt: claim.text,
  };
  const fact = findFact(claim, sentence, ctx.facts);

  if (!fact) {
    const strong = claim.type === "superlative" || claim.type === "certification";
    const severity: Severity = strong ? "high" : "medium";
    return {
      ...base,
      claimStatus: "unsupported",
      explanation: `No approved source in the Fact Ledger backs "${claim.text}". Rule: no source, no claim.`,
      factVersionId: null,
      ruleVersionId: ctx.claimPolicy?.versionId ?? null,
      suggestion: strong
        ? "Remove this claim, or ask the brand owner to add a source to the Fact Ledger."
        : "Remove or soften this claim, or ask the brand owner to add it to the Fact Ledger.",
      replacement: strong ? "" : null,
      severity,
      state: "open",
    };
  }

  const current = fact.versions.find((v) => v.id === fact.currentVersionId) ?? fact.versions[fact.versions.length - 1];

  // Boolean facts ("Organic certification: not certified"): the claim asserts
  // "true" unless a negation word sits right before it.
  if (fact.valueType === "boolean" || fact.valueType === "text") {
    const before = sentence.text.slice(Math.max(0, claim.start - sentence.start - 18), claim.start - sentence.start);
    const asserted = !NEGATION.test(before);
    const factIsTrue = current.value.toLowerCase() === "true";
    const agrees = fact.valueType === "boolean" ? asserted === factIsTrue : false;
    if (agrees) return supported(base, fact, current);
    return {
      ...base,
      claimStatus: "conflicting",
      explanation: `The draft says "${claim.text}" but the ledger says: ${cite(fact, current)}.`,
      factVersionId: current.id,
      ruleVersionId: null,
      suggestion: `Remove this claim. What we can say: ${current.displayValue}.`,
      replacement: "",
      severity: "high",
      state: "open",
    };
  }

  const claimNorm = normalizeValue(claim.text, claim.type);
  const currentNorm = normalizeValue(current.value, fact.valueType);
  if (claimNorm && currentNorm && valuesAgree(claimNorm, currentNorm)) return supported(base, fact, current);

  // Equal to an older version → Outdated.
  const older = [...fact.versions]
    .reverse()
    .find((v) => v.id !== current.id && claimNorm && valuesAgree(claimNorm, normalizeValue(v.value, fact.valueType) ?? { min: NaN, max: NaN }));
  const replacement = buildReplacement(claim, fact, current);
  const status: ClaimStatus = older ? "outdated" : "conflicting";
  return {
    ...base,
    claimStatus: status,
    explanation: older
      ? `"${claim.text}" was correct in v${older.versionNo} (${older.sourceName}) but the ledger now says: ${cite(fact, current)}, effective ${current.effectiveFrom}.`
      : `The draft says "${claim.text}" but the ledger says: ${cite(fact, current)}.`,
    factVersionId: current.id,
    ruleVersionId: null,
    suggestion: `Use ${replacement} (${current.sourceName}).`,
    replacement,
    severity: "high",
    state: "open",
  };
}

function supported(
  base: Pick<EngineIssue, "kind" | "spanStart" | "spanEnd" | "excerpt">,
  fact: EngineFact,
  current: EngineFactVersion,
): EngineIssue {
  return {
    ...base,
    claimStatus: "supported",
    explanation: `Verified against the ledger. ${cite(fact, current)}.`,
    factVersionId: current.id,
    ruleVersionId: null,
    suggestion: "No change needed.",
    replacement: null,
    severity: "low",
    state: "resolved",
  };
}
