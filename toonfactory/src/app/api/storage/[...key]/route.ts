import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { config } from "@/lib/config";
import { errorJson } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  json: "application/json",
  txt: "text/plain",
};

// Serves objects written by the `local` storage driver. S3/R2 deployments serve
// directly from the bucket/CDN and never hit this route.
export async function GET(_req: Request, { params }: { params: { key: string[] } }) {
  const rel = normalize(params.key.join("/")).replace(/^(\.\.(\/|\\|$))+/, "");
  const path = join(process.cwd(), config.storage.localDir, rel);
  try {
    const buf = await readFile(path);
    const ext = rel.split(".").pop()?.toLowerCase() ?? "";
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return errorJson("not found", 404);
  }
}
