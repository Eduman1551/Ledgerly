// Drizzle schema for Ledgerly. Every "versioned" thing (facts, rules) has a
// parent row plus a *_versions table, and the parent points at the current one.
import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// Shared enum value lists (also used by Zod schemas and the UI).
export const ROLES = ["creator", "reviewer", "admin"] as const;
export const TIERS = ["public", "internal", "confidential"] as const;
export const VALUE_TYPES = ["price", "number", "percent", "duration", "date", "boolean", "text"] as const;
export const RULE_KINDS = ["claim_policy", "banned_term", "required_term", "tone", "language", "accessibility", "visual"] as const;
export const SEVERITIES = ["low", "medium", "high"] as const;
export const CHANNELS = ["instagram", "ad", "email", "document"] as const;
export const DRAFT_STATUSES = ["draft", "checked", "in_review", "changes_requested", "approved"] as const;
export const LANGUAGES = ["english", "hindi", "hinglish", "mixed"] as const;
export const AI_PATHS = ["local_only", "redacted_ai", "full_ai", "ai_failed_fallback"] as const;
export const ISSUE_KINDS = ["claim", "term", "tone", "language", "accessibility", "visual"] as const;
export const CLAIM_STATUSES = ["supported", "unsupported", "outdated", "conflicting"] as const;
export const ISSUE_STATES = ["open", "accepted", "edited", "overridden", "resolved"] as const;
export const DECISION_ACTIONS = ["accept", "edit", "override", "approve", "request_changes"] as const;
export const SUGGESTION_STATUSES = ["pending", "accepted", "dismissed"] as const;

export type Role = (typeof ROLES)[number];
export type Tier = (typeof TIERS)[number];
export type ValueType = (typeof VALUE_TYPES)[number];
export type RuleKind = (typeof RULE_KINDS)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Channel = (typeof CHANNELS)[number];
export type DraftStatus = (typeof DRAFT_STATUSES)[number];
export type Language = (typeof LANGUAGES)[number];
export type AiPath = (typeof AI_PATHS)[number];
export type IssueKind = (typeof ISSUE_KINDS)[number];
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
export type IssueState = (typeof ISSUE_STATES)[number];
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  role: text("role", { enum: ROLES }).notNull(),
});

export const facts = pgTable("facts", {
  id: id(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  aliases: text("aliases").array().notNull().default([]),
  valueType: text("value_type", { enum: VALUE_TYPES }).notNull(),
  unit: text("unit"),
  tier: text("tier", { enum: TIERS }).notNull().default("public"),
  owner: text("owner").notNull(),
  currentVersionId: text("current_version_id"),
});

export const factVersions = pgTable("fact_versions", {
  id: id(),
  factId: text("fact_id")
    .notNull()
    .references(() => facts.id, { onDelete: "cascade" }),
  versionNo: integer("version_no").notNull(),
  value: text("value").notNull(), // canonical, e.g. "549", "3-5", "false", "2026-12-01"
  displayValue: text("display_value").notNull(), // what humans read, e.g. "₹549"
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url"),
  effectiveFrom: text("effective_from").notNull(), // ISO date
  createdBy: text("created_by"),
  createdAt: createdAt(),
});

export const rules = pgTable("rules", {
  id: id(),
  kind: text("kind", { enum: RULE_KINDS }).notNull(),
  title: text("title").notNull(),
  tier: text("tier", { enum: TIERS }).notNull().default("public"),
  severity: text("severity", { enum: SEVERITIES }).notNull().default("medium"),
  currentVersionId: text("current_version_id"),
  active: boolean("active").notNull().default(true),
});

export const ruleVersions = pgTable("rule_versions", {
  id: id(),
  ruleId: text("rule_id")
    .notNull()
    .references(() => rules.id, { onDelete: "cascade" }),
  versionNo: integer("version_no").notNull(),
  body: text("body").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  createdBy: text("created_by"),
  createdAt: createdAt(),
  changeNote: text("change_note"),
});

export const brandAssets = pgTable("brand_assets", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["palette", "doc", "logo"] }).notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  tier: text("tier", { enum: TIERS }).notNull().default("public"),
});

export const drafts = pgTable("drafts", {
  id: id(),
  title: text("title").notNull(),
  channel: text("channel", { enum: CHANNELS }).notNull(),
  tier: text("tier", { enum: TIERS }).notNull().default("public"),
  status: text("status", { enum: DRAFT_STATUSES }).notNull().default("draft"),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

export const revisions = pgTable("revisions", {
  id: id(),
  draftId: text("draft_id")
    .notNull()
    .references(() => drafts.id, { onDelete: "cascade" }),
  revisionNo: integer("revision_no").notNull(),
  text: text("text").notNull(),
  imageUrl: text("image_url"), // small data URL (downscaled in the browser)
  imageAlt: text("image_alt"),
  imageColors: jsonb("image_colors").$type<string[]>(), // dominant hex colours, extracted client-side
  note: text("note"), // why this revision exists, e.g. "Accepted fix: ₹499 → ₹549"
  createdBy: text("created_by"),
  createdAt: createdAt(),
});

export const checkRuns = pgTable("check_runs", {
  id: id(),
  revisionId: text("revision_id")
    .notNull()
    .references(() => revisions.id, { onDelete: "cascade" }),
  language: text("language", { enum: LANGUAGES }).notNull(),
  aiPath: text("ai_path", { enum: AI_PATHS }).notNull(),
  model: text("model"),
  charsSentToAi: integer("chars_sent_to_ai").notNull().default(0),
  redactionsCount: integer("redactions_count").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: createdAt(),
});

// Spans point into the draft's LATEST revision text. When a fix is accepted we
// create a new revision and shift the spans of the remaining issues to match.
export const issues = pgTable("issues", {
  id: id(),
  checkRunId: text("check_run_id")
    .notNull()
    .references(() => checkRuns.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ISSUE_KINDS }).notNull(),
  claimStatus: text("claim_status", { enum: CLAIM_STATUSES }),
  spanStart: integer("span_start").notNull(),
  spanEnd: integer("span_end").notNull(),
  excerpt: text("excerpt").notNull(),
  explanation: text("explanation").notNull(),
  factVersionId: text("fact_version_id"),
  ruleVersionId: text("rule_version_id"),
  suggestion: text("suggestion").notNull(),
  replacement: text("replacement"), // exact text "Accept" will put in place of the span (null = manual fix)
  severity: text("severity", { enum: SEVERITIES }).notNull(),
  state: text("state", { enum: ISSUE_STATES }).notNull().default("open"),
});

export const decisions = pgTable("decisions", {
  id: id(),
  draftId: text("draft_id").references(() => drafts.id, { onDelete: "cascade" }),
  issueId: text("issue_id"),
  ruleVersionId: text("rule_version_id"),
  factId: text("fact_id"),
  actorId: text("actor_id").notNull(),
  action: text("action", { enum: DECISION_ACTIONS }).notNull(),
  reason: text("reason"),
  createdAt: createdAt(),
});

export const comments = pgTable("comments", {
  id: id(),
  draftId: text("draft_id")
    .notNull()
    .references(() => drafts.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull(),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export const guidelineSuggestions = pgTable("guideline_suggestions", {
  id: id(),
  ruleId: text("rule_id")
    .notNull()
    .references(() => rules.id, { onDelete: "cascade" }),
  insight: text("insight").notNull(),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  proposedBody: text("proposed_body").notNull(),
  status: text("status", { enum: SUGGESTION_STATUSES }).notNull().default("pending"),
  createdAt: createdAt(),
});
