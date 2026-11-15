import { describe, expect, it } from "vitest";
import { extractClaimsLocal, mergeAiClaims, splitSentences } from "@/lib/engine/extract";
import { check, DIWALI_POST, find } from "./fixtures";

describe("splitSentences", () => {
  it("does not break on 'Kesar & Co.' or 'Rs.'", () => {
    const s = splitSentences("Kesar & Co. sells chai at Rs. 549 only. Order today!");
    expect(s.map((x) => x.text)).toEqual(["Kesar & Co. sells chai at Rs. 549 only.", "Order today!"]);
  });

  it("keeps correct offsets", () => {
    const text = "One. Two!";
    for (const s of splitSentences(text)) expect(text.slice(s.start, s.end)).toBe(s.text);
  });
});

describe("extractClaimsLocal", () => {
  it("finds prices, durations, certifications and superlatives with valid spans", () => {
    const claims = extractClaimsLocal(DIWALI_POST);
    expect(claims.map((c) => [c.type, c.text])).toEqual([
      ["superlative", "India's #1"],
      ["price", "₹499"],
      ["certification", "100% organic"],
      ["duration", "2 din"],
    ]);
    for (const c of claims) expect(DIWALI_POST.slice(c.start, c.end)).toBe(c.text);
  });

  it("drops trailing punctuation and ignores bare years", () => {
    const claims = extractClaimsLocal("Now ₹549, since 2026. Sale ends 20 Nov.");
    expect(claims.map((c) => c.text)).toEqual(["₹549", "20 Nov"]);
  });

  it("merges AI claims: adds subjects, drops text that is not in the draft", () => {
    const text = "Our chai is loved by 2 lakh+ people and brewed fresh daily.";
    const merged = mergeAiClaims(text, extractClaimsLocal(text), [
      { text: "2 lakh+ people", type: "number", subject: "customers served" },
      { text: "this text is invented", type: "number" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].subject).toBe("customers served");
  });
});

describe("ledger matching: the four claim statuses", () => {
  it("Supported: value equals the current version, with its source", async () => {
    const { issues } = await check("Our Masala Chai 250g is now ₹549.");
    const issue = find(issues, "₹549")!;
    expect(issue.claimStatus).toBe("supported");
    expect(issue.state).toBe("resolved");
    expect(issue.explanation).toContain("Price sheet v3");
  });

  it("Outdated: value equals an older version, suggestion is the current one", async () => {
    const { issues } = await check("Masala chai sirf ₹499 mein!");
    const issue = find(issues, "₹499")!;
    expect(issue.claimStatus).toBe("outdated");
    expect(issue.replacement).toBe("₹549");
    expect(issue.factVersionId).toBe("fact_masala_price_v3");
    expect(issue.suggestion).toContain("Price sheet v3");
  });

  it("Conflicting: value differs from every version", async () => {
    const { issues } = await check("Guaranteed delivery in 2 din.");
    const issue = find(issues, "2 din")!;
    expect(issue.claimStatus).toBe("conflicting");
    expect(issue.replacement).toBe("3–5 business days");
  });

  it("Conflicting: a claim that contradicts a boolean fact", async () => {
    const { issues } = await check("Our chai is 100% organic.");
    const issue = find(issues, "100% organic")!;
    expect(issue.claimStatus).toBe("conflicting");
    expect(issue.explanation).toContain("Not certified");
  });

  it("Supported: a negated claim that agrees with a boolean fact", async () => {
    const { issues } = await check("Our chai is not certified organic yet.");
    expect(issues.find((i) => i.kind === "claim")?.claimStatus).toBe("supported");
  });

  it("Unsupported: a factual claim with no fact in the ledger", async () => {
    const { issues } = await check("Rated India's #1 chai. Get 50% off today.");
    expect(find(issues, "India's #1")!.claimStatus).toBe("unsupported");
    expect(find(issues, "50%")!.claimStatus).toBe("unsupported");
    expect(find(issues, "India's #1")!.ruleVersionId).toBe("rule_banned_terms_v1"); // merged with the banned-term hit
  });

  it("picks the nearest fact when two prices share a sentence", async () => {
    const { issues } = await check("Masala Chai 250g at ₹499 with free shipping above ₹399.");
    expect(find(issues, "₹499")!.claimStatus).toBe("outdated");
    expect(find(issues, "₹399")!.claimStatus).toBe("supported");
  });

  it("matches a bare old price even without the product name", async () => {
    const { issues } = await check("Ab sirf ₹499!");
    expect(find(issues, "₹499")!.claimStatus).toBe("outdated");
  });

  it("works in Devanagari", async () => {
    const { issues, language } = await check("हमारी मसाला चाय अब सिर्फ ₹499 में।");
    expect(language).toBe("hindi");
    expect(find(issues, "₹499")!.claimStatus).toBe("outdated");
  });

  it("flags the full seeded Diwali post as expected", async () => {
    const { issues, language } = await check(DIWALI_POST, { tier: "internal" });
    expect(language).toBe("hinglish");
    const open = issues.filter((i) => i.state === "open").map((i) => [i.claimStatus ?? i.kind, i.excerpt]);
    expect(open).toEqual([
      ["unsupported", "India's #1"],
      ["outdated", "₹499"],
      ["conflicting", "100% organic"],
      ["term", "guaranteed"],
      ["conflicting", "2 din"],
      ["tone", "bro"],
      ["tone", "🔥"],
      ["term", "KesarCo"],
    ]);
  });
});
