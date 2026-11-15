// Shared types for the check engine. The engine is pure TypeScript: it never
// touches the database or the network. The API layer loads facts/rules, calls
// runCheck(), then saves the result.
import type { AiPath, Channel, ClaimStatus, IssueKind, Language, RuleKind, Severity, Tier, ValueType } from "@/lib/db/schema";

export type EngineFactVersion = {
  id: string;
  versionNo: number;
  value: string; // canonical: "549", "3-5", "false", "2026-12-01"
  displayValue: string;
  sourceName: string;
  effectiveFrom: string;
};

export type EngineFact = {
  id: string;
  key: string;
  label: string;
  aliases: string[];
  valueType: ValueType;
  unit: string | null;
  tier: Tier;
  currentVersionId: string;
  versions: EngineFactVersion[]; // oldest first
};

export type EngineRule = {
  id: string;
  kind: RuleKind;
  title: string;
  severity: Severity;
  tier: Tier;
  versionId: string;
  versionNo: number;
  body: string;
  config: Record<string, unknown>;
};

export type ClaimType = "price" | "number" | "percent" | "duration" | "date" | "superlative" | "certification" | "other";

export type Claim = {
  text: string;
  start: number;
  end: number;
  type: ClaimType;
  subject?: string; // optional hint from AI about what the claim is about
};

export type EngineIssue = {
  kind: IssueKind;
  claimStatus: ClaimStatus | null;
  spanStart: number;
  spanEnd: number; // spanStart === spanEnd means "whole draft" (e.g. missing alt text)
  excerpt: string;
  explanation: string;
  factVersionId: string | null;
  ruleVersionId: string | null;
  suggestion: string;
  replacement: string | null; // null = needs a manual edit
  severity: Severity;
  state: "open" | "resolved"; // supported claims are saved as "resolved"
};

export type CheckInput = {
  text: string;
  channel: Channel;
  tier: Tier;
  hasImage: boolean;
  imageAlt: string | null;
  imageColors: string[] | null; // dominant colours, extracted in the browser
  facts: EngineFact[];
  rules: EngineRule[];
  palette: string[]; // brand palette hex values
  personNames: string[]; // names to redact before text goes to AI
};

// What the AI returns (already validated with Zod in lib/ai).
export type AiClaim = { text: string; type: ClaimType; subject?: string };
export type AiToneIssue = { excerpt: string; explanation: string; rewrite: string };
export type AiAnalysis = { claims: AiClaim[]; tone: AiToneIssue[] };

// The engine gets AI through this small interface so tests can fake it.
export interface AiAdapter {
  model: string;
  analyze(input: { text: string; channel: Channel; language: Language; brandVoice: string }): Promise<AiAnalysis>;
}

export type CheckResult = {
  language: Language;
  aiPath: AiPath;
  model: string | null;
  charsSentToAi: number;
  redactionsCount: number;
  durationMs: number;
  issues: EngineIssue[];
};
