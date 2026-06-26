# TrackBeacon — niche restock & price-drop tracker (MVP starter)

**Live:** https://trackbeacon.vercel.app

A working scaffold of the playbook's Part 3 / Part 4 build: a freemium SaaS that
watches product pages, alerts users on price drops + restocks, and exposes a
public, always-current directory (your SEO + GEO engine).

Stack: **Next.js 14 (App Router) · Tailwind · Supabase (Postgres + magic-link auth + RLS) · Stripe · Resend · Vercel Cron.**

This repo gets you to roughly **checklist items #3–#10** on day one. You still
do the human parts: pick the niche, seed real items, launch to a community.

---

## 0. Edit one file first

Open `lib/niche.config.ts` and set your brand + niche copy. Everything
user-facing flows from there, so you can re-skin the whole app for any niche by
editing that single object.

> Playbook rule before you build: find the Reddit/Discord where your niche
> complains "I missed the restock again." If it's active, proceed.

## 1. Install & run

```bash
npm install
cp .env.example .env        # then fill in the values below
npm run dev                 # http://localhost:3000
```

## 2. Supabase (DB + auth)

1. Create a project at supabase.com.
2. SQL editor → run `supabase/schema.sql`, then `supabase/policies.sql`.
3. Project settings → API → copy the URL, the `anon` key, and the
   `service_role` key into `.env`.
4. Auth → URL config → add `http://localhost:3000/auth/callback` (and your prod
   URL later) to the redirect allow-list. Email auth (magic link) is on by default.

## 3. Seed the directory (100–200 real items)

Put product URLs (one per line) in `supabase/seed-urls.txt`, then:

```bash
npm run seed
```

The seeder scrapes each URL with the generic JSON-LD parser and upserts items.
Start with sources that ship schema.org Product data or have JSON feeds — far
more reliable than HTML scraping.

## 4. Stripe (payments)

1. Create a **Pro** product + recurring price → put the price ID in
   `STRIPE_PRICE_ID_PRO`.
2. `STRIPE_SECRET_KEY` from the dashboard (test mode first).
3. Webhook → endpoint `https://yourdomain.com/api/stripe/webhook`, events:
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` → copy the signing secret into
   `STRIPE_WEBHOOK_SECRET`.
4. Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## 5. Resend (email alerts)

Add `RESEND_API_KEY` and a verified `ALERT_FROM_EMAIL`. Free tier ~3k/mo.

## 6. The cron (the heart of the product)

`/api/cron/check` scrapes due items, writes price history, detects
price-drop/restock changes, and emails the matching trackers.

- On Vercel, `vercel.json` already schedules it hourly. Set a `CRON_SECRET` env
  var in Vercel — its Cron automatically sends `Authorization: Bearer <secret>`.
- Trigger manually while developing:

```bash
curl -H "x-cron-secret: YOUR_CRON_SECRET" http://localhost:3000/api/cron/check
```

## 7. Deploy

Push to GitHub → import to Vercel → paste the same env vars → deploy. Point your
domain via Cloudflare. Fixed cost ≈ the domain until you outgrow free tiers.

---

## How the repo maps to the playbook

| Playbook | Here |
|---|---|
| §5 schema + RLS | `supabase/schema.sql`, `supabase/policies.sql` |
| §4 pages/screens | `app/(marketing)`, `app/directory`, `app/item/[slug]`, `app/dashboard`, `app/account`, `app/login` |
| Prompt 4 scraper + change detection | `lib/scraper/` |
| Prompt 5 cron + alerts | `app/api/cron/check/route.ts`, `lib/alerts/` |
| Prompt 6 track + plan gating | `app/api/track/route.ts`, `lib/plans.ts` |
| Prompt 7 Stripe | `app/api/stripe/*` |
| Prompt 8 SEO + sitemap | `app/item/[slug]` JSON-LD, `app/sitemap.ts`, `app/robots.ts` |
| Prompt 9 content automation | `scripts/drop-report.ts` |

## What's intentionally NOT here (add after first paying user)

Push notifications, Discord webhooks, filters/segments, public API, mobile app,
multi-niche. The MVP is: directory → track → cron → email alert → Stripe.

## Scraping responsibly

Prefer official feeds/APIs. Respect robots.txt and ToS. Don't scrape personal
data without checking the law. The generic parser identifies itself via
User-Agent and uses a 15s timeout. This protects the business.

## Known sharp edges

- **JS-rendered prices**: the fetch+cheerio scraper only sees server-rendered
  HTML. If a site renders price client-side, `scrapeUrl` returns null — add a
  Playwright worker (a $5 box) and feed its HTML to `parseProductHtml`.
- **Free-plan instant alerts**: the cron currently emails free users instantly
  too. To truly gate, batch free-tier changes into a daily digest in
  `fanOutAlerts` (there's a marked spot).
- **Per-source parsers**: `lib/scraper/parsers/generic.ts` is the default. For
  sites without JSON-LD, add a parser file and branch on `source.scrape_config`.
