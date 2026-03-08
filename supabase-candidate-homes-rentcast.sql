-- ============================================
-- Add RentCast property data columns to candidate_homes
-- Run this in the Supabase SQL Editor
-- ============================================

-- Property details from RentCast
alter table public.candidate_homes add column if not exists lot_sqft int;
alter table public.candidate_homes add column if not exists year_built int;
alter table public.candidate_homes add column if not exists property_type text;
alter table public.candidate_homes add column if not exists latitude double precision;
alter table public.candidate_homes add column if not exists longitude double precision;

-- RentCast AVM valuation
alter table public.candidate_homes add column if not exists valuation int;
alter table public.candidate_homes add column if not exists valuation_low int;
alter table public.candidate_homes add column if not exists valuation_high int;

-- Allow 'saved' status (was missing from check constraint)
-- Drop and re-add check constraint to include 'saved'
alter table public.candidate_homes drop constraint if exists candidate_homes_status_check;
alter table public.candidate_homes add constraint candidate_homes_status_check
  check (status in ('new', 'reviewed', 'saved', 'sent', 'dismissed'));
