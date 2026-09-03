-- Stage 5 Phase A: additive-only. No column is dropped, no existing behaviour changes.
-- See docs/superpowers/plans/2026-09-03-stage5-phase-a-lens-migration.md for the full plan.

-- Composite FK targets require these; neither exists today (verified live 2026-09-03).
alter table public.conversions
  add constraint conversions_id_user_id_key unique (id, user_id);

alter table public.projects
  add constraint projects_id_user_id_key unique (id, user_id);

create table public.document_projects (
  document_id uuid not null,
  project_id  uuid not null,
  user_id     uuid not null,
  added_at    timestamptz not null default now(),
  primary key (document_id, project_id),
  constraint document_projects_document_user_fkey
    foreign key (document_id, user_id)
    references public.conversions (id, user_id)
    on delete cascade,
  constraint document_projects_project_user_fkey
    foreign key (project_id, user_id)
    references public.projects (id, user_id)
    on delete cascade
);

create index document_projects_project_user_idx
  on public.document_projects (project_id, user_id);

alter table public.document_projects enable row level security;

create policy "owner can read" on public.document_projects
  for select using (auth.uid() = user_id);
create policy "owner can insert" on public.document_projects
  for insert with check (auth.uid() = user_id);
create policy "owner can delete" on public.document_projects
  for delete using (auth.uid() = user_id);
-- No update policy: a link is added or removed, never mutated in place.

-- Backfill every existing singular project_id. converted_at is the closest available
-- proxy for "when this link was made" -- there is no separate project-assignment
-- history to backfill from.
insert into public.document_projects (document_id, project_id, user_id, added_at)
select id, project_id, user_id, converted_at
from public.conversions
where project_id is not null
on conflict (document_id, project_id) do nothing;
