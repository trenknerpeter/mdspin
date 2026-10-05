/**
 * Splits rendered article HTML so a call-to-action can sit part-way through it.
 *
 * Guide and blog bodies are a single HTML string from remark, injected with
 * dangerouslySetInnerHTML. To place anything mid-article we have to cut that
 * string, and `<h2>` is the only boundary that is both semantically right (a
 * section break, never mid-sentence) and reliably present — every article in
 * content/ has between 7 and 10 of them.
 *
 * Cutting before a top-level tag cannot produce unbalanced markup: everything
 * before the match is closed, everything after opens with the heading.
 */
export function splitBeforeNthH2(html: string, n: number): [string, string] {
  if (n < 1) return [html, ""]

  let index = -1
  for (let found = 0; found < n; found++) {
    index = html.indexOf("<h2", index + 1)
    // Short article, or fewer headings than asked for: leave it whole rather
    // than cutting somewhere arbitrary. Callers render the CTA only when the
    // second half is non-empty, so this degrades to "no mid-article CTA".
    if (index === -1) return [html, ""]
  }

  return [html.slice(0, index), html.slice(index)]
}

/**
 * Per-article overrides for the mid-article CTA and the converter at the foot,
 * read from an optional `cta:` block in the post's frontmatter.
 *
 * The default ask ("Got a document to convert?") suits how-to guides, but a
 * post like the format benchmark earns its click later and for a different
 * reason — after the cost tables, readers want their own number. Every field
 * is optional and anything malformed falls back to the default, so a typo in
 * frontmatter can never break a page that exists to rank.
 */
export type ArticleCta = {
  /** Place the bar before this <h2> (1-based). */
  section: number
  prompt?: string
  action?: string
  heading?: string
  subheading?: string
}

const DEFAULT_CTA_SECTION = 2

export function readArticleCta(raw: unknown): ArticleCta {
  const cta: ArticleCta = { section: DEFAULT_CTA_SECTION }
  if (!raw || typeof raw !== "object") return cta

  const data = raw as Record<string, unknown>
  if (Number.isInteger(data.section) && (data.section as number) >= 1) {
    cta.section = data.section as number
  }
  for (const key of ["prompt", "action", "heading", "subheading"] as const) {
    const value = data[key]
    if (typeof value === "string" && value.trim()) cta[key] = value.trim()
  }
  return cta
}
