// Pure guest-preview logic. No imports — unit-tested.
//
// Signed-out callers get a truncated preview instead of the full markdown; the
// cut happens server-side (app/api/convert*/route.ts) so the full text never
// reaches a signed-out client. The marker line exists for already-installed
// extensions that predate the `preview` field: they paste whatever text they
// get, so the text itself has to say it is incomplete.

export const PREVIEW_MAX_CHARS = 1200
export const PREVIEW_MAX_SHARE = 0.4
export const PREVIEW_MARKER = "> Preview only. Sign in free at mdspin.app to get the full document."

export type GuestPreviewMeta = { truncated: boolean; total_words: number }

export function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}

export function buildPreview(markdown: string): { preview: string; truncated: boolean; totalWords: number } {
  const text = markdown.trim()
  if (!text) return { preview: "", truncated: false, totalWords: 0 }

  const budget = Math.max(1, Math.min(PREVIEW_MAX_CHARS, Math.floor(text.length * PREVIEW_MAX_SHARE)))

  // Prefer the last paragraph break inside the budget; if that would throw away
  // more than half the budget, fall back to the last space; else hard-cut.
  let cut = text.lastIndexOf("\n\n", budget)
  if (cut < budget * 0.5) {
    const space = text.lastIndexOf(" ", budget)
    cut = space > 0 ? space : budget
  }

  const head = text.slice(0, cut).trimEnd()
  return {
    preview: `${head}\n\n…\n\n${PREVIEW_MARKER}\n`,
    truncated: true,
    totalWords: countWords(text),
  }
}

const GUEST_FIELDS = ["success", "markdown_text", "error", "message", "filename", "index", "file_type"] as const

export function gateForGuest(result: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of GUEST_FIELDS) if (k in result) out[k] = result[k]

  if (typeof result.markdown_text === "string" && result.success !== false) {
    const p = buildPreview(result.markdown_text)
    out.markdown_text = p.preview
    out.preview = { truncated: p.truncated, total_words: p.totalWords } satisfies GuestPreviewMeta
  }
  return out
}
