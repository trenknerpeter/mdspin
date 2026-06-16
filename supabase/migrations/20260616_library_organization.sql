-- Phase 2 Organization Layer: projects + spin metadata
-- Record-only: already applied to hosted project (ref ixdsddfxkrkytiitfici) via Supabase MCP.

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text,
  created_at  timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects(user_id);

alter table public.projects enable row level security;

create policy "owner can read" on public.projects
  for select using (auth.uid() = user_id);
create policy "owner can insert" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "owner can update" on public.projects
  for update using (auth.uid() = user_id);
create policy "owner can delete" on public.projects
  for delete using (auth.uid() = user_id);

-- Spin organization metadata
alter table public.conversions
  add column if not exists title      text,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists tags       text[] not null default '{}'::text[];

create index if not exists conversions_project_id_idx on public.conversions(project_id);
create index if not exists conversions_tags_idx on public.conversions using gin(tags);

-- Required so owners can rename / assign project / tag their spins
create policy "Users can update own conversions" on public.conversions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
