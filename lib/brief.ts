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
  return {
    topic: source.title ?? source.filename,
    docs: [source, ...related].map(toDoc),
  }
}
