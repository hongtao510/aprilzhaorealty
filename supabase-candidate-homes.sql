-- ============================================
-- Candidate Homes Migration
-- Run this in the Supabase SQL Editor
-- Adds search_criteria + candidate_homes tables
-- ============================================

-- 1. Create search_criteria table
create table if not exists public.search_criteria (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  region_id text not null,
  region_type int not null default 2,
  min_price int,
  max_price int,
  property_types text[] default '{1,2,3}',
  min_beds int,
  min_baths int,
  is_active boolean not null default true
);

alter table public.search_criteria enable row level security;

create policy "Admin can do anything with search_criteria"
  on public.search_criteria for all
  using (is_admin());

-- 2. Create candidate_homes table
create table if not exists public.candidate_homes (
  id uuid primary key default gen_random_uuid(),
  url text unique not null,
  title text,
  image_url text,
  address text,
  price text,
  price_numeric int,
  beds int,
  baths numeric,
  sqft int,
  status text not null default 'new' check (status in ('new', 'reviewed', 'sent', 'dismissed')),
  source text not null default 'redfin' check (source in ('redfin', 'manual')),
  search_criteria_id uuid references public.search_criteria(id) on delete set null,
  sent_to_client_id uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.candidate_homes enable row level security;

create policy "Admin can do anything with candidate_homes"
  on public.candidate_homes for all
  using (is_admin());

-- 3. Indexes
create index if not exists idx_candidate_homes_status on public.candidate_homes(status);
create index if not exists idx_candidate_homes_created_at on public.candidate_homes(created_at desc);
create index if not exists idx_candidate_homes_search_criteria on public.candidate_homes(search_criteria_id);

-- 4. Add unique constraint on saved_homes(client_id, url) for upsert dedup
--    (safe to run even if it already exists thanks to IF NOT EXISTS)
create unique index if not exists idx_saved_homes_client_url on public.saved_homes(client_id, url);

-- 5. Seed search criteria
--    Uncomment and adjust region_id values from your Redfin target area URLs.
--    To find a region_id: search Redfin for a city/zip, look at the URL or
--    network requests for region_id and region_type values.
--
-- insert into public.search_criteria (label, region_id, region_type, max_price, min_beds, property_types)
-- values
--   ('Belmont under $2M', '36805', 2, 2000000, 3, '{1,2}'),
--   ('Redwood City under $1.8M', '17420', 2, 1800000, 3, '{1,2}');
