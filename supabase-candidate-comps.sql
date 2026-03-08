-- ============================================
-- Candidate Comps Migration
-- Run this in the Supabase SQL Editor
-- Adds candidate_comps table for cached CMA results
-- ============================================

create table if not exists public.candidate_comps (
  id uuid primary key default gen_random_uuid(),
  candidate_home_id uuid references public.candidate_homes(id) on delete cascade,
  comps jsonb not null,
  price_estimate numeric,
  price_range_low numeric,
  price_range_high numeric,
  market_temperature text check (market_temperature in ('hot', 'warm', 'cool')),
  reasoning text,
  raw_response text,
  created_at timestamptz not null default now()
);

create index idx_candidate_comps_home_id on public.candidate_comps(candidate_home_id);

alter table public.candidate_comps enable row level security;

create policy "Admin can do anything with candidate_comps"
  on public.candidate_comps for all
  using (is_admin());
