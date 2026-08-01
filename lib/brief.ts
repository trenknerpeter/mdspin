// Pure helpers for building the Make brief-synthesis request payload.

export const CLUSTER_DOC_CAP = 6000 // chars per doc sent to the LLM (keeps token budget sane)

export interface ClusterDoc {
  title: string | null
  filename: string
  markdown_text: string | null
}

export interface BriefRequestDoc {
  title: string
  markdown: string
}

export interface BriefRequest {
  topic: string
  docs: BriefRequestDoc[]
  // Pre-joined markdown of all docs — convenient to map straight into an LLM prompt
  // in Make (the `docs` array is awkward to template in a text field).
  docsText: string
}

/**
 * Make's gateway answers `200` with the body `Accepted` whenever the scenario does not
 * reach its Webhook Response module — which is exactly what happens when the
 * shared-secret filter rejects a request, since a filter cannot return 401.
 *
 * Without this guard the tolerant plain-text parse in /api/brief would treat "Accepted"
 * as a successful synthesis and UPDATE conversions.brief with it, destroying a real
 * brief. A genuine brief is five markdown sections, so a very short body is never valid.
 */
const MAKE_ACK = /^accepted\.?$/i
const MIN_BRIEF_CHARS = 40

/**
 * Pull the brief out of whatever Make returned, or null if this isn't a real brief.
 * Accepts JSON `{brief}`, a bare JSON string, or raw markdown text.
 */
export function parseBriefResponse(rawText: string): string | null {
  let brief = ""
  try {
    const json = JSON.parse(rawText)
    if (typeof json === "string") brief = json
    else if (json && typeof json.brief === "string") brief = json.brief
    else brief = rawText
  } catch {
    brief = rawText
  }
  brief = brief.trim()

  if (!brief) return null
  if (MAKE_ACK.test(brief)) return null
  if (brief.length < MIN_BRIEF_CHARS) return null
  return brief
}

// Build the webhook payload: source first, then related docs. Each doc's markdown
// is capped at `capChars`. `topic` is the source's title (falls back to filename).
export function assembleClusterPayload(
  source: ClusterDoc,
  related: ClusterDoc[],
  capChars: number = CLUSTER_DOC_CAP
): BriefRequest {
  const toDoc = (d: ClusterDoc): BriefRequestDoc => ({
    title: d.title ?? d.filename,
    markdown: (d.markdown_text ?? "").slice(0, capChars),
  })
  const docs = [source, ...related].map(toDoc)
  const docsText = docs.map((d) => `### ${d.title}\n\n${d.markdown}`).join("\n\n---\n\n")
  return {
    topic: source.title ?? source.filename,
    docs,
    docsText,
  }
}
