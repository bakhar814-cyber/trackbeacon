# REST API

All routes live under `src/app/api/*` (Next.js App Router route handlers) and
return JSON. The base URL is `APP_BASE_URL` (default `http://localhost:3000`).

Authentication:
- Public/dashboard read routes are open in a single-tenant deployment (put them
  behind your own auth/proxy if exposed publicly).
- **Internal/automation routes** (`/api/cron/produce`, `/api/jobs/tick`) require
  the header `x-cron-secret: <CRON_SECRET>`. Requests without a matching secret
  get `401 Unauthorized`.

Money is reported in **micro-USD** (`costMicroUsd`, integer 1e-6 USD) wherever a
`*MicroUsd` field appears; divide by 1,000,000 for dollars.

---

## Endpoints at a glance

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/episodes` | — | List episodes (optionally filtered). |
| POST | `/api/episodes` | — | Create / plan a new episode. |
| GET | `/api/episodes/[id]` | — | Full episode detail (scenes, jobs, thumbnails). |
| POST | `/api/pipeline/run` | — | Enqueue (or advance) the pipeline for an episode. |
| POST | `/api/jobs/tick` | `x-cron-secret` | Drain one batch of due jobs (serverless worker tick). |
| POST | `/api/cron/produce` | `x-cron-secret` | Plan + enqueue the day's episodes. |
| GET | `/api/analytics/summary` | — | Channel + per-episode analytics rollup. |
| GET | `/api/health` | — | Liveness/readiness probe. |

---

## GET /api/episodes

List episodes, newest first. Optional query params:

- `status` — filter by `EpisodeStatus` (e.g. `PUBLISHED`, `ANIMATION`).
- `take` — page size (default 50).

**Request**

```http
GET /api/episodes?status=PUBLISHED&take=2
```

**Response `200`**

```json
{
  "episodes": [
    {
      "id": "clx_ep6",
      "number": 6,
      "title": "Rusty's Slow-Down Delivery",
      "status": "PUBLISHED",
      "youtubeId": "PIPBR06xZ",
      "thumbnailUrl": "https://cdn.toonfactory.dev/thumbs/ep6-final.png",
      "publishedAt": "2026-06-21T08:00:00.000Z",
      "costMicroUsd": 4400000
    },
    {
      "id": "clx_ep5",
      "number": 5,
      "title": "Hazel's Sharing Kite",
      "status": "PUBLISHED",
      "youtubeId": "PIPBR05xZ",
      "thumbnailUrl": "https://cdn.toonfactory.dev/thumbs/ep5-final.png",
      "publishedAt": "2026-06-17T08:00:00.000Z",
      "costMicroUsd": 4000000
    }
  ],
  "count": 2
}
```

---

## POST /api/episodes

Create the next episode. With an empty body the **story planner** picks the next
premise from canon; you may override fields.

**Request**

```http
POST /api/episodes
Content-Type: application/json

{ "title": "Welcome, Willow", "targetSeconds": 900 }
```

**Response `201`**

```json
{
  "episode": {
    "id": "clx_ep9",
    "number": 9,
    "title": "Welcome, Willow",
    "status": "PLANNED",
    "targetSeconds": 900,
    "costMicroUsd": 0
  }
}
```

Errors: `409 Conflict` if an episode with that `number` already exists
(`@@unique([seriesId, number])`).

---

## GET /api/episodes/[id]

Full detail for one episode including scenes, jobs, thumbnails and the latest
analytics snapshot.

**Request**

```http
GET /api/episodes/clx_ep4
```

**Response `200`** (abridged)

```json
{
  "episode": {
    "id": "clx_ep4",
    "number": 4,
    "title": "The Cozy Dark",
    "status": "PUBLISHED",
    "hook": "Inside the Old Oak Library it's dark — and Bramble isn't sure he likes it.",
    "outline": [{ "index": 0, "beat": "Cold open: the friends squeeze through the oak's hollow door." }],
    "cliffhanger": "A book about a pebble-powered kite catches Hazel's eye…",
    "nextSetup": "Hazel decides to build the kite from the book.",
    "seo": {
      "title": "The Cozy Dark | Pip & Bramble Ep 4 🦊🐻 Cartoons for Kids",
      "tags": ["kids cartoon", "pip and bramble", "preschool"],
      "chapters": [{ "start": 0, "title": "Cold open" }]
    },
    "videoUrl": "https://cdn.toonfactory.dev/videos/ep4.mp4",
    "youtubeId": "PIPBR04xZ",
    "costMicroUsd": 3600000,
    "scenes": [
      {
        "index": 0,
        "heading": "EXT — Old Oak — The Hollow Door",
        "mood": "mysterious-soft",
        "durationSec": 100,
        "dialogue": [{ "characterId": "clx_pip", "line": "Ooh, a secret library!", "emotion": "excited" }],
        "imageUrl": "https://cdn.toonfactory.dev/frames/ep4/scene-0.png",
        "clipUrl": "https://cdn.toonfactory.dev/clips/ep4/scene-0.mp4"
      }
    ],
    "thumbnails": [{ "url": "...", "score": 91.0, "chosen": true }],
    "jobs": [{ "stage": "upload", "status": "SUCCEEDED" }]
  }
}
```

Errors: `404 Not Found` if no episode matches the id.

---

## POST /api/pipeline/run

Enqueue the pipeline for an episode (or advance it to the next stage). This
creates `Job` rows; the worker executes them.

**Request**

```http
POST /api/pipeline/run
Content-Type: application/json

{ "episodeId": "clx_ep8" }
```

Optional body fields:
- `fromStage` — start at a specific `StageName` (e.g. `"voice"`); defaults to the
  episode's current stage.
- `force` — re-run already-completed stages.

**Response `202`**

```json
{
  "episodeId": "clx_ep8",
  "enqueued": ["animation", "voice", "music", "edit", "thumbnail", "seo", "qc", "upload"],
  "status": "ANIMATION"
}
```

Errors: `400` if `episodeId` is missing; `404` if the episode does not exist.

---

## POST /api/jobs/tick

Process one batch of due jobs. Useful when running the worker as a serverless
function or a cron tick instead of a long-lived process. Requires the cron
secret.

**Request**

```http
POST /api/jobs/tick
x-cron-secret: <CRON_SECRET>
Content-Type: application/json

{ "max": 5 }
```

**Response `200`**

```json
{
  "processed": 3,
  "results": [
    { "jobId": "clx_job1", "stage": "animation", "status": "SUCCEEDED", "costMicroUsd": 300000 },
    { "jobId": "clx_job2", "stage": "voice", "status": "SUCCEEDED", "costMicroUsd": 360000 },
    { "jobId": "clx_job3", "stage": "music", "status": "FAILED", "error": "provider timeout (will retry)" }
  ]
}
```

Errors: `401` if the secret is missing/incorrect.

---

## POST /api/cron/produce

The daily driver. Plans and enqueues `EPISODES_PER_DAY` episodes (default 2),
each kicked off at the start of the pipeline. Invoked by
`.github/workflows/produce.yml` on a schedule. Requires the cron secret.

**Request**

```http
POST /api/cron/produce
x-cron-secret: <CRON_SECRET>
Content-Type: application/json

{}
```

Optional body fields:
- `count` — override how many episodes to produce this run.

**Response `200`**

```json
{
  "produced": [
    { "episodeId": "clx_ep9", "number": 9, "status": "PLANNED" },
    { "episodeId": "clx_ep10", "number": 10, "status": "PLANNED" }
  ],
  "enqueuedJobs": 24
}
```

Errors: `401` if the secret is missing/incorrect.

---

## GET /api/analytics/summary

Channel-wide and per-episode rollup powering the Overview, Analytics and
Monetization screens.

**Request**

```http
GET /api/analytics/summary
```

**Response `200`**

```json
{
  "channel": {
    "subscribers": 780,
    "watchTimeHours": 3100.0,
    "totalViews": 62000,
    "monetized": false,
    "toMonetization": { "subsRemaining": 220, "watchHoursRemaining": 900.0 }
  },
  "totals": {
    "episodesPublished": 6,
    "revenueUsd": 184.20,
    "costUsd": 23.20,
    "avgCtr": 0.061,
    "avgViewPct": 0.48
  },
  "perEpisode": [
    {
      "episodeId": "clx_ep1",
      "number": 1,
      "title": "The Whispering Path",
      "views": 9800,
      "ctr": 0.072,
      "avgViewPct": 0.52,
      "revenueUsd": 31.10
    }
  ]
}
```

---

## GET /api/health

Liveness/readiness probe (used by Docker/Compose and uptime monitors). Verifies
the process is up and the database is reachable.

**Request**

```http
GET /api/health
```

**Response `200`**

```json
{ "status": "ok", "db": "up", "mode": "mock", "time": "2026-06-27T02:00:00.000Z" }
```

**Response `503`** (DB unreachable)

```json
{ "status": "degraded", "db": "down" }
```
