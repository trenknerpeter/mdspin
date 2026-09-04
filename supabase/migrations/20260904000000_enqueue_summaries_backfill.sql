-- Record-only: applied to hosted project (ref `ixdsddfxkrkytiitfici`) via Supabase MCP.
--
-- Two fixes for the same root cause: the per-doc summary pipeline had never produced a
-- single summary, because 24 of 60 in-vault docs were never enqueued at all.
--
-- Why they were NULL: summary_status was deliberately given NO DEFAULT (see
-- 20260730_vault_ingest.sql), so every write path that forgets the column silently
-- produces NULL -- and claim_pending_summaries matches only `= 'pending'`, so those rows
-- are invisible to the drainer forever. Four paths forget it: lib/library.ts's
-- addToVault(), createNote() and buildConversionRows(), and lib/vault/repo.ts's
-- createDocument(). Only folder ingest (lib/vault/ingest.ts) ever set it.
-- lib/vault/mappers.ts's `row.summary_status ?? "pending"` then DISPLAYED those rows as
-- 'pending' over MCP/REST, which is what hid this for a month.
--
-- The disable/enable trigger wrapper is NOT optional. This is the lesson recorded in
-- 20260730_vault_ingest_fix_touched_updated_at.sql, a migration that exists solely to
-- repair the damage from omitting it: conversions_touch would otherwise stamp
-- updated_at = now() and bump version on 24 documents nobody edited.

alter table public.conversions disable trigger conversions_touch;

update public.conversions
   set summary_status = case
         when summary is null or btrim(summary) = '' then 'pending'
         else 'manual'
       end
 where in_vault
   and summary_status is null;

alter table public.conversions enable trigger conversions_touch;

-- The structural fix, and the same guarantee embedding_status has had since
-- 20260827_document_chunks.sql declared it `not null default 'pending'`. Embeddings never
-- had this class of bug precisely because the database caught it.
--
-- This reverses the no-default decision in 20260730_vault_ingest.sql. That decision's
-- stated fear was that a default would enqueue History-only rows and "the drainer would
-- then spend LLM operations summarising documents nobody curated". That does not survive
-- contact with the code: every drainer filters `in_vault` (claim_pending_summaries,
-- claim_pending_summaries_global, the run route's remaining count, the status route), so a
-- non-vault row marked 'pending' costs exactly zero Make operations. The cost of keeping
-- the no-default is that the fifth write path someone adds next month reintroduces the bug.
alter table public.conversions
  alter column summary_status set default 'pending';
