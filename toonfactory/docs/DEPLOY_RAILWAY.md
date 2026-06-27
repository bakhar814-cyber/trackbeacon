# Deploy to Railway — click-by-click (browser only)

This gets ToonFactory running 24/7 with the **least setup**: one Railway service
that runs both the dashboard and the self-driving worker, plus a Postgres
database. No terminal, no separate file storage to start. ~10–15 minutes.

> Have these three YouTube values ready (from the OAuth step):
> `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`.

---

## 1. Create the Railway project

1. Go to **[railway.app](https://railway.app)** → **Login** → **Login with GitHub** (authorize it).
2. Click **New Project** → **Deploy from GitHub repo**.
3. If asked, **Configure GitHub App** → give Railway access to the
   **`bakhar814-cyber/trackbeacon`** repo → come back.
4. Pick **`bakhar814-cyber/trackbeacon`**. Railway creates a service and starts a
   first build — that's fine, we'll configure it next.

## 2. Point the service at the `toonfactory` folder

The app lives in a subfolder, so tell Railway where it is:

1. Click the service → **Settings** tab.
2. Find **Source** → **Root Directory** → set it to:
   ```
   toonfactory
   ```
3. Railway will detect the included **Dockerfile** automatically (it builds the
   app and includes ffmpeg for video). Leave the builder on Dockerfile.

## 3. Add a Postgres database

1. In the project canvas, click **New** (or **+ Create**) → **Database** →
   **Add PostgreSQL**. It appears as a second box.
2. That's it — it exposes a connection string we'll reference next.

## 4. Set the environment variables

Click your **app service** → **Variables** tab → add these (use **Raw Editor** to
paste them all at once, then fill in the blanks):

```bash
# --- Core ---
DATABASE_URL=${{Postgres.DATABASE_URL}}     # reference to the DB you added (keep as-is)
PIPELINE_MODE=live
CRON_SECRET=pick-any-long-random-string
EPISODES_PER_DAY=2

# --- Storage: local works in this single-service setup ---
STORAGE_DRIVER=local

# --- AI providers (start with cheaper models to keep cost low) ---
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

IMAGE_PROVIDER=openai
# (image reuses OPENAI_API_KEY)

VOICE_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=...

VIDEO_PROVIDER=ffmpeg

# --- Your YouTube channel (from the OAuth step) ---
YOUTUBE_CLIENT_ID=...apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=GOCSPX-...
YOUTUBE_REFRESH_TOKEN=1//...
```

> `${{Postgres.DATABASE_URL}}` is a Railway **reference** — if your database
> service isn't literally named "Postgres", use its actual name. Railway shows
> the available references as you type `${{`.

Don't set `APP_BASE_URL` yet — you need the domain first (next step).

## 5. Run both processes + apply the schema

Click the app service → **Settings** → **Deploy** → **Custom Start Command** →
paste:

```bash
npx prisma db push --skip-generate && sh -c "npm run worker & npm start"
```

This creates the database tables, starts the **worker** (which auto-produces the
daily episodes and creates the default Pip & Bramble cast on first run), and
serves the **dashboard**, all in one container.

## 6. Give it a public URL

1. Settings → **Networking** → **Generate Domain** (port **3000**).
2. Copy the URL it gives you (e.g. `https://toonfactory-production.up.railway.app`).
3. Go back to **Variables** and add:
   ```bash
   APP_BASE_URL=https://your-domain.up.railway.app
   ```
4. Railway redeploys automatically after a variable change.

## 7. Watch it work

- Open your domain → the **dashboard** loads.
- **Production** page → within a few minutes an episode starts moving through the
  12 stages. The worker keeps producing 2/day on its own.
- **Episodes** page → finished ones get a YouTube id + scheduled publish time.
- **Logs** page → look for `autoproduce: queued N episode(s)`.
- **Costs** page → tracks spend in real time.

That's a fully automated channel. 🎬

---

## Sanity check before you trust it

Watch the **first** episode go all the way to `SCHEDULED` with a YouTube id on the
Episodes page, then check it appears in **YouTube Studio → Content** (as a
scheduled, private/made-for-kids video). If the upload stage errors in **Logs**,
it's almost always one of:

| Log error | Fix |
|---|---|
| `ANTHROPIC/OPENAI/... key is not set` | the provider key variable is missing/typo'd |
| YouTube `invalid_grant` | refresh token wrong, or the OAuth app is still in "Testing" (publish it) |
| `ffmpeg ... not on PATH` | you changed the builder off Dockerfile — switch it back |

## Keeping costs sane

Real generation costs money per episode. Start with `gpt-4o-mini` +
`IMAGE_PROVIDER=openai` and watch the **Costs** dashboard for a day before
scaling up models or episodes/day. Set `EPISODES_PER_DAY=1` while testing.

## When you outgrow the single service

This setup keeps everything in one container with local storage — simplest, but
the files live with the container. To scale (separate web + multiple workers,
durable storage, a CDN), switch `STORAGE_DRIVER=s3` with Cloudflare R2 or AWS S3
and split the worker into its own service running `npm run worker`. See
[SCALING.md](SCALING.md) and [RUNBOOK.md](RUNBOOK.md).
