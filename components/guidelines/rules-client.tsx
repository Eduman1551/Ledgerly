"use client";
// Guidelines: rules grouped by kind, each with its version history. Editing a
// rule saves a NEW version; issues keep citing the version they were checked against.
import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { TierBadge } from "@/components/badges";
import { Field } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/client/api";
import type { RuleKind } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import type { listRules } from "@/lib/services/guidelines";

type Rule = Awaited<ReturnType<typeof listRules>>[number];

export const KIND_LABEL: Record<RuleKind, string> = {
  claim_policy: "Claim policy",
  banned_term: "Banned terms",
  required_term: "Required spelling",
  tone: "Tone",
  language: "Language",
  accessibility: "Accessibility",
  visual: "Visual identity",
};
const KIND_ORDER: RuleKind[] = ["claim_policy", "banned_term", "required_term", "tone", "language", "accessibility", "visual"];

/** The settings the engine actually runs, shown as readable chips. */
function ConfigSummary({ config }: { config: Record<string, unknown> }) {
  const entries = Object.entries(config).filter(([, v]) => !(Array.isArray(v) && v.length === 0) && !(v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0));
  if (entries.length === 0) return null;
  const show = (v: unknown): string => (Array.isArray(v) ? v.join(", ") : v && typeof v === "object" ? Object.entries(v).map(([k, x]) => `${k}: ${show(x)}`).join("; ") : String(v));
  return (
    <dl className="flex flex-wrap gap-1.5 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1 rounded-md bg-muted px-2 py-1">
          <dt className="font-medium">{key.replace(/_/g, " ")}:</dt>
          <dd className="text-muted-foreground">{show(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RulesClient({ rules, isAdmin }: { rules: Rule[]; isAdmin: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Rule | null>(null);
  const [body, setBody] = useState("");
  const [config, setConfig] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const openEdit = (rule: Rule) => {
    setEditing(rule);
    setBody(rule.current?.body ?? "");
    setConfig(JSON.stringify(rule.current?.config ?? {}, null, 2));
    setNote("");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(config || "{}");
    } catch {
      toast.error("The settings are not valid JSON. Fix them or leave them unchanged.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/rules/${editing.id}/versions`, { body: { body, config: parsed, changeNote: note || undefined } });
      toast.success(`Saved as version ${(editing.current?.versionNo ?? 0) + 1}. New checks use it from now on.`);
      setEditing(null);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {KIND_ORDER.filter((kind) => rules.some((r) => r.kind === kind)).map((kind) => (
        <section key={kind} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{KIND_LABEL[kind]}</h3>
          {rules
            .filter((r) => r.kind === kind)
            .map((rule) => (
              <article key={rule.id} id={rule.id} className="flex flex-col gap-2 rounded-xl border border-border p-4">
                <header className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold">{rule.title}</h4>
                  <span className="rounded bg-teal-50 px-1.5 py-0.5 text-xs font-semibold text-teal-800">v{rule.current?.versionNo ?? 1}</span>
                  <TierBadge tier={rule.tier} />
                  <span className="text-xs text-muted-foreground">severity: {rule.severity}</span>
                  {isAdmin && (
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => openEdit(rule)}>
                      <Pencil /> Edit (new version)
                    </Button>
                  )}
                </header>
                <p className="text-sm">{rule.current?.body}</p>
                <ConfigSummary config={rule.current?.config ?? {}} />
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs font-medium text-primary">Version history ({rule.versions.length})</summary>
                  <ol className="mt-2 flex flex-col gap-2">
                    {rule.versions.map((v) => (
                      <li key={v.id} className={`rounded-lg border p-2.5 ${v.id === rule.currentVersionId ? "border-primary bg-teal-50" : "border-border bg-muted/40"}`}>
                        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded bg-white px-1.5 py-0.5 font-semibold text-foreground ring-1 ring-border">v{v.versionNo}</span>
                          {formatDate(v.createdAt)} · {v.changeNote ?? "Edited"}
                          {v.id === rule.currentVersionId && <span className="ml-auto font-medium text-primary">current</span>}
                        </p>
                        <p className="mt-1">{v.body}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              </article>
            ))}
        </section>
      ))}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && !busy && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit: {editing?.title}</DialogTitle>
            <DialogDescription>Saving creates version {(editing?.current?.versionNo ?? 0) + 1}. The old version stays in the history.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Field label="Guideline wording" htmlFor="rule-body" hint="What creators and reviewers read.">
              <Textarea id="rule-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} required minLength={5} maxLength={1000} />
            </Field>
            <Field label="Check settings (JSON)" htmlFor="rule-config" hint="What the engine enforces, e.g. the list of banned terms or the emoji limit.">
              <Textarea id="rule-config" value={config} onChange={(e) => setConfig(e.target.value)} rows={6} className="font-mono text-xs" spellCheck={false} />
            </Field>
            <Field label="Change note (optional)" htmlFor="rule-note">
              <Input id="rule-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Why this change?" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Save new version
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
