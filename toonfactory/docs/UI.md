# Dashboard UI

The dashboard (Next.js App Router, Tailwind, Recharts) is the cockpit for the
whole factory. It has nine screens, each backed by the data models in
[DATABASE.md](./DATABASE.md) and the API in [API.md](./API.md). Below are text
wireframes describing each screen.

A persistent left sidebar is shared across all screens:

```
┌──────────────┐
│  🎬 ToonFactory      mode: MOCK ●        The Adventures of Pip & Bramble ▾  │
├──────────────┤
│ ▸ Overview   │
│ ▸ Production │
│ ▸ Episodes   │
│ ▸ Story      │
│ ▸ Analytics  │
│ ▸ Monetize   │
│ ▸ Costs      │
│ ▸ Logs       │
│ ▸ Settings   │
└──────────────┘
```

---

## 1. Overview

The at-a-glance home: channel health, today's production, and top
recommendations. Source: `GET /api/analytics/summary`, latest `ChannelStat`,
in-flight `Episode`/`Job`, `Recommendation`.

```
┌─ OVERVIEW ─────────────────────────────────────────────────────────────────┐
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐                   │
│  │ Subs      │ │ Watch hrs │ │ Published │ │ Revenue   │                    │
│  │   780     │ │  3,100    │ │    6      │ │  $184.20  │                     │
│  │ ▲ +44/wk  │ │ ▲ +210/wk │ │ +2 today  │ │ ▲ this mo │                    │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘                    │
│                                                                             │
│  Subscriber growth (12 wks)            Today's production                    │
│   1000┤                  ╭─        ┌───────────────────────────────┐        │
│    750┤            ╭────╯          │ Ep 8  ANIMATION   ▓▓▓▓▓▓░░ 62% │        │
│    500┤      ╭────╯                │ Ep 7  SCHEDULED   ✓ tomorrow   │        │
│    250┤ ╭───╯                      └───────────────────────────────┘        │
│      0┼────────────────────                                                  │
│                                    Top recommendations                       │
│                                    • [HIGH] Close-up faces on thumbnails     │
│                                    • [HIGH] Target 8–9 min episodes          │
│                                    • [MED]  Lead titles with the hook        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Production

The live pipeline view: which episodes are in flight and how far each has
progressed through the 12 stages. Source: `Episode` + `Job`, stage labels from
`src/lib/pipeline/stages.ts`. Buttons call `POST /api/pipeline/run` and
`POST /api/cron/produce`.

```
┌─ PRODUCTION ───────────────────────────────────────────[ ⚙ Produce now ]──┐
│  Pipeline: Plan→Script→Storyboard→Images→Animation→Voice→Music→Edit→        │
│            Thumbnail→SEO→QC→Upload                                           │
│                                                                             │
│  Ep 8 — "The Path Beyond the Creek"                       status: ANIMATION │
│   ✓Plan ✓Script ✓Storyboard ✓Images ▶Animation ·Voice ·Music ·Edit         │
│   ·Thumb ·SEO ·QC ·Upload                          [ Re-run ] [ View jobs ] │
│   ┌ Jobs ────────────────────────────────────────────────────────────────┐ │
│   │ animation  RUNNING   worker-1  attempt 1/3                            │ │
│   │ voice      QUEUED    runAfter +1m                                     │ │
│   └──────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Ep 7 — "Welcome, Willow"                                  status: SCHEDULED│
│   ✓ all stages complete · scheduled for tomorrow 08:00                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Episodes

The catalog: every episode with status, key artifacts and cost. Source:
`GET /api/episodes`. Row → `GET /api/episodes/[id]` detail.

```
┌─ EPISODES ───────────────────────────────[ + New episode ]  [filter: All ▾]┐
│  #  Title                         Status      Views   Cost    Published      │
│ ──────────────────────────────────────────────────────────────────────────│
│  8  The Path Beyond the Creek     ANIMATION     —    $1.80    —             │
│  7  Welcome, Willow               SCHEDULED     —    $3.60    tomorrow      │
│  6  Rusty's Slow-Down Delivery    PUBLISHED   9,800  $4.40    Jun 21        │
│  5  Hazel's Sharing Kite          PUBLISHED  11,200  $4.00    Jun 17        │
│  4  The Cozy Dark                 PUBLISHED  13,500  $3.60    Jun 13        │
│  3  Pip Counts to Five            PUBLISHED  15,100  $3.20    Jun 09        │
│  2  Bramble's Big Voice           PUBLISHED  17,800  $2.80    Jun 05        │
│  1  The Whispering Path           PUBLISHED  19,400  $2.40    Jun 01        │
└─────────────────────────────────────────────────────────────────────────────┘

Episode detail (drill-in)
┌─ Ep 4 — "The Cozy Dark"  [PUBLISHED]  YouTube: PIPBR04xZ ──────────────────┐
│  ▶ thumbnail   Hook: Inside the Old Oak Library it's dark…                  │
│  Lesson: the dark can be cozy, not scary    Cliffhanger: a kite book…       │
│  ┌ Scenes (5) ───────────────────────────────────────────────────────────┐ │
│  │ 0  EXT — Old Oak — The Hollow Door   mood: mysterious-soft   100s  ▶▢  │ │
│  │ 1  INT — Library — First Lantern      mood: wonder            115s  ▶▢  │ │
│  │ …                                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘│
│  SEO ▾   Thumbnails (3, chosen ★)   Analytics ▾   Jobs ▾   Cost: $3.60     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Story

The series bible: world rules, art style, cast, locations, the relationship
graph, and the canon timeline. Source: `Series`, `Character`, `Location`,
`Relationship`, `CanonFact`.

```
┌─ STORY ────────────────────────────────────────────────────────────────────┐
│  World rules: gentle · ages 3–8 · no violence · 1 lesson/episode             │
│  Art style: soft 2D storybook · warm pastels · thick outlines · 16:9         │
│                                                                             │
│  Cast                                   Relationships                         │
│  ┌───────────────────────────────┐      Pip ──best-friend── Bramble          │
│  │ 🦊 Pip      protagonist        │      Olive ──mentor──▶ Pip / Bramble      │
│  │ 🐻 Bramble  protagonist        │      Hazel ──friend── Pip                 │
│  │ 🦉 Olive    supporting (mentor)│      Rusty ──friend── Hazel               │
│  │ 🦔 Hazel    supporting         │                                          │
│  │ 🐦 Rusty    supporting         │      Locations                            │
│  └───────────────────────────────┘      Whispering Woods · Sunny Meadow ·    │
│                                          Crystal Creek · Old Oak Library ·    │
│  Canon timeline (continuity)             Bramble's Den                        │
│   • rule  woods stay in golden hour                                          │
│   • item  Pip's brass compass (Ep1)                                          │
│   • event Ep3: Pip learns to count to five                                   │
│   • reveal Ep4: secret library reading-nook …                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Analytics

Performance over time across the channel and per episode. Source:
`GET /api/analytics/summary`, `AnalyticsSnapshot`. Charts via Recharts.

```
┌─ ANALYTICS ──────────────────────────────────────────────[ last 30 days ▾]┐
│  Views (cumulative)                    Avg CTR 6.1%   Avg retention 48%      │
│   60k┤              ╭───                ┌──────────────────────────────────┐ │
│   40k┤         ╭───╯                    │ Episode      Views  CTR   Ret.  │ │
│   20k┤   ╭────╯                         │ 1 Whispering 19.4k  7.2%  52%   │ │
│     0┼──────────────                    │ 2 Big Voice  17.8k  6.6%  49%   │ │
│                                         │ 3 Count Five 15.1k  5.8%  47%   │ │
│  Retention curve (avg)                  │ 4 Cozy Dark  13.5k  6.0%  48%   │ │
│   100%┤╲                                │ 5 Kite       11.2k  5.5%  45%   │ │
│    50%┤ ╲────╮                          │ 6 Delivery    9.8k  6.4%  46%   │ │
│     0%┼──────╰────                      └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Monetization

Tracks progress toward the YouTube Partner Program thresholds and projected
revenue. Source: `ChannelStat` (latest + trend), `AnalyticsSnapshot` revenue.

```
┌─ MONETIZATION ─────────────────────────────────────────────────────────────┐
│  YouTube Partner Program — not yet eligible                                  │
│                                                                             │
│  Subscribers   780 / 1,000        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░  78%   (220 to go)     │
│  Watch hours   3,100 / 4,000      ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░  78%   (900 to go)     │
│                                                                             │
│  Projected eligibility: ~5 weeks at current growth (+44 subs, +210 hrs/wk)   │
│                                                                             │
│  Revenue (est., pre-monetization modeling)                                   │
│   This month  $184.20      Avg RPM  $2.40      Lifetime  $612.50            │
│                                                                             │
│  To accelerate:                                                              │
│   • [HIGH] Add end-screens linking each episode to the next (session time)   │
│   • [MED]  Publish 2nd daily episode at 18:00 (evening wind-down slot)        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Costs

The micro-USD ledger broken down by episode, stage/category, and provider.
Source: `CostEvent`, `Episode.costMicroUsd`.

```
┌─ COSTS ───────────────────────────────────────────────────[ this month ▾]─┐
│  Total spend $23.20    Avg/episode $3.47    Mode: MOCK (live cost = $0)      │
│                                                                             │
│  By category                          By provider                            │
│   animation  ▓▓▓▓▓▓▓▓  $4.80          openai     ▓▓▓▓▓▓  $5.76               │
│   image      ▓▓▓▓▓     $2.88          elevenlabs ▓▓▓▓    $2.16               │
│   voice      ▓▓▓       $2.16          anthropic  ▓▓      $1.26               │
│   llm        ▓▓        $1.26          mock       ▓▓▓▓▓   $5.40               │
│   music/video ▓        $0.90          ffmpeg/yt  ▪       $0.30               │
│                                                                             │
│  Per episode                                                                 │
│   Ep6 $4.40 · Ep5 $4.00 · Ep4 $3.60 · Ep3 $3.20 · Ep2 $2.80 · Ep1 $2.40    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Logs

Operational event stream with level/scope filters. Source: `LogEntry`.

```
┌─ LOGS ──────────────────────────[ level: All ▾ ][ scope: All ▾ ][ search ]─┐
│  time     lvl   scope     message                                            │
│ ──────────────────────────────────────────────────────────────────────────│
│  now      ERROR worker    Transient DB connection reset; reconnected         │
│  now      WARN  upload    Animation provider in mock mode; clips placeholder │
│  now      INFO  pipeline  Episode 8 entered 'animation' stage                │
│  -1d      INFO  pipeline  Episode 7 rendered and scheduled                   │
│  -2d      INFO  analytics Pulled YouTube analytics for 6 episodes            │
│  -8d      ERROR pipeline  Voice synth timed out on scene 3; fell back to mock│
│  -12d     WARN  worker    Job lease expired for stuck job; re-queued         │
│  -26d     WARN  pipeline  Image provider rate-limited; retrying (2/3)        │
│  …                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Settings

Edit provider selection, schedule, branding and the cron secret. Source:
`Setting` (key/value) + env (`src/lib/config.ts`, read-only display).

```
┌─ SETTINGS ─────────────────────────────────────────────────────────────────┐
│  Pipeline mode    ( ) live   (•) mock                                        │
│                                                                             │
│  Providers (env-driven)                Schedule                              │
│   LLM        anthropic ▾                Episodes/day   [ 2 ]                  │
│   Image      openai    ▾                Times          [08:00] [18:00] [+]    │
│   Voice      elevenlabs ▾               Timezone       America/New_York ▾     │
│   Music      mock      ▾                                                      │
│   Animation  mock      ▾               Branding                              │
│   Video      ffmpeg    ▾                Channel name   [ Pip & Bramble ]      │
│                                         Intro ☑  Outro ☑  End-screen ☑        │
│  Storage     local ▾   (s3: R2/S3/…)                                          │
│  Cron secret ••••••••••••  [ rotate ]   [ Save settings ]                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

> Wireframes are illustrative; numbers mirror the demo seed
> ([`prisma/seed.ts`](../prisma/seed.ts)) so a freshly seeded dashboard looks
> like this out of the box.
