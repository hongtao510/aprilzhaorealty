-- ============================================
-- Newsletter Approval Migration
-- Run this in the Supabase SQL Editor
-- Adds admin gating + once-per-user notification tracking
-- ============================================

alter table public.profiles
  add column if not exists newsletter_approved boolean not null default false,
  add column if not exists newsletter_notified_at timestamptz;

-- Speed up the cron's "approved subscribers with cities" query
create index if not exists idx_profiles_newsletter_approved_cities
  on public.profiles(newsletter_approved)
  where newsletter_approved = true and array_length(newsletter_cities, 1) > 0;
