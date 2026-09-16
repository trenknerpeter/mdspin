-- RECORD ONLY. Applied via Supabase MCP; see 20260916000000_source_connections.sql.
--
-- A linked synced document is a read-only mirror: the source owns body and title.
-- This MUST be enforced at the database, not in application code, because the vault
-- UI's editor (lib/library.ts updateSpin) writes to `conversions` via plain PostgREST
-- .update() and never passes through lib/vault/repo.ts — a TypeScript-layer guard would
-- be decorative. The sync worker bypasses this by setting a session-local GUC inside
-- its own transaction; nothing else can set it, since it's a plain SET LOCAL, not a
-- column or claim any client can forge.
create or replace function public.conversions_enforce_source_link()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.source_link_state = 'linked'
     and new.source_connection_id is not null
     and (new.markdown_text is distinct from old.markdown_text
          or new.title is distinct from old.title)
     and coalesce(current_setting('mdspin.sync_write', true), '') <> 'on'
  then
    raise exception 'SOURCE_LINKED' using errcode = '0A000',
      detail = 'This document mirrors an external source; detach it to edit the body or title.';
  end if;
  return new;
end;
$$;

drop trigger if exists conversions_source_link_guard on public.conversions;
create trigger conversions_source_link_guard
  before update on public.conversions
  for each row execute function public.conversions_enforce_source_link();
