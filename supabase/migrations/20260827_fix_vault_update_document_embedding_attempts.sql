-- Final-review fix (Minor 4): vault_update_document reset embedding_status to 'pending'
-- on a markdown edit but left embedding_attempts alone. A document that had previously
-- exhausted EMBEDDING_MAX_ATTEMPTS (lib/vault/limits.ts, currently 3) therefore came back
-- as 'pending' with zero retry budget left, so the very next drain would immediately
-- re-fail it via nextEmbeddingStatus(). New content deserves a fresh budget.
--
-- One added line in the same UPDATE ... SET clause; nothing else in the function changed.
-- CREATE OR REPLACE is safe: signature and return type are unchanged.
-- Applied live via Supabase MCP (migration
-- `fix_vault_update_document_embedding_attempts`); this file is a record-only mirror.
--
-- Verified live (both directions, in rolled-back transactions against a real row):
--   * doc forced to embedding_status='failed', embedding_attempts=3, then patched with
--     {"markdown_text": ...}  ->  status='pending', attempts=0
--   * same starting state, patched with {"title": ...} only  ->  status='failed',
--     attempts=3 (unchanged), confirming the `p_patch ? 'markdown_text'` guard still
--     scopes the reset to content edits only.

create or replace function public.vault_update_document(
  p_user_id uuid,
  p_document_id uuid,
  p_expected_version integer,
  p_patch jsonb,
  p_actor text default 'user'::text,
  p_actor_key_id uuid default null::uuid,
  p_reason text default null::text
)
returns table(id uuid, filename text, title text, file_type text, word_count integer, project_id uuid, tags text[], source_type text, converted_at timestamptz, updated_at timestamptz, version integer)
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
    project_id    = case when p_patch ? 'project_id' then (p_patch->>'project_id')::uuid else c.project_id end,
    -- Stage 3: a markdown edit makes every existing chunk/embedding stale. Flip back to
    -- 'pending' so the next backfill drain re-chunks and re-embeds this document; leave it
    -- alone otherwise (title/tags/project-only edits don't change the embedded content).
    embedding_status = case when p_patch ? 'markdown_text' then 'pending' else c.embedding_status end,
    -- Reset the retry budget alongside the status: a document that previously exhausted
    -- EMBEDDING_MAX_ATTEMPTS would otherwise come back as 'pending' with zero retries
    -- left, so the next drain would immediately re-fail it. New content deserves a fresh
    -- budget (final-review Minor finding 4).
    embedding_attempts = case when p_patch ? 'markdown_text' then 0 else c.embedding_attempts end
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
