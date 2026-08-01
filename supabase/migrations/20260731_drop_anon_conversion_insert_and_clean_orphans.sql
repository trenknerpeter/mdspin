-- Record-only: applied to hosted project (ref `ixdsddfxkrkytiitfici`) via Supabase MCP.
--
-- Closes an unauthenticated write vector on the primary table.
--
-- The policy "Anyone can insert anonymous conversions" (INSERT, role public,
-- WITH CHECK user_id IS NULL) allowed anybody holding the public anon key to insert
-- unbounded rows, including multi-MB markdown_text. Because every read path filters on
-- user_id, such rows were invisible to the application, so the growth would never have
-- surfaced in the UI.
--
-- Verified vestigial before dropping:
--   * mdspin-chrome-extension only SELECTs daily_usage. No .from("conversions") and no
--     .insert() anywhere in src/ or dist/.
--   * mdc-api never references the conversions table at all, and authenticates with
--     SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS regardless.
--   * true_frontend inserts only inside `if (user)`, a guard added by 7388f2c
--     ("signed-in-only auto-save", 2026-06-17).
--   * The 57 orphan rows ran 2026-03-17 -> 2026-06-15 and stopped two days before
--     7388f2c landed — they are fossils of the pre-guard anonymous auto-save path.
--     Zero created in the 45 days before this migration.
--
-- The 57 rows were exported to MDC_project/orphan-conversions-backup-2026-07-31.json
-- (all 28 columns, verified re-readable) before deletion. None were in_vault.

drop policy if exists "Anyone can insert anonymous conversions" on public.conversions;

delete from public.conversions where user_id is null;

-- Verified after apply: 221 -> 164 rows, 0 orphans remaining, in_vault unchanged at 43,
-- 4 policies remaining (all owner-only: select/insert/update/delete on auth.uid()).
--
-- Follow-up worth considering: conversions.user_id is still NULLABLE. Now that no code
-- path writes a null, adding NOT NULL would make this class of orphan unrepresentable.
-- Left out here to keep this migration to one concern.
