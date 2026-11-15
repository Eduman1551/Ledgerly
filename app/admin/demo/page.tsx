// Demo tools: reset data, health check, the judge walkthrough and project links.
import { ExternalLink } from "lucide-react";
import { DemoTools } from "@/components/demo-tools";
import { PageHeader } from "@/components/form-fields";

const REPO = "https://github.com/Eduman1551/Ledgerly";

const WALKTHROUGH = [
  "Start as Creator (Riya) and open “Diwali launch post”. See the highlighted issues, each with its source.",
  "Accept the price fix (₹499 → ₹549), edit or remove the “India's #1” claim, fix the other high-severity issues, then Re-check and Send to reviewer.",
  "Switch to Reviewer (Arjun). Open a draft in the review queue, override a tone flag with a reason, then Approve.",
  "Open “Winter Blend teaser brief” (Confidential): the trust strip says “Checked locally · 0 data sent to AI”.",
  "Switch to Admin (Meera) → Insights. The tone rule shows as a vague rule. Accept the rewrite, then see version 2 in Guidelines.",
  "Fact Ledger → New version on the Masala Chai price. Drafts that still use the old price are flagged Outdated on re-check.",
];

export default function DemoPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Demo tools" description="This is a demo with a fictional brand, Kesar & Co. There is no sign-in: use the persona switcher in the top bar to change role." />
      <DemoTools />
      <section className="rounded-xl bg-muted p-5">
        <h2 className="font-semibold">3-minute walkthrough</h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm">
          {WALKTHROUGH.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section className="flex flex-wrap gap-3 text-sm">
        <a href={REPO} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 font-medium hover:bg-muted">
          Source code on GitHub <ExternalLink className="size-3.5" />
        </a>
        <a href={`${REPO}#readme`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 font-medium hover:bg-muted">
          README (architecture, disclosures) <ExternalLink className="size-3.5" />
        </a>
        <a href="/api/health" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 font-medium hover:bg-muted">
          /api/health <ExternalLink className="size-3.5" />
        </a>
      </section>
    </div>
  );
}
