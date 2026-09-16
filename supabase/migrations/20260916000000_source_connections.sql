-- RECORD ONLY. This project has no migration runner: the SQL below was applied directly
-- to the hosted project (ref ixdsddfxkrkytiitfici) via the Supabase MCP.
--
-- Stage 1a of Live Source Sync: the source_connections table plus the columns on
-- conversions that let a document point back at one. Additive only.

create table if not exists public.source_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('github')),
  display_name text not null,
  -- {owner, repo, repo_id, branch, path_prefix, backfill_cursor}
  config jsonb not null default '{}'::jsonb,
  -- GitHub App installation id. Verified against the connecting user's own
  -- /user/installations list at connect time (see lib/integrations/github) — this
  -- column is never trusted as proof of ownership on its own.
  external_account_id text not null,
  status text not null default 'active' check (status in ('active','paused','error','revoked')),
  -- Diff base for force-push / truncated-tree recovery.
  last_synced_sha text,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),

  -- Enables the composite FK from conversions(source_connection_id, user_id).
  unique (id, user_id),
  -- Blocks a forged installation_id from creating a second connection to the same
  -- installation under a different account.
  unique (provider, external_account_id)
);

alter table public.source_connections enable row level security;

create policy "source_connections_select_own" on public.source_connections
  for select using (auth.uid() = user_id);
create policy "source_connections_insert_own" on public.source_connections
  for insert with check (auth.uid() = user_id);
create policy "source_connections_update_own" on public.source_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "source_connections_delete_own" on public.source_connections
  for delete using (auth.uid() = user_id);

create index if not exists source_connections_user_idx on public.source_connections(user_id);

-- ---------------------------------------------------------------------------
-- conversions: sync provenance
-- ---------------------------------------------------------------------------
alter table public.conversions
  add column if not exists source_connection_id uuid,
  add column if not exists external_id text,          -- e.g. repo-relative file path
  add column if not exists external_url text,          -- deep link back to the source
  -- Change detection ONLY. Deliberately NOT the same column as content_hash: writing
  -- content_hash on synced rows would enroll them in conversions_user_content_hash_key
  -- (user_id, content_hash), and file renames / duplicate-content files / "I already
  -- uploaded this folder by hand" would all fail with 23505. This column carries no
  -- unique constraint at all.
  add column if not exists source_content_hash text,
  add column if not exists source_synced_at timestamptz,
  add column if not exists source_link_state text not null default 'linked'
    check (source_link_state in ('linked','detached','missing'));

-- Composite FK: user_id is in the key deliberately (FK checks bypass RLS), same idiom
-- as projects_parent_user_fkey. ON DELETE RESTRICT (not SET NULL) is deliberate too —
-- an orphaned synced row with no connection is unrecoverable (permanently immutable,
-- duplicates on reconnect); disconnect_source_connection() must detach every member
-- row BEFORE the connection can be deleted.
alter table public.conversions
  add constraint conversions_source_connection_user_fkey
    foreign key (source_connection_id, user_id)
    references public.source_connections (id, user_id)
    on delete restrict;

create unique index if not exists conversions_source_connection_external_id_key
  on public.conversions(source_connection_id, external_id)
  where source_connection_id is not null;

create index if not exists conversions_source_connection_idx
  on public.conversions(source_connection_id) where source_connection_id is not null;

-- ---------------------------------------------------------------------------
-- Extend the two provenance CHECK constraints
-- ---------------------------------------------------------------------------
alter table public.conversions drop constraint conversions_source_type_check;
alter table public.conversions add constraint conversions_source_type_check
  check (source_type in ('conversion','upload','note','api','mcp','sync'));

alter table public.document_revisions drop constraint document_revisions_actor_check;
alter table public.document_revisions add constraint document_revisions_actor_check
  check (actor in ('user','api','mcp','make','system','sync'));
