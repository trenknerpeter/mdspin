-- RECORD ONLY. Applied via Supabase MCP; see 20260916000000_source_connections.sql.
--
-- The upsert spine for Live Source Sync. All decision logic lives here (not in TS) so
-- the mirror-guard bypass (mdspin.sync_write) and the write it protects happen in the
-- SAME transaction -- a network round trip between "set the bypass" and "do the write"
-- would be a race and a correctness hazard.
--
-- No document_revisions snapshot is written on any branch here, unlike
-- vault_update_document. Reasoning: the only three things that can happen to a synced
-- row are (1) first insert -- nothing to snapshot, (2) adopt-by-hash -- the row being
-- adopted has, BY DEFINITION of matching content_hash, a body identical to what's being
-- written, so there is nothing to lose, (3) update-on-change -- only reachable once a
-- row is already 'sync'+'linked', which the guard trigger has kept immutable to every
-- writer except this function since the moment it became linked, so the pre-image was
-- itself a prior sync write, never user content. GitHub's own commit history is the
-- revision log for synced content; duplicating it into Postgres would grow
-- document_revisions without bound for no recoverability benefit.
create or replace function public.vault_upsert_synced_document(
  p_user_id uuid,
  p_connection_id uuid,
  p_external_id text,
  p_external_url text,
  p_title text,
  p_filename text,
  p_markdown text,
  p_word_count integer,
  p_source_content_hash text,
  p_project_id uuid default null,
  p_tags text[] default '{}',
  p_summary_status text default 'pending'
)
returns table(
  id uuid, action text, filename text, title text, file_type text, word_count integer,
  project_id uuid, tags text[], source_type text, converted_at timestamptz,
  updated_at timestamptz, version integer, external_id text, external_url text,
  source_content_hash text, source_link_state text, summary text, summary_status text
)
language plpgsql
set search_path to 'public'
as $$
declare
  v_existing public.conversions%rowtype;
  v_adopt    public.conversions%rowtype;
  v_new      public.conversions%rowtype;
begin
  if not public.vault_actor_ok(p_user_id) then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.source_connections sc
     where sc.id = p_connection_id and sc.user_id = p_user_id
  ) then
    raise exception 'INVALID_REQUEST' using errcode = '22023',
      detail = 'source_connection_id does not belong to this user.';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects pr where pr.id = p_project_id and pr.user_id = p_user_id
  ) then
    raise exception 'INVALID_REQUEST' using errcode = '22023',
      detail = 'project_id does not belong to this user.';
  end if;

  select c.* into v_existing
    from public.conversions c
   where c.user_id = p_user_id
     and c.source_connection_id = p_connection_id
     and c.external_id = p_external_id
   for update;

  if v_existing.id is not null then
    if v_existing.source_link_state = 'detached' then
      -- The user took ownership of this document. The source keeps moving; this row
      -- doesn't follow it anymore.
      return query
        select c.id, 'skipped_detached'::text, c.filename, c.title, c.file_type, c.word_count,
               c.project_id, c.tags, c.source_type, c.converted_at, c.updated_at, c.version,
               c.external_id, c.external_url, c.source_content_hash, c.source_link_state,
               c.summary, c.summary_status
          from public.conversions c where c.id = v_existing.id;
      return;
    end if;

    if v_existing.source_content_hash is not distinct from p_source_content_hash then
      return query
        select c.id, 'unchanged'::text, c.filename, c.title, c.file_type, c.word_count,
               c.project_id, c.tags, c.source_type, c.converted_at, c.updated_at, c.version,
               c.external_id, c.external_url, c.source_content_hash, c.source_link_state,
               c.summary, c.summary_status
          from public.conversions c where c.id = v_existing.id;
      return;
    end if;

    perform set_config('mdspin.sync_write', 'on', true);
    -- PRESERVE project_id and tags entirely (omitted from this SET list) -- those are
    -- the user's, not the source's. source_link_state is reset to 'linked' here too:
    -- a file that had gone 'missing' (deleted upstream) and then reappeared under the
    -- same path is the same document again, not a new one.
    update public.conversions c set
      title                = p_title,
      markdown_text        = p_markdown,
      word_count           = p_word_count,
      source_content_hash  = p_source_content_hash,
      source_synced_at     = now(),
      external_url         = coalesce(p_external_url, c.external_url),
      source_link_state    = 'linked',
      summary_status       = 'pending',
      summary_attempts     = 0,
      embedding_status     = 'pending',
      embedding_attempts   = 0
    where c.id = v_existing.id;

    return query
      select c.id, 'updated'::text, c.filename, c.title, c.file_type, c.word_count,
             c.project_id, c.tags, c.source_type, c.converted_at, c.updated_at, c.version,
             c.external_id, c.external_url, c.source_content_hash, c.source_link_state,
             c.summary, c.summary_status
        from public.conversions c where c.id = v_existing.id;
    return;
  end if;

  -- No match on (connection, external_id). Adopt an existing hand-uploaded row with the
  -- same normalized-body hash before inserting a new one. p_source_content_hash is
  -- computed by the SAME algorithm (sha256 of normalizeForHash(body)) as the plain
  -- content_hash column, so they're directly comparable.
  select c.* into v_adopt
    from public.conversions c
   where c.user_id = p_user_id
     and c.source_connection_id is null
     and c.content_hash is not null
     and c.content_hash = p_source_content_hash
   limit 1
   for update skip locked;

  if v_adopt.id is not null then
    update public.conversions c set
      source_connection_id = p_connection_id,
      external_id           = p_external_id,
      external_url          = coalesce(p_external_url, c.external_url),
      source_content_hash   = p_source_content_hash,
      source_synced_at      = now(),
      source_link_state     = 'linked',
      source_type           = 'sync',
      -- Pull the row OUT of conversions_user_content_hash_key so the next rename,
      -- convergent edit, or duplicate-content file in this connection never collides
      -- with it.
      content_hash          = null
    where c.id = v_adopt.id;

    return query
      select c.id, 'adopted'::text, c.filename, c.title, c.file_type, c.word_count,
             c.project_id, c.tags, c.source_type, c.converted_at, c.updated_at, c.version,
             c.external_id, c.external_url, c.source_content_hash, c.source_link_state,
             c.summary, c.summary_status
        from public.conversions c where c.id = v_adopt.id;
    return;
  end if;

  insert into public.conversions (
    user_id, filename, file_type, title, markdown_text, word_count, tags, project_id,
    in_vault, source_type, source_connection_id, external_id, external_url,
    source_content_hash, source_synced_at, source_link_state, summary_status, embedding_status
  ) values (
    p_user_id, p_filename, 'md', p_title, p_markdown, p_word_count,
    coalesce(p_tags, '{}'::text[]), p_project_id,
    true, 'sync', p_connection_id, p_external_id, p_external_url,
    p_source_content_hash, now(), 'linked', p_summary_status, 'pending'
  )
  returning * into v_new;

  return query
    select c.id, 'inserted'::text, c.filename, c.title, c.file_type, c.word_count,
           c.project_id, c.tags, c.source_type, c.converted_at, c.updated_at, c.version,
           c.external_id, c.external_url, c.source_content_hash, c.source_link_state,
           c.summary, c.summary_status
      from public.conversions c where c.id = v_new.id;
end;
$$;
