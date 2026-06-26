-- TrackBeacon schema (playbook section 5)
-- Run this in the Supabase SQL editor, then run policies.sql.

create extension if not exists "pgcrypto";

-- Users mirror table. Supabase auth.users holds auth; this holds app state.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free','pro')),
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text,
  scrape_config jsonb not null default '{}'::jsonb,
  niche text,
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete set null,
  slug text not null unique,
  title text not null,
  image_url text,
  product_url text,
  current_price numeric,
  currency text not null default 'USD',
  in_stock boolean not null default false,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  price numeric,
  in_stock boolean not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.trackers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  active boolean not null default true,
  notify_on text[] not null default array['price_drop','restock','new_listing'],
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.trackers(id) on delete cascade,
  type text not null,
  old_value text,
  new_value text,
  channel text not null default 'email',
  sent_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  stripe_sub_id text,
  status text,
  current_period_end timestamptz
);

-- Indexes (playbook section 5)
create index if not exists idx_items_last_checked on public.items(last_checked_at);
create index if not exists idx_trackers_user on public.trackers(user_id);
create index if not exists idx_price_history_item on public.price_history(item_id, recorded_at desc);

-- Auto-create a public.users row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
