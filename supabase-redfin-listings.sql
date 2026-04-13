-- ============================================
-- Redfin Listings Migration
-- Run this in the Supabase SQL Editor
-- Stores daily scraped active listings from Redfin
-- ============================================

create table if not exists public.redfin_listings (
  id uuid primary key default gen_random_uuid(),
  redfin_url text not null unique,
  address text not null,
  city text not null,
  state text not null default 'CA',
  zip text not null,
  price numeric not null,
  beds integer,
  baths numeric,
  sqft numeric,
  lot_sqft numeric,
  year_built integer,
  price_per_sqft numeric,
  hoa_per_month numeric,
  property_type text,
  status text not null default 'active',
  days_on_market integer,
  mls_number text,
  latitude numeric,
  longitude numeric,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_new boolean not null default true,
  image_url text,
  created_at timestamptz not null default now()
);

create index idx_redfin_listings_first_seen on public.redfin_listings(first_seen_at);
create index idx_redfin_listings_city on public.redfin_listings(city);
create index idx_redfin_listings_status on public.redfin_listings(status);
create index idx_redfin_listings_is_new on public.redfin_listings(is_new) where is_new = true;

alter table public.redfin_listings enable row level security;

create policy "Admin can do anything with redfin_listings"
  on public.redfin_listings for all
  using (is_admin());

create policy "Anyone can read redfin_listings"
  on public.redfin_listings for select
  using (true);
