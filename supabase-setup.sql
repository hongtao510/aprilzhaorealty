-- ============================================
-- Supabase Database Setup for April Zhao Realty
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null default '',
  phone text,
  role text not null default 'client' check (role in ('admin', 'client')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Create materials table
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete cascade not null,
  file_name text not null,
  file_path text not null,
  file_size bigint not null default 0,
  file_type text not null default '',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Create messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Auto-create profile on signup trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    'client'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Helper function: check if current user is admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- 6. Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.messages enable row level security;

-- 7. RLS Policies for profiles
create policy "Admin can view all profiles"
  on public.profiles for select
  using (is_admin());

create policy "Admin can update all profiles"
  on public.profiles for update
  using (is_admin());

create policy "Admin can delete profiles"
  on public.profiles for delete
  using (is_admin());

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- 8. RLS Policies for materials
create policy "Admin can do anything with materials"
  on public.materials for all
  using (is_admin());

create policy "Clients can view own materials"
  on public.materials for select
  using (auth.uid() = client_id);

-- 9. RLS Policies for messages
create policy "Admin can do anything with messages"
  on public.messages for all
  using (is_admin());

create policy "Clients can view own messages"
  on public.messages for select
  using (auth.uid() = client_id);

create policy "Clients can send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id and auth.uid() = client_id);

-- 10. Create indexes for performance
create index if not exists idx_materials_client_id on public.materials(client_id);
create index if not exists idx_messages_client_id on public.messages(client_id);
create index if not exists idx_messages_is_read on public.messages(is_read) where is_read = false;
create index if not exists idx_profiles_role on public.profiles(role);

-- 11. Create storage bucket (run this separately if needed)
-- In Supabase Dashboard: Storage > New Bucket > "client-materials" (private)

-- 12. Storage policies (run after creating bucket)
-- Admin: full access
-- insert into storage.policies (name, bucket_id, operation, definition)
-- values
--   ('Admin full access', 'client-materials', 'SELECT', '(is_admin())'),
--   ('Admin upload', 'client-materials', 'INSERT', '(is_admin())'),
--   ('Admin delete', 'client-materials', 'DELETE', '(is_admin())');

-- Client: read own folder
-- insert into storage.policies (name, bucket_id, operation, definition)
-- values ('Client read own files', 'client-materials', 'SELECT',
--   '((bucket_id = ''client-materials'') AND (auth.uid()::text = (storage.foldername(name))[1]))');

-- 13. Create saved_homes table
create table if not exists public.saved_homes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete cascade not null,
  url text not null,
  title text,
  image_url text,
  address text,
  price text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.saved_homes enable row level security;

create policy "Admin can do anything with saved_homes"
  on public.saved_homes for all
  using (is_admin());

create policy "Clients can view own saved_homes"
  on public.saved_homes for select
  using (auth.uid() = client_id);

create policy "Clients can insert own saved_homes"
  on public.saved_homes for insert
  with check (auth.uid() = client_id);

create policy "Clients can delete own saved_homes"
  on public.saved_homes for delete
  using (auth.uid() = client_id);

create policy "Clients can update own saved_homes"
  on public.saved_homes for update
  using (auth.uid() = client_id);

create index if not exists idx_saved_homes_client_id on public.saved_homes(client_id);

-- 14. Create search_criteria table (configurable Redfin search parameters)
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

-- 15. Create candidate_homes table (scraped/manual listing candidates)
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

create index if not exists idx_candidate_homes_status on public.candidate_homes(status);
create index if not exists idx_candidate_homes_created_at on public.candidate_homes(created_at desc);
create index if not exists idx_candidate_homes_search_criteria on public.candidate_homes(search_criteria_id);

-- Add unique constraint on saved_homes(client_id, url) for upsert dedup
create unique index if not exists idx_saved_homes_client_url on public.saved_homes(client_id, url);

-- 16. Seed search criteria (adjust region_id values for your target areas)
-- Belmont/RWC under $2M — region_id from Redfin URL for that zip/area
-- insert into public.search_criteria (label, region_id, region_type, max_price, min_beds, property_types)
-- values
--   ('Belmont under $2M', '36805', 2, 2000000, 3, '{1,2}'),
--   ('Redwood City under $1.8M', '17420', 2, 1800000, 3, '{1,2}');

-- 17. Create subscribers table (newsletter signups)
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  created_at timestamptz not null default now()
);

alter table public.subscribers enable row level security;

create policy "Admin can do anything with subscribers"
  on public.subscribers for all
  using (is_admin());

-- ============================================
-- AFTER FIRST LOGIN: Set April's role to admin
-- Replace 'april-user-id' with her actual user ID
-- ============================================
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'aprilcasf@gmail.com';
