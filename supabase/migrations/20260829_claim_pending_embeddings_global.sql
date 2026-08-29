-- Global (cross-user) claim RPC for the cron-triggered embedding drain, plus the
-- security lock-down that makes it safe to expose at all. Applied live via Supabase MCP
-- in two steps (the first revoke-from-PUBLIC did not actually take -- this project grants
-- EXECUTE on new functions directly to anon/authenticated via ALTER DEFAULT PRIVILEGES,
-- independent of PUBLIC -- confirmed live via information_schema.role_routine_grants and
-- fixed with an explicit revoke from those roles). This file is a record-only mirror.

create or replace function public.claim_pending_embeddings_global(p_limit integer default 10)
returns table(id uuid, user_id uuid, title text, filename text, markdown_text text)
language plpgsql
set search_path to 'public'
as $$
begin
  return query
  update public.conversions c
     set embedding_status    = 'running',
         embedding_attempts  = c.embedding_attempts + 1,
         embedding_claimed_at = now()
   where c.id in (
     select c2.id
       from public.conversions c2
      where c2.in_vault
        and (
          c2.embedding_status = 'pending'
          or (c2.embedding_status = 'running' and c2.embedding_claimed_at < now() - interval '10 minutes')
        )
      order by c2.converted_at desc
      limit greatest(p_limit, 1)
      for update skip locked
   )
   returning c.id, c.user_id, c.title, c.filename, c.markdown_text;
end;
$$;

-- Unlike claim_pending_embeddings (scoped by auth.uid()), this function has NO per-user
-- filter by design -- it drains the whole vault across every account for the cron-triggered
-- global backfill. That means it must NEVER be callable by anon/authenticated (it would let
-- any signed-in user read every other user's document titles/filenames/markdown via a
-- direct RPC call).
revoke execute on function public.claim_pending_embeddings_global(integer) from public;
revoke execute on function public.claim_pending_embeddings_global(integer) from anon;
revoke execute on function public.claim_pending_embeddings_global(integer) from authenticated;
grant execute on function public.claim_pending_embeddings_global(integer) to service_role;
