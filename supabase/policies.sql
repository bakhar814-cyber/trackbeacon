-- TrackBeacon Row Level Security (playbook section 5)
-- "items + price_history are public-readable; trackers/alerts/subscriptions owner-only".
-- Run AFTER schema.sql.

alter table public.users          enable row level security;
alter table public.sources        enable row level security;
alter table public.items          enable row level security;
alter table public.price_history  enable row level security;
alter table public.trackers       enable row level security;
alter table public.alerts         enable row level security;
alter table public.subscriptions  enable row level security;

-- PUBLIC READ: the directory + price history power your SEO pages.
drop policy if exists "public read items" on public.items;
create policy "public read items" on public.items
  for select using (true);

drop policy if exists "public read price_history" on public.price_history;
create policy "public read price_history" on public.price_history
  for select using (true);

drop policy if exists "public read sources" on public.sources;
create policy "public read sources" on public.sources
  for select using (true);

-- USERS: a user can read/update only their own row.
drop policy if exists "own user row" on public.users;
create policy "own user row" on public.users
  for select using (auth.uid() = id);
drop policy if exists "update own user row" on public.users;
create policy "update own user row" on public.users
  for update using (auth.uid() = id);

-- TRACKERS: owner-only for everything.
drop policy if exists "own trackers select" on public.trackers;
create policy "own trackers select" on public.trackers
  for select using (auth.uid() = user_id);
drop policy if exists "own trackers insert" on public.trackers;
create policy "own trackers insert" on public.trackers
  for insert with check (auth.uid() = user_id);
drop policy if exists "own trackers update" on public.trackers;
create policy "own trackers update" on public.trackers
  for update using (auth.uid() = user_id);
drop policy if exists "own trackers delete" on public.trackers;
create policy "own trackers delete" on public.trackers
  for delete using (auth.uid() = user_id);

-- ALERTS: owner can read their own (joined via tracker).
drop policy if exists "own alerts select" on public.alerts;
create policy "own alerts select" on public.alerts
  for select using (
    exists (
      select 1 from public.trackers t
      where t.id = alerts.tracker_id and t.user_id = auth.uid()
    )
  );

-- SUBSCRIPTIONS: owner read-only (writes happen via service role in the webhook).
drop policy if exists "own subscriptions select" on public.subscriptions;
create policy "own subscriptions select" on public.subscriptions
  for select using (auth.uid() = user_id);

-- NOTE: the cron job and Stripe webhook use the SERVICE ROLE key, which
-- bypasses RLS, so writes to items/price_history/alerts/users happen there.
