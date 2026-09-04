// I/O helper shared between the user-triggered summary route
// (app/api/vault/summaries/run/route.ts) and the cron-triggered global drain
// (app/api/cron/summaries/route.ts) — both call the Make webhook, parse its reply, and
// write the result identically, so the logic lives in one place rather than two that can
// drift. Direct counterpart to lib/vault/embed-document.ts.
//
// It also exists here rather than inline in the routes because vitest.config.mts only
// includes lib/**/*.test.ts — route handlers are untestable in this harness, and the
// behaviour below is exactly the part that needs regression tests.

import type { SupabaseClient } from "@supabase/supabase-js"
import { assembleSummaryPayload, parseSummaryResponse, nextSummaryStatus } from "./summary"

export interface SummarizableDoc {
  id: string
  title: string | null
  filename: string
  markdown_text: string | null
}

/**
 * Why a typed reason rather than a bare boolean: the failure this pipeline actually hit in
 * production was indistinguishable from success at every layer. A blocked Make filter
 * answers HTTP 200 with the body "Accepted", so "the scenario rejected us" and "the
 * scenario is down" and "we sent nonsense" all collapsed into one silent non-event. The
 * caller can now log and surface which one happened.
 */
export type SummaryFailureReason = "webhook_error" | "unparseable_response" | "network_error"

export interface SummarizeDeps {
  webhookUrl: string
  webhookSecret: string
  /** Injected in tests; defaults to global fetch. */
  fetchImpl?: typeof fetch
  maxWords?: number
  /** Injected in tests so summary_generated_at is deterministic. */
  now?: () => string
}

export interface SummarizeResult {
  id: string
  /** Human-readable label for the drain checklist in the UI. */
  label: string
  ok: boolean
  summary: string | null
  reason?: SummaryFailureReason
}

/**
 * Summarise one document via the Make webhook and store the result.
 *
 * Auth-agnostic by design, like embedAndStoreDocument: the caller supplies the Supabase
 * client (per-request cookie-authenticated for the manual route, service-role for the
 * cron), and this function only updates the one conversions row it was handed.
 *
 * IMPORTANT: this never writes summary_attempts. The claim RPCs
 * (claim_summaries_by_id, claim_pending_summaries_global) own the increment — if the
 * worker incremented too, every run would burn two attempts and halve the retry budget.
 */
export async function summarizeAndStoreDocument(
  supabase: SupabaseClient,
  doc: SummarizableDoc,
  deps: SummarizeDeps
): Promise<SummarizeResult> {
  const label = doc.title || doc.filename
  const doFetch = deps.fetchImpl ?? fetch
  const now = deps.now ?? (() => new Date().toISOString())

  let summary: string | null = null
  let reason: SummaryFailureReason | undefined

  // One doc per call: the Make scenario handles exactly one, and batching would require an
  // Iterator + Aggregator on the Make side. See SUMMARY_BATCH_SIZE in ./limits.
  const request = assembleSummaryPayload([doc], { maxWords: deps.maxWords })

  try {
    const res = await doFetch(deps.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mdspin-secret": deps.webhookSecret },
      body: JSON.stringify({ maxWords: request.maxWords, docs: request.docs }),
    })
    if (!res.ok) {
      reason = "webhook_error"
    } else {
      // parseSummaryResponse refuses anything that doesn't self-identify which document it
      // belongs to — including the literal "Accepted" a blocked Make filter returns. An
      // empty result here is a real failure, not an empty summary.
      const parsed = parseSummaryResponse(await res.text(), [doc.id])
      summary = parsed[doc.id] ?? null
      if (!summary) reason = "unparseable_response"
    }
  } catch {
    reason = "network_error"
  }

  if (summary) {
    await supabase
      .from("conversions")
      .update({ summary, summary_status: "ready", summary_generated_at: now() })
      .eq("id", doc.id)
    return { id: doc.id, label, ok: true, summary }
  }

  // The claim already incremented summary_attempts, so re-read it to decide whether this
  // document still has budget ('pending', retried by the next drain) or is spent
  // ('failed', left alone until a human retries). Defaulting an unreadable row to the max
  // rather than 0 mirrors embed-document.ts: better to stop than to retry forever.
  const { data: current } = await supabase
    .from("conversions")
    .select("summary_attempts")
    .eq("id", doc.id)
    .maybeSingle()
  const attempts = (current as { summary_attempts: number } | null)?.summary_attempts ?? 3
  await supabase
    .from("conversions")
    .update({ summary_status: nextSummaryStatus(attempts, false) })
    .eq("id", doc.id)

  return { id: doc.id, label, ok: false, summary: null, reason }
}
