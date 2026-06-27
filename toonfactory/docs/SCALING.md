# Scaling

ToonFactory's defaults (DB-backed queue, single worker, local storage) are tuned
for a small operator producing a couple of episodes a day. This document explains
how to scale to **hundreds of episodes per month** across one or many channels.

---

## 1. Where the bottlenecks are

A daily episode touches every stage in
[`src/lib/pipeline/stages.ts`](../src/lib/pipeline/stages.ts). At volume the
constraints, in order, are usually:

1. **Render/animation throughput** — turning frames into clips is the slowest,
   most expensive step.
2. **Provider rate limits** — image/voice/LLM APIs cap requests per minute.
3. **Worker concurrency** — one DB-polling worker serializes everything.
4. **Storage & egress** — many large mp4s + frames.
5. **DB queue contention** — polling a single `Job` table under heavy load.

Tackle them in roughly that order.

---

## 2. Swap the DB queue for Redis / BullMQ

The `Job` table is intentionally a drop-in queue. The system already uses
lease-based concurrency (`lockedBy`/`lockedAt`/`runAfter`), so the semantics map
cleanly onto a real broker.

- Introduce **Redis + BullMQ**. Keep one BullMQ queue **per stage** (`plan`,
  `script`, … `upload`) so you can scale and rate-limit each stage independently.
- The `Job` table becomes the durable record/audit log; BullMQ handles dispatch,
  retries (BullMQ backoff replaces manual `runAfter` math), and priorities.
- Benefits: blocking pops (no polling), built-in delayed jobs, per-queue
  concurrency, dead-letter handling, and a ready-made dashboard (Bull Board).

Migration is mechanical because the worker only depends on "claim a job → run a
stage → record result", all of which BullMQ provides.

---

## 3. Horizontal workers

- Run **N worker replicas** (`npm run worker`) behind the same DB/Redis. Leases
  make concurrent claims safe.
- **Specialize workers by stage**: a fleet of cheap CPU workers for
  `plan/script/seo/qc`, GPU/render workers for `animation/edit`, and IO-bound
  workers for `voice/music/upload`. With per-stage BullMQ queues you set
  concurrency per pool.
- Make stages **idempotent** (re-running a stage produces the same asset via the
  content-addressed `cacheKey`) so retries and worker crashes are safe.
- Scale rule of thumb: provision the render pool to your daily clip count ÷ clips
  per worker-hour; size other pools to keep the render pool fed.

---

## 4. Rendering: GPU farm vs. hosted APIs

Animation/edit dominate cost and time. Two strategies, often combined:

- **Hosted render/animation APIs** (Runway, Kling for animation; Shotstack for
  edit). Zero infra, pay-per-clip, scale instantly, but pricier per unit.
  Configure via `ANIMATION_PROVIDER` / `VIDEO_PROVIDER`.
- **Self-hosted GPU render farm** for `ffmpeg`/open models. Cheaper at high
  volume; run render workers on GPU nodes (e.g. autoscaling GPU pool on a cloud
  or a spot-instance fleet). Use a job-affinity queue so only GPU workers pick up
  render jobs.

A new `Provider` implementation that targets a render farm/cluster requires **no
pipeline changes** — it just implements `AnimationProvider`/`VideoProvider` from
[`src/lib/providers/types.ts`](../src/lib/providers/types.ts).

---

## 5. Batching & caching

These keep marginal cost near-zero as volume grows (see also the cost section of
[ARCHITECTURE.md](./ARCHITECTURE.md)):

- **Content-addressed assets** (`Asset.cacheKey`): character designs,
  backgrounds, intros/outros and music beds are generated once and reused across
  every episode. At scale this is the single biggest saver.
- **Frozen design tokens + stable seeds** maximize cache hit rate and visual
  consistency.
- **Batch requests** to image/voice/LLM providers (multiple scenes per call
  where supported) to amortize overhead and stay under per-request limits.
- **Cache LLM outputs** for deterministic sub-tasks (SEO templates, QC prompts).

---

## 6. Rate-limit handling

- **Token-bucket limiters per provider** (e.g. via BullMQ's `limiter` option on
  each stage queue) so you never exceed a vendor's RPM.
- **Exponential backoff + jitter** on `429`/`503`, using `attempts`/`runAfter`
  (or BullMQ backoff). Already modeled in the `Job` schema.
- **Provider fallback chains**: on sustained rate-limiting, fall back to an
  alternate provider for that capability, or to `mock` for non-critical stages so
  a batch never fully stalls (`effectiveProvider()` already supports mock
  fallback).
- **Spread the schedule**: produce across the day rather than two big bursts
  (`EPISODES_PER_DAY` + per-stage limiters) to smooth load.

---

## 7. Storage & CDN

- Switch `STORAGE_DRIVER=s3` (works with AWS S3, Cloudflare R2, Supabase, MinIO)
  via `src/lib/storage.ts`. R2 is attractive (no egress fees).
- Serve assets through a **CDN** (`S3_PUBLIC_BASE_URL` → CloudFront/Cloudflare).
- **Lifecycle policies**: keep final mp4s + chosen thumbnails hot; move
  intermediate frames/clips to cold storage or expire them after upload.
- Deduplicate via `cacheKey`; never store the same generated asset twice.

---

## 8. Cost projections

Per-episode cost in `live` mode is dominated by image + animation; LLM/voice are
small; mock mode is **$0**. Illustrative figures (your provider mix will vary):

| Volume | Episodes/mo | Est. cost/episode | Est. monthly compute | Notes |
| --- | --- | --- | --- | --- |
| Hobby (mock) | any | **$0.00** | **$0** | Full pipeline, deterministic stubs. |
| Solo daily | ~60 | $3 – $5 | ~$180 – $300 | 2/day, hosted APIs, heavy asset reuse. |
| Small studio | ~300 | $2.50 – $4 | ~$750 – $1,200 | Batching + cache lower unit cost. |
| At scale | ~1,000 | $2 – $3.50 | ~$2,000 – $3,500 | Self-hosted GPU render cuts per-unit cost. |
| Multi-channel | 3,000+ | $1.75 – $3 | ~$5,000 – $9,000+ | Shared assets across series amortize design cost. |

Add fixed infra on top: managed Postgres (~$20–50/mo), Redis (~$10–30/mo),
worker hosts, and CDN/storage egress. The **micro-USD `CostEvent` ledger** gives
you exact actuals per stage/provider/episode to refine these.

---

## 9. Multi-channel strategy

The schema is single-series per `Series` row but multi-series ready:

- **One DB, many `Series`**: each `Series` carries its own world rules, cast,
  art style, and episodes. Producing for multiple channels is just multiple
  `Series` rows; `produce` iterates them.
- **Per-series schedule** via `Setting` rows (e.g. `schedule:<seriesId>`).
- **Per-channel YouTube credentials**: store channel OAuth per series (env per
  worker, or extend `Setting`/a credentials table).
- **Shared asset pool**: cross-series reuse of generic backgrounds/SFX/music via
  `cacheKey` further amortizes generation cost.
- **Worker partitioning**: shard workers by `seriesId` so one busy channel can't
  starve another, or use BullMQ priorities.

---

## 10. Scale-up checklist

- [ ] Move queue to Redis/BullMQ (per-stage queues).
- [ ] Run multiple, stage-specialized workers; ensure stages are idempotent.
- [ ] Add per-provider rate limiters + backoff + fallback chains.
- [ ] Offload rendering to hosted APIs and/or a GPU farm.
- [ ] `STORAGE_DRIVER=s3` + CDN + lifecycle policies.
- [ ] Pooled DB connections; add read replicas if analytics queries grow.
- [ ] Watch the `CostEvent` ledger and `ChannelStat` dashboards; tune batch sizes.
- [ ] For many channels: multiple `Series`, per-series schedules + credentials.
