import { describe, expect, it } from "vitest";
import { checkAccessibility, checkBannedTerms, checkLanguage, checkRequiredTerm, checkTone } from "@/lib/engine/rules";
import { rule } from "./fixtures";

describe("banned terms", () => {
  it("flags banned phrases case-insensitively and suggests removal", () => {
    const issues = checkBannedTerms("GUARANTEED results, the Best in the World chai", rule("banned_term"));
    expect(issues.map((i) => i.excerpt)).toEqual(["Best in the World", "GUARANTEED"]);
    expect(issues.every((i) => i.replacement === "" && i.ruleVersionId === "rule_banned_terms_v1")).toBe(true);
  });

  it("does not flag words that only contain a banned term", () => {
    expect(checkBannedTerms("A secure checkout and curated blends.", rule("banned_term"))).toHaveLength(0);
  });
});

describe("required brand spelling", () => {
  it.each(["KesarCo", "Kesar and Co", "Kesar & Company", "kesar & co", "Kesar & Co"])("flags the variant %s", (variant) => {
    const issues = checkRequiredTerm(`Order from ${variant} today`, rule("required_term"));
    expect(issues).toHaveLength(1);
    expect(issues[0].excerpt).toBe(variant);
    expect(issues[0].replacement).toBe("Kesar & Co.");
  });

  it("accepts the exact spelling, email domains and unrelated words", () => {
    expect(checkRequiredTerm("Namaste from Kesar & Co.! Write to help@kesarco.example or visit kesarco.example. Kesar coffee is not ours.", rule("required_term"))).toHaveLength(0);
  });
});

describe("tone: slang, emojis, ALL-CAPS", () => {
  it("flags slang words", () => {
    const issues = checkTone("Order karo bro, it is lit yaar", rule("tone"), "instagram");
    expect(issues.map((i) => i.excerpt).sort()).toEqual(["bro", "lit", "yaar"]);
  });

  it("does not flag slang inside other words", () => {
    expect(checkTone("Our brochure has a little surprise", rule("tone"), "instagram")).toHaveLength(0);
  });

  it("respects slang allowed on a channel (what an accepted rewrite adds)", () => {
    const relaxed = { ...rule("tone"), config: { ...rule("tone").config, allowed_slang_by_channel: { instagram: ["yaar"] } } };
    expect(checkTone("Chai time yaar", relaxed, "instagram")).toHaveLength(0);
    expect(checkTone("Chai time yaar", relaxed, "email")).toHaveLength(1);
  });

  it("flags only the emojis above the limit", () => {
    const text = "Chai 🔥🔥🔥🔥";
    const [issue] = checkTone(text, rule("tone"), "instagram");
    expect(issue.excerpt).toBe("🔥");
    expect(text.slice(issue.spanStart, issue.spanEnd)).toBe("🔥");
    expect(checkTone("Chai 🔥🔥🔥", rule("tone"), "instagram")).toHaveLength(0);
  });

  it("flags ALL-CAPS words but not known abbreviations or codes", () => {
    const issues = checkTone("ORDER now, pay by UPI, ref KC-2041", rule("tone"), "email");
    expect(issues.map((i) => [i.excerpt, i.replacement])).toEqual([["ORDER", "Order"]]);
  });
});

describe("language per channel", () => {
  it("flags Hinglish in an email but not on Instagram", () => {
    const text = "Masala chai sirf ₹549 mein";
    expect(checkLanguage(text, rule("language"), "email", "hinglish")).toHaveLength(1);
    expect(checkLanguage(text, rule("language"), "instagram", "hinglish")).toHaveLength(0);
    expect(checkLanguage("Plain English", rule("language"), "email", "english")).toHaveLength(0);
  });
});

describe("accessibility", () => {
  it("flags sentences over 25 words", () => {
    const long = `${Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ")}.`;
    const issues = checkAccessibility(`Short one. ${long}`, rule("accessibility"), false, null);
    expect(issues).toHaveLength(1);
    expect(issues[0].explanation).toContain("30 words");
  });

  it("flags an image without alt text, and emoji-only lines", () => {
    const issues = checkAccessibility("Hello\n🔥🔥", rule("accessibility"), true, "  ");
    expect(issues.map((i) => i.excerpt).sort()).toEqual(["Attached image", "🔥🔥"]);
    expect(checkAccessibility("Hello", rule("accessibility"), true, "A cup of masala chai")).toHaveLength(0);
  });
});
