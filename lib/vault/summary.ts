// Pure helpers for the per-doc summary pipeline. Mirrors the pure/IO split in
// lib/brief.ts: everything here is testable, and the route handler owns the fetch.

import { extractHeadings } from "./title"
import { SUMMARY_DOC_CAP, SUMMARY_MAX_CHARS, SUMMARY_MAX_ATTEMPTS } from "./limits"

export type SummaryStatus = "pending" | "running" | "ready" | "failed" | "manual"

export interface SummarySourceDoc {
  id: string
  title: string | null
  filename: string
  markdown_text: string | null
}

export interface SummaryRequestDoc {
  id: string
  title: string
  markdown: string
}

export interface SummaryRequest {
  docs: SummaryRequestDoc[]
  maxWords: number
}

/**
 * Build the Make webhook payload for a batch of documents.
 *
 * Each doc is sent as its first `capChars` characters plus an outline of every heading in
 * the WHOLE document. The outline is the useful trick here: a 40-word summary needs to
 * know what the document covers end to end, and headings convey that for a tiny fraction
 * of the tokens a full body would cost.
 */
export function assembleSummaryPayload(
  docs: SummarySourceDoc[],
  opts: { capChars?: number; maxWords?: number } = {}
): SummaryRequest {
  const capChars = opts.capChars ?? SUMMARY_DOC_CAP
  const maxWords = opts.maxWords ?? 40

  return {
    maxWords,
    docs: docs.map((d) => {
      const body = d.markdown_text ?? ""
      const head = body.slice(0, capChars)
      const headings = extractHeadings(body)
      // Only worth appending when the document was actually truncated and has structure
      // the head didn't already show.
      const truncated = body.length > capChars
      const outline =
        truncated && headings.length
          ? `\n\n## Outline\n${headings
              .map((h) => `${"  ".repeat(Math.max(0, h.level - 1))}- ${h.text}`)
              .join("\n")}`
          : ""
      return {
        id: d.id,
        title: d.title ?? d.filename,
        markdown: head + outline,
      }
    }),
  }
}

/**
 * Enforce the summary length server-side rather than trusting the model. Truncates on a
 * word boundary and appends an ellipsis when it has to cut.
 */
export function clampSummary(
  raw: string | null | undefined,
  max = SUMMARY_MAX_CHARS
): string | null {
  if (!raw) return null
  const text = raw.trim().replace(/\s+/g, " ")
  if (!text) return null
  if (text.length <= max) return text

  const slice = text.slice(0, max - 1)
  const lastSpace = slice.lastIndexOf(" ")
  const cut = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice
  return `${cut.replace(/[,;:.]$/, "")}…`
}

/**
 * The retry state machine. Retries are automatic-ish — the next drain picks up anything
 * left `pending` — and bounded, so a permanently unsummarisable doc stops costing money.
 *
 * `attempts` is the count AFTER the attempt being recorded.
 */
export function nextSummaryStatus(attempts: number, ok: boolean): SummaryStatus {
  if (ok) return "ready"
  return attempts >= SUMMARY_MAX_ATTEMPTS ? "failed" : "pending"
}

/**
 * Delimiter the Make scenario uses to return `<docId>\n<<<MDSPIN>>>\n<summary>`.
 *
 * Why a delimited plain-text body rather than JSON: Make has no `toJSON()` function, so
 * building a JSON body means string-concatenating unescaped model output — one quote or
 * backslash in a summary and the response is unparseable. Make's gateway also strips
 * custom response headers, so the id can't ride along there either. A delimiter needs no
 * escaping and survives any content.
 */
export const SUMMARY_DELIMITER = "\n<<<MDSPIN>>>\n"

/**
 * Parse whatever the Make scenario returns.
 *
 * CRITICAL: there is deliberately NO bare-raw-text fallback. When a Make filter blocks a
 * request — which is how the shared-secret check is enforced — the gateway still answers
 * `200` with the body `Accepted`. A tolerant parser that attributed unrecognised text to
 * the single requested doc would cheerfully store the literal string "Accepted" as that
 * document's summary. Verified against the live scenario. Text is only trusted when it
 * carries the delimiter, which self-identifies the document it belongs to.
 */
export function parseSummaryResponse(
  body: unknown,
  requestedIds: string[]
): Record<string, string> {
  const out: Record<string, string> = {}

  const take = (id: unknown, summary: unknown) => {
    if (typeof id !== "string" || typeof summary !== "string") return
    if (!requestedIds.includes(id)) return // never write a summary onto an unrequested doc
    const clamped = clampSummary(summary)
    if (clamped) out[id] = clamped
  }

  let value: unknown = body

  // Preferred shape: the delimited plain-text response.
  if (typeof value === "string" && value.includes(SUMMARY_DELIMITER)) {
    const idx = value.indexOf(SUMMARY_DELIMITER)
    take(value.slice(0, idx).trim(), value.slice(idx + SUMMARY_DELIMITER.length))
    return out
  }

  if (typeof value === "string") {
    try {
      value = JSON.parse(value)
    } catch {
      // Not JSON and not delimited — "Accepted", an error page, anything. Not a summary.
      return out
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object") {
        take((item as Record<string, unknown>).id, (item as Record<string, unknown>).summary)
      }
    }
    return out
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    if (Array.isArray(obj.summaries)) {
      for (const item of obj.summaries) {
        if (item && typeof item === "object") {
          take((item as Record<string, unknown>).id, (item as Record<string, unknown>).summary)
        }
      }
      return out
    }
    // Single-doc shape: { summary: "..." }
    if (typeof obj.summary === "string" && requestedIds.length === 1) {
      take(requestedIds[0], obj.summary)
    }
  }

  return out
}
