// Shared test fixtures: the seed facts/rules and a helper to run a check.
import { runCheck } from "@/lib/engine/pipeline";
import type { AiAdapter, CheckInput, EngineIssue } from "@/lib/engine/types";
import { SEED_PALETTE, SEED_USERS, seedEngineFacts, seedEngineRules } from "@/lib/seed/data";

export const facts = seedEngineFacts();
export const rules = seedEngineRules();
export const palette = SEED_PALETTE.map((c) => c.hex);
export const rule = (kind: string) => rules.find((r) => r.kind === kind)!;

export function check(text: string, overrides: Partial<CheckInput> = {}, ai: AiAdapter | null = null) {
  return runCheck(
    { text, channel: "instagram", tier: "public", hasImage: false, imageAlt: null, imageColors: null, facts, rules, palette, personNames: SEED_USERS.map((u) => u.name), ...overrides },
    ai,
  );
}

export const find = (issues: EngineIssue[], excerpt: string) => issues.find((i) => i.excerpt === excerpt);

export const DIWALI_POST = "Is Diwali, India's #1 masala chai sirf ₹499 mein! 100% organic aur guaranteed delivery in 2 din. Order karo bro 🔥🔥🔥🔥 KesarCo ke saath!";
