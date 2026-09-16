-- RECORD ONLY. Applied via Supabase MCP; see 20260916000000_source_connections.sql.
--
-- Service-role-safe sibling of claim_summaries_by_id. That function is `security invoker`
-- filtering on auth.uid() -- called from a service-role connection (no user session),
-- auth.uid() is NULL, so `c.user_id = auth.uid()` is never true and it silently claims
-- ZERO rows, no error. That's exactly Trap 3 from the Cloud Knowledge Hub strategy doc,
-- and it's how the sync webhook's inline summary drain would have failed: green log
-- line, nothing summarized, forever.
--
-- Do NOT "fix" claim_summaries_by_id itself by adding `or auth.uid() is null` -- that
-- function is anon-callable-by-design for the manual per-user route, and that change
-- would let it claim across every account.
create or replace function public.claim_summaries_by_id_for_user(p_user_id uuid, p_ids uuid[])
returns table(id uuid, user_id uuid, title text, filename text, markdown_text text)
language plpgsql
set search_path = public
as $$
begin
  return query
  update public.conversions c
     set summary_status     = 'running',
         summary_claimed_at = now(),
         summary_attempts   = case
           when c.summary_status in ('ready', 'manual') then 1
           else c.summary_attempts + 1
         end
   where c.user_id = p_user_id
     and c.in_vault
     and c.id = any(p_ids[1:10])
   returning c.id, c.user_id, c.title, c.filename, c.markdown_text;
end;
$$;

-- Same lockdown as claim_pending_summaries_global: this takes an explicit p_user_id
-- instead of relying on auth.uid(), so it must never be reachable by anon/authenticated
-- -- that would let any signed-in caller claim (and read the markdown of) any other
-- user's documents just by passing their user_id.
revoke execute on function public.claim_summaries_by_id_for_user(uuid, uuid[]) from public;
revoke execute on function public.claim_summaries_by_id_for_user(uuid, uuid[]) from anon;
revoke execute on function public.claim_summaries_by_id_for_user(uuid, uuid[]) from authenticated;
grant  execute on function public.claim_summaries_by_id_for_user(uuid, uuid[]) to service_role;
