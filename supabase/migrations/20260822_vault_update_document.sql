-- Stage 2c: transactional patch + optimistic concurrency + revision snapshot. Guardrails (anti-truncation, mcp_usage, required reason for MCP callers) are Stage 4's job — this function only provides the mechanism.
--
-- Note: the RETURNS TABLE(id, filename, title, file_type, word_count, project_id, tags,
-- source_type, converted_at, updated_at, version) clause implicitly declares PL/pgSQL OUT
-- variables with those exact names, scoped to the whole function body. Any unqualified
-- reference to a column sharing one of those names anywhere in the body (UPDATE targets,
-- SET clause fallbacks, DELETE pruning subqueries, etc.) is ambiguous between the OUT
-- variable and the table column. Every table reference below is qualified with an alias
-- to avoid this.
--
-- Final-review amendment (2026-08-23): two fixes folded into this CREATE OR REPLACE.
-- (1) `set search_path to 'public'` added — this was the one of the six new Stage 2c
-- functions (besides vault_actor_ok) the Supabase advisor flagged as missing it; every
-- reference in the body was already schema-qualified with `public.`, so this only closes
-- the advisory warning, no behavior change.
-- (2) A project_id-ownership check added before the UPDATE: the `conversions.project_id`
-- foreign key only checks that the referenced project EXISTS, not who owns it, and FK
-- checks bypass RLS — so without this guard, patching a document's project_id to a project
-- owned by a different user succeeded silently. Live-verified against the hosted DB: a
-- scratch document's project_id could previously be moved to another real user's project
-- through this RPC. Now rejected with errcode 22023 (mapped to VaultError INVALID_REQUEST
-- in lib/vault/repo.ts's updateDocument()) unless the target project belongs to p_user_id,
-- or the patch is explicitly clearing project_id to null.

create or replace function public.vault_update_document(
  p_user_id uuid,
  p_document_id uuid,
  p_expected_version integer,
  p_patch jsonb,
  p_actor text default 'user',
  p_actor_key_id uuid default null,
  p_reason text default null
)
returns table(
  id uuid, filename text, title text, file_type text, word_count integer,
  project_id uuid, tags text[], source_type text, converted_at timestamptz,
  updated_at timestamptz, version integer
)
language plpgsql
set search_path to 'public'
as $$
declare
  v_current record;
begin
  if not public.vault_actor_ok(p_user_id) then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select c.id, c.version, c.title, c.markdown_text, c.tags, c.project_id
    into v_current
    from public.conversions c
   where c.id = p_document_id and c.user_id = p_user_id
   for update;

  if v_current.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_current.version <> p_expected_version then
    raise exception 'VERSION_CONFLICT'
      using errcode = '55000', detail = v_current.version::text;
  end if;

  if p_patch ? 'project_id' and p_patch->>'project_id' is not null then
    if not exists (
      select 1 from public.projects pr
       where pr.id = (p_patch->>'project_id')::uuid and pr.user_id = p_user_id
    ) then
      raise exception 'INVALID_REQUEST' using errcode = '22023';
    end if;
  end if;

  insert into public.document_revisions (
    document_id, user_id, from_version, title, markdown_text, tags, project_id,
    actor, actor_key_id, reason
  ) values (
    p_document_id, p_user_id, v_current.version, v_current.title, v_current.markdown_text,
    v_current.tags, v_current.project_id, p_actor, p_actor_key_id, p_reason
  );

  update public.conversions c set
    title         = case when p_patch ? 'title' then p_patch->>'title' else c.title end,
    markdown_text = case when p_patch ? 'markdown_text' then p_patch->>'markdown_text' else c.markdown_text end,
    tags          = case when p_patch ? 'tags'
                          then (select coalesce(array_agg(x), '{}'::text[]) from jsonb_array_elements_text(p_patch->'tags') x)
                          else c.tags end,
    project_id    = case when p_patch ? 'project_id' then (p_patch->>'project_id')::uuid else c.project_id end
  where c.id = p_document_id and c.user_id = p_user_id;

  delete from public.document_revisions dr
   where dr.document_id = p_document_id
     and dr.id not in (
       select dr2.id from public.document_revisions dr2
        where dr2.document_id = p_document_id
        order by dr2.from_version desc
        limit 50
     );

  return query
    select c.id, c.filename, c.title, c.file_type, c.word_count,
           c.project_id, c.tags, c.source_type, c.converted_at, c.updated_at, c.version
      from public.conversions c
     where c.id = p_document_id and c.user_id = p_user_id;
end;
$$;
