-- Record-only: applied to hosted project (ref `ixdsddfxkrkytiitfici`) via Supabase MCP.
--
-- RC4: editing a document's markdown already re-queued its EMBEDDING (embedding_status =
-- 'pending', embedding_attempts = 0) but did nothing to its summary, so an edited document
-- would keep a summary describing the version before the edit -- indefinitely, since
-- nothing else ever re-queues one. Harmless while the pipeline produced nothing at all;
-- actively wrong the moment it started working.
--
-- These two functions are reproduced verbatim from their live definitions with only the
-- summary_status / summary_attempts lines added, directly alongside the embedding lines
-- they mirror. Source of truth for the rest of the body: 20260902_stage4_mcp_writes.sql.

create or replace function public.vault_append_to_document(
  p_user_id uuid, p_document_id uuid, p_addition text, p_actor text default 'mcp'::text,
  p_actor_key_id uuid default null::uuid, p_reason text default null::text)
returns table(id uuid, filename text, title text, file_type text, word_count integer,
              project_id uuid, tags text[], source_type text,
              converted_at timestamp with time zone, updated_at timestamp with time zone,
              version integer)
language plpgsql
set search_path to 'public'
as $function$
declare
  v_current record;
  v_new_markdown text;
begin
  if not public.vault_actor_ok(p_user_id) then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select c.id, c.markdown_text, c.version into v_current
    from public.conversions c
   where c.id = p_document_id and c.user_id = p_user_id
   for update;

  if v_current.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  v_new_markdown := case
    when coalesce(v_current.markdown_text, '') = '' then p_addition
    else v_current.markdown_text || E'\n\n' || p_addition
  end;

  insert into public.document_revisions (document_id, user_id, from_version, actor, actor_key_id, reason)
  values (p_document_id, p_user_id, v_current.version, p_actor, p_actor_key_id, p_reason);

  update public.conversions c set
    markdown_text = v_new_markdown,
    word_count = case when trim(v_new_markdown) = '' then 0
                      else array_length(regexp_split_to_array(trim(v_new_markdown), '\s+'), 1) end,
    embedding_status = 'pending',
    embedding_attempts = 0,
    -- An append always changes the body, so the summary is always stale -- no guard needed
    -- here, unlike vault_update_document where markdown_text is one optional patch key.
    summary_status = 'pending',
    summary_attempts = 0
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
$function$;

create or replace function public.vault_update_document(
  p_user_id uuid, p_document_id uuid, p_expected_version integer, p_patch jsonb,
  p_actor text default 'user'::text, p_actor_key_id uuid default null::uuid,
  p_reason text default null::text, p_confirm_shrink boolean default false)
returns table(id uuid, filename text, title text, file_type text, word_count integer,
              project_id uuid, tags text[], source_type text,
              converted_at timestamp with time zone, updated_at timestamp with time zone,
              version integer)
language plpgsql
set search_path to 'public'
as $function$
declare
  v_current record;
  v_new_tags text[];
  v_new_markdown text;
  v_changed boolean;
begin
  if not public.vault_actor_ok(p_user_id) then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select c.id, c.version, c.title, c.markdown_text, c.tags, c.project_id, c.source_type
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

  if p_actor = 'mcp' and p_patch ? 'markdown_text' then
    v_new_markdown := p_patch->>'markdown_text';

    if v_current.source_type not in ('note', 'mcp') then
      raise exception 'IMMUTABLE_SOURCE' using errcode = '0A000';
    end if;

    if length(coalesce(v_current.markdown_text, '')) > 2000
       and length(coalesce(v_new_markdown, '')) < length(coalesce(v_current.markdown_text, '')) * 0.5
       and not p_confirm_shrink
    then
      raise exception 'SUSPICIOUS_SHRINK' using errcode = '22001',
        detail = jsonb_build_object(
          'previous_length', length(v_current.markdown_text),
          'new_length', length(coalesce(v_new_markdown, ''))
        )::text;
    end if;
  end if;

  if p_patch ? 'tags' then
    select coalesce(array_agg(x), '{}'::text[]) into v_new_tags
      from jsonb_array_elements_text(p_patch->'tags') x;
  end if;

  v_changed :=
    (p_patch ? 'title' and (p_patch->>'title') is distinct from v_current.title)
    or (p_patch ? 'markdown_text' and (p_patch->>'markdown_text') is distinct from v_current.markdown_text)
    or (p_patch ? 'tags' and v_new_tags is distinct from v_current.tags)
    or (p_patch ? 'project_id' and (p_patch->>'project_id')::uuid is distinct from v_current.project_id);

  if not v_changed then
    return query
      select c.id, c.filename, c.title, c.file_type, c.word_count,
             c.project_id, c.tags, c.source_type, c.converted_at, c.updated_at, c.version
        from public.conversions c
       where c.id = p_document_id and c.user_id = p_user_id;
    return;
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
    tags          = case when p_patch ? 'tags' then v_new_tags else c.tags end,
    project_id    = case when p_patch ? 'project_id' then (p_patch->>'project_id')::uuid else c.project_id end,
    embedding_status = case when p_patch ? 'markdown_text' then 'pending' else c.embedding_status end,
    embedding_attempts = case when p_patch ? 'markdown_text' then 0 else c.embedding_attempts end,
    -- Guarded on markdown_text exactly like the embedding lines above: retitling or
    -- retagging a document does not make its summary stale, so it must not burn a Make
    -- operation. Only a body change does.
    summary_status = case when p_patch ? 'markdown_text' then 'pending' else c.summary_status end,
    summary_attempts = case when p_patch ? 'markdown_text' then 0 else c.summary_attempts end
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
$function$;
