# 🎬 ToonFactory

**An end-to-end AI automation platform that writes, produces, and publishes a
daily YouTube Kids cartoon series — with no human in the loop.**

ToonFactory plans an episode from series canon, writes the script, storyboards
it, generates characters/backgrounds/animation/voices/music, edits the final
video, creates and scores thumbnails, writes SEO, runs a kid-safety quality
check, uploads to YouTube, then learns from analytics to improve the next
episode. The demo series is **_The Adventures of Pip & Bramble_** — a curious
fox kit and a gentle bear cub exploring the Whispering Woods.

It runs **end-to-end with zero API keys** in mock mode, and becomes
production-grade the moment you add provider keys and flip `PIPELINE_MODE=live`.

---

## What it is

- A **Next.js 14 + TypeScript** app (dashboard + REST API) backed by
  **PostgreSQL/Prisma**, plus a **job-queue worker**.
- A **12-stage AI production pipeline** orchestrated through a database-backed
  queue.
- A **modular provider architecture**: every AI capability (LLM, image, voice,
  music, animation, video) is an interface you can swap via env — no code
  changes.
- A **cost-aware system**: every provider call is metered in micro-USD and rolled
  up per episode.

---

## Key features (15 areas)

1. **Story universe & canon** — series bible, characters, locations,
   relationships, and a queryable canon timeline that prevents plot holes.
2. **Story planning** — picks the next episode premise from canon + analytics.
3. **Script writing** — title, hook, outline, scenes, narration, dialogue,
   cliffhanger, next-episode setup.
4. **Storyboarding** — per-scene image prompts derived from the script.
5. **Image generation** — characters, backgrounds, props, action frames with
   frozen design tokens + stable seeds for consistency.
6. **Animation** — turns frames into moving clips (camera, motion, lip-sync).
7. **Voice generation** — per-character dialogue + narration via voice profiles.
8. **Music & SFX** — background, ambient, action and emotional cues.
9. **Video editing** — assembles clips + audio + captions + intro/outro into mp4.
10. **Thumbnail studio** — generates multiple thumbnails, scores them, picks the
    best.
11. **SEO** — titles, descriptions, tags, chapters, keywords, hashtags.
12. **Quality & kids-safety check** — automated policy/safety gate before upload.
13. **YouTube publishing** — upload/schedule with playlists, end-screens, cards.
14. **Analytics & monetization** — per-episode metrics, channel growth toward the
    1,000-sub / 4,000-hour Partner thresholds, revenue tracking.
15. **Continuous improvement & cost control** — AI recommendations from
    analytics + a full micro-USD cost ledger with caching/reuse/batching.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| App | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Data | PostgreSQL + Prisma |
| Queue | DB-backed `Job` table (lease-based), pluggable to Redis/BullMQ |
| Worker | `tsx src/worker/index.ts` |
| Validation | Zod |
| Providers | Anthropic / OpenAI / Gemini · ElevenLabs / Google TTS · Suno · Runway / Kling · ffmpeg / Shotstack · YouTube Data API v3 — all swappable, all mockable |
| Infra | Docker, docker-compose, GitHub Actions |

---

## The AI workflow

```
        ┌─ Story Planning ─ Script ─ Storyboard ─ Images ─ Animation ─┐
        │                                                             │
 canon ─┤                                                             ├─ Voice
        │                                                             │
        └─ Upload ─ Quality Check ─ SEO ─ Thumbnail ─ Video Edit ─ Music ┘
              │
              ▼
          YouTube ──► Analytics ──► Continuous Improvement ──┐
                                                             │
                                  (recommendations feed the next plan)
                                                             ▼
                                                      (back to Story Planning)
```

The exact stage list and labels live in
[`src/lib/pipeline/stages.ts`](src/lib/pipeline/stages.ts). See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full diagram.

---

## Quickstart (mock mode — zero API keys)

You need Node 20+ and PostgreSQL (or use Docker, below).

```bash
# 1. Configure (defaults are mock mode, no keys needed)
cp .env.example .env
#   ensure DATABASE_URL points at your Postgres

# 2. Install + set up the database
npm install
npm run prisma:generate
npm run prisma:migrate        # create the schema
npm run seed                  # load the rich demo dataset

# 3. Run it
npm run dev                   # dashboard + API → http://localhost:3000
# (in a second terminal) drain the pipeline:
npm run worker
```

Open http://localhost:3000 — the dashboard is already alive with a full series,
8 episodes, analytics, costs, and logs from the seed.

**Or with Docker (Postgres + web + worker in one command):**

```bash
cp .env.example .env
docker compose up --build
docker compose exec web npm run seed     # one-time demo data
```

Trigger a production run manually:

```bash
curl -X POST http://localhost:3000/api/cron/produce \
  -H "x-cron-secret: $(grep CRON_SECRET .env | cut -d= -f2)"
```

### Render real MP4s locally (no cloud, no keys)

The ffmpeg video provider is a free local tool, so it works even in mock mode.
With `ffmpeg` installed, set `VIDEO_PROVIDER=ffmpeg` and every episode exports a
real, playable 1280×720 H.264 + AAC `.mp4` — clips/stills + mixed voice & music +
burned-in captions, with intro/outro/concat handled automatically. Undecodable
mock visuals fall back to captioned slates so a valid video is always produced.

---

## Testing

```bash
npm test            # unit + mock-provider tests (no database needed)
DATABASE_URL=postgresql://… npm test   # also runs the full-pipeline + queue
                                       # integration suite against Postgres
```

The suite covers cost math, thumbnail scoring, continuity prompting, the loose
JSON parser, every mock provider's output shape, the job queue's lease/retry
semantics, and a complete 12-stage episode run that asserts the episode reaches
`SCHEDULED` with a video, thumbnail, scenes, and SEO. CI runs all of this on
every push — see [`.github/workflows`](.github/workflows) (and the root-level
`toonfactory-ci.yml`, since GitHub runs workflows from the repository root).

---

## Going live

1. Set `PIPELINE_MODE=live` in `.env`.
2. Pick providers (`LLM_PROVIDER`, `IMAGE_PROVIDER`, …) and add the matching API
   keys.
3. Configure object storage (`STORAGE_DRIVER=s3` + `S3_*`) and YouTube OAuth.
4. Deploy: web on Vercel, Postgres managed, worker on Railway/Render/Fly, and
   the scheduled `produce.yml` workflow.

Verify a real LLM before producing a full episode:

```bash
PIPELINE_MODE=live LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-... npm run smoke:llm
```

It makes one tiny request and prints the reply, the resolved model, and the
measured cost. The Anthropic provider defaults to `claude-opus-4-8`, sends
per-model pricing to the cost ledger, omits sampling params on models that
reject them, and retries transient 429/5xx with backoff.

Verify the media providers the same way (each makes one real call and prints the
URL + cost):

```bash
PIPELINE_MODE=live IMAGE_PROVIDER=openai OPENAI_API_KEY=sk-...     npm run smoke:image
PIPELINE_MODE=live VOICE_PROVIDER=elevenlabs ELEVENLABS_API_KEY=... npm run smoke:voice
```

The image providers map the pipeline's 16:9 frames onto each model's accepted
sizes (gpt-image-1 fixed sizes; Imagen `aspectRatio` + watermark-off for seeds),
and the voice stage falls back to `ELEVENLABS_DEFAULT_VOICE_ID` until you map a
real voice id onto each character.

### Connect your YouTube channel

1. Google Cloud → enable **YouTube Data API v3**; OAuth consent screen → add scopes
   `youtube.upload` + `youtube.force-ssl`, then **Publish** the app (a Testing-status
   app issues refresh tokens that expire after 7 days).
2. Create an OAuth **Desktop app** client; put the id/secret in `.env`
   (`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`).
3. Mint a refresh token: `npm run youtube:auth` → open the printed URL → sign in as
   the channel owner → paste the printed `YOUTUBE_REFRESH_TOKEN` into `.env`.
4. Verify without uploading: `npm run smoke:youtube` → prints your channel title,
   id, and subscriber count.

The uploader streams `episode.videoUrl` to YouTube, so in live mode use cloud
storage (`STORAGE_DRIVER=s3`) or an `APP_BASE_URL` the worker can actually reach.
Uploads are flagged `selfDeclaredMadeForKids` and scheduled across the day.

Full instructions in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Any provider
without a key transparently falls back to a mock, so a partial live config still
produces episodes instead of crashing.

---

## What's production-ready vs. what needs your API keys

**Honesty section — what you get out of the box vs. what you must supply.**

✅ **Production-ready today (no keys):**
- Complete data model + migrations ([`prisma/schema.prisma`](prisma/schema.prisma)).
- The full 12-stage pipeline definition and status machine
  ([`src/lib/pipeline/stages.ts`](src/lib/pipeline/stages.ts)).
- Modular, typed provider abstraction with a registry and env-based selection
  ([`src/lib/providers/`](src/lib/providers/), [`src/lib/config.ts`](src/lib/config.ts)).
- DB-backed job queue with leases, retries, and priorities.
- Micro-USD cost ledger and rollups ([`src/lib/cost.ts`](src/lib/cost.ts)).
- Deterministic **mock providers** that run every stage end-to-end at $0.
- Rich demo seed so the dashboard looks real immediately
  ([`prisma/seed.ts`](prisma/seed.ts)).
- Docker/Compose, CI workflow, and a scheduled production workflow.

🔑 **Needs your API keys / accounts to go live:**
- **LLM** (Anthropic/OpenAI/Gemini) for real planning, scripts, SEO, QC.
- **Image** (OpenAI/Stability/Flux/Gemini) for real frames + thumbnails.
- **Voice** (ElevenLabs/Google/OpenAI) for real narration + dialogue.
- **Music** (Suno) and **Animation** (Runway/Kling) — these default to mock; wire
  in a provider for real audio/motion.
- **Video** (ffmpeg locally, or Shotstack) for real assembly.
- **Storage** (S3/R2/Supabase/MinIO) for hosting + CDN-serving media.
- **YouTube Data API v3 OAuth** to actually publish.

The capability sub-folders and live provider implementations are wired through
the interfaces in [`src/lib/providers/types.ts`](src/lib/providers/types.ts);
some live adapters are thin and expand as you add credentials. Mock mode is the
source of truth for "does the whole pipeline work" — start there.

---

## Content & compliance

ToonFactory is built for **original, wholesome, kid-safe** content. The demo
series enforces world rules of *gentle tone, ages 3–8, no violence or scary
elements, one positive lesson per episode*, and includes an automated
**kids-safety quality-check stage** before any upload. Operators are responsible
for complying with **YouTube's Terms of Service, Community Guidelines, the
"Made for Kids"/COPPA requirements, and the YouTube Partner Program policies**,
and for ensuring all generated assets and any third-party provider usage respect
applicable rights and terms.

---

## Documentation

- [docs/RUNBOOK.md](docs/RUNBOOK.md) — **fully automated setup**: connect YouTube,
  turn on real content, run 24/7, verify, tune.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system overview, provider
  architecture, the 12-stage pipeline, queue design, cost strategy, diagrams.
- [docs/API.md](docs/API.md) — REST endpoints with request/response examples.
- [docs/DATABASE.md](docs/DATABASE.md) — every model/table and its relations.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — local, Docker, Vercel + worker,
  YouTube OAuth, going live.
- [docs/SCALING.md](docs/SCALING.md) — Redis/BullMQ, horizontal workers, render
  farms, batching/caching, cost projections, multi-channel.
- [docs/UI.md](docs/UI.md) — wireframes for all nine dashboard screens.

---

## Project layout

```
prisma/        schema.prisma · seed.ts
src/app/       Next.js dashboard + /api routes
src/worker/    job-queue worker (npm run worker)
src/lib/       config · db · cost · logger · storage · pipeline/ · providers/
docs/          documentation (above)
Dockerfile · docker-compose.yml · .github/workflows/
```

## License

Provided as-is for the ToonFactory project. Review provider and platform terms
before commercial use.
