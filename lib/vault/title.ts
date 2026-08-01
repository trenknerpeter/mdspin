// Pure title derivation and heading extraction for ingested markdown.

/** How far into a document we look for an H1 before falling back to the filename. */
const H1_SEARCH_LINES = 50
const MAX_TITLE_LEN = 200

export const UNTITLED = "Untitled note"

export interface Heading {
  level: number
  text: string
}

/** Collapse whitespace, strip inline markdown emphasis/links/code, and cap length. */
export function cleanHeadingText(raw: string): string {
  let t = raw.trim()
  // `[label](url)` and `[label][ref]` -> label
  t = t.replace(/\[([^\]]*)\]\((?:[^)]*)\)/g, "$1").replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
  // `**bold**`, `__bold__`, `*em*`, `_em_`, `` `code` ``, `~~strike~~`
  t = t.replace(/(\*\*|__|~~)(.*?)\1/g, "$2")
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")
  t = t.replace(/(^|[^_])_([^_]+)_/g, "$1$2")
  t = t.replace(/`([^`]*)`/g, "$1")
  t = t.replace(/\s+/g, " ").trim()
  return t.slice(0, MAX_TITLE_LEN)
}

/**
 * Extract every ATX (`## x`) and setext (`x` over `===`) heading, skipping anything
 * inside a fenced code block. Fenced code is the reason this can't be a one-line regex:
 * `# not a heading` inside a ```/~~~ fence is extremely common in technical notes.
 */
export function extractHeadings(markdown: string, maxLines = Infinity): Heading[] {
  const lines = markdown.split(/\r?\n/)
  const out: Heading[] = []
  let fence: string | null = null

  const limit = Math.min(lines.length, maxLines === Infinity ? lines.length : maxLines)

  for (let i = 0; i < limit; i++) {
    const line = lines[i]

    // Fence open/close. A closing fence must use the same character and be at least
    // as long as the opening one.
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (!fence) {
        fence = marker
      } else if (marker[0] === fence[0] && marker.length >= fence.length) {
        fence = null
      }
      continue
    }
    if (fence) continue

    // ATX: `#` through `######`, and the `#` run MUST be followed by whitespace —
    // `#NoSpace` is a tag, not a heading.
    const atx = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line)
    if (atx) {
      // Trim an optional closing run of #s: `## Title ##`
      const text = cleanHeadingText(atx[2].replace(/\s+#+\s*$/, ""))
      if (text) out.push({ level: atx[1].length, text })
      continue
    }

    // Setext: a non-empty line followed by a run of = (h1) or - (h2).
    const next = i + 1 < lines.length ? lines[i + 1] : ""
    if (line.trim() && /^\s{0,3}(=+|-+)\s*$/.test(next)) {
      // `---` after a blank-ish line is an hrule, and a `-` run following text is h2.
      const level = next.trim()[0] === "=" ? 1 : 2
      const text = cleanHeadingText(line)
      if (text) {
        out.push({ level, text })
        i++ // consume the underline
      }
    }
  }

  return out
}

/** Turn a filename into a human title: drop the extension, `-`/`_` become spaces. */
export function titleFromFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, "").replace(/\.[A-Za-z0-9]+$/, "")
  // Deliberately NOT Title Cased: "kubernetes-notes" -> "kubernetes notes" is honest,
  // capitalising it would be guessing at intent.
  return cleanHeadingText(base.replace(/[-_]+/g, " "))
}

/**
 * Title precedence: frontmatter `title` -> first H1 in the body -> filename -> UNTITLED.
 *
 * Only the first H1_SEARCH_LINES lines are searched: an H1 that appears 900 lines into a
 * document is a section heading, not the document's title.
 */
export function deriveTitle(opts: {
  frontmatterTitle?: string | string[] | null
  body: string
  filename?: string | null
}): string {
  const fm = Array.isArray(opts.frontmatterTitle)
    ? opts.frontmatterTitle[0]
    : opts.frontmatterTitle
  if (fm && String(fm).trim()) return cleanHeadingText(String(fm))

  const h1 = extractHeadings(opts.body, H1_SEARCH_LINES).find((h) => h.level === 1)
  if (h1) return h1.text

  if (opts.filename) {
    const fromName = titleFromFilename(opts.filename)
    if (fromName) return fromName
  }

  return UNTITLED
}
