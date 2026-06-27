// Deterministic mock image provider. Generates a colored SVG placeholder that
// embeds the prompt text and a seeded background color, stores it via putObject
// as image/svg+xml, and returns its public URL. Zero cost, fully offline.
import { putObject, hashKey } from "@/lib/storage";
import type {
  ImageProvider,
  ImageRequest,
  ImageResult,
  ProviderResult,
} from "@/lib/providers/types";

// Derive a stable hex color from the prompt + seed.
function seededColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const r = (h & 0xff) | 0x40;
  const g = ((h >> 8) & 0xff) | 0x40;
  const b = ((h >> 16) & 0xff) | 0x40;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export class MockImageProvider implements ImageProvider {
  readonly name = "mock";

  async generate(req: ImageRequest): Promise<ProviderResult<ImageResult>> {
    const width = req.width ?? 1024;
    const height = req.height ?? 1024;
    const seedStr = hashKey(req.prompt, width, height, req.seed ?? 0);
    const bg = seededColor(seedStr);
    const fg = seededColor(seedStr + "fg");

    const label = escapeXml(req.prompt.slice(0, 80));
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect width="100%" height="100%" fill="${bg}"/>` +
      `<rect x="${width * 0.05}" y="${height * 0.05}" width="${width * 0.9}" height="${height * 0.9}" fill="none" stroke="${fg}" stroke-width="6"/>` +
      `<text x="50%" y="48%" font-family="sans-serif" font-size="${Math.round(width / 28)}" fill="${fg}" text-anchor="middle">${label}</text>` +
      `<text x="50%" y="56%" font-family="monospace" font-size="${Math.round(width / 48)}" fill="${fg}" text-anchor="middle">mock ${seedStr.slice(0, 8)}</text>` +
      `</svg>`;

    const key = `images/mock/${seedStr}.svg`;
    const url = await putObject(key, svg, "image/svg+xml");

    return {
      data: { url, width, height, seed: req.seed },
      provider: this.name,
      costMicroUsd: 0,
      meta: { mock: true },
    };
  }
}
