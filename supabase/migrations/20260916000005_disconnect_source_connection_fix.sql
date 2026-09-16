-- RECORD ONLY. Applied via Supabase MCP; see 20260916000000_source_connections.sql.
--
-- Fixes a real hole in the first version of this function: it scoped ownership by
-- auth.uid() alone, which is NULL under a service-role/API-key connection -- meaning
-- `auth.uid() is null or auth.uid() = sc.user_id` was TRUE for every connection, and any
-- API-key-authenticated caller could disconnect (and detach the documents of) any OTHER
-- user's connection just by guessing/knowing its id. Every other RPC in this schema
-- (vault_update_document, vault_organize_document, etc.) takes an EXPLICIT p_user_id and
-- checks it via vault_actor_ok -- this one is brought in line with that pattern instead
-- of trusting auth.uid() as the only source of truth. Live-verified after apply: a call
-- with a mismatched p_user_id now raises NOT_FOUND rather than succeeding.
create or replace function public.disconnect_source_connection(p_user_id uuid, p_connection_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  if not public.vault_actor_ok(p_user_id) then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.source_connections sc
     where sc.id = p_connection_id and sc.user_id = p_user_id
     for update
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  perform set_config('mdspin.sync_write', 'on', true);
  update public.conversions c set
    source_link_state    = 'detached',
    source_type          = 'upload',
    source_connection_id = null,
    external_id           = null,
    external_url          = null,
    source_content_hash   = null,
    source_synced_at      = null
  where c.source_connection_id = p_connection_id
    and c.user_id = p_user_id;

  delete from public.source_connections sc
   where sc.id = p_connection_id and sc.user_id = p_user_id;
end;
$$;

drop function if exists public.disconnect_source_connection(uuid);
