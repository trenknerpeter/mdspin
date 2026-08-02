-- Record-only: applied to hosted project (ref `ixdsddfxkrkytiitfici`) via Supabase MCP.
--
-- Claim-based work queue for the per-doc summary drainer (app/api/vault/summaries/run).
-- `FOR UPDATE SKIP LOCKED` + a 'running' status gives crash recovery with no cron: a
-- claim that never completes (server crash, Vercel timeout) is simply reclaimed by the
-- next drain once summary_claimed_at is more than 10 minutes old.
--
-- security invoker + explicit auth.uid() filter, matching every other RPC on this table.
-- Volatile (not stable) since this performs a write.

create or replace function public.claim_pending_summaries(p_limit int default 5)
returns table (id uuid, title text, filename text, markdown_text text)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  update public.conversions c
     set summary_status    = 'running',
         summary_attempts  = c.summary_attempts + 1,
         summary_claimed_at = now()
   where c.id in (
     select c2.id
       from public.conversions c2
      where c2.user_id = auth.uid()
        and c2.in_vault
        and (
          c2.summary_status = 'pending'
          or (c2.summary_status = 'running' and c2.summary_claimed_at < now() - interval '10 minutes')
        )
      order by c2.converted_at desc
      limit greatest(p_limit, 1)
      for update skip locked
   )
   returning c.id, c.title, c.filename, c.markdown_text;
end;
$$;
