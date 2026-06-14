-- Anonymous lifetime conversion counter (no daily reset).
-- Signed-in users continue to use daily_usage; this table is IP-keyed only.
create table if not exists public.anon_usage (
  identifier        text primary key,
  conversion_count  integer not null default 0,
  updated_at        timestamptz not null default now()
);

-- Service-role only (the frontend rate-limiter uses the admin client).
alter table public.anon_usage enable row level security;
-- No policies => only the service role key can read/write. Intentional.

-- Atomic increment-by-1 upsert, mirroring increment_daily_usage.
create or replace function public.increment_anon_usage(p_identifier text)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.anon_usage (identifier, conversion_count, updated_at)
  values (p_identifier, 1, now())
  on conflict (identifier)
  do update set conversion_count = public.anon_usage.conversion_count + 1,
                updated_at = now();
end;
$$;
