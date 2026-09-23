// Pure helpers for the GitHub auto-filing pipeline. Mirrors the pure/IO split in
// lib/vault/summary.ts: everything here is testable, and classify-document.ts owns the
// fetch + DB write.

import { FILING_DOC_CAP, FILING_MAX_ATTEMPTS } from "./limits"

export type FilingStatus = "pending" | "running" | "filed" | "flagged" | "failed"

export interface FilingCandidateProject {
  id: string
  name: string
}

export interface FilingSourceDoc {
  id: string
  title: string | null
  filename: string
  markdown_text: string | null
}

export interface FilingRequest {
  doc: { id: string; title: string; markdown: string }
  projects: FilingCandidateProject[]
}

/** Same head-plus-outline shape as assembleSummaryPayload, capped separately since a
 *  filing decision needs less body than a summary does. */
export function assembleFilingPayload(
  doc: FilingSourceDoc,
  candidates: FilingCandidateProject[],
  opts: { capChars?: number } = {}
): FilingRequest {
  const capChars = opts.capChars ?? FILING_DOC_CAP
  const body = doc.markdown_text ?? ""
  return {
    doc: { id: doc.id, title: doc.title ?? doc.filename, markdown: body.slice(0, capChars) },
    projects: candidates,
  }
}

/** Normalize a name for comparison: lowercase, collapse anything that isn't a letter or
 *  digit into nothing. "Client Acme-Corp" and "client_acme_corp" compare equal; this is
 *  deliberately aggressive (matches lib/vault/paths.ts's philosophy of a cheap, obvious
 *  heuristic) since a false NEGATIVE here just falls through to the LLM step, while a
 *  false POSITIVE would silently misfile a document. */
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export interface PathMatchInput {
  /** GitHub repo name, e.g. "acme-handbook". */
  repoName: string
  /** Path within the repo, e.g. "clients/acme/notes.md". */
  externalId: string
}

export interface PathMatchResult {
  projectId: string
  confidence: number
  note: string
}

/** Deterministic first pass: does the repo name, or the document's top-level folder,
 *  read as the same thing as one of the user's existing top-level project names? No
 *  network call, no cost -- only worth it when it hits, which for most repos it won't
 *  (confirmed with the user: repo names rarely match project names 1:1). Falls through
 *  to the LLM step on any non-match rather than guessing at a fuzzy one. */
export function matchProjectByPath(
  input: PathMatchInput,
  candidates: FilingCandidateProject[]
): PathMatchResult | null {
  const repoKey = normalizeForMatch(input.repoName)
  const topFolder = input.externalId.split("/").slice(0, -1)[0]
  const folderKey = topFolder ? normalizeForMatch(topFolder) : null

  for (const project of candidates) {
    const projectKey = normalizeForMatch(project.name)
    if (!projectKey) continue
    if (projectKey === repoKey) {
      return { projectId: project.id, confidence: 1, note: "Matched by repository name." }
    }
    if (folderKey && projectKey === folderKey) {
      return { projectId: project.id, confidence: 0.95, note: "Matched by folder path." }
    }
  }
  return null
}

/** Resolve a name the LLM returned back to one of the actual candidate projects, using
 *  the same aggressive normalization as matchProjectByPath. The model is asked for a
 *  project NAME rather than an id -- Make has no clean way to hand it back a
 *  per-candidate id array to echo from, and a name is what an LLM reliably gets right
 *  anyway, unlike copying a UUID. Every "match" decision must resolve through this
 *  rather than trusting anything the model returns directly. */
export function findCandidateByName(
  name: string,
  candidates: FilingCandidateProject[]
): FilingCandidateProject | null {
  const key = normalizeForMatch(name)
  if (!key) return null
  return candidates.find((c) => normalizeForMatch(c.name) === key) ?? null
}

/** Confidence bar for filing into an EXISTING project off the LLM's judgement. Lower
 *  than the new-project bar: matching into something that already exists is the lower-
 *  risk action, reversible with a single bulk-move either way. */
export const FILING_MATCH_CONFIDENCE_THRESHOLD = 0.75

/** Confidence bar for auto-CREATING a project. Higher than the match bar on purpose --
 *  see the design doc's "auto-create only above high confidence" decision. Creating
 *  clutter is a worse failure mode than leaving one more document Unfiled. */
export const FILING_NEW_PROJECT_CONFIDENCE_THRESHOLD = 0.85

export type FilingDecision =
  | { decision: "match"; name: string; confidence: number }
  | { decision: "new"; name: string; confidence: number }
  | { decision: "none"; confidence: number }

/** Delimiter mirrors SUMMARY_DELIMITER (lib/vault/summary.ts) for the same reason: Make
 *  has no toJSON() and strips response headers, so the doc id has to ride in the body
 *  ahead of a marker rather than as JSON built by string concatenation. Everything AFTER
 *  the delimiter is the model's own raw output, which we ask it to make valid JSON --
 *  that's the model's job, not Make's, so there's no concatenation risk there. */
export const FILING_DELIMITER = "\n<<<MDSPIN_FILING>>>\n"

/**
 * Parse whatever the Make scenario returns.
 *
 * Same defensiveness as parseSummaryResponse and for the same reason: a blocked Make
 * filter answers HTTP 200 with the literal body "Accepted". That string doesn't contain
 * the delimiter and isn't valid JSON after it, so it always falls through to the
 * unparseable-failure path here -- it can never be mistaken for a real decision.
 *
 * This only extracts and shape-validates the decision -- it does NOT know the candidate
 * list, so a `match`/`new` name that doesn't resolve to anything real is caught one
 * layer up, in classify-document.ts's call to findCandidateByName.
 */
export function parseFilingResponse(body: unknown, requestedId: string): FilingDecision | null {
  if (typeof body !== "string" || !body.includes(FILING_DELIMITER)) return null
  const idx = body.indexOf(FILING_DELIMITER)
  const id = body.slice(0, idx).trim()
  if (id !== requestedId) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(body.slice(idx + FILING_DELIMITER.length))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null
  const obj = parsed as Record<string, unknown>
  const confidence = typeof obj.confidence === "number" ? Math.max(0, Math.min(1, obj.confidence)) : null
  if (confidence === null) return null

  if (obj.decision === "match") {
    if (typeof obj.name !== "string" || !obj.name.trim()) return null
    return { decision: "match", name: obj.name.trim().slice(0, 80), confidence }
  }
  if (obj.decision === "new") {
    if (typeof obj.name !== "string" || !obj.name.trim()) return null
    return { decision: "new", name: obj.name.trim().slice(0, 80), confidence }
  }
  if (obj.decision === "none") {
    return { decision: "none", confidence }
  }
  return null
}

/** Retry state machine for a technical failure (webhook down, network error, unparseable
 *  response) -- mirrors nextSummaryStatus exactly. NOT used for a 'flagged' outcome: that
 *  is a completed decision, not a failure, and is never retried automatically. */
export function nextFilingStatusAfterFailure(attempts: number): FilingStatus {
  return attempts >= FILING_MAX_ATTEMPTS ? "failed" : "pending"
}
