-- ============================================
-- Newsletter Signup Migration
-- Run this in the Supabase SQL Editor
-- Adds per-user city preferences + unsubscribe token
-- ============================================

alter table public.profiles
  add column if not exists newsletter_cities text[] not null default '{}',
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

-- Backfill tokens for any existing rows that predate the default
update public.profiles
set unsubscribe_token = gen_random_uuid()
where unsubscribe_token is null;

-- Partial GIN index — only rows with at least one subscribed city
create index if not exists idx_profiles_newsletter_subscribed
  on public.profiles using gin(newsletter_cities)
  where array_length(newsletter_cities, 1) > 0;

create unique index if not exists idx_profiles_unsubscribe_token
  on public.profiles(unsubscribe_token);

-- Let authenticated users update their own profile (needed for city toggle)
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
