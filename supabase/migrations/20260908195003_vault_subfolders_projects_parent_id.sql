-- RECORD ONLY. Applied to the hosted Supabase project (ixdsddfxkrkytiitfici) via the
-- Supabase MCP on 2026-09-08; this project has no migration runner.
--
-- Sub-folders: projects nest exactly one level (project -> sub-project -> documents).
-- parent_id is nullable; every existing project stays a root, so this is a no-op on read
-- paths until someone actually nests something.
alter table public.projects
  add column if not exists parent_id uuid;

-- Composite FK against projects_id_user_id_key. user_id is in the key deliberately:
-- FK checks bypass RLS, so a plain (parent_id) -> (id) reference would let a project be
-- parented under another user's project. Same trap documented in
-- 20260822_vault_update_document.sql:16-23.
alter table public.projects
  add constraint projects_parent_user_fkey
    foreign key (parent_id, user_id) references public.projects (id, user_id)
    on delete cascade;

create index if not exists projects_parent_id_idx
  on public.projects (parent_id) where parent_id is not null;

-- Depth cap. A CHECK can't look at another row, so this is a trigger.
-- SECURITY DEFINER is load-bearing: a plain trigger reading public.projects is itself
-- subject to RLS, so a cross-tenant parent_id returns NO ROW -- and "no row" would read
-- as "parent has no parent, therefore it's a root" and be silently accepted. Hence the
-- explicit not-found reject below.
create or replace function public.projects_enforce_single_level()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_parent_parent uuid;
  v_found boolean;
begin
  if new.parent_id is null then
    return new;  -- promoting to top level is always safe
  end if;

  if new.parent_id = new.id then
    raise exception 'A project cannot be its own parent' using errcode = '23514';
  end if;

  select p.parent_id, true into v_parent_parent, v_found
    from public.projects p
   where p.id = new.parent_id and p.user_id = new.user_id;

  if not coalesce(v_found, false) then
    raise exception 'parent_id must be one of your own projects' using errcode = '23503';
  end if;

  if v_parent_parent is not null then
    raise exception 'Projects nest one level only' using errcode = '23514';
  end if;

  if exists (select 1 from public.projects where parent_id = new.id) then
    raise exception 'A project with sub-folders cannot itself become a sub-folder'
      using errcode = '23514';
  end if;

  return new;
end $$;

drop trigger if exists projects_single_level on public.projects;
create trigger projects_single_level
  before insert or update of parent_id on public.projects
  for each row execute function public.projects_enforce_single_level();
