import { describe, expect, it } from "vitest";
import { normalizeValue, parseDate, parseDuration, parseNumber, valuesAgree } from "@/lib/engine/normalize";

describe("parseNumber", () => {
  it.each([
    ["₹499", 499],
    ["Rs. 1,499/-", 1499],
    ["2 lakh+", 200000],
    ["1.5 crore", 15000000],
    ["20%", 20],
    ["₹५४९", 549],
    ["10k", 10000],
  ])("%s → %d", (raw, expected) => {
    expect(parseNumber(raw)).toBe(expected);
  });

  it("returns null without a number", () => {
    expect(parseNumber("free")).toBeNull();
  });

  it("does not read the Hindi word 'ke' as thousands", () => {
    expect(parseNumber("499 ke")).toBe(499);
  });
});

describe("parseDuration", () => {
  it("reads ranges and Hindi units", () => {
    expect(parseDuration("3–5 business days")).toEqual({ min: 3, max: 5 });
    expect(parseDuration("3 se 5 din")).toEqual({ min: 3, max: 5 });
    expect(parseDuration("2 din")).toEqual({ min: 2, max: 2 });
  });

  it("converts hours and weeks to days", () => {
    expect(parseDuration("48 hours")).toEqual({ min: 2, max: 2 });
    expect(parseDuration("1 week")).toEqual({ min: 7, max: 7 });
  });
});

describe("parseDate", () => {
  it("reads common date styles", () => {
    expect(parseDate("1 Dec 2026")).toEqual({ min: 1201, max: 1201, year: 2026 });
    expect(parseDate("December 1")).toEqual({ min: 1201, max: 1201, year: undefined });
    expect(parseDate("2026-12-01")).toEqual({ min: 1201, max: 1201, year: 2026 });
    expect(parseDate("1st December, 2026")).toEqual({ min: 1201, max: 1201, year: 2026 });
  });
});

describe("valuesAgree", () => {
  const n = (raw: string, type: Parameters<typeof normalizeValue>[1]) => normalizeValue(raw, type)!;

  it("matches equal values written differently", () => {
    expect(valuesAgree(n("Rs 549", "price"), n("549", "price"))).toBe(true);
    expect(valuesAgree(n("2 lakh", "number"), n("200000", "number"))).toBe(true);
  });

  it("matches a point claim with the top of a range, not the bottom", () => {
    expect(valuesAgree(n("5 days", "duration"), n("3-5", "duration"))).toBe(true);
    expect(valuesAgree(n("2 din", "duration"), n("3-5", "duration"))).toBe(false);
  });

  it("compares the year only when both sides have one", () => {
    expect(valuesAgree(n("1 Dec", "date"), n("2026-12-01", "date"))).toBe(true);
    expect(valuesAgree(n("1 Dec 2027", "date"), n("2026-12-01", "date"))).toBe(false);
  });
});
