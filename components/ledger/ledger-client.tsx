"use client";
// Fact Ledger table with a version-history drawer, plus the admin forms
// "Add fact" and "New version". Old versions are always kept.
import { History, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { TierBadge } from "@/components/badges";
import { Field, NativeSelect } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/client/api";
import type { Tier, ValueType } from "@/lib/db/schema";
import { formatIsoDate } from "@/lib/format";
import type { listFacts } from "@/lib/services/ledger";

type Fact = Awaited<ReturnType<typeof listFacts>>[number];

const TYPE_LABEL: Record<ValueType, string> = { price: "Price", number: "Number", percent: "Percentage", duration: "Duration", date: "Date", boolean: "Yes / no", text: "Text" };
const VALUE_HINT: Record<ValueType, string> = {
  price: "e.g. ₹599",
  number: "e.g. 2 lakh or 250000",
  percent: "e.g. 20%",
  duration: "e.g. 3-5 (the unit goes in the unit field)",
  date: "e.g. 1 Dec 2026",
  boolean: "yes or no",
  text: "The approved wording",
};
const today = () => new Date().toISOString().slice(0, 10);

export function LedgerClient({ facts, isAdmin, ownerName }: { facts: Fact[]; isAdmin: boolean; ownerName: string }) {
  const router = useRouter();
  const [historyOf, setHistoryOf] = useState<Fact | null>(null);
  const [versionOf, setVersionOf] = useState<Fact | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  // "New version" form
  const [version, setVersion] = useState({ value: "", displayValue: "", sourceName: "", effectiveFrom: today() });
  // "Add fact" form
  const emptyFact = { label: "", aliases: "", valueType: "price" as ValueType, unit: "", tier: "public" as Tier, owner: ownerName, value: "", displayValue: "", sourceName: "", effectiveFrom: today() };
  const [fact, setFact] = useState(emptyFact);

  async function save(fn: () => Promise<unknown>, success: string, close: () => void) {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      close();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const submitVersion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionOf) return;
    void save(() => api(`/api/facts/${versionOf.id}/versions`, { body: { ...version, displayValue: version.displayValue || undefined } }), `New version saved. Drafts that still say the old value will be flagged as Outdated on their next check.`, () => setVersionOf(null));
  };

  const submitFact = (e: React.FormEvent) => {
    e.preventDefault();
    const aliases = fact.aliases
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length >= 2);
    void save(() => api("/api/facts", { body: { ...fact, aliases, unit: fact.unit || null, displayValue: fact.displayValue || undefined } }), "Fact added to the ledger", () => {
      setAdding(false);
      setFact(emptyFact);
    });
  };

  // Confidential values are only shown to the brand owner.
  const display = (f: Fact) => (f.tier === "confidential" && !isAdmin ? "Hidden (confidential)" : (f.current?.displayValue ?? "–"));

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add fact
          </Button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead>Fact</TableHead>
              <TableHead>Current value</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Effective from</TableHead>
              <TableHead className="text-right">Versions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {facts.map((f) => (
              <TableRow key={f.id}>
                <TableCell>
                  <span className="font-medium">{f.label}</span>
                  <span className="block text-xs text-muted-foreground">{TYPE_LABEL[f.valueType]}</span>
                </TableCell>
                <TableCell className="max-w-64 font-medium whitespace-normal">{display(f)}</TableCell>
                <TableCell className="text-muted-foreground">{f.current?.sourceName ?? "–"}</TableCell>
                <TableCell>
                  <TierBadge tier={f.tier} />
                </TableCell>
                <TableCell className="text-muted-foreground">{f.owner}</TableCell>
                <TableCell className="text-muted-foreground">{f.current ? formatIsoDate(f.current.effectiveFrom) : "–"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setHistoryOf(f)} aria-label={`Version history of ${f.label}`}>
                      <History /> v{f.current?.versionNo ?? 1} · history
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setVersion({ value: "", displayValue: "", sourceName: "", effectiveFrom: today() });
                          setVersionOf(f);
                        }}
                      >
                        New version
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Version history drawer */}
      <Sheet open={historyOf !== null} onOpenChange={(open) => !open && setHistoryOf(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{historyOf?.label}</SheetTitle>
            <SheetDescription>Every version is kept. A draft that uses an older value is flagged as Outdated, with the current value as the fix.</SheetDescription>
          </SheetHeader>
          <ol className="flex flex-col gap-2 px-4 pb-6">
            {historyOf?.versions.map((v) => {
              const current = v.id === historyOf.currentVersionId;
              const hidden = historyOf.tier === "confidential" && !isAdmin;
              return (
                <li key={v.id} className={`rounded-lg border p-3 text-sm ${current ? "border-primary bg-teal-50" : "border-border"}`}>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold ring-1 ring-border">v{v.versionNo}</span>
                    <span className="font-semibold">{hidden ? "Hidden (confidential)" : v.displayValue}</span>
                    {current && <span className="ml-auto text-xs font-medium text-primary">current</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Source: {v.sourceName} · effective {formatIsoDate(v.effectiveFrom)}
                  </p>
                </li>
              );
            })}
          </ol>
        </SheetContent>
      </Sheet>

      {/* New version */}
      <Dialog open={versionOf !== null} onOpenChange={(open) => !open && !busy && setVersionOf(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New version: {versionOf?.label}</DialogTitle>
            <DialogDescription>
              Current value: <strong>{versionOf?.current?.displayValue}</strong>. The old version stays in the history.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitVersion} className="flex flex-col gap-3">
            <Field label="New value" htmlFor="nv-value" hint={versionOf ? VALUE_HINT[versionOf.valueType] : undefined}>
              <Input id="nv-value" value={version.value} onChange={(e) => setVersion({ ...version, value: e.target.value })} required autoFocus />
            </Field>
            <Field label="Display text (optional)" htmlFor="nv-display" hint="How people should read it. Leave empty to use the value as typed.">
              <Input id="nv-display" value={version.displayValue} onChange={(e) => setVersion({ ...version, displayValue: e.target.value })} />
            </Field>
            <Field label="Source" htmlFor="nv-source" hint="No source, no claim: name the document this value comes from.">
              <Input id="nv-source" value={version.sourceName} onChange={(e) => setVersion({ ...version, sourceName: e.target.value })} required placeholder="e.g. Price sheet v4" />
            </Field>
            <Field label="Effective from" htmlFor="nv-date">
              <Input id="nv-date" type="date" value={version.effectiveFrom} onChange={(e) => setVersion({ ...version, effectiveFrom: e.target.value })} required />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVersionOf(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Save new version
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add fact */}
      <Dialog open={adding} onOpenChange={(open) => !open && !busy && setAdding(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add a fact</DialogTitle>
            <DialogDescription>Drafts are checked against this value. Aliases are the words creators use when they talk about it.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitFact} className="flex flex-col gap-3">
            <Field label="Label" htmlFor="nf-label">
              <Input id="nf-label" value={fact.label} onChange={(e) => setFact({ ...fact, label: e.target.value })} required placeholder="e.g. Gift box price" />
            </Field>
            <Field label="Aliases (comma-separated)" htmlFor="nf-aliases" hint="Used to find the fact in a draft, e.g. gift box, gift hamper">
              <Input id="nf-aliases" value={fact.aliases} onChange={(e) => setFact({ ...fact, aliases: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Type" htmlFor="nf-type">
                <NativeSelect id="nf-type" value={fact.valueType} onChange={(e) => setFact({ ...fact, valueType: e.target.value as ValueType })}>
                  {Object.entries(TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Unit (optional)" htmlFor="nf-unit">
                <Input id="nf-unit" value={fact.unit} onChange={(e) => setFact({ ...fact, unit: e.target.value })} placeholder="e.g. business days" />
              </Field>
              <Field label="Privacy tier" htmlFor="nf-tier">
                <NativeSelect id="nf-tier" value={fact.tier} onChange={(e) => setFact({ ...fact, tier: e.target.value as Tier })}>
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="confidential">Confidential (never sent to AI)</option>
                </NativeSelect>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Value" htmlFor="nf-value" hint={VALUE_HINT[fact.valueType]}>
                <Input id="nf-value" value={fact.value} onChange={(e) => setFact({ ...fact, value: e.target.value })} required />
              </Field>
              <Field label="Display text (optional)" htmlFor="nf-display">
                <Input id="nf-display" value={fact.displayValue} onChange={(e) => setFact({ ...fact, displayValue: e.target.value })} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Source" htmlFor="nf-source">
                <Input id="nf-source" value={fact.sourceName} onChange={(e) => setFact({ ...fact, sourceName: e.target.value })} required placeholder="e.g. Price sheet v3" />
              </Field>
              <Field label="Owner" htmlFor="nf-owner">
                <Input id="nf-owner" value={fact.owner} onChange={(e) => setFact({ ...fact, owner: e.target.value })} required />
              </Field>
              <Field label="Effective from" htmlFor="nf-date">
                <Input id="nf-date" type="date" value={fact.effectiveFrom} onChange={(e) => setFact({ ...fact, effectiveFrom: e.target.value })} required />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdding(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Add fact
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
