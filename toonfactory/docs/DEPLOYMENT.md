# Deployment

ToonFactory has three things to run: the **web/API** server, the **worker**, and
a **PostgreSQL** database. This guide covers local Docker, a production split
(Vercel + managed Postgres + a separate worker host), env setup, migrations +
seed, YouTube OAuth, and going live with real providers.

---

## 1. Local — Docker Compose (everything in one command)

The fastest path. Brings up Postgres, the web app, and the worker.

```bash
cp .env.example .env          # defaults are fine: PIPELINE_MODE=mock, zero keys
docker compose up --build
```

- Web/dashboard → http://localhost:3000
- The `web` service runs `prisma migrate deploy` on boot, then `next start`.
- The `worker` service runs `npm run worker`.
- Postgres data persists in the `toonfactory_pgdata` volume.

Load the demo dataset once (so the dashboard looks alive):

```bash
docker compose exec web npm run seed
```

See [`docker-compose.yml`](../docker-compose.yml). The DB credentials there
(`toon` / `toon` / `toonfactory`) match the `DATABASE_URL` shape in
`.env.example`; the compose file overrides the host to the `db` service name.

---

## 2. Local — without Docker

Requires Node 20+ and a local/remote PostgreSQL.

```bash
cp .env.example .env
# point DATABASE_URL at your Postgres, e.g.:
# DATABASE_URL="postgresql://toon:toon@localhost:5432/toonfactory?schema=public"

npm install
npm run prisma:generate
npm run prisma:migrate        # creates the schema (dev)
npm run seed                  # demo data (optional but recommended)

npm run dev                   # web + API on :3000
# in a second terminal:
npm run worker                # drains the job queue
```

---

## 3. Production — recommended split

Next.js serverless functions are short-lived, so the **long-running worker must
run somewhere persistent**. A clean, low-cost split:

| Component | Host | Notes |
| --- | --- | --- |
| Web / API | **Vercel** | Deploys `next start` + API routes automatically. |
| PostgreSQL | **Managed Postgres** (Neon, Supabase, RDS, Railway) | Use a pooled connection string for serverless. |
| Worker | **Railway / Render / Fly.io** | A persistent process running `npm run worker` (use the `Dockerfile`). |
| Object storage | **S3 / Cloudflare R2 / Supabase Storage** | `STORAGE_DRIVER=s3`. |
| Scheduler | **GitHub Actions** (`produce.yml`) | Hits `/api/cron/produce` twice daily. |

### 3a. Web on Vercel
1. Import the repo into Vercel.
2. Set all env vars from `.env.example` in the Vercel project (Production scope).
   At minimum: `DATABASE_URL`, `APP_BASE_URL` (your Vercel URL), `CRON_SECRET`,
   `PIPELINE_MODE`.
3. Build command is the default `next build`; ensure `prisma generate` runs (it
   runs via the build pipeline / `postinstall` if you add one, or set the build
   command to `prisma generate && next build`).
4. Deploy.

### 3b. Worker on Railway / Render / Fly
Deploy the same repo using the included [`Dockerfile`](../Dockerfile) but override
the start command to `npm run worker`:
- **Railway/Render:** set the service start command to `npm run worker`.
- **Fly.io:** in `fly.toml`, set `[processes] worker = "npm run worker"`.

Give the worker the **same** `DATABASE_URL` and provider keys as the web app.
The worker and web share state only through Postgres.

> Alternative (no separate host): run the worker as a serverless tick — schedule
> `POST /api/jobs/tick` (with `x-cron-secret`) every minute via GitHub Actions or
> Vercel Cron. Simpler, but lower throughput than a persistent worker.

---

## 4. Environment variables

Copy `.env.example` → `.env` and fill in. Everything except `DATABASE_URL` is
optional in mock mode. Key groups:

- **Core:** `DATABASE_URL`, `APP_BASE_URL`, `PIPELINE_MODE` (`mock` | `live`),
  `CRON_SECRET`.
- **Provider selection:** `LLM_PROVIDER`, `IMAGE_PROVIDER`, `VOICE_PROVIDER`,
  `MUSIC_PROVIDER`, `ANIMATION_PROVIDER`, `VIDEO_PROVIDER`.
- **Keys:** `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL`), `OPENAI_API_KEY`,
  `GEMINI_API_KEY`, `STABILITY_API_KEY`, `FLUX_API_KEY`, `ELEVENLABS_API_KEY`,
  `GOOGLE_TTS_API_KEY`, `SUNO_API_KEY`, `RUNWAY_API_KEY`, `KLING_API_KEY`,
  `SHOTSTACK_API_KEY`.
- **Storage:** `STORAGE_DRIVER` (`local` | `s3`), `STORAGE_LOCAL_DIR`, and the
  `S3_*` settings (works with AWS S3, Cloudflare R2, Supabase, MinIO).
- **YouTube:** `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`,
  `YOUTUBE_REFRESH_TOKEN`, `YOUTUBE_CHANNEL_ID`.
- **Schedule:** `EPISODES_PER_DAY`, `SERIES_TITLE`, `TARGET_EPISODE_SECONDS`.

All env is read through the typed [`src/lib/config.ts`](../src/lib/config.ts).

> **Secrets hygiene:** never commit `.env`. The `.dockerignore` excludes it from
> images; on Vercel/Railway/Render set them in the dashboard. For GitHub Actions
> `produce.yml`, set `APP_BASE_URL` and `CRON_SECRET` as repository secrets.

---

## 5. Running migrations + seed in production

```bash
# Apply migrations (idempotent, safe to run on every deploy):
npm run prisma:deploy        # prisma migrate deploy

# Seed demo data (only on a fresh/demo DB — it CLEARS tables first):
npm run seed
```

The `web` Compose service already runs `prisma migrate deploy` on boot. On
Vercel, run `prisma migrate deploy` from a release/CI step against the production
`DATABASE_URL` (do **not** run `seed` against real production data).

---

## 6. YouTube OAuth setup

To publish to YouTube you need an OAuth2 **refresh token** for the channel.

1. **Google Cloud project** → enable the **YouTube Data API v3**.
2. **Configure the OAuth consent screen** (External or Internal). Add the scope
   `https://www.googleapis.com/auth/youtube.upload` (and
   `.../youtube.readonly` for analytics if used). Add yourself as a test user.
3. **Create OAuth client credentials** of type *Web application* (or *Desktop*).
   Note the **Client ID** and **Client Secret** → `YOUTUBE_CLIENT_ID`,
   `YOUTUBE_CLIENT_SECRET`.
4. **Get a refresh token** via the consent flow (e.g. the OAuth Playground, or a
   one-time local script), requesting offline access. Store it as
   `YOUTUBE_REFRESH_TOKEN`.
5. Set `YOUTUBE_CHANNEL_ID` to the target channel.
6. The app exchanges the refresh token for short-lived access tokens at upload
   time — no interactive login needed in production.

> Brand-new uploads from automated accounts may be limited until the API project
> is verified and the channel is in good standing. Keep content kid-safe and
> original (see the README compliance note).

---

## 7. Going live (`PIPELINE_MODE=live`)

1. Set `PIPELINE_MODE=live`.
2. Choose providers via the `*_PROVIDER` vars and add the matching API keys.
3. Configure storage (`STORAGE_DRIVER=s3` + `S3_*`) so generated media is served
   from a CDN-backed bucket rather than the local disk.
4. Configure YouTube OAuth (section 6).

Mock-mode safety net: `effectiveProvider()` in `config.ts` automatically falls
back to `mock` for any provider that is missing its key — so a partial live
config still produces episodes (with placeholders for the unconfigured stages)
instead of crashing. Verify each capability one at a time as you add keys.

Recommended rollout order: LLM → Image → Voice → Video edit (ffmpeg) →
Thumbnail → Music → Animation → YouTube upload.

---

## 8. Health & monitoring

- `GET /api/health` — liveness/readiness (DB connectivity + mode). Wire it into
  your platform's health checks and an uptime monitor.
- The Compose `db` service has a `pg_isready` healthcheck; `web`/`worker` wait
  for it.
- Operational signals land in `LogEntry` (scopes `pipeline`/`worker`/`upload`)
  and are visible on the Logs dashboard ([UI.md](./UI.md)).
