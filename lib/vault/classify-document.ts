// I/O helper for the GitHub auto-filing pipeline. Shared between the GitHub webhook's
// inline drain (app/api/webhooks/github/route.ts) and the manual backfill route
// (app/api/vault/filing/run/route.ts) -- both claim, classify, and write the result
// identically. Direct counterpart to lib/vault/summarize-document.ts.
//
// Gated the same way summaries/embeddings are: the caller checks MAKE_FILING_WEBHOOK_URL
// before ever claiming a document, so there's no partially-configured state where a
// document gets claimed (and its attempt budget spent) with nothing able to classify it.

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assembleFilingPayload,
  parseFilingResponse,
  matchProjectByPath,
  findCandidateByName,
  nextFilingStatusAfterFailure,
  FILING_MATCH_CONFIDENCE_THRESHOLD,
  FILING_NEW_PROJECT_CONFIDENCE_THRESHOLD,
  type FilingCandidateProject,
  type FilingSourceDoc,
} from "./filing"

export interface ClassifiableDoc extends FilingSourceDoc {
  user_id: string
  /** Path within the repo (conversions.external_id) -- the input to path-matching. */
  external_id: string | null
  source_connection_id: string | null
}

export type FilingFailureReason = "webhook_error" | "unparseable_response" | "network_error"
export type FilingOutcome = "filed" | "flagged" | "failed"

export interface ClassifyDeps {
  webhookUrl: string
  webhookSecret: string
  /** GitHub repo name for this doc's connection, e.g. "acme-handbook" -- looked up by the
   *  caller from source_connections.config.repo. Null skips straight to the LLM step
   *  (nothing to path-match against). */
  repoName?: string | null
  fetchImpl?: typeof fetch
  now?: () => string
}

export interface ClassifyResult {
  id: string
  label: string
  ok: boolean
  outcome: FilingOutcome
  /** Set when outcome is 'filed' and this call created a new project for it. */
  createdProjectId?: string
  reason?: FilingFailureReason
}

const pct = (confidence: number) => `${Math.round(confidence * 100)}%`

/**
 * Classify and file one document via path-match / the Make webhook fallback, and store
 * the result. Auth-agnostic by design, like summarizeAndStoreDocument: the caller
 * supplies the Supabase client (service-role for the webhook's inline drain, per-request
 * cookie-authenticated for the manual backfill route).
 *
 * IMPORTANT: never writes filing_attempts. The claim RPCs (claim_pending_filings,
 * claim_filings_by_id, claim_filings_by_id_for_user) own the increment -- see
 * summarize-document.ts's identical comment for why double-incrementing here would halve
 * the retry budget.
 */
export async function classifyAndStoreDocument(
  supabase: SupabaseClient,
  doc: ClassifiableDoc,
  candidates: FilingCandidateProject[],
  deps: ClassifyDeps
): Promise<ClassifyResult> {
  const label = doc.title || doc.filename
  const now = deps.now ?? (() => new Date().toISOString())

  if (deps.repoName && doc.external_id) {
    const pathMatch = matchProjectByPath({ repoName: deps.repoName, externalId: doc.external_id }, candidates)
    if (pathMatch) {
      await supabase
        .from("conversions")
        .update({
          project_id: pathMatch.projectId,
          filing_status: "filed",
          filing_confidence: pathMatch.confidence,
          filing_note: pathMatch.note,
          filing_decided_at: now(),
        })
        .eq("id", doc.id)
      return { id: doc.id, label, ok: true, outcome: "filed" }
    }
  }

  const doFetch = deps.fetchImpl ?? fetch
  const payload = assembleFilingPayload(doc, candidates)

  let decision: ReturnType<typeof parseFilingResponse> = null
  let reason: FilingFailureReason | undefined

  try {
    const res = await doFetch(deps.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mdspin-secret": deps.webhookSecret },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      reason = "webhook_error"
    } else {
      decision = parseFilingResponse(await res.text(), doc.id)
      if (!decision) reason = "unparseable_response"
    }
  } catch {
    reason = "network_error"
  }

  if (decision) {
    // The model names a project rather than an id (Make can't hand it a per-candidate id
    // array to echo back, and copying a UUID is exactly the kind of thing an LLM gets
    // wrong) -- resolve that name to a real candidate before trusting it either way. A
    // 'new' decision that actually names an existing project is treated as a match
    // against it rather than risking a duplicate project for a naming collision.
    const resolved = decision.decision !== "none" ? findCandidateByName(decision.name, candidates) : null

    if (decision.decision === "match" && !resolved) {
      // The model claimed a match but named something we don't recognise -- indistinguishable
      // from a broken response, never something to guess through.
      reason = "unparseable_response"
      decision = null
    } else if (resolved) {
      if (decision.confidence >= FILING_MATCH_CONFIDENCE_THRESHOLD) {
        await supabase
          .from("conversions")
          .update({
            project_id: resolved.id,
            filing_status: "filed",
            filing_confidence: decision.confidence,
            filing_note: "Matched by content.",
            filing_decided_at: now(),
          })
          .eq("id", doc.id)
        return { id: doc.id, label, ok: true, outcome: "filed" }
      }
      await supabase
        .from("conversions")
        .update({
          filing_status: "flagged",
          filing_confidence: decision.confidence,
          filing_note: `Might belong in "${resolved.name}" — ${pct(decision.confidence)} confident.`,
          filing_suggested_project_id: resolved.id,
          filing_decided_at: now(),
        })
        .eq("id", doc.id)
      return { id: doc.id, label, ok: true, outcome: "flagged" }
    } else if (decision.decision === "new" && decision.confidence >= FILING_NEW_PROJECT_CONFIDENCE_THRESHOLD) {
      const { data: project, error: createError } = await supabase
        .from("projects")
        .insert({ user_id: doc.user_id, name: decision.name, color: null, parent_id: null, auto_created: true })
        .select("id")
        .single()
      if (!createError && project) {
        await supabase
          .from("conversions")
          .update({
            project_id: project.id,
            filing_status: "filed",
            filing_confidence: decision.confidence,
            filing_note: `Created new project "${decision.name}".`,
            filing_decided_at: now(),
          })
          .eq("id", doc.id)
        return { id: doc.id, label, ok: true, outcome: "filed", createdProjectId: project.id }
      }
      // Project creation itself failing (rare -- a DB error) is a technical failure, not
      // a low-confidence decision: fall through to the failure path below rather than
      // silently flagging a document that the model was actually confident about.
      reason = "webhook_error"
      decision = null
    } else if (decision.decision !== "match") {
      // Below-threshold new-topic guess, or an explicit 'none' -- a completed decision,
      // not a failure. Never retried automatically; the guess is surfaced in the Unfiled
      // view via filing_note.
      // 'none' has no percentage of its own worth showing: confidence there measures how
      // sure the model is that nothing fits, not "how confident it is where this
      // belongs" -- a number next to that phrase reads as self-contradictory (confirmed
      // live against the scenario: a vague doc came back "none" at 90%).
      const note =
        decision.decision === "new"
          ? `Might be a new topic ("${decision.name}") — ${pct(decision.confidence)} confident.`
          : "Couldn't tell where this belongs."
      await supabase
        .from("conversions")
        .update({
          filing_status: "flagged",
          filing_confidence: decision.confidence,
          filing_note: note,
          filing_suggested_project_id: null,
          filing_decided_at: now(),
        })
        .eq("id", doc.id)
      return { id: doc.id, label, ok: true, outcome: "flagged" }
    }
  }

  // Technical failure: consult filing_attempts (already incremented by the claim) to
  // decide retry-vs-give-up, exactly like summarize-document.ts's identical branch.
  const { data: current } = await supabase
    .from("conversions")
    .select("filing_attempts")
    .eq("id", doc.id)
    .maybeSingle()
  const attempts = (current as { filing_attempts: number } | null)?.filing_attempts ?? 3
  const nextStatus = nextFilingStatusAfterFailure(attempts)
  await supabase
    .from("conversions")
    .update({
      filing_status: nextStatus,
      // Only worth a note once retries are exhausted -- a mid-retry 'pending' with a
      // stale note would look like a decision that was never made.
      filing_note: nextStatus === "failed" ? "Couldn't classify this document after 3 attempts." : null,
    })
    .eq("id", doc.id)

  return { id: doc.id, label, ok: false, outcome: "failed", reason }
}
