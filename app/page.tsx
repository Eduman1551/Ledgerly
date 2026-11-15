// Landing page: the pitch, the 4-stage workflow, and three persona cards.
import { BadgeCheck, Brain, ShieldCheck } from "lucide-react";
import { PersonaCards } from "@/components/persona-cards";

const STAGES = [
  { n: 1, title: "Setup", who: "Admin", steps: ["Upload brand docs", "Tag privacy tier", "Build the Fact Ledger"] },
  { n: 2, title: "Check", who: "Ledgerly", steps: ["Creator submits", "Split into claims, route by tier", "Check every claim"] },
  { n: 3, title: "Review", who: "Humans", steps: ["See why and fix", "Accept or edit", "Reviewer approves or overrides"] },
  { n: 4, title: "Learn", who: "Governance Brain", steps: ["Log the decision", "Spot vague rules", "Rewrite becomes a new version"] },
];

const PILLARS = [
  { icon: BadgeCheck, title: "Claim Ledger", text: "Every claim is labelled Supported, Unsupported, Outdated or Conflicting against a versioned Fact Ledger. No source, no claim." },
  { icon: Brain, title: "Governance Brain", text: "Learns from every accept, edit and override. Finds vague rules and proposes clearer wording for the brand owner to accept." },
  { icon: ShieldCheck, title: "Private by Design", text: "Confidential content is checked locally. AI only ever sees redacted text, and a trust strip tells you exactly what was sent." },
];

export default function LandingPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 py-6">
      <section className="flex flex-col gap-4">
        <span className="w-fit rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">Brand governance for English, Hindi and Hinglish content</span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance">Publish on-brand. Every claim checked against an approved source.</h1>
        <p className="max-w-3xl text-lg text-muted-foreground">
          Ledgerly checks drafts against your guidelines, facts, terminology and visual identity. Each issue shows the rule it breaks and a suggested fix. A human always makes the final call.
        </p>
      </section>

      <section aria-labelledby="start" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="start" className="text-lg font-semibold">
            Pick a role to start the demo
          </h2>
          <p className="text-sm text-muted-foreground">Demo with a fictional brand, no sign-in needed.</p>
        </div>
        <PersonaCards />
      </section>

      <section aria-labelledby="workflow" className="flex flex-col gap-3">
        <h2 id="workflow" className="text-lg font-semibold">
          How it works
        </h2>
        <ol className="grid gap-3 md:grid-cols-4">
          {STAGES.map((s) => (
            <li key={s.n} className="rounded-xl bg-muted p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{s.n}</span>
                <span className="font-semibold">{s.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{s.who}</span>
              </div>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground">
                {s.steps.map((step) => (
                  <li key={step} className="flex gap-2">
                    <span aria-hidden className="text-primary">
                      →
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="flex flex-col gap-2 rounded-xl border border-border p-5">
            <p.icon className="size-5 text-primary" />
            <h3 className="font-semibold">{p.title}</h3>
            <p className="text-sm text-muted-foreground">{p.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
