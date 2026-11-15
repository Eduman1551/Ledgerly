// Visual identity check. The browser extracts an image's dominant colours and
// sends only hex values; here we compare them with the brand palette using
// Delta-E (CIE76) distance in Lab colour space.
import type { EngineIssue, EngineRule } from "./types";

type Lab = { l: number; a: number; b: number };

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToLab([r, g, b]: [number, number, number]): Lab {
  // sRGB → linear → XYZ (D65) → Lab
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return { l: 116 * f(y) - 16, a: 500 * (f(x) - f(y)), b: 200 * (f(y) - f(z)) };
}

/** Delta-E (CIE76): 0 = same colour, ~2 = barely visible, 25+ = clearly different. */
export function deltaE(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return Infinity;
  const [la, lb] = [rgbToLab(a), rgbToLab(b)];
  return Math.sqrt((la.l - lb.l) ** 2 + (la.a - lb.a) ** 2 + (la.b - lb.b) ** 2);
}

/** Greys, white and black carry no brand colour, so they are never flagged. */
export function isNeutral(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const lab = rgbToLab(rgb);
  return Math.sqrt(lab.a ** 2 + lab.b ** 2) < 12;
}

export type PaletteMatch = { color: string; nearest: string; distance: number; onPalette: boolean };

export function matchPalette(colors: string[], palette: string[], threshold = 28): PaletteMatch[] {
  return colors
    .filter((c) => hexToRgb(c) !== null && !isNeutral(c))
    .map((color) => {
      let nearest = palette[0] ?? "#000000";
      let distance = Infinity;
      for (const p of palette) {
        const d = deltaE(color, p);
        if (d < distance) {
          distance = d;
          nearest = p;
        }
      }
      return { color, nearest, distance, onPalette: distance <= threshold };
    });
}

/** One visual issue when most of the image's dominant colours are off-palette. */
export function checkVisual(colors: string[] | null, palette: string[], rule: EngineRule | undefined): EngineIssue[] {
  if (!rule || !colors?.length || palette.length === 0) return [];
  const threshold = typeof rule.config.max_delta_e === "number" ? rule.config.max_delta_e : 28;
  const matches = matchPalette(colors, palette, threshold);
  const off = matches.filter((m) => !m.onPalette);
  if (matches.length === 0 || off.length * 2 <= matches.length) return [];
  return [
    {
      kind: "visual",
      claimStatus: null,
      spanStart: 0,
      spanEnd: 0,
      excerpt: off.map((m) => m.color).join(", "),
      explanation: `${off.length} of ${matches.length} dominant image colours are far from the brand palette ("${rule.title}" v${rule.versionNo}). Example: ${off[0].color} is closest to ${off[0].nearest} but ΔE is ${Math.round(off[0].distance)}.`,
      factVersionId: null,
      ruleVersionId: rule.versionId,
      suggestion: `Use an image built around the brand palette: ${palette.join(", ")}.`,
      replacement: null,
      severity: rule.severity,
      state: "open",
    },
  ];
}
