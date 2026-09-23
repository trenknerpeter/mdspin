-- RECORD ONLY. Applied via Supabase MCP; no local migration runner in this project.
--
-- Schema for the GitHub auto-filing pipeline (see
-- docs/superpowers/specs/2026-09-23-github-auto-filing-design.md). Every newly-synced
-- document currently lands with project_id = NULL (Unfiled) by design
-- (20260916000002_vault_upsert_synced_document.sql) -- this adds the columns and claim
-- RPCs a background classifier uses to file it, mirroring the summary pipeline's
-- pending/running/claim/attempts shape exactly (20260801_claim_pending_summaries.sql,
-- 20260904000002_claim_summaries_by_id.sql, 20260916000003_claim_summaries_by_id_for_user.sql).
--
-- filing_status is deliberately NOT a column-wide default (unlike summary_status, which
-- WAS given one after 20260904000000 fixed a month of invisible NULLs): filing only
-- applies to source_type='sync' rows without a project. Every other write path
-- (upload/note/mcp/conversion) already has an explicit filing decision at write time --
-- giving this column a default would misclassify every one of those rows as "needs
-- filing". vault_upsert_synced_document sets it explicitly on insert instead.

alter table public.conversions
  add column filing_status text
    check (filing_status in ('pending', 'running', 'filed', 'flagged', 'failed')),
  add column filing_confidence numeric,
  add column filing_note text,
  -- Populated only for 'flagged' rows below the confidence bar, so the Unfiled view can
  -- offer a one-click "File into X" instead of just naming X in prose. ON DELETE SET NULL
  -- because losing the suggestion is harmless -- the row just shows no guess anymore.
  add column filing_suggested_project_id uuid references public.projects(id) on delete set null,
  add column filing_claimed_at timestamptz,
  add column filing_decided_at timestamptz,
  add column filing_attempts integer not null default 0;

alter table public.projects
  add column auto_created boolean not null default false;

comment on column public.conversions.filing_status is
  'Classifier status for auto-filing a synced (GitHub) document. NULL for every row the filing pipeline does not apply to.';
comment on column public.projects.auto_created is
  'True when the GitHub auto-filing classifier created this project (high-confidence "new topic"), rather than the user.';

-- Claim RPC for the manual backfill banner's {limit} drain. Mirrors
-- claim_pending_summaries exactly: security invoker + explicit auth.uid() filter,
-- FOR UPDATE SKIP LOCKED, 'running' + attempts increment so a crash mid-run is reclaimed
-- after 10 minutes rather than stranded. 'flagged' and 'filed' are terminal and never
-- reclaimed here -- flagged is a completed decision, not a failure; filed rows have a
-- project_id and are no longer Unfiled at all.
create or replace function public.claim_pending_filings(p_limit int default 5)
returns table (id uuid, title text, filename text, markdown_text text, external_id text, source_connection_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  update public.conversions c
     set filing_status    = 'running',
         filing_attempts  = c.filing_attempts + 1,
         filing_claimed_at = now()
   where c.id in (
     select c2.id
       from public.conversions c2
      where c2.user_id = auth.uid()
        and c2.in_vault
        and c2.source_type = 'sync'
        and c2.project_id is null
        and (
          c2.filing_status = 'pending'
          or (c2.filing_status = 'running' and c2.filing_claimed_at < now() - interval '10 minutes')
        )
      order by c2.converted_at asc
      limit greatest(p_limit, 1)
      for update skip locked
   )
   returning c.id, c.title, c.filename, c.markdown_text, c.external_id, c.source_connection_id;
end;
$$;

-- Claim RPC for the backfill banner's "Retry failed" bulk action. Mirrors
-- claim_summaries_by_id: deliberately no filing_status filter beyond project_id/source_type
-- (a human clicking retry should be able to act regardless of current status), and resets
-- the attempt budget on retry the same way summaries does.
create or replace function public.claim_filings_by_id(p_ids uuid[])
returns table(id uuid, user_id uuid, title text, filename text, markdown_text text, external_id text, source_connection_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  update public.conversions c
     set filing_status     = 'running',
         filing_claimed_at = now(),
         filing_attempts   = case
           when c.filing_status = 'flagged' then 1
           else c.filing_attempts + 1
         end
   where c.user_id = auth.uid()
     and c.in_vault
     and c.source_type = 'sync'
     and c.project_id is null
     and c.id = any(p_ids[1:10])
   returning c.id, c.user_id, c.title, c.filename, c.markdown_text, c.external_id, c.source_connection_id;
end;
$$;

-- Service-role-safe sibling of claim_filings_by_id, for the GitHub webhook's own inline
-- drain (app/api/webhooks/github/route.ts, called with an explicit p_user_id since a
-- service-role connection has no auth.uid() -- see claim_summaries_by_id_for_user's
-- comment for the exact failure mode this avoids: a silent zero-row claim that looks
-- like success everywhere except the vault ever actually getting filed).
create or replace function public.claim_filings_by_id_for_user(p_user_id uuid, p_ids uuid[])
returns table(id uuid, user_id uuid, title text, filename text, markdown_text text, external_id text, source_connection_id uuid)
language plpgsql
set search_path = public
as $$
begin
  return query
  update public.conversions c
     set filing_status     = 'running',
         filing_claimed_at = now(),
         filing_attempts   = c.filing_attempts + 1
   where c.user_id = p_user_id
     and c.in_vault
     and c.source_type = 'sync'
     and c.project_id is null
     and c.id = any(p_ids[1:10])
   returning c.id, c.user_id, c.title, c.filename, c.markdown_text, c.external_id, c.source_connection_id;
end;
$$;

revoke execute on function public.claim_filings_by_id_for_user(uuid, uuid[]) from public;
revoke execute on function public.claim_filings_by_id_for_user(uuid, uuid[]) from anon;
revoke execute on function public.claim_filings_by_id_for_user(uuid, uuid[]) from authenticated;
grant  execute on function public.claim_filings_by_id_for_user(uuid, uuid[]) to service_role;
