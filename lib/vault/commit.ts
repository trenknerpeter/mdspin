// Browser-side commit helpers for markdown ingest (Stage 1c).
//
// No dedicated /api/vault/documents/bulk route for this slice: every operation
// here is a single-table, RLS-scoped read or write with no secret involved, so
// it stays browser-direct per the same rule that already governs lib/library.ts.
// Project resolution happens client-side (sequential get-or-create by name)
// rather than via an atomic Postgres function, because the schema is still
// one-project-per-doc — there is no join-row atomicity concern to solve yet.

import { createClient } from "@/lib/supabase/client"
import { listProjects, createProject, type Project } from "@/lib/library"
import type { IngestRow } from "@/lib/vault/ingest"
import { HASH_PROBE_CHUNK } from "@/lib/vault/limits"

/**
 * Which of these content hashes already exist anywhere in the user's
 * conversions (RLS-scoped). Checked without an in_vault filter — only
 * ingest-created rows ever carry a non-null hash, and those are always
 * inserted with in_vault=true, so this is equivalent and simpler.
 */
export async function checkExistingContentHashes(hashes: string[]): Promise<Set<string>> {
  const nonNull = hashes.filter((h): h is string => !!h)
  if (nonNull.length === 0) return new Set()

  const supabase = createClient()
  const found = new Set<string>()
  for (let i = 0; i < nonNull.length; i += HASH_PROBE_CHUNK) {
    const slice = nonNull.slice(i, i + HASH_PROBE_CHUNK)
    const { data, error } = await supabase
      .from("conversions")
      .select("content_hash")
      .not("content_hash", "is", null)
      .in("content_hash", slice)
    if (error) throw error
    for (const row of (data ?? []) as { content_hash: string }[]) found.add(row.content_hash)
  }
  return found
}

/**
 * Resolve project NAMES to ids, creating any that don't exist yet. Sequential
 * by design: this typically resolves a handful of distinct names (folders),
 * not hundreds, so a Postgres function isn't worth the added surface for a
 * schema that only supports one project per doc anyway.
 */
export async function resolveProjectIds(
  names: string[],
  existing: Project[]
): Promise<Map<string, string>> {
  const byLowerName = new Map(existing.map((p) => [p.name.toLowerCase(), p.id]))
  const result = new Map<string, string>()
  const distinct = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)))

  for (const name of distinct) {
    const existingId = byLowerName.get(name.toLowerCase())
    if (existingId) {
      result.set(name, existingId)
      continue
    }
    const created = await createProject(name)
    byLowerName.set(name.toLowerCase(), created.id)
    result.set(name, created.id)
  }
  return result
}

export interface PreparedIngestRow extends IngestRow {
  user_id: string
  project_id: string | null
}

export interface CommitOutcome {
  insertedIds: string[]
  /** Always 0 — see the comment on insertIngestRows for why. Kept on the
   *  return shape so callers don't need to change if this is revisited. */
  skippedDuplicateCount: number
}

/**
 * Insert one chunk of prepared rows.
 *
 * Plain insert, NOT upsert. `conversions_user_content_hash_key` is a PARTIAL
 * unique index (`(user_id, content_hash) WHERE content_hash IS NOT NULL`), and
 * Postgres will only use a partial index as an ON CONFLICT arbiter when the
 * ON CONFLICT clause repeats that exact WHERE predicate — something
 * PostgREST's upsert(onConflict:) has no way to express. Confirmed live: this
 * table's unique index makes `.upsert(rows, {onConflict:"user_id,content_hash"})`
 * fail on every call with `42P10: there is no unique or exclusion constraint
 * matching the ON CONFLICT specification`, not just on an actual collision.
 *
 * The caller already checked existing hashes client-side (checkExistingContentHashes)
 * before building these rows, so a real duplicate reaching this function means a
 * genuine race (two tabs importing the same file at once) — rare enough that
 * surfacing it as a thrown 23505, caught by the per-chunk try/catch in
 * use-vault-ingest.ts and offered a retry, is the right amount of handling.
 */
export async function insertIngestRows(rows: PreparedIngestRow[]): Promise<CommitOutcome> {
  if (rows.length === 0) return { insertedIds: [], skippedDuplicateCount: 0 }
  const supabase = createClient()
  const { data, error } = await supabase.from("conversions").insert(rows).select("id")
  if (error) throw error
  return {
    insertedIds: ((data ?? []) as { id: string }[]).map((r) => r.id),
    skippedDuplicateCount: 0,
  }
}
