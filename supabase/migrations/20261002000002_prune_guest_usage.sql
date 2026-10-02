-- Guest (IP-keyed) usage retention: 90 days after a guest's last conversion.
--
-- The privacy page used to promise guest IPs were discarded after 24 hours, but
-- anon_usage is a LIFETIME counter that was never pruned. This function is the
-- retention mechanism; /api/cron/prune-guest-usage calls it once a day.
--
-- Pruning a row resets that guest's free-preview allowance — accepted trade-off.
--
-- Also deletes:
--   * anon_usage rows still keyed by a raw IP. lib/rate-limit.ts now stores an
--     HMAC-SHA256 hex digest instead; anything that isn't 64 hex chars is a
--     pre-hashing row that can never match a lookup again.
--   * legacy daily_usage rows with identifier_type = 'ip' (raw IPs, written before
--     anon_usage existed, last one 2026-06-15) once they pass the same 90 days.
create or replace function public.prune_guest_usage(p_days integer default 90)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anon_expired  integer;
  v_anon_raw_ip   integer;
  v_daily_ip      integer;
begin
  delete from public.anon_usage
  where updated_at < now() - make_interval(days => p_days);
  get diagnostics v_anon_expired = row_count;

  delete from public.anon_usage
  where identifier !~ '^[0-9a-f]{64}$';
  get diagnostics v_anon_raw_ip = row_count;

  delete from public.daily_usage
  where identifier_type = 'ip'
    and date < current_date - p_days;
  get diagnostics v_daily_ip = row_count;

  return jsonb_build_object(
    'anon_expired', v_anon_expired,
    'anon_raw_ip',  v_anon_raw_ip,
    'daily_ip',     v_daily_ip
  );
end;
$$;

-- Service-role only, like increment_anon_usage's table.
revoke execute on function public.prune_guest_usage(integer) from public, anon, authenticated;
