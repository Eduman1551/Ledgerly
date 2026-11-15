"use client";
// Demo tools: reset the shared demo data and test the database / AI connection.
import { Activity, CircleCheck, CircleX, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/client/api";

type Health = {
  ok: boolean;
  db: { kind: string; ok: boolean; error: string | null };
  ai: { configured: boolean; model: string; label: string; probed: boolean; ok: boolean | null; error: string | null; ms: number | null };
};

function Line({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm">
      {ok === null ? <Activity className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-600" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-red-600" />}
      <span>{children}</span>
    </p>
  );
}

export function DemoTools() {
  const router = useRouter();
  const [busy, setBusy] = useState<"reset" | "health" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);

  async function reset() {
    setBusy("reset");
    try {
      await api("/api/demo/reset", { method: "POST" });
      toast.success("Demo data reset. Kesar & Co. is back to its starting state.");
      setConfirming(false);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function check() {
    setBusy("health");
    try {
      setHealth(await api<Health>("/api/health?probe=1"));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-xl border border-border p-5">
        <h2 className="font-semibold">Reset demo data</h2>
        <p className="text-sm text-muted-foreground">
          Everyone who opens this link shares one database. If another visitor has already approved or edited the demo drafts, reset to get the original Kesar &amp; Co. data back: 11 drafts, 9 facts, 7 rules and the decision history.
        </p>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <span className="flex-1">This deletes every draft, fact and rule change made so far. Continue?</span>
            <Button variant="destructive" onClick={reset} disabled={busy !== null}>
              {busy === "reset" && <Loader2 className="animate-spin" />} Yes, reset
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button className="w-fit" onClick={() => setConfirming(true)}>
            <RotateCcw /> Reset demo data
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border p-5">
        <h2 className="font-semibold">Health check</h2>
        <p className="text-sm text-muted-foreground">Checks the database and makes one small real call to the AI model. If AI is off or failing, every check still works with local rules.</p>
        <Button className="w-fit" variant="outline" onClick={check} disabled={busy !== null}>
          {busy === "health" ? <Loader2 className="animate-spin" /> : <Activity />} Run health check
        </Button>
        {health && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-muted p-3" role="status">
            <Line ok={health.db.ok}>
              Database: {health.db.kind}
              {health.db.error && ` · ${health.db.error}`}
            </Line>
            {!health.ai.configured ? (
              <Line ok={null}>AI: no API key configured. All checks run locally (this is a supported mode, not an error).</Line>
            ) : (
              <Line ok={health.ai.ok}>
                AI: {health.ai.label} ({health.ai.model}){health.ai.ok ? ` answered in ${health.ai.ms} ms` : ` · ${health.ai.error ?? "failed"} · checks fall back to local rules`}
              </Line>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
