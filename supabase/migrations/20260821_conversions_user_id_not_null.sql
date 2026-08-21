-- Record-only: applied to hosted project `ixdsddfxkrkytiitfici` via Supabase MCP.
--
-- Strategy doc (`~/.claude/plans/MDSpin strategy.md`) flagged conversions.user_id as
-- nullable "worth doing" back when 57 of 211 rows were orphaned NULL. Stage 0 dropped the
-- anonymous INSERT policy (`WITH CHECK (user_id IS NULL)`) and cleaned those orphans; the
-- INSERT policy now requires `auth.uid() = user_id`, and every insert call site
-- (use-converter.ts, lib/library.ts, lib/vault/commit.ts) sets user_id explicitly from an
-- authenticated user. Re-verified 2026-08-21: 0 orphan rows across all 196 conversions.
-- Safe to close the gap now that nothing can reopen it.
alter table public.conversions
  alter column user_id set not null;
