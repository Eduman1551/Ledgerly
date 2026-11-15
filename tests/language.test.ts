import { describe, expect, it } from "vitest";
import { detectLanguage, firstHindiWord } from "@/lib/engine/language";
import { DIWALI_POST } from "./fixtures";

describe("detectLanguage", () => {
  it("detects plain English", () => {
    expect(detectLanguage("Our Masala Chai 250g is now ₹549 with free shipping.")).toBe("english");
  });

  it("detects Hinglish (romanised Hindi mixed with English)", () => {
    expect(detectLanguage(DIWALI_POST)).toBe("hinglish");
    expect(detectLanguage("Baarish aur chai, perfect combo yaar! Masala chai ab sirf ₹499 mein.")).toBe("hinglish");
  });

  it("detects Hindi written in Devanagari", () => {
    expect(detectLanguage("हमारी मसाला चाय अब सिर्फ ₹549 में मिलेगी।")).toBe("hindi");
  });

  it("detects mixed scripts", () => {
    expect(detectLanguage("Order now and enjoy free shipping, क्योंकि चाय सबको पसंद है")).toBe("mixed");
  });

  it("does not call English Hinglish because of one borrowed word", () => {
    expect(detectLanguage("Namaste from Kesar & Co.! Your order is on the way.")).toBe("english");
  });

  it("handles empty text", () => {
    expect(detectLanguage("")).toBe("english");
  });

  it("finds the first Hindi word", () => {
    const text = "Order now, sirf ₹549";
    const span = firstHindiWord(text)!;
    expect(text.slice(span.start, span.end)).toBe("sirf");
  });
});
