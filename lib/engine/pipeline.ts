// The check pipeline: language → tier routing → claims → ledger → rules →
// tone → visual. AI is optional; every AI step has a local fallback.
import type { AiPath } from "@/lib/db/schema";
import { extractClaimsLocal, mergeAiClaims, splitSentences, type Sentence } from "./extract";
import { detectLanguage } from "./language";
import { checkClaim } from "./ledger";
import { checkVisual } from "./palette";
import { redact, restore } from "./redact";
import { runRuleChecks } from "./rules";
import type { AiAdapter, AiAnalysis, CheckInput, CheckResult, Claim, EngineIssue } from "./types";

const overlaps = (a: EngineIssue, b: EngineIssue) => a.spanStart < b.spanEnd && b.spanStart < a.spanEnd;

/** The brand-voice text we are allowed to show the AI (never confidential rules). */
function brandVoiceFor(input: CheckInput): string {
  return input.rules
    .filter((r) => (r.kind === "tone" || r.kind === "language") && r.tier !== "confidential")
    .map((r) => `- ${r.title}: ${r.body}`)
    .join("\n");
}

function sentenceOf(claim: Claim, sentences: Sentence[], text: string): Sentence {
  return sentences.find((s) => claim.start >= s.start && claim.start < s.end) ?? { text, start: 0, end: text.length };
}

export async function runCheck(input: CheckInput, ai?: AiAdapter | null): Promise<CheckResult> {
  const started = Date.now();
  const { text } = input;
  const language = detectLanguage(text);

  // --- Tier routing ---------------------------------------------------------
  // Confidential → no AI at all. Internal → redacted text only. Public → text
  // goes to AI, but values of confidential facts are still hidden.
  let aiPath: AiPath = "local_only";
  let charsSentToAi = 0;
  let redactionsCount = 0;
  let model: string | null = null;
  let analysis: AiAnalysis = { claims: [], tone: [] };

  if (ai && input.tier !== "confidential" && text.trim()) {
    const redacted = redact(text, {
      level: input.tier === "internal" ? "full" : "confidential_only",
      personNames: input.personNames,
      facts: input.facts,
    });
    try {
      const raw = await ai.analyze({ text: redacted.text, channel: input.channel, language, brandVoice: brandVoiceFor(input) });
      // Placeholders are swapped back locally; the map never left the server.
      analysis = {
        claims: raw.claims.map((c) => ({ ...c, text: restore(c.text, redacted.map), subject: c.subject ? restore(c.subject, redacted.map) : undefined })),
        tone: raw.tone.map((t) => ({ excerpt: restore(t.excerpt, redacted.map), explanation: restore(t.explanation, redacted.map), rewrite: restore(t.rewrite, redacted.map) })),
      };
      aiPath = input.tier === "internal" ? "redacted_ai" : "full_ai";
      charsSentToAi = redacted.text.length;
      redactionsCount = redacted.count;
      model = ai.model;
    } catch {
      aiPath = "ai_failed_fallback"; // timeout, rate limit, bad output → local rules only
      model = ai.model;
      // Be honest: the (redacted) text may already have left before the failure.
      charsSentToAi = redacted.text.length;
      redactionsCount = redacted.count;
    }
  }

  // --- Claims → ledger ------------------------------------------------------
  const sentences = splitSentences(text);
  const claims = mergeAiClaims(text, extractClaimsLocal(text), analysis.claims);
  const claimPolicy = input.rules.find((r) => r.kind === "claim_policy");
  const claimIssues = claims.map((c) => checkClaim(c, sentenceOf(c, sentences, text), { facts: input.facts, claimPolicy }));

  // --- Rules ------------------------------------------------------------------
  const ruleIssues = runRuleChecks({ text, channel: input.channel, language, hasImage: input.hasImage, imageAlt: input.imageAlt, rules: input.rules });

  // A banned term that is also a flagged claim ("India's #1") becomes one card:
  // the claim card, which also cites the banned-terms rule.
  const keptRuleIssues: EngineIssue[] = [];
  for (const issue of ruleIssues) {
    const claim = issue.kind === "term" ? claimIssues.find((c) => c.state === "open" && overlaps(c, issue)) : undefined;
    if (claim) {
      claim.ruleVersionId = issue.ruleVersionId;
      claim.explanation += ` It is also a banned term.`;
      claim.severity = "high";
      if (claim.replacement === null) claim.replacement = "";
    } else {
      keptRuleIssues.push(issue);
    }
  }

  // --- AI tone issues (only where no local issue already covers the text) ----
  const toneRule = input.rules.find((r) => r.kind === "tone");
  const aiToneIssues: EngineIssue[] = [];
  for (const t of analysis.tone.slice(0, 3)) {
    const excerpt = t.excerpt.trim();
    const start = excerpt ? text.indexOf(excerpt) : -1;
    if (start === -1 || !toneRule) continue;
    const issue: EngineIssue = {
      kind: "tone",
      claimStatus: null,
      spanStart: start,
      spanEnd: start + excerpt.length,
      excerpt,
      explanation: `${t.explanation} ("${toneRule.title}" v${toneRule.versionNo}, judged by AI)`,
      factVersionId: null,
      ruleVersionId: toneRule.versionId,
      suggestion: t.rewrite ? `Suggested rewrite: ${t.rewrite}` : "Rewrite this in the brand voice.",
      replacement: t.rewrite && t.rewrite !== excerpt ? t.rewrite : null,
      severity: "low",
      state: "open",
    };
    const taken = [...claimIssues, ...keptRuleIssues, ...aiToneIssues].some((other) => other.state === "open" && overlaps(other, issue));
    if (!taken) aiToneIssues.push(issue);
  }

  // --- Visual -----------------------------------------------------------------
  const visualIssues = checkVisual(input.imageColors, input.palette, input.rules.find((r) => r.kind === "visual"));

  const issues = [...claimIssues, ...keptRuleIssues, ...aiToneIssues, ...visualIssues].sort((a, b) => a.spanStart - b.spanStart || a.spanEnd - b.spanEnd);

  return { language, aiPath, model, charsSentToAi, redactionsCount, durationMs: Date.now() - started, issues };
}
