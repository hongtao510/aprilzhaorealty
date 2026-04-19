-- ============================================
-- Newsletter Filter Ranges Migration
-- Run this in the Supabase SQL Editor
-- Replaces the previous min_price/max_price + min_sqft/max_sqft scalars
-- with array-based range buckets (multi-select). Old columns are kept
-- for backwards compat but no longer read/written.
-- ============================================

alter table public.profiles
  add column if not exists filter_price_ranges text[] not null default '{}',
  add column if not exists filter_sqft_ranges text[] not null default '{}';
