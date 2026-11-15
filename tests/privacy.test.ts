import { describe, expect, it, vi } from "vitest";
import { redact, restore } from "@/lib/engine/redact";
import { trustStripText } from "@/lib/engine/trust";
import type { AiAdapter } from "@/lib/engine/types";
import { check, facts } from "./fixtures";

const names = ["Riya Sharma", "Arjun Mehta", "Meera Iyer"];
const BRIEF = "Winter Blend launches on 1 Dec 2026 at ₹699. Ask Arjun Mehta (arjun@kesarco.example, +91 98765 43210), ref KC-2041.";

describe("redaction", () => {
  it("hides emails, phones, names, internal codes and confidential fact values", () => {
    const { text, count } = redact(BRIEF, { level: "full", personNames: names, facts });
    for (const secret of ["Winter Blend", "1 Dec 2026", "₹699", "Arjun", "arjun@kesarco.example", "98765", "KC-2041"]) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain("[EMAIL_1]");
    expect(text).toContain("[NAME_1]");
    expect(text).toContain("[CODE_1]");
    expect(count).toBeGreaterThanOrEqual(6);
  });

  it("round-trips: restore(redact(x)) === x", () => {
    const { text, map } = redact(BRIEF, { level: "full", personNames: names, facts });
    expect(restore(text, map)).toBe(BRIEF);
  });

  it("uses the same placeholder for a repeated value", () => {
    const { text } = redact("Riya Sharma wrote it. Riya Sharma owns it.", { level: "full", personNames: names, facts });
    expect(text).toBe("[NAME_1] wrote it. [NAME_1] owns it.");
  });

  it("confidential_only keeps names but still hides confidential facts", () => {
    const { text } = redact("Arjun Mehta says Winter Blend costs ₹699, Masala Chai ₹549.", { level: "confidential_only", personNames: names, facts });
    expect(text).toContain("Arjun Mehta");
    expect(text).toContain("₹549"); // public fact stays
    expect(text).not.toContain("₹699");
    expect(text).not.toContain("Winter Blend");
  });
});

describe("tier routing", () => {
  const fakeAi = (analyze: AiAdapter["analyze"]): AiAdapter => ({ model: "test-model", analyze });

  it("Confidential drafts never call AI", async () => {
    const analyze = vi.fn(async () => ({ claims: [], tone: [] }));
    const result = await check(BRIEF, { tier: "confidential", channel: "document" }, fakeAi(analyze));
    expect(analyze).not.toHaveBeenCalled();
    expect(result.aiPath).toBe("local_only");
    expect(trustStripText(result)).toBe("Checked locally · 0 data sent to AI");
  });

  it("Internal drafts send only redacted text", async () => {
    const analyze = vi.fn(async () => ({ claims: [], tone: [] }));
    const result = await check(BRIEF, { tier: "internal", channel: "document" }, fakeAi(analyze));
    const sent = analyze.mock.calls[0][0].text;
    expect(sent).not.toContain("Arjun");
    expect(sent).not.toContain("₹699");
    expect(result.aiPath).toBe("redacted_ai");
    expect(result.charsSentToAi).toBe(sent.length);
    expect(trustStripText(result)).toMatch(/^Redacted text \(\d+ items hidden\) sent to test-model · \d+ chars$/);
  });

  it("Public drafts still hide confidential fact values", async () => {
    const analyze = vi.fn(async () => ({ claims: [], tone: [] }));
    const result = await check("Masala Chai is ₹549. Psst, Winter Blend at ₹699 soon.", { tier: "public" }, fakeAi(analyze));
    expect(analyze.mock.calls[0][0].text).not.toContain("₹699");
    expect(result.aiPath).toBe("full_ai");
  });

  it("restores placeholders in AI output before locating it in the draft", async () => {
    const text = "Thanks Arjun Mehta, this drop is totally sick. Order today.";
    const ai = fakeAi(async (input) => {
      expect(input.text).toContain("[NAME_1]");
      return { claims: [], tone: [{ excerpt: "Thanks [NAME_1], this drop is totally sick.", explanation: "Too casual.", rewrite: "Thank you [NAME_1], this blend is special." }] };
    });
    const { issues } = await check(text, { tier: "internal" }, ai);
    const tone = issues.find((i) => i.kind === "tone")!;
    expect(tone.excerpt).toBe("Thanks Arjun Mehta, this drop is totally sick.");
    expect(tone.replacement).toBe("Thank you Arjun Mehta, this blend is special.");
  });

  it("falls back to local rules when AI fails, and says so", async () => {
    const result = await check("Masala chai sirf ₹499 mein bro", { tier: "public" }, fakeAi(async () => Promise.reject(new Error("429 rate limit"))));
    expect(result.aiPath).toBe("ai_failed_fallback");
    expect(result.issues.some((i) => i.claimStatus === "outdated")).toBe(true);
    expect(trustStripText(result)).toContain("AI unavailable, checked with local rules");
  });

  it("without AI everything is checked locally", async () => {
    const result = await check("Masala chai sirf ₹499 mein", { tier: "public" }, null);
    expect(result.aiPath).toBe("local_only");
    expect(result.charsSentToAi).toBe(0);
  });
});
