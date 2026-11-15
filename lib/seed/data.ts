// Demo data for the FICTIONAL chai brand "Kesar & Co.". Nothing here refers to
// a real company. Plain data only, so the eval script can use it without a DB.
import type { Channel, RuleKind, Severity, Tier, ValueType } from "@/lib/db/schema";
import type { EngineFact, EngineRule } from "@/lib/engine/types";

export const SEED_USERS = [
  { id: "user_riya", name: "Riya Sharma", role: "creator" as const },
  { id: "user_arjun", name: "Arjun Mehta", role: "reviewer" as const },
  { id: "user_meera", name: "Meera Iyer", role: "admin" as const },
];

export const SEED_PALETTE = [
  { name: "Saffron", hex: "#B45309" },
  { name: "Ink", hex: "#1F2933" },
  { name: "Cream", hex: "#FFF7ED" },
  { name: "Leaf", hex: "#3F6212" },
];

export const SEED_BRAND_VOICE =
  "Kesar & Co. sounds warm, clear and friendly. Light Hinglish is fine on Instagram. No slang like \"bro\" or \"lit\", at most 3 emojis, no ALL-CAPS words. The brand name is always written exactly \"Kesar & Co.\".";

type SeedFact = {
  id: string;
  key: string;
  label: string;
  aliases: string[];
  valueType: ValueType;
  unit: string | null;
  tier: Tier;
  owner: string;
  versions: { value: string; displayValue: string; sourceName: string; effectiveFrom: string }[]; // oldest → current
};

export const SEED_FACTS: SeedFact[] = [
  {
    id: "fact_masala_price",
    key: "masala_chai_250g_price",
    label: "Masala Chai 250g price",
    aliases: ["masala chai", "masala chai 250g", "मसाला चाय"],
    valueType: "price",
    unit: "INR",
    tier: "public",
    owner: "Meera Iyer",
    versions: [
      { value: "449", displayValue: "₹449", sourceName: "Price sheet v1", effectiveFrom: "2025-04-01" },
      { value: "499", displayValue: "₹499", sourceName: "Price sheet v2", effectiveFrom: "2026-01-15" },
      { value: "549", displayValue: "₹549", sourceName: "Price sheet v3", effectiveFrom: "2026-11-01" },
    ],
  },
  {
    id: "fact_free_shipping",
    key: "free_shipping_threshold",
    label: "Free shipping threshold",
    aliases: ["free shipping", "free delivery", "shipping free", "फ्री शिपिंग", "मुफ्त डिलीवरी"],
    valueType: "price",
    unit: "INR",
    tier: "public",
    owner: "Meera Iyer",
    versions: [{ value: "399", displayValue: "orders above ₹399", sourceName: "Shipping policy", effectiveFrom: "2025-04-01" }],
  },
  {
    id: "fact_delivery_time",
    key: "delivery_time",
    label: "Delivery time",
    aliases: ["delivery", "delivered", "deliver", "ships in", "shipped in", "डिलीवरी"],
    valueType: "duration",
    unit: "business days",
    tier: "public",
    owner: "Arjun Mehta",
    versions: [
      { value: "5-7", displayValue: "5–7 business days", sourceName: "Logistics SLA 2025", effectiveFrom: "2025-04-01" },
      { value: "3-5", displayValue: "3–5 business days", sourceName: "Logistics SLA", effectiveFrom: "2026-06-01" },
    ],
  },
  {
    id: "fact_customers",
    key: "customers_served",
    label: "Customers served",
    aliases: ["customers", "customer", "chai lovers", "families", "ग्राहक", "ग्राहकों"],
    valueType: "number",
    unit: null,
    tier: "public",
    owner: "Meera Iyer",
    versions: [{ value: "200000", displayValue: "2 lakh+", sourceName: "Annual report 2025", effectiveFrom: "2026-03-31" }],
  },
  {
    id: "fact_organic",
    key: "organic_certification",
    label: "Organic certification",
    aliases: ["organic", "certified organic", "organic certified", "ऑर्गेनिक", "जैविक"],
    valueType: "boolean",
    unit: null,
    tier: "internal",
    owner: "Meera Iyer",
    versions: [{ value: "false", displayValue: "Not certified (only the Assam leaf is organic-sourced)", sourceName: "Compliance note", effectiveFrom: "2026-02-10" }],
  },
  {
    id: "fact_return_window",
    key: "return_window",
    label: "Return window",
    aliases: ["return", "returns", "refund", "wapas", "रिटर्न", "वापसी"],
    valueType: "duration",
    unit: "days",
    tier: "public",
    owner: "Arjun Mehta",
    versions: [{ value: "7", displayValue: "7 days", sourceName: "Returns policy", effectiveFrom: "2025-04-01" }],
  },
  {
    id: "fact_diwali_sale",
    key: "diwali_sale_discount",
    label: "Diwali sale",
    aliases: ["diwali sale", "diwali offer", "festive sale", "दिवाली सेल", "दिवाली ऑफर"],
    valueType: "percent",
    unit: "%",
    tier: "internal",
    owner: "Meera Iyer",
    versions: [{ value: "20", displayValue: "20% off, 25 Oct – 5 Nov 2026", sourceName: "Campaign brief", effectiveFrom: "2026-10-25" }],
  },
  {
    id: "fact_winter_launch",
    key: "winter_blend_launch_date",
    label: "Winter Blend launch date",
    aliases: ["winter blend", "launch", "launches", "launching"],
    valueType: "date",
    unit: null,
    tier: "confidential",
    owner: "Meera Iyer",
    versions: [{ value: "2026-12-01", displayValue: "1 Dec 2026", sourceName: "Launch plan", effectiveFrom: "2026-10-01" }],
  },
  {
    id: "fact_winter_price",
    key: "winter_blend_price",
    label: "Winter Blend price",
    aliases: ["winter blend"],
    valueType: "price",
    unit: "INR",
    tier: "confidential",
    owner: "Meera Iyer",
    versions: [{ value: "699", displayValue: "₹699", sourceName: "Launch plan", effectiveFrom: "2026-10-01" }],
  },
];

type SeedRule = { id: string; kind: RuleKind; title: string; tier: Tier; severity: Severity; body: string; config: Record<string, unknown> };

export const SEED_RULES: SeedRule[] = [
  {
    id: "rule_claim_policy",
    kind: "claim_policy",
    title: "No source, no claim",
    tier: "public",
    severity: "high",
    body: "Every number, price, date, percentage, superlative or certification in a draft needs an approved source in the Fact Ledger.",
    config: {},
  },
  {
    id: "rule_banned_terms",
    kind: "banned_term",
    title: "Banned terms",
    tier: "public",
    severity: "high",
    body: "Never use these phrases: \"India's #1\", \"No. 1 in India\", \"best in the world\", \"guaranteed\", \"cure\", \"100% organic\".",
    config: { terms: ["India's #1", "No. 1 in India", "best in the world", "guaranteed", "cure", "100% organic"] },
  },
  {
    id: "rule_brand_spelling",
    kind: "required_term",
    title: "Brand name spelling",
    tier: "public",
    severity: "medium",
    body: "The brand name is written exactly \"Kesar & Co.\" (not \"Kesar and Co\", \"KesarCo\" or \"Kesar & Company\").",
    config: { term: "Kesar & Co.", pattern: "kesar\\s*(?:&|and|n|-)?\\s*(?:company|co\\.?)(?![A-Za-z])" },
  },
  {
    // Deliberately vague: it does not say which slang, or on which channel.
    // Reviewers keep overriding it, which is what the Governance Brain detects.
    id: "rule_tone",
    kind: "tone",
    title: "Tone: avoid slang",
    tier: "public",
    severity: "medium",
    body: "Keep the voice warm, clear and friendly. Avoid casual slang, too many emojis and ALL-CAPS words.",
    config: { slang: ["bro", "lit", "yaar"], max_emojis: 3, no_all_caps: true, allowed_caps: ["FSSAI", "COD", "GST", "UPI", "FAQ", "OTP", "INR", "SMS", "SLA", "USP"], allowed_slang_by_channel: {} },
  },
  {
    id: "rule_language",
    kind: "language",
    title: "Language per channel",
    tier: "public",
    severity: "medium",
    body: "Hinglish and Devanagari are allowed on Instagram and ads. Emails and documents are written in English.",
    config: { allowed_channels: ["instagram", "ad"] },
  },
  {
    id: "rule_accessibility",
    kind: "accessibility",
    title: "Accessibility basics",
    tier: "public",
    severity: "low",
    body: "Images need alt text. Keep sentences under 25 words. Avoid emoji-only lines.",
    config: { max_sentence_words: 25, require_alt_text: true, no_emoji_only_lines: true },
  },
  {
    id: "rule_visual",
    kind: "visual",
    title: "Brand palette",
    tier: "public",
    severity: "low",
    body: "Images should be built around the brand palette colours: Saffron, Ink, Cream and Leaf.",
    config: { max_delta_e: 28 },
  },
];

/** A scripted step in a seeded draft's history. `match` is the flagged excerpt. */
export type SeedStep =
  | { do: "accept"; match: string }
  | { do: "override"; match: string; reason: string }
  | { do: "submit" }
  | { do: "approve"; comment?: string }
  | { do: "request_changes"; comment: string };

export type SeedDraft = {
  id: string;
  title: string;
  channel: Channel;
  tier: Tier;
  text: string;
  daysAgo: number;
  steps: SeedStep[];
};

export const SEED_DRAFTS: SeedDraft[] = [
  // --- The three drafts the judge path uses --------------------------------
  {
    id: "draft_diwali",
    title: "Diwali launch post",
    channel: "instagram",
    tier: "internal",
    text: "Is Diwali, India's #1 masala chai sirf ₹499 mein! 100% organic aur guaranteed delivery in 2 din. Order karo bro 🔥🔥🔥🔥 KesarCo ke saath!",
    daysAgo: 0,
    steps: [],
  },
  {
    id: "draft_newsletter",
    title: "November newsletter",
    channel: "email",
    tier: "public",
    text: "Namaste from Kesar & Co.! Our Masala Chai 250g is now ₹549, and you get free shipping on orders above ₹399. Orders are delivered in 5–7 business days. This winter, we are slowing down and brewing each batch a little longer so that every single cup you pour at home tastes just as warm and comforting as the one you remember from your favourite chai stall. Not happy with your order? Return it within 7 days.",
    daysAgo: 1,
    steps: [],
  },
  {
    id: "draft_winter",
    title: "Winter Blend teaser brief",
    channel: "document",
    tier: "confidential",
    text: "Winter Blend teaser plan. Winter Blend launches on 1 Dec 2026 at ₹649. Tease it to our 2 lakh+ customers on Instagram from 20 Nov. Asset owner: Arjun Mehta (arjun@kesarco.example), ref KC-2041.",
    daysAgo: 1,
    steps: [],
  },
  // --- So the lists are not empty: one in review, one sent back -------------
  {
    id: "draft_shipping",
    title: "Free shipping reminder",
    channel: "email",
    tier: "public",
    text: "Free shipping on all orders above ₹399. Delivery in 3–5 business days. Smiles guaranteed!",
    daysAgo: 2,
    steps: [{ do: "accept", match: "guaranteed" }, { do: "submit" }],
  },
  {
    id: "draft_assam",
    title: "Assam Gold ad copy",
    channel: "ad",
    tier: "public",
    text: "Try our new Assam Gold tea, the best in the world. 50% off this week only!",
    daysAgo: 3,
    steps: [
      { do: "accept", match: "best in the world" },
      { do: "submit" },
      { do: "request_changes", comment: "\"50% off\" is not in any campaign brief. Please confirm the offer with Meera before we publish." },
    ],
  },
  // --- History the Governance Brain learns from -----------------------------
  // Pattern: reviewers keep overriding the vague tone rule ("yaar"), and the
  // old ₹499 price is the most repeated mistake.
  {
    id: "draft_customer_love",
    title: "Customer love post",
    channel: "instagram",
    tier: "public",
    text: "2 lakh+ customers trust KesarCo for their daily cup. Thanks bro, you made it happen! Returns are easy within 7 days.",
    daysAgo: 5,
    steps: [{ do: "accept", match: "KesarCo" }, { do: "accept", match: "bro" }, { do: "submit" }, { do: "approve", comment: "Clean and on-brand. Good to go." }],
  },
  {
    id: "draft_festive_ad",
    title: "Festive ad copy",
    channel: "ad",
    tier: "internal",
    text: "Diwali ki shubhkamnayein yaar! Masala chai sirf ₹499 mein. Order karo bro, guaranteed delivery in 3–5 business days.",
    daysAgo: 8,
    steps: [
      { do: "accept", match: "₹499" },
      { do: "accept", match: "bro" },
      { do: "accept", match: "guaranteed" },
      { do: "submit" },
      { do: "override", match: "yaar", reason: "'yaar' matches how our customers talk in ads" },
      { do: "approve" },
    ],
  },
  {
    id: "draft_chai_lovers",
    title: "Chai lovers reel",
    channel: "instagram",
    tier: "public",
    text: "Garam chai aur pyaare dost yaar ❤️ Masala chai ₹499 mein, guaranteed fresh!",
    daysAgo: 11,
    steps: [
      { do: "accept", match: "₹499" },
      { do: "accept", match: "guaranteed" },
      { do: "submit" },
      { do: "override", match: "yaar", reason: "The tone rule does not say which slang is banned on Instagram" },
      { do: "approve" },
    ],
  },
  {
    id: "draft_weekend",
    title: "Weekend offer story",
    channel: "instagram",
    tier: "public",
    text: "Weekend plans? Chai pe charcha yaar! Masala Chai 250g at ₹499 only.",
    daysAgo: 14,
    steps: [{ do: "accept", match: "₹499" }, { do: "submit" }, { do: "override", match: "yaar", reason: "Reviewer call: 'yaar' is friendly, not rude" }, { do: "approve" }],
  },
  {
    id: "draft_rakhi",
    title: "Rakhi gifting post",
    channel: "instagram",
    tier: "public",
    text: "Is Rakhi, apne bhai ko chai ka tohfa bhejo yaar. Masala chai sirf ₹499 mein, free shipping above ₹399!",
    daysAgo: 17,
    steps: [{ do: "accept", match: "₹499" }, { do: "submit" }, { do: "override", match: "yaar", reason: "Hinglish slang is on-brand for Gen Z reels" }, { do: "approve" }],
  },
  {
    id: "draft_monsoon",
    title: "Monsoon chai reel",
    channel: "instagram",
    tier: "internal",
    text: "Baarish aur chai, perfect combo yaar! Masala chai ab sirf ₹499 mein.",
    daysAgo: 20,
    steps: [{ do: "accept", match: "₹499" }, { do: "submit" }, { do: "override", match: "yaar", reason: "'yaar' fits our Instagram audience" }, { do: "approve" }],
  },
];

// --- Helpers that turn seed data into engine input (used by seed, tests, eval) ---

export function seedEngineFacts(): EngineFact[] {
  return SEED_FACTS.map((f) => {
    const versions = f.versions.map((v, i) => ({ id: `${f.id}_v${i + 1}`, versionNo: i + 1, ...v }));
    return { id: f.id, key: f.key, label: f.label, aliases: f.aliases, valueType: f.valueType, unit: f.unit, tier: f.tier, versions, currentVersionId: versions[versions.length - 1].id };
  });
}

export function seedEngineRules(): EngineRule[] {
  return SEED_RULES.map((r) => ({ id: r.id, kind: r.kind, title: r.title, severity: r.severity, tier: r.tier, versionId: `${r.id}_v1`, versionNo: 1, body: r.body, config: r.config }));
}
