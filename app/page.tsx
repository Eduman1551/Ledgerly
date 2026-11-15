// Home page and role picker. No login: choosing a role sets a demo persona.
import { ArrowDown, ArrowRight, BadgeCheck, Brain, Lock, ScanSearch, ShieldCheck, Upload, UserCheck } from "lucide-react";
import Image from "next/image";
import { PersonaCards } from "@/components/persona-cards";
import diyasPhoto from "@/public/images/diwali-diyas.webp";
import teamPhoto from "@/public/images/team-meeting.webp";

const STAGES = [
  { icon: Upload, title: "Setup", who: "Admin", text: "Upload brand docs, tag privacy tiers, build the Fact Ledger." },
  { icon: ScanSearch, title: "Check", who: "Ledgerly", text: "Split drafts into claims and check each one against the ledger, terms and tone." },
  { icon: UserCheck, title: "Review", who: "Humans", text: "See why, accept or edit the fix. A reviewer approves or overrides with a reason." },
  { icon: Brain, title: "Learn", who: "Governance Brain", text: "Spot vague rules from overrides and propose clearer guideline versions." },
];

const PILLARS = [
  { icon: BadgeCheck, title: "Claim Ledger", text: "Every price, number and promise is labelled Supported, Outdated, Conflicting or Unsupported, with its source." },
  { icon: Lock, title: "Private by design", text: "Confidential drafts never leave the server. Internal ones are redacted before any AI sees them." },
  { icon: Brain, title: "Learns from reviewers", text: "Overrides with reasons become clearer guidelines, once the brand owner accepts them." },
];

/** A small mock of a real issue card, so visitors see the product before they click. */
function IssuePreview() {
  return (
    <div className="w-72 rounded-xl border border-border bg-white/95 p-3.5 text-sm shadow-[0_16px_40px_-12px_rgba(16,24,40,0.35)] backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Outdated</span>
        <span className="text-[11px] font-medium tracking-wide text-red-700 uppercase">high</span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 font-medium">
        <span className="rounded bg-muted px-1.5 py-0.5 line-through decoration-red-400">₹499</span>
        <ArrowRight className="size-3.5 text-muted-foreground" />
        <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-800">₹549</span>
        <span className="text-xs font-normal text-muted-foreground">· Price sheet v3</span>
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">Correct in v2, but the ledger now says ₹549, effective 1 Nov 2026.</p>
      <p className="mt-2.5 flex items-center gap-1.5 rounded-md bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-900">
        <ShieldCheck className="size-3.5" /> Redacted text sent to AI · 3 items hidden
      </p>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16 pb-6">
      {/* Hero */}
      <section className="relative -mx-4 -mt-6 overflow-hidden border-b border-border px-4 pt-14 pb-16 sm:pt-20">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[52rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-teal-200/50 via-cyan-100/40 to-amber-100/50 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-1 text-xs font-medium text-teal-800 shadow-sm backdrop-blur">
              <span className="size-1.5 rounded-full bg-teal-600" /> Brand governance for English, Hindi and Hinglish content
            </span>
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-[#1f2933] sm:text-5xl lg:text-6xl">
              Ledgerly
              <span className="mt-2 block bg-gradient-to-r from-teal-700 to-teal-500 bg-clip-text text-3xl text-transparent sm:text-4xl lg:text-[2.6rem]">Brand-safe content, verified before it&apos;s published.</span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Every claim in a draft is checked against approved sources, guidelines, terminology and visual identity. Each issue shows the rule it breaks and a suggested fix, and a human always makes the final call.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="#roles" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1f2933] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                Try the live demo <ArrowDown className="size-4" />
              </a>
              <a href="#how" className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-5 text-sm font-medium transition hover:bg-muted">
                How it works
              </a>
            </div>
          </div>

          {/* Image collage with a floating product preview */}
          <div className="relative mx-auto w-full max-w-xl">
            <div className="overflow-hidden rounded-2xl border border-white shadow-[0_24px_60px_-20px_rgba(16,24,40,0.45)] ring-1 ring-border">
              <Image src={teamPhoto} alt="A marketing team in a Bengaluru office applauding a colleague who is presenting at the head of the table" priority unoptimized className="aspect-[16/10] h-auto w-full object-cover" sizes="(max-width: 1024px) 100vw, 560px" />
            </div>
            <div className="absolute -bottom-10 -left-4 hidden w-44 overflow-hidden rounded-xl border-4 border-white shadow-xl sm:block">
              <Image src={diyasPhoto} alt="Lit clay diyas on a decorative tray with flower petals, the kind of festive scene Diwali campaigns are built around" unoptimized className="aspect-[4/3] h-auto w-full object-cover" sizes="176px" />
            </div>
            <div className="mt-4 flex justify-center sm:absolute sm:-right-6 sm:-bottom-14 sm:mt-0">
              <IssuePreview />
            </div>
          </div>
        </div>
      </section>

      {/* Role picker */}
      <section id="roles" aria-labelledby="roles-title" className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col gap-6 pt-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 id="roles-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Choose a role to enter the demo
          </h2>
          <p className="max-w-2xl text-muted-foreground">Each role opens its own dashboard. You can switch role any time from the top bar.</p>
        </div>
        <PersonaCards />
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm text-muted-foreground">
          <span>Demo with a fictional brand</span>
          <span aria-hidden>·</span>
          <span>no sign-in needed</span>
          <span aria-hidden>·</span>
          <span>AI sees only redacted text</span>
        </p>
      </section>

      {/* Workflow strip */}
      <section id="how" aria-labelledby="how-title" className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 id="how-title" className="text-2xl font-semibold tracking-tight">
            Setup → Check → Review → Learn
          </h2>
          <p className="max-w-2xl text-muted-foreground">Twelve steps, four stages. Ledgerly never publishes and never applies a fix on its own.</p>
        </div>
        <ol className="relative grid gap-4 md:grid-cols-4">
          <span aria-hidden className="absolute top-7 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-teal-200 via-teal-400 to-teal-200 md:block" />
          {STAGES.map((s, i) => (
            <li key={s.title} className="relative flex flex-col items-center gap-3 rounded-2xl bg-[#f3f4f6] p-5 text-center">
              <span className="relative flex size-14 items-center justify-center rounded-2xl bg-white text-primary shadow-sm ring-1 ring-border">
                <s.icon className="size-6" />
                <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{i + 1}</span>
              </span>
              <span>
                <span className="block font-semibold">{s.title}</span>
                <span className="block text-xs font-medium text-muted-foreground">{s.who}</span>
              </span>
              <span className="text-sm text-muted-foreground">{s.text}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Pillars */}
      <section className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="flex flex-col gap-2 rounded-2xl border border-border bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:shadow-md">
            <span className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-primary">
              <p.icon className="size-5" />
            </span>
            <h3 className="font-semibold">{p.title}</h3>
            <p className="text-sm text-muted-foreground">{p.text}</p>
          </div>
        ))}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Photos from Unsplash:{" "}
        <a className="underline underline-offset-2 hover:text-foreground" href="https://unsplash.com/photos/men-and-women-having-a-meeting-cW4lLTavU80" target="_blank" rel="noreferrer">
          team meeting by Smartworks Coworking
        </a>{" "}
        ·{" "}
        <a className="underline underline-offset-2 hover:text-foreground" href="https://unsplash.com/photos/lit-oil-lamps-on-decorative-tray-xisPXJqwQkA" target="_blank" rel="noreferrer">
          diyas by Udayaditya Barua
        </a>{" "}
        (Unsplash License).
      </p>
    </div>
  );
}
