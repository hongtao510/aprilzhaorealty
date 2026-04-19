-- ============================================
-- Newsletter Listing Filters Migration
-- Run this in the Supabase SQL Editor
-- Adds per-user property filters (type, price, beds, baths, sqft)
-- so users receive more relevant listings in their daily digest
-- and can browse the same filtered view at /portal/listings.
-- ============================================

alter table public.profiles
  add column if not exists filter_property_types text[] not null default '{}',
  add column if not exists filter_min_price integer,
  add column if not exists filter_max_price integer,
  add column if not exists filter_min_beds integer,
  add column if not exists filter_min_baths numeric,
  add column if not exists filter_min_sqft integer,
  add column if not exists filter_max_sqft integer;

-- Useful composite index for listings browse queries
create index if not exists idx_redfin_listings_browse
  on public.redfin_listings(city, status, price)
  where status = 'active';
