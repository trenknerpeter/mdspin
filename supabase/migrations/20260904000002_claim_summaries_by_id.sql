-- Record-only: applied to hosted project (ref `ixdsddfxkrkytiitfici`) via Supabase MCP.
--
-- Claim RPC for the manual {ids} path of app/api/vault/summaries/run.
--
-- Why this must be an RPC rather than the plain .update() it replaces: PostgREST cannot
-- express `summary_attempts = summary_attempts + 1`. The old route therefore claimed with
-- `.update({summary_status:'running'})` and nothing else, which left summary_attempts at 0
-- forever -- so nextSummaryStatus(0, false) always answered 'pending', and a document could
-- NEVER reach 'failed'. A completely broken webhook looked exactly like "nobody clicked".
-- That is the bug that made this pipeline's total failure invisible for a month.
--
-- It also stamps summary_claimed_at, which the old path never did. Both claim RPCs'
-- stale-reclaim predicate is `summary_claimed_at < now() - interval '10 minutes'`, which is
-- NULL-false -- so a doc claimed via {ids} whose run then died (crash, Vercel timeout) was
-- orphaned in 'running' forever, invisible to reclaim. The embeddings twin fixed exactly
-- this in app/api/vault/embeddings/run/route.ts; summaries never got the same fix.
--
-- The invariant this establishes: THE CLAIM OWNS THE INCREMENT AND THE STAMP. The worker
-- (lib/vault/summarize-document.ts) never writes summary_attempts, or the retry budget
-- would be consumed at double rate.

create or replace function public.claim_summaries_by_id(p_ids uuid[])
returns table(id uuid, user_id uuid, title text, filename text, markdown_text text)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  update public.conversions c
     set summary_status     = 'running',
         summary_claimed_at = now(),
         -- A human clicking "Regenerate" on a working doc starts a fresh attempt budget; a
         -- human clicking "Retry" on a failing one keeps consuming it, so a genuinely
         -- unsummarisable doc still reaches 'failed' and stops costing Make operations.
         -- Without the reset, three successful regenerations would leave attempts at 3 and
         -- the next transient blip would mark a healthy doc permanently failed.
         summary_attempts   = case
           when c.summary_status in ('ready', 'manual') then 1
           else c.summary_attempts + 1
         end
   where c.user_id = auth.uid()
     and c.in_vault
     -- Deliberately NO summary_status filter: the manual path must be able to regenerate a
     -- doc that is already 'ready', which is the pre-existing behaviour this replaces.
     and c.id = any(p_ids[1:10])   -- mirrors MAX_IDS in the route
   returning c.id, c.user_id, c.title, c.filename, c.markdown_text;
end;
$$;
