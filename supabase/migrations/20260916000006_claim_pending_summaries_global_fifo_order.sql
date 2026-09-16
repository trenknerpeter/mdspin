-- RECORD ONLY. Applied via Supabase MCP; see 20260916000000_source_connections.sql.
--
-- A freshly synced or backfilled batch inserts many rows with converted_at = now(),
-- which under the old `order by converted_at desc` jumped straight to the front of the
-- global drain queue and starved every pre-existing pending document indefinitely.
-- FIFO on least(converted_at, updated_at) fixes both directions: a brand-new row is
-- still queued behind older pending work, and a RE-synced row (which keeps its
-- original converted_at but bumps updated_at on change) is ordered by whichever is
-- earlier, so a doc that has been stale-pending longest is served first either way.
create or replace function public.claim_pending_summaries_global(p_limit integer default 3)
returns table(id uuid, user_id uuid, title text, filename text, markdown_text text)
language plpgsql
set search_path to 'public'
as $$
begin
  return query
  update public.conversions c
     set summary_status     = 'running',
         summary_attempts   = c.summary_attempts + 1,
         summary_claimed_at = now()
   where c.id in (
     select c2.id
       from public.conversions c2
      where c2.in_vault
        and (
          c2.summary_status = 'pending'
          or (c2.summary_status = 'running' and c2.summary_claimed_at < now() - interval '10 minutes')
        )
      order by least(c2.converted_at, c2.updated_at) asc
      limit greatest(p_limit, 1)
      for update skip locked
   )
   returning c.id, c.user_id, c.title, c.filename, c.markdown_text;
end;
$$;
