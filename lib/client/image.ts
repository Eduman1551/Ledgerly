// Browser-side image handling for the visual check. The image itself is only
// downscaled for preview; the server check receives just the dominant colours.

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This file is not an image the browser can read."));
    img.src = URL.createObjectURL(file);
  });

function drawScaled(img: HTMLImageElement, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/**
 * Dominant colours by quantisation: every pixel is put in a coarse RGB bucket
 * (4 levels per channel = 64 buckets); the biggest buckets win and each
 * reports the average colour of its pixels.
 */
export function dominantColors(pixels: Uint8ClampedArray, count = 5): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue; // transparent
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const key = ((r >> 6) << 4) | ((g >> 6) << 2) | (b >> 6);
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((bk) => toHex(bk.r / bk.n, bk.g / bk.n, bk.b / bk.n));
}

/** Returns a small preview (JPEG data URL) and the image's dominant colours. */
export async function prepareImage(file: File): Promise<{ dataUrl: string; colors: string[] }> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (PNG, JPG or WebP).");
  const img = await loadImage(file);
  const preview = drawScaled(img, 480);
  const sample = drawScaled(img, 64);
  const pixels = sample.ctx.getImageData(0, 0, sample.canvas.width, sample.canvas.height).data;
  URL.revokeObjectURL(img.src);
  return { dataUrl: preview.canvas.toDataURL("image/jpeg", 0.7), colors: dominantColors(pixels) };
}
