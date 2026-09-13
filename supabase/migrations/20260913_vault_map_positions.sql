-- RECORD ONLY. This project has no migration runner: the SQL below was applied directly to the
-- hosted project (ref ixdsddfxkrkytiitfici) via the Supabase MCP. This file exists so the schema
-- change is reviewable in git, not to be executed by a tool.
--
-- Where the user has dragged each planet on the Vault Map (/app/vault/map).
--
-- A dedicated table rather than columns on `projects` for one reason: the Map has a node that
-- is not a project — the "Unfiled" bucket — and giving it a home here keeps the component from
-- special-casing it against a separate storage mechanism. `node_id` is therefore plain text
-- (a projects.id, or the '__unfiled__' sentinel the TS layer already uses), NOT a foreign key.
--
-- Consequence of that choice, accepted deliberately: deleting a project leaves an orphan row.
-- It is harmless — reads only look up positions for projects that still exist — and cheaper
-- than either a polymorphic FK or a nullable-FK-plus-sentinel scheme.
--
-- This is view state, not domain data: a missing row simply means "fall back to the
-- deterministic hashed position", which is what every project starts with.

create table if not exists public.vault_map_positions (
  user_id    uuid not null references auth.users(id) on delete cascade,
  node_id    text not null,
  x          real not null,
  y          real not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, node_id)
);

alter table public.vault_map_positions enable row level security;

-- Unlike document_chunks / document_projects, this table DOES get an update policy: dragging a
-- planet is an upsert on an existing row, and delete-then-insert would make a drag momentarily
-- lose the position it is in the middle of setting.
create policy "vault_map_positions_select_own" on public.vault_map_positions
  for select using (auth.uid() = user_id);
create policy "vault_map_positions_insert_own" on public.vault_map_positions
  for insert with check (auth.uid() = user_id);
create policy "vault_map_positions_update_own" on public.vault_map_positions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "vault_map_positions_delete_own" on public.vault_map_positions
  for delete using (auth.uid() = user_id);
