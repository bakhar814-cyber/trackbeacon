// Local ffmpeg video assembly provider. Downloads every scene asset to a temp
// working dir, builds an ffmpeg concat + audio-mix + caption (subtitle) command,
// spawns ffmpeg to produce a single mp4, then stores the result via putObject.
//
// This provider is intended for live mode only. It guards aggressively: if
// ffmpeg is not installed, or inputs cannot be fetched, it throws a clear error
// so callers can fall back or surface the problem.
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { usdToMicro } from "@/lib/cost";
import { putObject, hashKey } from "@/lib/storage";
import type {
  ProviderResult,
  VideoAssembleRequest,
  VideoProvider,
  VideoResult,
  VideoTrackScene,
} from "@/lib/providers/types";

// Local compute only; nominal "cost" to keep the ledger non-zero in live mode.
const USD_PER_RENDER = 0.01;

// Run a command, capturing stderr; reject with a clear message on failure.
function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) =>
      reject(new Error(`Failed to spawn ${cmd}: ${err.message}`)),
    );
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

async function assertFfmpeg(): Promise<void> {
  try {
    await run("ffmpeg", ["-version"]);
  } catch {
    throw new Error(
      "FfmpegVideoProvider: ffmpeg is not available on PATH. Install ffmpeg or use a different VIDEO_PROVIDER.",
    );
  }
}

// Fetch a remote/local asset URL into a local file path.
async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch asset ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
}

// Build an SRT caption file from a scene's caption cues.
function buildSrt(captions: NonNullable<VideoTrackScene["captions"]>): string {
  const fmt = (t: number): string => {
    const ms = Math.floor((t % 1) * 1000);
    const total = Math.floor(t);
    const s = total % 60;
    const m = Math.floor(total / 60) % 60;
    const h = Math.floor(total / 3600);
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
  };
  return captions
    .map((c, i) => `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`)
    .join("\n");
}

export class FfmpegVideoProvider implements VideoProvider {
  readonly name = "ffmpeg";

  async assemble(req: VideoAssembleRequest): Promise<ProviderResult<VideoResult>> {
    if (req.scenes.length === 0) {
      throw new Error("FfmpegVideoProvider: no scenes to assemble");
    }
    await assertFfmpeg();

    const work = await mkdtemp(join(tmpdir(), "toonfactory-"));
    try {
      // 1) Render each scene to a normalized mp4 (clip + mixed audio + captions).
      const sceneFiles: string[] = [];
      for (let i = 0; i < req.scenes.length; i++) {
        const scene = req.scenes[i];
        const clipPath = join(work, `scene-${i}-clip.mp4`);
        await download(scene.clipUrl, clipPath);

        // Download voice tracks + optional music.
        const audioPaths: string[] = [];
        for (let v = 0; v < scene.voiceUrls.length; v++) {
          const ap = join(work, `scene-${i}-voice-${v}`);
          await download(scene.voiceUrls[v], ap);
          audioPaths.push(ap);
        }
        if (scene.musicUrl) {
          const mp = join(work, `scene-${i}-music`);
          await download(scene.musicUrl, mp);
          audioPaths.push(mp);
        }

        const inputs: string[] = ["-i", clipPath];
        for (const ap of audioPaths) inputs.push("-i", ap);

        // Mix all audio inputs (indexes 1..N) down to one stereo track.
        const filterParts: string[] = [];
        if (audioPaths.length > 0) {
          const refs = audioPaths.map((_, idx) => `[${idx + 1}:a]`).join("");
          filterParts.push(
            `${refs}amix=inputs=${audioPaths.length}:duration=longest[aout]`,
          );
        }

        // Burn in captions, if any.
        let videoLabel = "0:v";
        if (scene.captions && scene.captions.length > 0) {
          const srtPath = join(work, `scene-${i}.srt`);
          await writeFile(srtPath, buildSrt(scene.captions));
          // subtitles filter needs the path escaped for the filtergraph.
          const escaped = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
          filterParts.push(`[0:v]subtitles='${escaped}'[vout]`);
          videoLabel = "vout";
        }

        const outPath = join(work, `scene-${i}.mp4`);
        const videoMap = videoLabel === "vout" ? "[vout]" : "0:v";
        const args = [
          "-y",
          ...inputs,
          ...(filterParts.length
            ? ["-filter_complex", filterParts.join(";")]
            : []),
          "-map",
          videoMap,
          ...(audioPaths.length ? ["-map", "[aout]"] : []),
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-t",
          String(Math.max(0.1, scene.durationSec)),
          outPath,
        ];
        await run("ffmpeg", args);
        sceneFiles.push(outPath);
      }

      // 2) Assemble intro + scenes + outro via the concat demuxer.
      const concatList: string[] = [];
      if (req.introUrl) {
        const introPath = join(work, "intro.mp4");
        await download(req.introUrl, introPath);
        concatList.push(introPath);
      }
      concatList.push(...sceneFiles);
      if (req.outroUrl) {
        const outroPath = join(work, "outro.mp4");
        await download(req.outroUrl, outroPath);
        concatList.push(outroPath);
      }

      const listPath = join(work, "concat.txt");
      await writeFile(
        listPath,
        concatList.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
      );

      const finalPath = join(work, "final.mp4");
      await run("ffmpeg", [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        // Re-encode to guarantee a consistent stream across heterogeneous inputs.
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        finalPath,
      ]);

      const buf = await readFile(finalPath);
      const key = `video/ffmpeg/${hashKey(req.title, req.scenes.map((s) => s.clipUrl))}.mp4`;
      const url = await putObject(key, buf, "video/mp4");

      const durationSec = req.scenes.reduce((s, sc) => s + Math.max(0, sc.durationSec), 0);
      return {
        data: { url, durationSec },
        provider: this.name,
        costMicroUsd: usdToMicro(USD_PER_RENDER),
        meta: { scenes: req.scenes.length },
      };
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }
}
