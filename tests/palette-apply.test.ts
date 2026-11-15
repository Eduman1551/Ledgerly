import { describe, expect, it } from "vitest";
import { applyReplacement, shiftSpan } from "@/lib/engine/apply";
import { checkVisual, deltaE, isNeutral, matchPalette } from "@/lib/engine/palette";
import { check, DIWALI_POST, palette, rule } from "./fixtures";

describe("palette distance (Delta-E)", () => {
  it("is 0 for the same colour and large for opposites", () => {
    expect(deltaE("#B45309", "#b45309")).toBe(0);
    expect(deltaE("#000000", "#FFFFFF")).toBeCloseTo(100, 0);
    expect(deltaE("#B45309", "#2563EB")).toBeGreaterThan(60);
  });

  it("treats near-brand colours as on-palette and others as off", () => {
    const matches = matchPalette(["#B85A10", "#2563EB"], palette);
    expect(matches[0]).toMatchObject({ nearest: "#B45309", onPalette: true });
    expect(matches[1].onPalette).toBe(false);
  });

  it("ignores neutral greys", () => {
    expect(isNeutral("#808080")).toBe(true);
    expect(matchPalette(["#808080", "#FFFFFF"], palette)).toHaveLength(0);
  });

  it("raises one visual issue only when most colours are off-palette", () => {
    expect(checkVisual(["#2563EB", "#DB2777", "#B45309"], palette, rule("visual"))).toHaveLength(1);
    expect(checkVisual(["#B45309", "#3F6212", "#2563EB"], palette, rule("visual"))).toHaveLength(0);
    expect(checkVisual(null, palette, rule("visual"))).toHaveLength(0);
  });
});

describe("applying fixes", () => {
  it("replaces a span", () => {
    expect(applyReplacement("chai sirf ₹499 mein", 10, 14, "₹549").text).toBe("chai sirf ₹549 mein");
  });

  it("removes a word without leaving double spaces or a space before punctuation", () => {
    expect(applyReplacement("Order karo bro today", 11, 14, "").text).toBe("Order karo today");
    expect(applyReplacement("Thanks bro, see you", 7, 10, "").text).toBe("Thanks, see you");
    expect(applyReplacement("Smiles guaranteed!", 7, 17, "").text).toBe("Smiles!");
    expect(applyReplacement("guaranteed fresh", 0, 10, "").text).toBe("fresh");
  });

  it("shifts later spans and leaves earlier ones alone", () => {
    const fix = applyReplacement("aaa bbb ccc", 4, 7, "XXXXX");
    expect(shiftSpan({ start: 0, end: 3 }, fix)).toEqual({ start: 0, end: 3 });
    expect(shiftSpan({ start: 8, end: 11 }, fix)).toEqual({ start: 10, end: 13 });
    expect(fix.text.slice(10, 13)).toBe("ccc");
  });

  it("keeps every highlight on the right words after accepting each fix in turn", async () => {
    let text = DIWALI_POST;
    let issues = (await check(text, { tier: "internal" })).issues.filter((i) => i.state === "open");
    while (issues.length > 0) {
      const [current, ...rest] = issues;
      const fix = applyReplacement(text, current.spanStart, current.spanEnd, current.replacement ?? "");
      text = fix.text;
      issues = rest.map((i) => {
        const moved = shiftSpan({ start: i.spanStart, end: i.spanEnd }, fix);
        return { ...i, spanStart: moved.start, spanEnd: moved.end };
      });
      for (const i of issues) expect(text.slice(i.spanStart, i.spanEnd)).toBe(i.excerpt);
    }
    expect(text).toBe("Is Diwali, masala chai sirf ₹549 mein! aur delivery in 3–5 business days. Order karo 🔥🔥🔥 Kesar & Co. ke saath!");
    // The fixed text has no open issues left.
    expect((await check(text, { tier: "internal" })).issues.filter((i) => i.state === "open")).toHaveLength(0);
  });
});
