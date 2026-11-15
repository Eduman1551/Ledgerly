// Zod schemas for every API input. The same schemas type the client calls.
import { z } from "zod";
import { CHANNELS, RULE_KINDS, SEVERITIES, TIERS, VALUE_TYPES } from "@/lib/db/schema";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");

export const newDraftSchema = z.object({
  title: z.string().trim().min(2, "Give the draft a title").max(120),
  channel: z.enum(CHANNELS),
  tier: z.enum(TIERS),
  text: z.string().trim().min(1, "Write some text first").max(5000),
  imageUrl: z.string().startsWith("data:image/").max(400_000).nullish(),
  imageAlt: z.string().trim().max(300).nullish(),
  imageColors: z.array(hex).max(8).nullish(),
});

export const patchDraftSchema = z.object({ title: z.string().trim().min(2).max(120).optional(), comment: z.string().trim().min(1).max(1000).optional() });

export const newRevisionSchema = z.object({ text: z.string().trim().min(1).max(5000), imageAlt: z.string().trim().max(300).nullish(), useAi: z.boolean().default(true) });

export const checkSchema = z.object({ useAi: z.boolean().default(true) });

export const issueDecisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("edit"), text: z.string().max(500) }),
  z.object({ action: z.literal("override"), reason: z.string().trim().min(3, "An override needs a reason").max(500) }),
]);

export const reviewSchema = z.object({ action: z.enum(["approve", "request_changes"]), comment: z.string().trim().max(1000).optional() });

export const newFactSchema = z.object({
  label: z.string().trim().min(2).max(120),
  aliases: z.array(z.string().trim().min(2).max(60)).max(12).default([]),
  valueType: z.enum(VALUE_TYPES),
  unit: z.string().trim().max(30).nullish(),
  tier: z.enum(TIERS),
  owner: z.string().trim().min(2).max(80),
  value: z.string().trim().min(1).max(200),
  displayValue: z.string().trim().max(200).optional(),
  sourceName: z.string().trim().min(2, "No source, no claim: name the source").max(120),
  sourceUrl: z.string().trim().url().max(300).nullish().or(z.literal("")),
  effectiveFrom: isoDate,
});

export const newFactVersionSchema = newFactSchema.pick({ value: true, displayValue: true, sourceName: true, sourceUrl: true, effectiveFrom: true });

export const newRuleSchema = z.object({
  kind: z.enum(RULE_KINDS),
  title: z.string().trim().min(2).max(120),
  tier: z.enum(TIERS).default("public"),
  severity: z.enum(SEVERITIES).default("medium"),
  body: z.string().trim().min(5).max(1000),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const newRuleVersionSchema = z.object({
  body: z.string().trim().min(5).max(1000),
  config: z.record(z.string(), z.unknown()).optional(),
  changeNote: z.string().trim().max(300).optional(),
});

export const importDocSchema = z.object({ text: z.string().trim().min(10, "Paste or upload a guideline document first").max(20_000), tier: z.enum(TIERS), useAi: z.boolean().default(true) });

export type NewDraftBody = z.input<typeof newDraftSchema>;
export type NewFactBody = z.input<typeof newFactSchema>;
export type NewRuleBody = z.input<typeof newRuleSchema>;
