# Ledgerly · CodeNova India 2026 Round 2 submission

Team **CookedCoders** (IIIT Kota) · Problem statement by Inkloom AI

---

## 1. Working project link

`TODO: https://<your-project>.vercel.app`

Opens without sign-in. Pick a persona on the landing page. The demo uses the fictional brand Kesar & Co. and starts with seeded data. **Demo tools → Reset demo data** restores the starting state.

## 2. Source-code repository link

https://github.com/Eduman1551/Ledgerly (public)

## 3. Updated project PDF

The updated deck is uploaded separately in the form. It reflects the stack and plan changes in section 6 below.

---

## 4. Completed features

Everything listed here works on the live link without an AI key (the local fallback). With a key, AI also extracts claims and reviews tone on Public and Internal drafts.

**Home page and role dashboards**
- Home page that is also the role picker (no login): pitch, workflow strip, three role cards, trust line.
- Creator dashboard (my drafts, what needs fixing, drafts checked, issues fixed), reviewer dashboard (review queue, recent approvals, override count) and admin dashboard (KPIs, shortcuts, top Governance Brain insights).
- Role-aware navigation and friendly route guards with a one-click role switch.

**Core workflow (content in → checked → issues with rule and fix → human approval)**
- Drafts inbox with status, channel, tier, language and open-issue count; reviewers see their review queue first.
- New draft form: title, channel, privacy tier (with an explanation of what each tier means for AI), text typed or loaded from .txt / .md / .docx, optional image with alt text.
- Check pipeline exposed as REST: language detection, tier routing, claim extraction, ledger matching, rule checks, tone, visual check.
- Review screen: draft text with inline colour-coded highlights (click a highlight to jump to its card), "N issues found" panel, "X of N fixed" progress, language and tier badges, revision selector.
- Every issue card shows a status chip, excerpt → suggestion (e.g. `₹499 → ₹549 · Price sheet v3`), why it was flagged, the cited fact version and/or rule version, and role-based actions.
- Creator: **Accept** (applies the fix as a new revision), **Edit** (inline replacement), **Accept all fixes**, **Edit text** (saves a revision and re-checks), **Re-check**, **Send to reviewer** (blocked while a high-severity issue is open).
- Reviewer: **Override** with a required reason, **Comment**, **Approve** or **Request changes** with a comment. Approved drafts show "Approved, ready to publish" and **Copy final text**. Ledgerly never publishes.
- Revision history with word-level diffs, decision log and comments.
- Overrides survive a re-check (same words, same rule/fact version).

**Claim Ledger (MVP)**
- Versioned facts (value, display value, source, owner, effective date, tier, aliases) with a version-history drawer.
- Claim statuses Supported / Unsupported / Outdated / Conflicting, including boolean facts ("100% organic" vs "Not certified") and negation ("not certified organic" = supported).
- Value normalisation for ₹ / Rs / INR, commas, lakh / crore / k, Devanagari digits, ranges, "din", hours / weeks, and dates.
- Add fact and New version forms (admin only). Old versions are kept, so drafts using an old value are flagged Outdated on their next check.
- Confidential values are hidden from non-admin personas.

**Guidelines and terminology**
- Seven rule kinds: claim policy, banned terms, required brand spelling (catches variants like "KesarCo", "Kesar and Co", "Kesar & Company"), tone (slang, emoji limit, ALL-CAPS), language per channel, accessibility (sentence length, emoji-only lines, alt text), visual palette.
- Rules grouped by kind with version history. Editing creates a new version; issues cite the version they were checked against.
- Brand palette swatches.
- **Import from brand doc**: paste or upload; AI (non-confidential docs) or a local parser proposes rules and facts in a review table; nothing is ticked or saved until the admin confirms.

**Hinglish tone check (USP)**
- Language detection for English, Hindi (Devanagari), Hinglish and mixed script (100% on the 20-post eval set).
- Slang, emoji and caps checks work in Hinglish; the AI tone step is asked to rewrite in the creator's own language and script.
- Language-per-channel rule (Hinglish allowed on Instagram and ads, not email or documents).

**Privacy tiers (USP)**
- Confidential → local rules only, 0 data sent to AI.
- Internal → reversible redaction of names, emails, phone numbers, internal codes and confidential fact values before AI; placeholders restored on the server.
- Public → confidential fact values are still hidden.
- Trust strip on every result: "Checked locally · 0 data sent to AI", "Redacted text (N items hidden) sent to Gemini … · N chars", or "AI unavailable, checked with local rules".
- Top-bar AI pill to switch AI off for a session (local fallback).

**Governance Brain (USP)**
- KPI tiles: drafts checked, claims verified, fixes accepted vs overridden, characters sent to AI vs checked locally.
- Override-rate-per-rule bar chart (Recharts) with a data table, and the most repeated mistakes (counted on each draft's first check; the old ₹499 price is #1 in the seed data).
- Vague-rule detector (≥ 3 decisions and ≥ 40% overrides on the current version) with the override reasons as evidence and a proposed rewrite built from them, plus Accept / Dismiss and optional AI polish.
- Accepting creates a new rule version (with the new channel-specific slang allowance in its config) and later checks use it.

**Visual identity and accessibility**
- Dominant colours extracted in the browser (canvas quantisation); only hex values go to the server.
- Server-side Delta-E (CIE76) comparison with the brand palette; neutral greys ignored.
- Missing alt text flagged as an accessibility issue.

**Reliability and demo**
- Zod validation on every API input and AI output; JSON errors with readable messages; page-level error, loading and not-found screens; toasts for failed actions.
- 15 s timeout on every AI call, no retries, deterministic fallback; per-visitor in-memory rate limit on AI routes.
- Role checks on the server (override/approve = reviewer or admin; ledger/rules/insight decisions = admin).
- Demo tools: Reset demo data, health check (database + one real AI probe), walkthrough, links.
- Seed data: 3 personas, 9 facts (with version history), 7 rules, 11 drafts including approved, in-review and changes-requested ones, and a replayed decision history that the Governance Brain learns from.
- Testing: 71 Vitest tests, `pnpm eval` on 20 labelled posts, GitHub Actions CI (typecheck, lint, test, build).

## 5. Technology and implementation details

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript (strict) |
| Backend | Next.js Route Handlers (`app/api/**`) on the Node.js runtime as the REST API |
| UI | Tailwind CSS v4, shadcn/ui, lucide-react, Recharts, sonner |
| Database | PostgreSQL on Neon, Drizzle ORM + drizzle-kit, `@neondatabase/serverless` HTTP driver; committed migrations in `drizzle/` |
| Local fallback DB | PGlite (in-memory Postgres) when `DATABASE_URL` is not set |
| Validation | Zod on API inputs, forms and AI outputs |
| AI | Google Gemini (`gemini-3.8-flash`, configurable) via the Vercel AI SDK, structured output with Zod schemas |
| File parsing | mammoth (.docx), plain read for .txt / .md |
| Tests | Vitest, plus an eval script |
| Deploy | Vercel + Neon, public GitHub repo, GitHub Actions CI |
| Package manager | pnpm, tsx for scripts |

**Code structure**
- `lib/engine/`: the check engine, pure TypeScript with no database or network access, fully unit-tested. AI is injected through a small `AiAdapter` interface so tests can use a fake.
- `lib/services/`: one file per workflow area (drafts, review, ledger, guidelines, insights, brand-doc import).
- `app/api/`: thin Route Handlers: validate with Zod, check the role, call a service, return JSON.
- `lib/seed/`: demo data. The seeder replays the demo history through the real engine and review services, so the seeded state is exactly what the app would produce.

**Key algorithms**
- Fact matching scores each fact by the distance between the claim and the nearest label/alias in the same sentence (mentions after the claim count as further away); a value equal to one of the fact's versions pulls the fact closer. This lets "Masala Chai at ₹499 with free shipping above ₹399" match each price to the right fact.
- When a fix is accepted, the remaining issues' highlight spans are shifted to the new text, so the creator can keep fixing without a re-check.

## 6. Changes made to the original plan

| Original plan (Round 1 deck) | What we built | Why |
|---|---|---|
| Node.js backend with a REST API, separate from the Next.js frontend | One Next.js app; the Node backend is Next.js Route Handlers exposing the same REST endpoints | One repo and one deploy, shared types and Zod schemas, less to break before the deadline |
| PostgreSQL (managed) | Neon Postgres with Drizzle ORM | Free tier, works with Vercel, typed queries and committed migrations |
| "LLM API" | Google Gemini Flash through the Vercel AI SDK | Free-tier key, structured output with Zod, easy to swap the model via `LLM_MODEL` |
| Login per role | No login; a persona switcher (cookie) with server-side role checks | Organiser rule: every link must open without sign-in |
| AI does claim checking | AI only extracts claims and judges tone; matching against the ledger is deterministic and local | Fact checks must be reproducible and must work on Confidential content without AI |
| — (not in the deck) | In-memory PGlite database when `DATABASE_URL` is missing | Lets teammates, judges and CI run the app with zero setup |
| — | `pnpm eval` with 20 labelled posts | Round 2 asks for evidence of testing |
| Generate rewrites with AI | Default rewrite is a local template built from the override reasons; AI polish is optional | The Governance Brain works without a key, and AI cannot add permissions the evidence does not support |

**Decisions we made on our own** (noted here as asked): the default Gemini model ID is `gemini-3.8-flash`; Internal-tier seed draft "Diwali launch post" goes through redaction when a key is set; the demo reset is open to every persona because judges share one database; PDF import was cut (lowest priority in the plan).

## 7. Three major improvements for Round 3

All three go clearly beyond what Round 2 shipped.

**(a) Full visual and accessibility review**
Round 2 checks only an image's dominant colours against the palette and whether alt text exists. Round 3 adds: OCR on text inside images (posters, ad creatives) so prices and claims in a graphic are checked against the Fact Ledger like any other claim; logo detection (correct logo version, clear space, not stretched or recoloured); WCAG contrast checks for text over images; and an AI-drafted alt-text suggestion the creator can accept.

**(b) Multi-format input and integrations, so content is checked where it is written**
Round 2 accepts pasted text and .txt/.md/.docx uploads. Round 3 adds: PDF and slide-deck review with page-level highlights; a browser extension that checks text inside CMS, social schedulers and Google Docs; and a Slack / CMS webhook that runs a check when a draft is posted and returns the issues with their sources. The privacy tiers and trust strip apply to every integration.

**(c) Governance Brain v2: measured accuracy and proactive guideline health**
Round 2 detects vague rules from override rates on one demo dataset. Round 3 adds: a larger labelled set (target 300+ posts across English, Hindi and Hinglish, labelled by real reviewers) with claim-check precision and recall reported per language and per release; repeat mistakes clustered per creator and per team, with targeted tips; automatic alias suggestions when a fact is missed (the main local-mode error in our eval); and a scheduled guideline-health report for the brand owner (rules that are overridden, never triggered, or contradict each other).
