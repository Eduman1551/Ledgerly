// Governance Brain: what the decision log teaches us about the guidelines.
import { Brain } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/form-fields";
import { OverrideChart } from "@/components/insights/override-chart";
import { SuggestionCard } from "@/components/insights/suggestion-card";
import { getDb } from "@/lib/db";
import { getInsights } from "@/lib/services/insights";
import { RoleGate } from "@/components/role-gate";

export const dynamic = "force-dynamic";

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-muted p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

async function InsightsPageContent() {
  const insights = await getInsights(await getDb());
  const { kpis } = insights;
  const pending = insights.suggestions.filter((s) => s.status === "pending");
  const handled = insights.suggestions.filter((s) => s.status !== "pending");
  const decided = kpis.accepted + kpis.overridden;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Governance Brain" description="Every accept, edit and override is logged. Rules that reviewers keep overriding are probably vague, so Ledgerly proposes clearer wording. A rewrite only takes effect when the brand owner accepts it." />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key numbers">
        <Kpi label="Drafts checked" value={kpis.draftsChecked} sub={`of ${kpis.totalDrafts} drafts`} />
        <Kpi label="Claims verified" value={kpis.claimsVerified} sub="supported by the Fact Ledger" />
        <Kpi label="Fixes accepted vs overridden" value={`${kpis.accepted} / ${kpis.overridden}`} sub={decided ? `${Math.round((kpis.overridden / decided) * 100)}% of decisions were overrides` : "no decisions yet"} />
        <Kpi label="Data sent to AI" value={`${kpis.charsSentToAi.toLocaleString("en-IN")} chars`} sub={`${kpis.charsCheckedLocally.toLocaleString("en-IN")} chars checked locally · ${kpis.aiChecks} AI / ${kpis.localChecks} local checks`} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="vague-title">
        <h2 id="vague-title" className="text-lg font-semibold">
          Vague rule detector
        </h2>
        <p className="-mt-2 text-sm text-muted-foreground">A rule appears here when its current version has at least 3 decisions and reviewers overrode 40% or more of them.</p>
        {pending.length === 0 ? (
          <EmptyState title="No vague rules right now" icon={<Brain className="size-6 text-muted-foreground" />}>
            Reviewers are not overriding any current rule often enough. New override patterns will show up here.
          </EmptyState>
        ) : (
          pending.map((s) => <SuggestionCard key={s.id} suggestion={s} />)
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="rounded-xl border border-border p-4" aria-labelledby="chart-title">
          <h2 id="chart-title" className="font-semibold">
            Override rate per rule
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">All decisions so far, across every version of each rule.</p>
          {insights.ruleStats.length ? <OverrideChart stats={insights.ruleStats} /> : <p className="text-sm text-muted-foreground">No decisions have been logged yet.</p>}
        </section>

        <section className="rounded-xl border border-border p-4" aria-labelledby="mistakes-title">
          <h2 id="mistakes-title" className="font-semibold">
            Most repeated mistakes
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">Counted on the first check of each draft, before any fix.</p>
          {insights.repeatedMistakes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No repeated mistakes yet.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {insights.repeatedMistakes.map((m, i) => (
                <li key={`${m.label}-${i}`} className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold ring-1 ring-border">{i + 1}</span>
                  <span className="flex-1">
                    <span className="font-medium">{m.label}</span>
                    <span className="block text-xs text-muted-foreground">{m.detail}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{m.count}×</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {handled.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="handled-title">
          <h2 id="handled-title" className="text-lg font-semibold">
            Past suggestions
          </h2>
          {handled.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} />
          ))}
        </section>
      )}
    </div>
  );
}

export default function InsightsPage() {
  return (
    <RoleGate path="/insights">
      <InsightsPageContent />
    </RoleGate>
  );
}
