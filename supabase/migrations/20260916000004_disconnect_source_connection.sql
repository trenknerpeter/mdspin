-- RECORD ONLY. Applied via Supabase MCP; see 20260916000000_source_connections.sql.
--
-- Detach every document a connection owns, THEN delete the connection, in one
-- transaction. Order matters: conversions_source_connection_user_fkey is ON DELETE
-- RESTRICT specifically so a connection can never be deleted out from under its
-- documents leaving them permanently immutable (source_type='sync' forever) and
-- unrecoverable (falls out of the idempotency index, duplicating on reconnect).
--
-- Superseded by 20260916000005_disconnect_source_connection_fix.sql within minutes of
-- landing — this version scoped ownership by auth.uid() alone, which is a real hole
-- under the service-role/API-key path. Recorded here anyway (rather than only keeping
-- the fixed version) because that's what actually happened, and the fix's own comment
-- only makes sense next to what it fixed.
create or replace function public.disconnect_source_connection(p_connection_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_user_id uuid;
begin
  select sc.user_id into v_user_id
    from public.source_connections sc
   where sc.id = p_connection_id
     and (auth.uid() is null or auth.uid() = sc.user_id)
   for update;

  if v_user_id is null then
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
    and c.user_id = v_user_id;

  delete from public.source_connections sc
   where sc.id = p_connection_id and sc.user_id = v_user_id;
end;
$$;
