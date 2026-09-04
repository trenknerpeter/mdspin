-- Record-only: applied to hosted project (ref `ixdsddfxkrkytiitfici`) via Supabase MCP.
--
-- Global (cross-user) claim RPC for the cron-triggered summary drain
-- (app/api/cron/summaries), plus the security lock-down that makes it safe to expose.
-- Mirrors 20260829_claim_pending_embeddings_global.sql exactly; see that file for the
-- original working-out.
--
-- This is what makes summaries automatic. Before it, the ONLY way a summary could be
-- produced was a human opening one document's detail panel and clicking "Generate
-- summary" -- the drain branch of app/api/vault/summaries/run had zero callers anywhere
-- in the repo, so 'pending' meant "queued into a queue with no worker".
--
-- `FOR UPDATE SKIP LOCKED` + a 'running' status gives crash recovery: a claim that never
-- completes (server crash, Vercel timeout) is reclaimed by the next tick once
-- summary_claimed_at is more than 10 minutes old.

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
      order by c2.converted_at desc
      limit greatest(p_limit, 1)
      for update skip locked
   )
   returning c.id, c.user_id, c.title, c.filename, c.markdown_text;
end;
$$;

-- Unlike claim_pending_summaries (scoped by auth.uid()), this function has NO per-user
-- filter by design -- it drains the whole vault across every account for the cron. That
-- means it must NEVER be callable by anon/authenticated: it would let any signed-in user
-- read every other user's document titles/filenames/markdown via a direct RPC call.
--
-- The revokes from anon and authenticated are NOT redundant with the revoke from public.
-- This project grants EXECUTE on new functions directly to those roles via ALTER DEFAULT
-- PRIVILEGES, independent of PUBLIC -- so `revoke ... from public` alone silently fails to
-- take. Confirmed live via information_schema.role_routine_grants when the embeddings twin
-- was written; verified again here after apply.
revoke execute on function public.claim_pending_summaries_global(integer) from public;
revoke execute on function public.claim_pending_summaries_global(integer) from anon;
revoke execute on function public.claim_pending_summaries_global(integer) from authenticated;
grant  execute on function public.claim_pending_summaries_global(integer) to service_role;
