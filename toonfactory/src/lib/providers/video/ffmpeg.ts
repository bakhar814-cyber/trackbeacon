// Local ffmpeg video assembly provider. Downloads every scene asset to a temp
// working dir, renders each scene to a normalized segment (video OR looped still
// OR a captioned color slate when the visual can't be decoded), mixes the voice
// + music audio, burns in captions, then concatenates everything into one mp4
// and stores it via putObject.
//
// It is robust to heterogeneous inputs: real animation clips (mp4), still frames
// (png/jpg/webp), or — in mock mode — vector/undecodable assets, which fall back
// to a solid slate so a real, playable video is always produced.
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

// Normalized output format so the concat demuxer never chokes on mismatches.
const W = 1280;
const H = 720;
const FPS = 25;
const USD_PER_RENDER = 0.01;

const IMAGE_CODECS = new Set(["png", "mjpeg", "jpeg", "webp", "gif", "bmp", "tiff"]);

// Run a command, capturing stdout/stderr; reject with a clear message on failure.
function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout?.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr?.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e) => reject(new Error(`Failed to spawn ${cmd}: ${e.message}`)));
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-1500)}`)),
    );
  });
}

async function assertFfmpeg(): Promise<void> {
  try {
    await run("ffmpeg", ["-version"]);
  } catch {
    throw new Error(
      "FfmpegVideoProvider: ffmpeg is not on PATH. Install ffmpeg or set VIDEO_PROVIDER=mock.",
    );
  }
}

async function download(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

// Classify a downloaded visual as a video, a still image, or undecodable.
async function classifyVisual(path: string): Promise<"video" | "image" | "none"> {
  try {
    const out = await run("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_name,avg_frame_rate",
      "-of", "default=nw=1",
      path,
    ]);
    const codec = /codec_name=(\w+)/.exec(out)?.[1] ?? "";
    if (!codec) return "none";
    if (IMAGE_CODECS.has(codec)) return "image";
    return "video";
  } catch {
    return "none";
  }
}

function buildSrt(captions: NonNullable<VideoTrackScene["captions"]>): string {
  const fmt = (t: number): string => {
    const ms = Math.floor((t % 1) * 1000);
    const total = Math.floor(t);
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)},${pad(ms, 3)}`;
  };
  return captions
    .map((c, i) => `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`)
    .join("\n");
}

const SLATE_COLORS = ["0x1b2440", "0x223052", "0x2a3a63", "0x1f2e4d", "0x263a5c"];

export class FfmpegVideoProvider implements VideoProvider {
  readonly name = "ffmpeg";

  async assemble(req: VideoAssembleRequest): Promise<ProviderResult<VideoResult>> {
    if (req.scenes.length === 0) throw new Error("FfmpegVideoProvider: no scenes");
    await assertFfmpeg();

    const work = await mkdtemp(join(tmpdir(), "toonfactory-"));
    try {
      const sceneFiles: string[] = [];

      for (let i = 0; i < req.scenes.length; i++) {
        const scene = req.scenes[i];
        const dur = Math.max(0.5, scene.durationSec || 4);

        // --- Resolve the visual source ---
        const visualPath = join(work, `s${i}-visual`);
        const got = scene.clipUrl ? await download(scene.clipUrl, visualPath) : false;
        const kind = got ? await classifyVisual(visualPath) : "none";

        const inputs: string[] = [];
        let videoChain: string;
        if (kind === "video") {
          inputs.push("-i", visualPath);
          videoChain = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=${FPS},format=yuv420p`;
        } else if (kind === "image") {
          inputs.push("-loop", "1", "-t", String(dur), "-i", visualPath);
          videoChain = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=${FPS},format=yuv420p`;
        } else {
          // Undecodable (e.g. SVG/mock) → captioned color slate.
          const color = SLATE_COLORS[i % SLATE_COLORS.length];
          inputs.push("-f", "lavfi", "-t", String(dur), "-i", `color=c=${color}:s=${W}x${H}:r=${FPS}`);
          videoChain = `[0:v]drawtext=text='${req.title.replace(/['":]/g, " ").slice(0, 40)} — Scene ${i + 1}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h/2-40,format=yuv420p`;
        }

        // --- Audio: mix voice + music, or synthesize silence ---
        const audioPaths: string[] = [];
        for (let v = 0; v < scene.voiceUrls.length; v++) {
          const ap = join(work, `s${i}-v${v}`);
          if (await download(scene.voiceUrls[v], ap)) audioPaths.push(ap);
        }
        if (scene.musicUrl) {
          const mp = join(work, `s${i}-music`);
          if (await download(scene.musicUrl, mp)) audioPaths.push(mp);
        }
        for (const ap of audioPaths) inputs.push("-i", ap);

        const filterParts = [`${videoChain}[vbase]`];
        let vLabel = "vbase";

        // Burn captions if present.
        if (scene.captions && scene.captions.length > 0) {
          const srtPath = join(work, `s${i}.srt`);
          await writeFile(srtPath, buildSrt(scene.captions));
          const esc = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
          filterParts.push(`[vbase]subtitles='${esc}'[vout]`);
          vLabel = "vout";
        }

        // Audio chain: input indices start at 1 (index 0 is the visual).
        const audioStart = 1;
        if (audioPaths.length > 0) {
          const refs = audioPaths.map((_, idx) => `[${audioStart + idx}:a]`).join("");
          filterParts.push(
            `${refs}amix=inputs=${audioPaths.length}:duration=longest,aresample=44100,pan=stereo|c0=c0|c1=c0[aout]`,
          );
        } else {
          filterParts.push(`anullsrc=channel_layout=stereo:sample_rate=44100[aout]`);
        }

        const outPath = join(work, `scene-${i}.mp4`);
        await run("ffmpeg", [
          "-y",
          ...inputs,
          "-filter_complex", filterParts.join(";"),
          "-map", `[${vLabel}]`,
          "-map", "[aout]",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-pix_fmt", "yuv420p",
          "-r", String(FPS),
          "-c:a", "aac",
          "-ar", "44100",
          "-t", String(dur),
          outPath,
        ]);
        sceneFiles.push(outPath);
      }

      // --- Concatenate intro + scenes + outro ---
      const concatList: string[] = [];
      for (const [url, name] of [
        [req.introUrl, "intro"],
        [undefined, ""],
        [req.outroUrl, "outro"],
      ] as const) {
        if (!url) continue;
        const p = join(work, `${name}.mp4`);
        if (await download(url, p)) concatList.push(p);
      }
      const ordered = [
        ...(req.introUrl ? [join(work, "intro.mp4")] : []).filter((p) => concatList.includes(p)),
        ...sceneFiles,
        ...(req.outroUrl ? [join(work, "outro.mp4")] : []).filter((p) => concatList.includes(p)),
      ];

      const listPath = join(work, "concat.txt");
      await writeFile(listPath, ordered.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));

      const finalPath = join(work, "final.mp4");
      await run("ffmpeg", [
        "-y", "-f", "concat", "-safe", "0", "-i", listPath,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(FPS),
        "-c:a", "aac", "-ar", "44100",
        finalPath,
      ]);

      const buf = await readFile(finalPath);
      const key = `video/ffmpeg/${hashKey(req.title, req.scenes.map((s) => s.clipUrl))}.mp4`;
      const url = await putObject(key, buf, "video/mp4");

      const durationSec = req.scenes.reduce((s, sc) => s + Math.max(0.5, sc.durationSec || 4), 0);
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
