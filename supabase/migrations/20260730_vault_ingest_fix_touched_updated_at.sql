-- Record-only: applied to hosted project (ref `ixdsddfxkrkytiitfici`) via Supabase MCP.
--
-- Corrects an ordering mistake in 20260730_vault_ingest.sql. That file creates the
-- `conversions_touch` BEFORE UPDATE trigger and *then* runs the summary-enqueue UPDATE,
-- so the enqueue fired the trigger and stamped updated_at = now() / version = 2 on all
-- 43 in_vault rows — defeating the whole reason updated_at was backfilled in three steps.
--
-- These rows had never actually been modified, so updated_at must equal converted_at and
-- version must be 1. Scoped tightly (version = 2, still pending, touched within 15
-- minutes) so a genuine user edit landing between the two migrations is left alone.
--
-- Lesson for future migrations on this table: any data backfill must run BEFORE
-- conversions_touch exists, or be wrapped in disable/enable trigger.

alter table public.conversions disable trigger conversions_touch;

update public.conversions
   set updated_at = converted_at,
       version    = 1
 where in_vault
   and version = 2
   and summary_status = 'pending'
   and updated_at > now() - interval '15 minutes';

alter table public.conversions enable trigger conversions_touch;

-- Verified after apply: 221/221 rows have updated_at = converted_at and version = 1;
-- 43 pending summaries, matching 43 in_vault rows exactly.
