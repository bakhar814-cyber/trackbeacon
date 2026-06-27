# Architecture

ToonFactory is an end-to-end AI automation platform that **writes, produces, and
publishes a daily YouTube Kids cartoon series** with no human in the loop. This
document explains how the system is put together.

---

## 1. System overview

There are three runtime processes, all built from the same code:

| Process | Entry point | Responsibility |
| --- | --- | --- |
| **Web / API** | `next start` (Next.js 14 App Router) | Dashboard UI + REST API routes under `src/app/api/*`. |
| **Worker** | `npm run worker` → `src/worker/index.ts` | Long-running loop that leases jobs from the DB queue and executes pipeline stages. |
| **Cron trigger** | `POST /api/cron/produce` | Called on a schedule (GitHub Actions `produce.yml`) to plan + enqueue the day's episodes. |

They share a single **PostgreSQL** database (the source of truth and the job
queue) accessed through **Prisma** (`src/lib/db.ts`).

```
                         ┌────────────────────────────────────────────┐
                         │                 PostgreSQL                  │
                         │  story universe · episodes · job queue ·    │
                         │  assets · analytics · costs · logs          │
                         └───────────────▲───────────────▲────────────┘
                                         │               │
          plan + enqueue jobs            │               │  lease + run jobs
                                         │               │  (one stage at a time)
   ┌─────────────────┐   POST   ┌────────┴───────┐   ┌───┴──────────────┐
   │  GitHub Actions │ ───────► │   Web / API    │   │     Worker(s)    │
   │  produce.yml    │  cron    │  (Next.js 14)  │   │  src/worker/...  │
   │  (2× daily)     │  secret  │  dashboard +   │   │                  │
   └─────────────────┘          │  REST routes   │   └───┬──────────────┘
                                └───────┬────────┘       │
                                        │                │ calls capability providers
                                        │ reads/writes   ▼
                                        │        ┌───────────────────────────────┐
                                        │        │   Provider registry            │
                                        │        │  src/lib/providers/registry.ts │
                                        │        ├───────────────────────────────┤
                                        │        │ llm · image · voice · music ·  │
                                        │        │ animation · video             │
                                        │        └───────┬───────────────────────┘
                                        │                │ (swappable via env)
                                        ▼                ▼
                                 Dashboard UI     Anthropic · OpenAI · Gemini ·
                                 (browser)        ElevenLabs · Runway · Suno ·
                                                  ffmpeg · YouTube · S3/R2 …
                                                  (or deterministic MOCK stubs)
```

In **mock mode** (`PIPELINE_MODE=mock`, the default), every provider falls back
to a deterministic stub, so the entire pipeline runs end-to-end with **zero API
keys and zero cost**.

---

## 2. Modular provider architecture

Every external AI capability is expressed as a small TypeScript interface in
[`src/lib/providers/types.ts`](../src/lib/providers/types.ts):

- `LlmProvider` — story planning, scripts, SEO, scoring, optimization
- `ImageProvider` — characters, backgrounds, props, action frames, thumbnails
- `VoiceProvider` — per-character dialogue + narration
- `MusicProvider` — background music, ambient, action/emotional cues, SFX
- `AnimationProvider` — turns a still frame into a moving clip
- `VideoProvider` — assembles clips + audio + captions into a final mp4

Each call returns a `ProviderResult<T>` carrying `{ data, provider, costMicroUsd,
cached?, meta? }` so the **cost ledger stays accurate regardless of which
provider is used**.

Concrete implementations live under capability folders, e.g.
`src/lib/providers/llm/` (`anthropic.ts`, `openai.ts`, `gemini.ts`, `mock.ts`)
and `src/lib/providers/image/` (`openai.ts`, `gemini.ts`). Each folder owns a
selector that picks the implementation based on env config
([`src/lib/config.ts`](../src/lib/config.ts) → `effectiveProvider()`), and the
[`registry`](../src/lib/providers/registry.ts) re-exports them all:

```ts
import { providers } from "@/lib/providers/registry";
const llm = providers.llm();   // returns the env-selected (or mock) LLM provider
```

The key property: **adding or swapping a provider never touches pipeline code.**
You implement the interface, register it in the capability folder's selector, and
flip an env var.

`effectiveProvider()` also transparently falls back to `mock` when
`PIPELINE_MODE=mock` *or* when a selected provider has no API key — keeping the
whole system runnable while remaining production-ready when keys are supplied.

---

## 3. The 12-stage pipeline

The canonical workflow is defined once in
[`src/lib/pipeline/stages.ts`](../src/lib/pipeline/stages.ts) and shared by the
orchestrator, the worker, the API, and the dashboard. **The order of
`PIPELINE_STAGES` *is* the production workflow.**

| # | Stage (`StageName`) | Label | Drives status → | Providers used |
| --- | --- | --- | --- | --- |
| 1 | `plan` | Story Planning | `PLANNED` | llm |
| 2 | `script` | Script Writing | `WRITING` | llm |
| 3 | `storyboard` | Storyboard | `STORYBOARD` | llm |
| 4 | `images` | Image Generation | `ASSETS` | image |
| 5 | `animation` | Animation | `ANIMATION` | animation |
| 6 | `voice` | Voice Generation | `AUDIO` | voice |
| 7 | `music` | Music & SFX | `AUDIO` | music |
| 8 | `edit` | Video Editing | `EDITING` | video |
| 9 | `thumbnail` | Thumbnail | `EDITING` | image + llm (scoring) |
| 10 | `seo` | SEO | `REVIEW` | llm |
| 11 | `qc` | Quality Check | `REVIEW` | llm (kids-safety/policy) |
| 12 | `upload` | YouTube Upload | `SCHEDULED` | youtube |

After publish, two continuous loops keep running:

- **Analytics** — periodically pulls YouTube metrics into `AnalyticsSnapshot`
  and `ChannelStat`.
- **Continuous Improvement** — an LLM reviews analytics and writes
  `Recommendation` rows (titles, thumbnails, pacing, length, schedule, revenue)
  that feed back into the next `plan` stage.

Mapping helpers in the same file:
- `STAGE_STATUS` — the `EpisodeStatus` each stage moves an episode into.
- `STAGE_LABELS` — human-readable labels for the dashboard.

The full narrative order, including the post-publish loops:

```
Story Planning → Script → Storyboard → Images → Animation → Voice → Music →
Video Edit → Thumbnail → SEO → Quality Check → Upload → Analytics →
Continuous Improvement ─┐
        ▲               │
        └───────────────┘  (recommendations feed the next episode's plan)
```

---

## 4. Data model summary

Full details in [DATABASE.md](./DATABASE.md). At a glance, the schema
([`prisma/schema.prisma`](../prisma/schema.prisma)) is organized into five
domains:

- **Story universe** — `Series`, `Character`, `Location`, `Relationship`,
  `CanonFact` (a queryable continuity timeline that prevents plot holes).
- **Episodes & production** — `Episode` (with `EpisodeStatus`), `Scene`, `Asset`
  (with `AssetKind`).
- **Job queue** — `Job` (with `JobStatus`).
- **Analytics & revenue** — `AnalyticsSnapshot`, `ChannelStat`, `Thumbnail`.
- **Cost & ops** — `CostEvent`, `LogEntry` (with `LogLevel`), `Recommendation`,
  `Setting`.

All money is stored as **micro-USD integers** (`costMicroUsd`, 1e-6 USD) to
avoid floating-point drift; convert with `usdToMicro` / `microToUsd` in
[`src/lib/cost.ts`](../src/lib/cost.ts).

---

## 5. Job queue design

The queue is **database-backed** (the `Job` table) — no extra infrastructure to
run locally — and designed to be swapped for Redis/BullMQ at scale (see
[SCALING.md](./SCALING.md)).

Key design points (`Job` model in `prisma/schema.prisma`):

- **One row per pipeline stage** (`stage`), tied to an `episodeId`.
- **Lease-based concurrency**: `lockedBy` + `lockedAt` let multiple workers run
  safely. A worker atomically claims a `QUEUED` job whose `runAfter <= now`,
  sets `status = RUNNING` and a lease, then executes the stage.
- **Retries with backoff**: `attempts` / `maxAttempts` (default 3). On failure
  the worker records the `error`, increments `attempts`, and either re-queues
  with a later `runAfter` or marks the job `FAILED`.
- **Prioritization**: higher `priority` jobs are leased first.
- **Stuck-job recovery**: leases that exceed a timeout are reclaimed and
  re-queued (logged under the `worker` scope).
- Indexed on `(status, runAfter)` for fast polling.

`JobStatus`: `QUEUED → RUNNING → SUCCEEDED | FAILED | CANCELLED`.

The worker is triggered to advance the queue either by its own polling loop or
by `POST /api/jobs/tick` (handy for serverless/cron-driven setups). See
[API.md](./API.md).

---

## 6. Cost-optimization strategy

ToonFactory is built to keep per-episode cost in the low single-digit dollars.

- **Caching & reuse (content-addressed assets).** The `Asset` table has a unique
  `cacheKey` (a hash of the generation request). Character designs, backgrounds,
  intros/outros, and music beds are generated once and **reused across every
  episode** — a cache hit returns the stored URL at zero marginal cost. Providers
  signal reuse via `ProviderResult.cached`.
- **Frozen design tokens.** Each `Character.designToken` is a verbatim prompt
  fragment injected into every image request (plus a stable `seed`), guaranteeing
  visual consistency *and* maximizing cache hits.
- **Batching.** Scenes are storyboarded and rendered in batches to amortize
  request overhead and stay within provider rate limits.
- **Retries with backoff** instead of failing whole episodes; transient errors
  fall back to mock so production never fully stalls.
- **Mode switch.** `PIPELINE_MODE=mock` produces full episodes with zero spend —
  ideal for development, CI, demos, and regression tests.
- **Micro-USD ledger.** Every provider call records a `CostEvent`
  ([`recordCost`](../src/lib/cost.ts)) and rolls the cost up onto
  `Episode.costMicroUsd`, so the Costs dashboard shows exact per-stage,
  per-provider, and per-episode spend.

---

## 7. Folder structure map

```
toonfactory/
├── prisma/
│   ├── schema.prisma        # full data model + enums (source of truth)
│   └── seed.ts              # rich demo dataset (npm run seed)
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── layout.tsx       # root layout
│   │   ├── globals.css
│   │   └── api/             # REST API routes (see API.md)
│   ├── worker/
│   │   └── index.ts         # job-queue worker entrypoint (npm run worker)
│   └── lib/
│       ├── config.ts        # typed env access + effectiveProvider()
│       ├── db.ts            # singleton PrismaClient
│       ├── cost.ts          # micro-USD helpers + recordCost()
│       ├── logger.ts        # structured logging → LogEntry
│       ├── format.ts        # display formatting helpers
│       ├── storage.ts       # local | S3-compatible asset storage
│       ├── pipeline/
│       │   └── stages.ts    # the 12 stages, status map, labels
│       └── providers/
│           ├── types.ts     # provider interfaces (the contracts)
│           ├── registry.ts  # single entry point: providers.llm() etc.
│           ├── cache.ts     # content-addressed asset caching
│           ├── llm/         # anthropic | openai | gemini | mock (+ index)
│           ├── image/       # openai | gemini (+ mock)
│           ├── voice/       # elevenlabs | openai | google | mock
│           ├── music/       # suno | mock
│           ├── animation/   # runway | kling | mock
│           └── video/       # ffmpeg | shotstack | mock
├── docs/                    # this documentation
├── Dockerfile               # multi-stage build (web + worker share the image)
├── docker-compose.yml       # db + web + worker for local/single-host
└── .github/workflows/       # ci.yml (build) + produce.yml (scheduled produce)
```

> The capability sub-folders under `src/lib/providers/` and the `src/app/api/*`
> routes / `src/worker/index.ts` are part of the system's design. Some are stubs
> or expand as you wire in live providers; the contracts and the pipeline that
> drive them are defined in the files referenced above.

---

## 8. Why this shape

- **Single image, two roles** keeps deploys simple: scale `web` and `worker`
  independently without separate build pipelines.
- **DB-as-queue** removes infrastructure for small operators while leaving a
  clean seam to graduate to Redis/BullMQ.
- **Provider interfaces + env selection** make the most volatile part of the
  system (the AI vendors) the easiest to change.
- **Mock-first** means the project is always runnable, testable, and demoable.
