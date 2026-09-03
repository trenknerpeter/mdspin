create or replace function public.conversions_sync_document_projects()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- Legacy sync only: mirrors the single project_id column into document_projects.
  -- Delete-all-then-insert-one is correct ONLY while every write path still thinks
  -- in terms of one project per document. The moment a future feature links a
  -- document to more than one project directly via document_projects, this trigger
  -- must be dropped FIRST (Stage 5 Phase D) or it will silently wipe those extra
  -- links on the next legacy single-project save.
  if TG_OP = 'UPDATE' and new.project_id is not distinct from old.project_id then
    return new;
  end if;

  delete from public.document_projects where document_id = new.id;

  if new.project_id is not null then
    insert into public.document_projects (document_id, project_id, user_id)
    values (new.id, new.project_id, new.user_id)
    on conflict (document_id, project_id) do nothing;
  end if;

  return new;
end;
$function$;

create trigger conversions_sync_document_projects
  after insert or update of project_id on public.conversions
  for each row
  execute function public.conversions_sync_document_projects();
