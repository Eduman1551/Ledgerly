// Guidelines: versioned rules, the brand palette, and the brand-doc import.
import { PageHeader } from "@/components/form-fields";
import { ImportDoc } from "@/components/guidelines/import-doc";
import { RulesClient } from "@/components/guidelines/rules-client";
import { getDb } from "@/lib/db";
import { loadPalette } from "@/lib/services/context";
import { listRules } from "@/lib/services/guidelines";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function GuidelinesPage() {
  const db = await getDb();
  const [user, rules, palette] = await Promise.all([getCurrentUser(), listRules(db), loadPalette(db)]);
  const isAdmin = user.role === "admin";
  return (
    <div>
      <PageHeader
        title="Guidelines"
        description={
          <>
            The rules every draft is checked against. Each edit creates a new version, and every flagged issue cites the exact version it broke.
            {!isAdmin && " Only the brand owner (Meera) can edit rules."}
          </>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <RulesClient rules={rules} isAdmin={isAdmin} />
        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border border-border p-4" aria-labelledby="palette-title">
            <h3 id="palette-title" className="font-semibold">
              Brand palette
            </h3>
            <p className="text-sm text-muted-foreground">Attached images are compared with these colours (Delta-E distance).</p>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {palette.map((c) => (
                <li key={c.hex} className="flex items-center gap-2 rounded-lg border border-border p-2">
                  <span className="size-8 rounded-md border border-border" style={{ backgroundColor: c.hex }} aria-hidden />
                  <span className="text-sm leading-tight">
                    <span className="block font-medium">{c.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{c.hex}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      {isAdmin && (
        <div className="mt-6">
          <ImportDoc />
        </div>
      )}
    </div>
  );
}
