"use client";
// "Import from brand doc": paste or upload a guideline document, get proposed
// rules and facts, tick the ones to keep. Nothing is saved until the admin confirms.
import { FileUp, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app-context";
import { TierBadge } from "@/components/badges";
import { Field, NativeSelect } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/client/api";
import type { RuleKind, Tier, ValueType } from "@/lib/db/schema";
import { KIND_LABEL } from "./rules-client";

type ProposedRule = { kind: RuleKind; title: string; body: string; terms?: string[]; config: Record<string, unknown> };
type ProposedFact = { label: string; valueType: ValueType; value: string; sourceName?: string };
type Proposals = { path: string; rules: ProposedRule[]; facts: ProposedFact[] };

const SAMPLE = `Kesar & Co. gifting guidelines (sample)
Never say "miracle" or "detox" in any post.
Always write "Kesar & Co. Gift Studio" exactly.
Avoid slang like "fam" in emails.
Gift box price: ₹899
Gift wrapping time: 2 days
Corporate order discount: 15%`;

export function ImportDoc() {
  const router = useRouter();
  const { aiEnabled, user } = useApp();
  const [text, setText] = useState("");
  const [tier, setTier] = useState<Tier>("internal");
  const [busy, setBusy] = useState<"propose" | "save" | null>(null);
  const [proposals, setProposals] = useState<Proposals | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      setText((await api<{ text: string }>("/api/import/parse-file", { formData: form })).text);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function propose() {
    setBusy("propose");
    try {
      const result = await api<Proposals>("/api/import/brand-doc", { body: { text, tier, useAi: aiEnabled } });
      setProposals(result);
      setPicked(new Set()); // nothing is pre-ticked: the admin chooses
      if (result.rules.length + result.facts.length === 0) toast.info("No rules or facts were found in this document.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function saveSelected() {
    if (!proposals) return;
    setBusy("save");
    let saved = 0;
    const failures: string[] = [];
    const today = new Date().toISOString().slice(0, 10);
    for (const [i, rule] of proposals.rules.entries()) {
      if (!picked.has(`rule-${i}`)) continue;
      await api("/api/rules", { body: { kind: rule.kind, title: rule.title, body: rule.body, config: rule.config, tier, severity: rule.kind === "banned_term" ? "high" : "medium" } })
        .then(() => saved++)
        .catch((error) => failures.push(`${rule.title}: ${errorMessage(error)}`));
    }
    for (const [i, fact] of proposals.facts.entries()) {
      if (!picked.has(`fact-${i}`)) continue;
      await api("/api/facts", { body: { label: fact.label, valueType: fact.valueType, value: fact.value, tier, owner: user.name, sourceName: fact.sourceName || "Imported brand doc", effectiveFrom: today, aliases: [fact.label.replace(/\s+(price|time|discount|window)$/i, "")] } })
        .then(() => saved++)
        .catch((error) => failures.push(`${fact.label}: ${errorMessage(error)}`));
    }
    setBusy(null);
    if (saved) toast.success(`Added ${saved} item${saved === 1 ? "" : "s"}. They apply to new checks.`);
    failures.forEach((f) => toast.error(f));
    if (saved && failures.length === 0) {
      setProposals(null);
      setText("");
    }
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border p-4" aria-labelledby="import-title">
      <div>
        <h3 id="import-title" className="font-semibold">
          Import from brand doc
        </h3>
        <p className="text-sm text-muted-foreground">Paste or upload a guideline document. Ledgerly proposes rules and facts; you tick the ones to add. Nothing is saved without your confirmation.</p>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Paste the guideline text here…" aria-label="Guideline document text" maxLength={20000} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm font-medium hover:bg-muted">
          <FileUp className="size-4" /> Upload .txt / .md / .docx
          <input type="file" accept=".txt,.md,.docx" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <Button type="button" variant="ghost" onClick={() => setText(SAMPLE)}>
          Use sample text
        </Button>
        <Field label="Document tier" htmlFor="doc-tier" className="ml-auto w-56">
          <NativeSelect id="doc-tier" value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
            <option value="public">Public (AI may read it)</option>
            <option value="internal">Internal (AI may read it)</option>
            <option value="confidential">Confidential (local parser only)</option>
          </NativeSelect>
        </Field>
        <Button onClick={propose} disabled={busy !== null || text.trim().length < 10}>
          {busy === "propose" ? <Loader2 className="animate-spin" /> : <Sparkles />} Propose rules and facts
        </Button>
      </div>

      {proposals && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <p className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-900" role="status">
            <ShieldCheck className="size-4" /> {proposals.path} <TierBadge tier={tier} />
          </p>
          {proposals.rules.length + proposals.facts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing was found. Try clearer lines such as: Never say &quot;miracle&quot;. Or: Gift box price: ₹899.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="w-8 py-1.5">Add</th>
                    <th className="w-36">Type</th>
                    <th>Proposal</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.rules.map((r, i) => (
                    <tr key={`rule-${i}`} className="border-b border-border align-top">
                      <td className="py-2">
                        <input type="checkbox" className="size-4 accent-teal-700" checked={picked.has(`rule-${i}`)} onChange={() => toggle(`rule-${i}`)} aria-label={`Add rule ${r.title}`} />
                      </td>
                      <td className="py-2 text-xs font-medium">Rule · {KIND_LABEL[r.kind]}</td>
                      <td className="py-2">
                        <span className="font-medium">{r.title}</span>
                        <span className="block text-muted-foreground">{r.body}</span>
                        {r.terms && r.terms.length > 0 && <span className="text-xs text-muted-foreground">Terms: {r.terms.join(", ")}</span>}
                      </td>
                    </tr>
                  ))}
                  {proposals.facts.map((f, i) => (
                    <tr key={`fact-${i}`} className="border-b border-border align-top">
                      <td className="py-2">
                        <input type="checkbox" className="size-4 accent-teal-700" checked={picked.has(`fact-${i}`)} onChange={() => toggle(`fact-${i}`)} aria-label={`Add fact ${f.label}`} />
                      </td>
                      <td className="py-2 text-xs font-medium">Fact · {f.valueType}</td>
                      <td className="py-2">
                        <span className="font-medium">{f.label}</span> = {f.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setProposals(null)} disabled={busy !== null}>
                  Discard all
                </Button>
                <Button onClick={saveSelected} disabled={busy !== null || picked.size === 0}>
                  {busy === "save" && <Loader2 className="animate-spin" />} Add {picked.size} selected
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
