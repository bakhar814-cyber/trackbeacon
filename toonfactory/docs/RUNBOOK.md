# ToonFactory Runbook — fully automated channel

This is the hands-off setup: connect your channel, turn on real content, and run
it 24/7 so it produces **2 episodes/day** and schedules them to YouTube with no
manual steps. Do it in order; each step has a verify command.

> All paths are relative to the `toonfactory/` directory.

---

## Mental model

Three things must be true for hands-off operation:

1. **Channel connected** — a YouTube OAuth refresh token.
2. **Real content keys set** — otherwise it produces deterministic *mock*
   placeholders (great for testing, not for publishing).
3. **Running 24/7** — the **worker** is what drives everything; with
   `WORKER_AUTOPRODUCE=true` (default) it queues the daily quota itself, so no
   external scheduler is required.

Once those hold, the worker auto-produces episodes, renders them to MP4, and the
upload stage schedules them to YouTube spaced across the day.

---

## Step 0 — Get the code running in mock mode (sanity check)

```bash
cd toonfactory
npm install
cp .env.example .env            # defaults to PIPELINE_MODE=mock — no keys needed
npx prisma migrate dev && npm run seed
npm run dev                     # dashboard → http://localhost:3000
# in a second terminal:
npm run worker                  # starts producing immediately (mock assets)
```

You should see episodes move through the 12 stages on the **Production** page.
When this works, switch on the real pieces below.

---

## Step 1 — Connect your YouTube channel (one time)

1. **Google Cloud Console** → create a project → **enable "YouTube Data API v3"**.
2. **OAuth consent screen** → add scopes `youtube.upload` + `youtube.force-ssl`
   → **Publish the app**. ⚠️ A *Testing*-status app issues refresh tokens that
   expire after 7 days; publishing gives you a non-expiring token.
3. **Credentials → Create OAuth client ID → Desktop app.** Put the values in
   `.env`:
   ```bash
   YOUTUBE_CLIENT_ID=...apps.googleusercontent.com
   YOUTUBE_CLIENT_SECRET=GOCSPX-...
   ```
4. Mint the refresh token (run on your own machine — the callback is localhost):
   ```bash
   npm run youtube:auth        # open the printed URL, sign in as the channel owner, allow
   ```
   Paste the printed line into `.env`:
   ```bash
   YOUTUBE_REFRESH_TOKEN=1//...
   ```
5. **Verify** (no upload happens):
   ```bash
   npm run smoke:youtube       # prints your channel title, id, subscribers ✅
   ```

---

## Step 2 — Turn on real content

In `.env`:

```bash
PIPELINE_MODE=live

LLM_PROVIDER=anthropic       ANTHROPIC_API_KEY=sk-ant-...   # or openai / gemini
IMAGE_PROVIDER=openai        OPENAI_API_KEY=sk-...          # or gemini / stable-diffusion / flux
VOICE_PROVIDER=elevenlabs    ELEVENLABS_API_KEY=...
VIDEO_PROVIDER=ffmpeg                                       # local renderer (in the Docker image)

EPISODES_PER_DAY=2
TARGET_EPISODE_SECONDS=900

# Storage the uploader can fetch the finished MP4 from anywhere:
STORAGE_DRIVER=s3
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://...     # public base URL for objects
# (S3_ENDPOINT for non-AWS S3 such as Cloudflare R2 / MinIO)
```

**Verify each provider before producing a full episode:**

```bash
npm run smoke:llm        # one tiny request → reply, model, cost
npm run smoke:image      # one 16:9 frame  → url, dimensions, cost
npm run smoke:voice      # one line        → url, duration, cost
```

> **Tip — keep costs low:** start with cheaper models (`OPENAI_MODEL=gpt-4o-mini`,
> `GEMINI_MODEL=gemini-1.5-flash`). The **Costs** dashboard tracks every cent.

---

## Step 3 — Run it 24/7

Your laptop isn't always on, so deploy. Pick one.

### Option A — Docker on any VPS (simplest, self-contained)

```bash
docker compose up -d --build
docker compose exec web npm run seed     # one time: creates the series + characters
```

This runs **Postgres + web + worker**. The worker auto-produces the daily quota
(`WORKER_AUTOPRODUCE=true`) — **no cron needed**. ffmpeg is included in the image.

For production, point `DATABASE_URL` at a **managed Postgres** and use **S3/R2**
for storage instead of keeping data inside the container.

### Option B — Serverless web + separate worker

- **Web (dashboard + API):** Vercel (or any Node host).
- **Worker:** a long-running container on Railway / Render / Fly. Serverless
  platforms can't run the worker daemon — it must be an always-on process. The
  provided Docker image runs it with `npm run worker` and includes ffmpeg.
- **Schedule:** if you set `WORKER_AUTOPRODUCE=false`, trigger production with a
  cron hitting the API instead:
  - GitHub Actions: `.github/workflows/toonfactory-produce.yml` (fires 08:00 &
    18:00 UTC). Set repo secrets `TOONFACTORY_APP_BASE_URL` and
    `TOONFACTORY_CRON_SECRET` (the latter must equal `CRON_SECRET` in the app).
  - Or Vercel Cron via `vercel.json`.
  - Or manually: `curl -X POST "$APP_BASE_URL/api/cron/produce" -H "x-cron-secret: $CRON_SECRET"`

---

## Step 4 — Confirm automation

- **Production** page → episodes moving through the 12 stages.
- **Episodes** page → finished ones show a YouTube id + scheduled publish time.
- **Analytics** / **Monetization** pages fill in over the following days.
- **Logs** page → `autoproduce: queued N episode(s)` confirms the self-scheduler.

That's it — the channel now runs itself.

---

## Tuning & operations

| Want to… | Do this |
|---|---|
| Change episodes/day | `EPISODES_PER_DAY` |
| Change episode length | `TARGET_EPISODE_SECONDS` |
| Drive production via cron only | `WORKER_AUTOPRODUCE=false` + the produce workflow |
| Change how often the worker checks the quota | `WORKER_AUTOPRODUCE_INTERVAL_MS` |
| Map a real voice per character | edit `Character.voiceProfile.voiceId` (Story page / DB); narrator + unmapped fall back to `ELEVENLABS_DEFAULT_VOICE_ID` |
| Swap any AI provider | change the `*_PROVIDER` env var — no code changes |
| Scale throughput | run multiple `worker` instances (job leasing prevents double-processing) |

## Health checks

```bash
curl "$APP_BASE_URL/api/health"               # db + mode + provider selection
curl "$APP_BASE_URL/api/analytics/summary"    # channel KPIs
```

## Honest caveats

- **Cost** is the main constraint — real LLM + image + voice for 2×15-min
  episodes/day adds up. Watch the **Costs** dashboard and start with cheap models.
- **Music & animation** are still mock (their gateways are third-party/unofficial);
  the pipeline produces complete videos without them.
- **YouTube quota** ≈ 6 uploads/day by default — 2/day is well within it.
- Keep content **original and kid-safe** — uploads are flagged
  `selfDeclaredMadeForKids` and the QC stage screens disallowed words.

See also: [DEPLOYMENT.md](DEPLOYMENT.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[SCALING.md](SCALING.md).
