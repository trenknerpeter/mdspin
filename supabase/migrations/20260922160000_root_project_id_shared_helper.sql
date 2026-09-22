-- RECORD ONLY. Applied to the hosted Supabase project (ixdsddfxkrkytiitfici) via the
-- Supabase MCP on 2026-09-22; this project has no migration runner.
--
-- Adds public.root_project_id(parent_id, id) -- a one-line coalesce(parent_id, id), same
-- convention as affinity_band: a small pure SQL function, immutable, parallel safe, no
-- table access. find_related_documents and vault_stats both re-implemented this exact
-- idiom independently (coordinated only by a "change them together" code comment) -- they
-- now call the shared function instead. Mirrors lib/library.ts's rootProjectId().
--
-- vault_search_documents deliberately does NOT call this: its project-scope check is
-- `p.id = p_project_id or p.parent_id = p_project_id`, a "this project or its children"
-- membership test that's correct whether p_project_id is a root or a leaf subproject --
-- not a root computation, so folding it into root_project_id would be a semantic mismatch,
-- not a simplification. Left untouched.
--
-- Verified as a behavioral no-op on the live vault: vault_stats and find_related_documents
-- (run against two documents in different subprojects under the same root, and one at the
-- top level) returned byte-for-byte identical results before and after, since
-- root_project_id(a, b) computes exactly what coalesce(a, b) did inline.
create or replace function public.root_project_id(p_parent_id uuid, p_id uuid)
returns uuid
language sql
immutable
parallel safe
as $function$
  select coalesce(p_parent_id, p_id)
$function$;

-- Body-only change to find_related_documents: the doc_roots CTE now calls
-- public.root_project_id(p.parent_id, p.id) instead of inlining coalesce(p.parent_id, p.id).
-- Everything else is verbatim from 20260908195118_vault_subfolders_root_scoped_relatedness.sql.
--
--   doc_roots as (
--     select dp.document_id, public.root_project_id(p.parent_id, p.id) as root_id
--     from public.document_projects dp
--     join public.projects p on p.id = dp.project_id
--   ),
--
-- See the live definition (pg_get_functiondef) for the full body.

-- Body-only change to vault_stats: the project_count subquery now calls
-- public.root_project_id(p.parent_id, p.id) instead of inlining coalesce(p.parent_id, p.id).
-- Everything else is verbatim from 20260908195322_vault_subfolders_stats_count_roots.sql.
--
--     (select count(distinct public.root_project_id(p.parent_id, p.id))
--        from scope s
--        join public.projects p on p.id = s.project_id
--       where s.project_id is not null)::integer,
--
-- See the live definition (pg_get_functiondef) for the full body.
