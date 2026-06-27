# Database

ToonFactory uses **PostgreSQL** via **Prisma**. The single source of truth is
[`prisma/schema.prisma`](../prisma/schema.prisma); this document explains each
model and how they relate. Seed it with realistic demo data via `npm run seed`
([`prisma/seed.ts`](../prisma/seed.ts)).

**Money convention:** every `costMicroUsd` field is an integer in **micro-USD**
(1e-6 USD) to avoid floating-point drift. Use `usdToMicro` / `microToUsd` from
[`src/lib/cost.ts`](../src/lib/cost.ts).

---

## Entity-relationship overview

```
Series ─┬─< Character ──< Relationship >── Character
        ├─< Location
        ├─< Relationship
        └─< Episode ─┬─< Scene
                     ├─< Asset
                     ├─< Job
                     ├─< Thumbnail
                     └─< AnalyticsSnapshot

CanonFact  → Series (+ optional Episode)   continuity timeline
ChannelStat                                channel-wide rollups (standalone)
CostEvent  → optional Episode              cost ledger
LogEntry   → optional Episode / Job        structured logs
Recommendation                             AI optimization suggestions (standalone)
Setting                                    key/value admin config (standalone)
```

`─<` denotes a one-to-many relation.

---

## Story universe

### `Series`
The top-level show. Holds the creative bible used by every downstream stage.
- `title`, `logline`, `targetAge` (default `"3-8"`).
- `worldRules` (JSON) — tone, age, do/don't lists, lessons-per-episode, format.
- `artStyle` (JSON) — style, palette hex codes, outlines, lighting, aspect ratio,
  negative prompts.
- Relations: `characters`, `locations`, `episodes`, `relationships`.

### `Character`
A frozen design spec so a character looks identical in every render.
- `name`, `role` (`protagonist | antagonist | supporting`), `age`.
- `appearance` (JSON) — fur/hair, eyes, body, palette hex codes.
- `clothing`, `personality` (JSON).
- `voiceProfile` (JSON) — `{ provider, voiceId, pitch, speed }`, mapped to the
  voice provider.
- `designToken` — a short string injected **verbatim** into every image prompt
  for consistency (and cache reuse).
- `refImageUrl` — reference image fed to image providers.
- `arc` (JSON array) — tracked character-development beats.
- Relations: `appearancesA` / `appearancesB` (both sides of `Relationship`),
  `series`.
- Indexed on `seriesId`.

### `Location`
A reusable place with a visual spec.
- `name`, `description`, `visualSpec` (JSON — palette, time of day, details,
  mood), `refImageUrl`.
- Indexed on `seriesId`.

### `Relationship`
A directed edge between two `Character`s (`a` → `b`).
- `kind` (`friend | sibling | rival | mentor | best-friend …`), `status`,
  `notes`.
- Both `aId` and `bId` reference `Character`; cascade on delete.
- Indexed on `seriesId`.

### `CanonFact`
A queryable continuity timeline. The story planner reads the most recent facts to
keep continuity and prevent plot holes across episodes.
- `category` (`event | reveal | item | rule | relationship`), `summary`,
  `detail` (embedding-ready text for a future vector store).
- Optional `episodeId` ties a fact to the episode that established it.
- Indexed on `seriesId` and `episodeId`.

---

## Episodes & production

### `Episode`
One cartoon episode and the heart of the production pipeline.
- `number` (sequential; `@@unique([seriesId, number])`), `title`.
- `status` — `EpisodeStatus` enum (see below); each pipeline stage drives this.
- Narrative payload: `hook`, `outline` (JSON array of beats), `cliffhanger`,
  `nextSetup`, `script` (JSON — full narration + dialogue tree).
- `targetSeconds` (default 900).
- `seo` (JSON) — title, description, tags, keywords, hashtags, chapters.
- Artifacts: `videoUrl`, `thumbnailUrl`, `youtubeId`, `scheduledFor`,
  `publishedAt`.
- `costMicroUsd` — rolled-up total spend for the episode.
- Relations: `scenes`, `assets`, `jobs`, `thumbnails`, `analytics`, `series`.
- Indexed on `status`.

**`EpisodeStatus` enum** (production order):
`PLANNED → WRITING → STORYBOARD → ASSETS → ANIMATION → AUDIO → EDITING →
REVIEW → READY → SCHEDULED → PUBLISHED`, plus `FAILED`.

### `Scene`
A single beat/shot within an episode.
- `index` (`@@unique([episodeId, index])`), `heading`, `description`.
- `locationRef` (Location id or name), `characters` (JSON — character ids
  present).
- `narration`, `dialogue` (JSON — `[{ characterId, line, emotion }]`), `mood`,
  `durationSec`.
- Storyboard + media: `imagePrompt`, `imageUrl`, `clipUrl` (animated clip),
  `voiceUrls` (JSON), `musicUrl`.
- Indexed on `episodeId`.

### `Asset`
A **content-addressed** asset store enabling caching + reuse across episodes.
- `kind` — `AssetKind` enum: `CHARACTER | BACKGROUND | PROP | ACTION |
  THUMBNAIL | VOICE | MUSIC | SFX | CLIP | VIDEO`.
- `provider`, `prompt`, `url`, `meta` (JSON), `costMicroUsd`.
- `cacheKey` — **unique** hash of the generation request; an identical request
  reuses the stored asset (a cache hit) at zero marginal cost.
- Optional `episodeId` (set `null` on episode delete, so shared assets survive).
- Indexed on `kind` and `episodeId`.

---

## Job queue

### `Job`
Database-backed work queue, one row per pipeline stage. Pluggable to Redis/BullMQ
in production (see [SCALING.md](./SCALING.md)).
- `stage` (pipeline stage name, e.g. `"script"`, `"animation"`, `"upload"`).
- `status` — `JobStatus` enum: `QUEUED | RUNNING | SUCCEEDED | FAILED |
  CANCELLED`.
- `priority`, `attempts`, `maxAttempts` (default 3).
- `payload` / `result` (JSON), `error`.
- Lease fields for safe concurrent workers: `lockedBy`, `lockedAt`.
- `runAfter` — earliest time the job may run (used for backoff/scheduling).
- Optional `episodeId` (cascade on delete).
- Indexed on `(status, runAfter)` and `episodeId`.

---

## Analytics & revenue

### `Thumbnail`
Candidate thumbnails with a CTR-predictor score.
- `url`, `prompt`, `score` (0..100 float), `scoreDetail` (JSON — per-criteria
  breakdown), `chosen` (boolean; the picked variant).
- Belongs to an `Episode`; indexed on `episodeId`.

### `AnalyticsSnapshot`
A point-in-time metrics capture for an episode.
- `capturedAt`, `views`, `watchTimeMin`, `impressions`.
- `ctr` (0..1), `avgViewPct` (retention 0..1).
- `subsGained`, `likes`, `comments`, `rpmUsd`, `revenueUsd`.
- Optional `episodeId` (cascade). Indexed on `episodeId` and `capturedAt`.

### `ChannelStat`
Channel-wide rollups used by the monetization assistant.
- `capturedAt`, `subscribers`, `totalViews`.
- `watchTimeHours` (rolling 365-day public watch hours).
- `monetized` (boolean). Indexed on `capturedAt`.
- YouTube Partner thresholds tracked here: 1,000 subscribers + 4,000 watch hours.

---

## Cost tracking & ops

### `CostEvent`
The granular cost ledger; `recordCost()` writes one per provider call and
increments the episode total.
- `provider`, `category` (`llm | image | voice | music | animation | video |
  upload`).
- `units`, `unit`, `costMicroUsd`.
- Optional `episodeId`. Indexed on `provider` and `createdAt`.

### `LogEntry`
Structured application logs.
- `level` — `LogLevel` enum: `DEBUG | INFO | WARN | ERROR`.
- `scope` (e.g. `"pipeline"`, `"worker"`, `"upload"`), `message`, `meta` (JSON).
- Optional `episodeId` / `jobId`. Indexed on `level`, `createdAt`, `episodeId`.

### `Recommendation`
Persisted, AI-generated optimization suggestions surfaced on the dashboard.
- `area` (`titles | thumbnails | pacing | length | schedule | revenue`),
  `title`, `detail`.
- `impact` (`low | medium | high`), `applied` (boolean). Indexed on `area`.

### `Setting`
Key/value config editable from the admin dashboard.
- `key` (primary key), `value` (JSON). e.g.
  `schedule → { episodesPerDay: 2, times: ["08:00","18:00"] }`.

---

## Migrations & seeding

```bash
npm run prisma:generate     # generate the typed client
npm run prisma:migrate      # create/apply a dev migration (prisma migrate dev)
npm run prisma:deploy       # apply migrations in prod (prisma migrate deploy)
npm run seed                # load the demo dataset (idempotent: clears + rebuilds)
npm run prisma:studio       # browse data in Prisma Studio
```

The seed clears all tables in FK-safe order and rebuilds: 1 series, 5 characters,
5 locations, relationships, ~12 canon facts, 8 episodes (6 published, 1
scheduled, 1 mid-production), scenes/assets/thumbnails, ~30 days of analytics,
12 weeks of channel growth, a cost ledger, logs, recommendations and settings.
