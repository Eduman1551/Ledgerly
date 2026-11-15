// `pnpm eval`: run the engine on the 20 labelled posts and report accuracy.
// Local-only mode always runs. AI mode also runs when GOOGLE_GENERATIVE_AI_API_KEY
// is set. Results are printed and written to docs/eval-results.md.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import type { Channel, ClaimStatus, Language, Tier } from "../lib/db/schema";
import { runCheck } from "../lib/engine/pipeline";
import type { AiAdapter } from "../lib/engine/types";
import { SEED_PALETTE, SEED_USERS, seedEngineFacts, seedEngineRules } from "../lib/seed/data";

config({ path: ".env.local" });

type Post = {
  id: string;
  group: string;
  channel: Channel;
  tier: Tier;
  text: string;
  expected: { language: Language; toneFlag: boolean; claims: { excerpt: string; status: ClaimStatus }[] };
};

const posts: Post[] = JSON.parse(readFileSync("data/eval/posts.json", "utf8")).posts;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const sameExcerpt = (a: string, b: string) => norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a));
const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${Math.round((n / d) * 100)}%`);

type ModeResult = {
  mode: string;
  precision: [number, number];
  recall: [number, number];
  detection: [number, number];
  language: [number, number];
  tone: [number, number];
  byStatus: Record<ClaimStatus, { expected: number; found: number }>;
  misses: string[];
  aiFailures: number;
};

async function evaluate(mode: string, ai: AiAdapter | null): Promise<ModeResult> {
  const result: ModeResult = {
    mode,
    precision: [0, 0],
    recall: [0, 0],
    detection: [0, 0],
    language: [0, 0],
    tone: [0, 0],
    byStatus: { supported: { expected: 0, found: 0 }, unsupported: { expected: 0, found: 0 }, outdated: { expected: 0, found: 0 }, conflicting: { expected: 0, found: 0 } },
    misses: [],
    aiFailures: 0,
  };

  for (const post of posts) {
    const check = await runCheck(
      { text: post.text, channel: post.channel, tier: post.tier, hasImage: false, imageAlt: null, imageColors: null, facts: seedEngineFacts(), rules: seedEngineRules(), palette: SEED_PALETTE.map((c) => c.hex), personNames: SEED_USERS.map((u) => u.name) },
      ai,
    );
    if (check.aiPath === "ai_failed_fallback") result.aiFailures++;
    const predicted = check.issues.filter((i) => i.kind === "claim" && i.claimStatus).map((i) => ({ excerpt: i.excerpt, status: i.claimStatus as ClaimStatus }));

    // Recall: each expected claim must be found with the right status.
    for (const exp of post.expected.claims) {
      result.recall[1]++;
      result.detection[1]++;
      result.byStatus[exp.status].expected++;
      const sameSpot = predicted.filter((p) => sameExcerpt(p.excerpt, exp.excerpt));
      if (sameSpot.length > 0) result.detection[0]++;
      if (sameSpot.some((p) => p.status === exp.status)) {
        result.recall[0]++;
        result.byStatus[exp.status].found++;
      } else {
        result.misses.push(`${post.id}: expected "${exp.excerpt}" = ${exp.status}, got ${sameSpot.length ? sameSpot.map((p) => p.status).join("/") : "nothing"}`);
      }
    }
    // Precision: each predicted claim must match an expected one.
    for (const p of predicted) {
      result.precision[1]++;
      if (post.expected.claims.some((exp) => sameExcerpt(p.excerpt, exp.excerpt) && exp.status === p.status)) result.precision[0]++;
      else if (!post.expected.claims.some((exp) => sameExcerpt(p.excerpt, exp.excerpt))) result.misses.push(`${post.id}: extra claim "${p.excerpt}" = ${p.status} (not in the labels)`);
    }

    result.language[1]++;
    if (check.language === post.expected.language) result.language[0]++;
    else result.misses.push(`${post.id}: language expected ${post.expected.language}, got ${check.language}`);

    result.tone[1]++;
    const toneFlagged = check.issues.some((i) => i.kind === "tone");
    if (toneFlagged === post.expected.toneFlag) result.tone[0]++;
    else result.misses.push(`${post.id}: tone flag expected ${post.expected.toneFlag}, got ${toneFlagged}`);
  }
  return result;
}

function report(r: ModeResult): string {
  const lines = [
    `### Mode: ${r.mode}`,
    "",
    "| Metric | Score | Count |",
    "|---|---|---|",
    `| Claim-status precision | ${pct(...r.precision)} | ${r.precision[0]} of ${r.precision[1]} predicted claims are correct |`,
    `| Claim-status recall | ${pct(...r.recall)} | ${r.recall[0]} of ${r.recall[1]} labelled claims found with the right status |`,
    `| Claim detection (any status) | ${pct(...r.detection)} | ${r.detection[0]} of ${r.detection[1]} labelled claims located |`,
    `| Language detection accuracy | ${pct(...r.language)} | ${r.language[0]} of ${r.language[1]} posts |`,
    `| Tone-flag accuracy | ${pct(...r.tone)} | ${r.tone[0]} of ${r.tone[1]} posts |`,
    "",
    "| Claim status | Recall | Found / labelled |",
    "|---|---|---|",
    ...(Object.entries(r.byStatus) as [ClaimStatus, { expected: number; found: number }][]).map(([status, s]) => `| ${status} | ${pct(s.found, s.expected)} | ${s.found} / ${s.expected} |`),
    "",
    r.aiFailures ? `AI failed on ${r.aiFailures} of ${posts.length} posts (those fell back to local rules).\n` : "",
    r.misses.length ? "Misses and disagreements:\n" : "No misses.",
    ...r.misses.map((m) => `- ${m}`),
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const results = [await evaluate("local only (no AI)", null)];

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const { getAiAdapter } = await import("../lib/ai/analyze");
    const adapter = getAiAdapter();
    if (adapter) {
      // Free-tier keys are rate limited, so pause between posts.
      const slow: AiAdapter = { model: adapter.model, analyze: async (input) => (await new Promise((r) => setTimeout(r, 4500)), adapter.analyze(input)) };
      results.push(await evaluate(`AI + local (${adapter.model})`, slow));
    }
  }

  const groups = posts.reduce<Record<string, number>>((acc, p) => ((acc[p.group] = (acc[p.group] ?? 0) + 1), acc), {});
  const markdown = [
    "# Evaluation results",
    "",
    `Generated by \`pnpm eval\` on ${new Date().toISOString().slice(0, 10)}.`,
    "",
    `Dataset: \`data/eval/posts.json\`, ${posts.length} hand-labelled posts (${Object.entries(groups)
      .map(([g, n]) => `${n} ${g}`)
      .join(", ")}) for the fictional brand Kesar & Co., checked against the seeded Fact Ledger and rules.`,
    "",
    "How a claim is scored: a predicted claim counts as correct when its text overlaps a labelled claim and the status (supported / unsupported / outdated / conflicting) is the same.",
    "",
    ...results.map(report),
    results.length === 1 ? "_AI mode was skipped because GOOGLE_GENERATIVE_AI_API_KEY is not set. Run `pnpm eval` with a key in `.env.local` to add it._\n" : "",
    "## Reading the misses",
    "",
    "The local engine is regex-based, so it misses claims with no digits or fixed phrases: number words (\"do din\"), \"half price\", and superlatives outside its pattern list (\"sabse pasandida\", \"best chai in the world\"). It also misses a fact when the sentence uses wording that is not in the fact alias list (\"arrives in\" for delivery time), and it cannot verify a date that the ledger only stores inside another fact's display text (\"5 Nov\"). These are exactly the cases the AI extraction step is for, and they are part of the Round 3 accuracy work.",
    "",
  ].join("\n");

  mkdirSync("docs", { recursive: true });
  writeFileSync("docs/eval-results.md", markdown);
  console.log(markdown);
  console.log("Written to docs/eval-results.md");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
