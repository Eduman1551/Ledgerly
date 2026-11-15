"use client";
// A "vague rule" insight: the evidence (override reasons), the current wording,
// the proposed rewrite, and Accept / Dismiss. Accepting creates a new rule version.
import { Check, Loader2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app-context";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/client/api";
import type { Insights } from "@/lib/services/insights";

type Suggestion = Insights["suggestions"][number];

export function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const router = useRouter();
  const { user, aiEnabled } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const isAdmin = user.role === "admin";
  const { evidence } = suggestion;
  const pending = suggestion.status === "pending";

  async function run(label: string, path: string, success: string) {
    setBusy(label);
    try {
      await api(path, { method: "POST" });
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const allowed = evidence.proposedConfig?.allowed_slang_by_channel as Record<string, string[]> | undefined;

  return (
    <article className={`flex flex-col gap-3 rounded-xl border p-4 ${pending ? "border-purple-200 bg-purple-50/40" : "border-border bg-muted/40"}`}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800">Vague rule</span>
        <h3 className="font-semibold">{suggestion.ruleTitle}</h3>
        <span className="text-xs text-muted-foreground">version {evidence.ruleVersionNo}</span>
        {!pending && <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${suggestion.status === "accepted" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{suggestion.status === "accepted" ? "Rewrite accepted" : "Dismissed"}</span>}
      </header>
      <p className="text-sm">{suggestion.insight}</p>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase">Evidence: why reviewers overrode it</p>
        <ul className="mt-1 flex flex-col gap-1 text-sm">
          {evidence.reasons.map((reason, i) => (
            <li key={i} className="rounded-md bg-white px-2.5 py-1.5 ring-1 ring-border">
              “{reason}”
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Overridden words:{" "}
          {Object.entries(evidence.terms)
            .map(([term, n]) => `"${term}" ×${n}`)
            .join(", ")}{" "}
          · Channels:{" "}
          {Object.entries(evidence.channels)
            .map(([ch, n]) => `${ch} ×${n}`)
            .join(", ")}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-white p-3 ring-1 ring-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Current wording (v{evidence.ruleVersionNo})</p>
          <p className="mt-1 text-sm">{suggestion.currentBody}</p>
        </div>
        <div className="rounded-lg bg-white p-3 ring-1 ring-green-300">
          <p className="text-xs font-semibold text-green-800 uppercase">Proposed rewrite</p>
          <p className="mt-1 text-sm">{suggestion.proposedBody}</p>
          {allowed && Object.keys(allowed).length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Check change:{" "}
              {Object.entries(allowed)
                .map(([ch, words]) => `${words.map((w) => `"${w}"`).join(", ")} allowed on ${ch}`)
                .join("; ")}
              .
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Written by: {evidence.rewrittenBy}</p>
        </div>
      </div>

      {pending && isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => run("accept", `/api/insights/${suggestion.id}/accept`, "Rewrite accepted. It is now the current version of the rule.")} disabled={busy !== null}>
            {busy === "accept" ? <Loader2 className="animate-spin" /> : <Check />} Accept rewrite
          </Button>
          <Button variant="outline" onClick={() => run("dismiss", `/api/insights/${suggestion.id}/dismiss`, "Dismissed. The rule stays as it is.")} disabled={busy !== null}>
            <X /> Dismiss
          </Button>
          {aiEnabled && suggestion.ruleTier !== "confidential" && (
            <Button variant="ghost" onClick={() => run("polish", `/api/insights/${suggestion.id}/rewrite`, "Wording polished by AI. The permissions did not change.")} disabled={busy !== null} title="Sends the rule wording and override reasons (not any draft) to AI">
              {busy === "polish" ? <Loader2 className="animate-spin" /> : <Sparkles />} Polish wording with AI
            </Button>
          )}
        </div>
      )}
      {pending && !isAdmin && <p className="text-xs text-muted-foreground">Only the brand owner (Meera) can accept or dismiss a rewrite. Switch persona in the top bar.</p>}
      {suggestion.status === "accepted" && (
        <Link href={`/guidelines#${suggestion.ruleId}`} className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline">
          See the new version in Guidelines →
        </Link>
      )}
    </article>
  );
}
