-- Stage 4: MCP write tools — usage metering table + two new write RPCs + guardrails on
-- the existing vault_update_document. Record-only: applied live via the Supabase MCP's
-- apply_migration first, this file committed for history per this repo's established
-- "no migration runner" convention.

create table if not exists public.mcp_usage (
  key_id uuid not null references public.api_keys(id) on delete cascade,
  date date not null default current_date,
  read_count integer not null default 0,
  write_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (key_id, date)
);

alter table public.mcp_usage enable row level security;
-- Deliberately zero policies: this table is written and read ONLY through the two
-- SECURITY DEFINER RPCs below, invoked from the MCP surface's service-role admin client.
-- RLS with no policies means "deny all" for every other path — belt-and-suspenders on
-- top of the service-role client already bypassing RLS, matching this table's
-- fail-closed design intent.

create or replace function public.increment_mcp_read(p_key_id uuid, p_weight integer default 1)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.mcp_usage (key_id, date, read_count)
  values (p_key_id, current_date, greatest(p_weight, 0))
  on conflict (key_id, date)
    do update set read_count = mcp_usage.read_count + greatest(p_weight, 0), updated_at = now();
end;
$$;

-- This Supabase project grants EXECUTE on new functions directly to anon/authenticated
-- via ALTER DEFAULT PRIVILEGES, independent of the PUBLIC role — confirmed live during
-- Stage 3's claim_pending_embeddings_global lockdown. p_key_id here has no auth.uid()
-- ownership check (unlike vault_actor_ok-guarded functions), so a signed-in user could
-- otherwise pass ANY key_id and inflate/deflate another key's usage counters.
-- All three revokes are required, not just anon/authenticated: confirmed live during
-- this migration's own application that CREATE FUNCTION here ALSO grants EXECUTE to
-- PUBLIC by default (unlike claim_pending_embeddings_global's already-locked-down ACL,
-- which has no bare PUBLIC entry) — and PUBLIC membership is implicit for every role, so
-- leaving it in place would silently re-open the same gap the anon/authenticated revokes
-- were meant to close. Verify with `select proacl from pg_proc where proname = ...` after
-- applying — the only remaining grantees must be postgres and service_role.
revoke execute on function public.increment_mcp_read(uuid, integer) from public;
revoke execute on function public.increment_mcp_read(uuid, integer) from anon;
revoke execute on function public.increment_mcp_read(uuid, integer) from authenticated;

create or replace function public.try_increment_mcp_write(p_key_id uuid, p_daily_limit integer)
returns table(allowed boolean, write_count integer, remaining integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer;
begin
  insert into public.mcp_usage (key_id, date, write_count)
  values (p_key_id, current_date, 0)
  on conflict (key_id, date) do nothing;

  select m.write_count into v_count
    from public.mcp_usage m
   where m.key_id = p_key_id and m.date = current_date
   for update;

  if v_count >= p_daily_limit then
    return query select false, v_count, 0;
    return;
  end if;

  update public.mcp_usage
     set write_count = write_count + 1, updated_at = now()
   where key_id = p_key_id and date = current_date;

  return query select true, v_count + 1, p_daily_limit - (v_count + 1);
end;
$$;

revoke execute on function public.try_increment_mcp_write(uuid, integer) from public;
revoke execute on function public.try_increment_mcp_write(uuid, integer) from anon;
revoke execute on function public.try_increment_mcp_write(uuid, integer) from authenticated;

create or replace function public.vault_append_to_document(
  p_user_id uuid,
  p_document_id uuid,
  p_addition text,
  p_actor text default 'mcp',
  p_actor_key_id uuid default null,
  p_reason text default null
)
returns table(id uuid, filename text, title text, file_type text, word_count integer, project_id uuid, tags text[], source_type text, converted_at timestamptz, updated_at timestamptz, version integer)
language plpgsql
set search_path to 'public'
as $$
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

  -- Non-destructive by construction (the prior body is always a prefix of the result),
  -- so unlike vault_update_document's pre-image snapshot, every content column here is
  -- left NULL: nothing is at risk of being lost, and storing the whole prior body on
  -- every append would make document_revisions grow proportional to append count for no
  -- recovery benefit.
  insert into public.document_revisions (document_id, user_id, from_version, actor, actor_key_id, reason)
  values (p_document_id, p_user_id, v_current.version, p_actor, p_actor_key_id, p_reason);

  update public.conversions c set
    markdown_text = v_new_markdown,
    word_count = case when trim(v_new_markdown) = '' then 0
                      else array_length(regexp_split_to_array(trim(v_new_markdown), '\s+'), 1) end,
    embedding_status = 'pending',
    embedding_attempts = 0
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

create or replace function public.vault_organize_document(
  p_user_id uuid,
  p_document_id uuid,
  p_add_tags text[] default '{}',
  p_remove_tags text[] default '{}',
  p_actor text default 'mcp',
  p_actor_key_id uuid default null,
  p_reason text default null
)
returns table(id uuid, filename text, title text, file_type text, word_count integer, project_id uuid, tags text[], source_type text, converted_at timestamptz, updated_at timestamptz, version integer)
language plpgsql
set search_path to 'public'
as $$
declare
  v_current record;
  v_new_tags text[];
begin
  if not public.vault_actor_ok(p_user_id) then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select c.id, c.version, c.tags into v_current
    from public.conversions c
   where c.id = p_document_id and c.user_id = p_user_id
   for update;

  if v_current.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct t), '{}'::text[])
    into v_new_tags
    from unnest(coalesce(v_current.tags, '{}'::text[]) || coalesce(p_add_tags, '{}'::text[])) t
   where t <> all (coalesce(p_remove_tags, '{}'::text[]));

  -- Tags-only pre-image: title/markdown/project_id are untouched by this RPC, so leaving
  -- them NULL keeps a revision row's populated columns matching exactly what this call
  -- could have changed (same convention vault_append_to_document uses above).
  insert into public.document_revisions (document_id, user_id, from_version, tags, actor, actor_key_id, reason)
  values (p_document_id, p_user_id, v_current.version, v_current.tags, p_actor, p_actor_key_id, p_reason);

  update public.conversions c set tags = v_new_tags
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

-- vault_update_document: add a trailing p_confirm_shrink param, an mcp-actor-only
-- immutable-source + anti-truncation guard, and a byte-identical-write skip that benefits
-- every caller (title/tags/project_id edits that don't actually change anything no longer
-- burn a version bump + a junk revision row).
--
-- CREATE OR REPLACE does NOT achieve this safely on its own: Postgres identifies a
-- function by name PLUS argument-type signature, so adding a new parameter — even a
-- DEFAULTed trailing one — changes the signature and makes CREATE OR REPLACE create a
-- SECOND overloaded function instead of replacing the first. Confirmed live while
-- applying this exact migration: `select proname, pronargs from pg_proc where
-- proname='vault_update_document'` came back with both `pronargs=7` (the old function)
-- AND `pronargs=8` (this one) until the old one was dropped explicitly — the same
-- overload-ambiguity trap this strategy doc's own Stage 5 plan already names for a
-- different function ("an overload would have made the existing named-argument call
-- ambiguous to PostgREST"). The REST route's `PATCH /documents/:id` calls this by name
-- with keyword args, so two live overloads is a `42725: function is not unique` error
-- waiting to fire on the very next request, not just an untidy leftover.
drop function if exists public.vault_update_document(uuid, uuid, integer, jsonb, text, uuid, text);

create or replace function public.vault_update_document(
  p_user_id uuid,
  p_document_id uuid,
  p_expected_version integer,
  p_patch jsonb,
  p_actor text default 'user',
  p_actor_key_id uuid default null,
  p_reason text default null,
  p_confirm_shrink boolean default false
)
returns table(id uuid, filename text, title text, file_type text, word_count integer, project_id uuid, tags text[], source_type text, converted_at timestamptz, updated_at timestamptz, version integer)
language plpgsql
set search_path to 'public'
as $$
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

  -- Stage 4 guardrails: mcp-actor ONLY. The browser UI (actor='user') has let a signed-in
  -- human freely rewrite any of their own vault documents, including imported ones,
  -- since Stage 1c's note editor shipped — that's an existing, intentional feature, not a
  -- gap to close. The REST API (actor='api') is unchanged from Stage 2d. Neither surface
  -- has a confirm_shrink affordance, so extending either guardrail to them would turn a
  -- normal save into an unrecoverable-looking error with no way to proceed. The whole
  -- point here is stopping an AGENT from silently destroying imported content.
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
