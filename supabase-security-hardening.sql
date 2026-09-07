-- ============================================
-- Security hardening + API rate limiting
-- Run this in the Supabase SQL Editor for existing deployments.
-- ============================================

-- Profile rows include role and approval data, so clients must never receive
-- blanket permission to update their own row. Preference updates are handled
-- by /api/portal/newsletter with a service-role client and an explicit allowlist.
drop policy if exists "Users can update own profile" on public.profiles;

-- Defense in depth: if a broad update policy is accidentally reintroduced,
-- authenticated users still cannot modify authorization/admin-owned columns
-- on their own profile. Service-role operations have no auth.uid() and bypass
-- this guard; admins can continue managing other users.
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() = old.id and (
    new.role is distinct from old.role
    or new.email is distinct from old.email
    or new.newsletter_approved is distinct from old.newsletter_approved
    or new.newsletter_notified_at is distinct from old.newsletter_notified_at
    or new.unsubscribe_token is distinct from old.unsubscribe_token
  ) then
    raise exception 'Privileged profile fields cannot be changed by the account owner'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_profile_privileged_fields() from public;

drop trigger if exists protect_profile_privileged_fields on public.profiles;
create trigger protect_profile_privileged_fields
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_fields();

-- A small persistent fixed-window limiter used by public and email APIs.
-- RLS is enabled with no client policies; only the service role can access it.
create table if not exists public.api_rate_limits (
  rate_limit_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;

create or replace function public.check_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max_requests integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  accepted boolean;
begin
  if p_key is null or length(p_key) < 8
     or p_window_seconds < 1 or p_window_seconds > 86400
     or p_max_requests < 1 or p_max_requests > 1000 then
    return false;
  end if;

  insert into public.api_rate_limits as limits (
    rate_limit_key,
    window_started_at,
    request_count,
    updated_at
  ) values (p_key, now(), 1, now())
  on conflict (rate_limit_key) do update
    set request_count = case
          when limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
            then 1
          else limits.request_count + 1
        end,
        window_started_at = case
          when limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
            then now()
          else limits.window_started_at
        end,
        updated_at = now()
    where limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
       or limits.request_count < p_max_requests
  returning true into accepted;

  return coalesce(accepted, false);
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
