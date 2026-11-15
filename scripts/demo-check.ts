// `pnpm demo:check`: run the local engine on every seeded draft and print the
// issues. Handy for explaining the engine without starting the app.
import { runCheck } from "../lib/engine/pipeline";
import { trustStripText } from "../lib/engine/trust";
import { SEED_DRAFTS, SEED_PALETTE, SEED_USERS, seedEngineFacts, seedEngineRules } from "../lib/seed/data";

async function main() {
  for (const draft of SEED_DRAFTS) {
    const result = await runCheck(
      { text: draft.text, channel: draft.channel, tier: draft.tier, hasImage: false, imageAlt: null, imageColors: null, facts: seedEngineFacts(), rules: seedEngineRules(), palette: SEED_PALETTE.map((c) => c.hex), personNames: SEED_USERS.map((u) => u.name) },
      null,
    );
    console.log(`\n${draft.title} [${draft.channel}, ${draft.tier}, ${result.language}] · ${trustStripText(result)}`);
    for (const i of result.issues) {
      const label = i.claimStatus ?? i.kind;
      console.log(`  ${label.padEnd(13)} ${i.severity.padEnd(6)} "${i.excerpt}" → ${i.replacement === null ? "(manual)" : JSON.stringify(i.replacement)}`);
    }
  }
}

main();
