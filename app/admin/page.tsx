// Admin / brand owner dashboard (Meera): KPIs, shortcuts, top Governance Brain insights.
import { BadgeCheck, BookMarked, Brain, Cloud, HardDrive, ScrollText, Scale, Wrench } from "lucide-react";
import Link from "next/link";
import { DashboardHeader, Panel, QuickLink, StatTile } from "@/components/dashboard/parts";
import { SuggestionCard } from "@/components/insights/suggestion-card";
import { RoleGate } from "@/components/role-gate";
import { getDb } from "@/lib/db";
import { getInsights } from "@/lib/services/insights";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

async function AdminDashboard() {
  const [user, insights] = await Promise.all([getCurrentUser(), getDb().then(getInsights)]);
  const { kpis } = insights;
  const pending = insights.suggestions.filter((s) => s.status === "pending").slice(0, 2);
  const decided = kpis.accepted + kpis.overridden;

  return (
    <div>
      <DashboardHeader greeting={`Welcome back, ${user.name.split(" ")[0]}`} role="Brand owner" />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key numbers">
        <StatTile icon={BadgeCheck} label="Claims verified" value={kpis.claimsVerified} hint={`across ${kpis.draftsChecked} checked drafts`} tone="green" />
        <StatTile icon={Scale} label="Accepted vs overridden" value={`${kpis.accepted} / ${kpis.overridden}`} hint={decided ? `${Math.round((kpis.overridden / decided) * 100)}% of decisions were overrides` : "no decisions yet"} tone="purple" />
        <StatTile icon={Cloud} label="Data sent to AI" value={`${kpis.charsSentToAi.toLocaleString("en-IN")}`} hint={`chars · ${kpis.aiChecks} AI checks (redacted where needed)`} tone="amber" />
        <StatTile icon={HardDrive} label="Checked locally" value={`${kpis.charsCheckedLocally.toLocaleString("en-IN")}`} hint={`chars · ${kpis.localChecks} local-only checks`} tone="teal" />
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Shortcuts">
        <QuickLink href="/ledger" icon={BookMarked} title="Fact Ledger" text="Approved facts and their versions" />
        <QuickLink href="/guidelines" icon={ScrollText} title="Guidelines" text="Rules, palette, brand-doc import" />
        <QuickLink href="/insights" icon={Brain} title="Insights" text="Override rates and repeat mistakes" />
        <QuickLink href="/admin/demo" icon={Wrench} title="Demo tools" text="Reset demo data, health check" />
      </section>

      <Panel title="Governance Brain: top insights" action={<Link href="/insights" className="text-sm font-medium text-primary hover:underline">See all</Link>}>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No rule needs attention right now. When reviewers keep overriding a rule, a rewrite proposal shows up here.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RoleGate path="/admin">
      <AdminDashboard />
    </RoleGate>
  );
}
