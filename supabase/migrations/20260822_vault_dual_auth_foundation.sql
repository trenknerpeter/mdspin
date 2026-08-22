-- Stage 2c foundation: projects.instructions, document_revisions, vault_actor_ok. Applied live via Supabase MCP; this file is a record-only mirror.

alter table public.projects
  add column if not exists instructions text;

create table if not exists public.document_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.conversions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_version integer not null,
  title text,
  markdown_text text,
  tags text[],
  project_id uuid,
  actor text not null default 'user' check (actor in ('user','api','mcp','make','system')),
  actor_key_id uuid,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists document_revisions_document_id_idx
  on public.document_revisions(document_id, from_version desc);

alter table public.document_revisions enable row level security;

create policy document_revisions_owner_select on public.document_revisions
  for select using (auth.uid() = user_id);

create policy document_revisions_owner_insert on public.document_revisions
  for insert with check (auth.uid() = user_id);

create policy document_revisions_owner_delete on public.document_revisions
  for delete using (auth.uid() = user_id);

create or replace function public.vault_actor_ok(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select auth.uid() is null or auth.uid() = p_user_id
$$;
