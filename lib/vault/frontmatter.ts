// Dependency-free YAML frontmatter splitter for markdown ingest.
//
// Why not gray-matter, which this repo already depends on: gray-matter does
// `const fs = require('fs')` at module top level and pulls js-yaml@3. That is fine for
// lib/blog.ts (server-only) but cannot be imported into a client component, and ingest
// parses files in the BROWSER so the review table can show derived titles/tags before
// anything is uploaded. This parser is isomorphic and used by both client and server so
// the two agree byte-for-byte.
//
// Deliberately restricted: scalars, quoted strings, flow lists (`[a, b]`), block lists
// (`- item`), and `#` comments. Anything fancier (anchors, block scalars, nested maps)
// is returned raw rather than guessed at — an import must never fail on YAML we don't
// understand.

export interface Frontmatter {
  /** Parsed keys we understood. Empty when the YAML could not be parsed. */
  data: Record<string, string | string[]>
  /** The raw YAML block, present whenever a fence existed. */
  raw: string | null
  /** Body with the frontmatter fence removed. */
  body: string
}

const FENCE = /^---[ \t]*\r?\n/

/**
 * Split leading `---` fenced YAML from a markdown document.
 *
 * The fence must start at the very first character — a `---` used as a horizontal rule
 * later in the document must not be mistaken for frontmatter, and an opening `---` with
 * no closing fence is treated as body (it's an hrule, not a truncated header).
 */
export function splitFrontmatter(input: string): Frontmatter {
  // Strip a UTF-8 BOM; editors add it and it would defeat the start-of-string match.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input

  const open = FENCE.exec(text)
  if (!open) return { data: {}, raw: null, body: text }

  const afterOpen = open[0].length
  // Find a line that is exactly `---` (or `...`, which YAML also accepts as a terminator).
  const close = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m
  const rest = text.slice(afterOpen)
  const m = close.exec(rest)
  if (!m) {
    // No closing fence: the opening `---` was an hrule. Treat everything as body.
    return { data: {}, raw: null, body: text }
  }

  const raw = rest.slice(0, m.index)
  const body = rest.slice(m.index + m[0].length)

  let data: Record<string, string | string[]> = {}
  try {
    data = parseSimpleYaml(raw)
  } catch {
    data = {}
  }

  return { data, raw, body }
}

function stripQuotes(v: string): string {
  const t = v.trim()
  if (t.length >= 2 && ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'")))) {
    return t.slice(1, -1)
  }
  return t
}

/** Drop an unquoted trailing `# comment`, leaving quoted `#` alone. */
function stripComment(v: string): string {
  let quote: string | null = null
  for (let i = 0; i < v.length; i++) {
    const ch = v[i]
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === "#" && (i === 0 || /\s/.test(v[i - 1]))) {
      return v.slice(0, i)
    }
  }
  return v
}

function parseFlowList(v: string): string[] {
  const inner = v.trim().slice(1, -1)
  if (!inner.trim()) return []
  return inner
    .split(",")
    .map((s) => stripQuotes(s))
    .filter((s) => s.length > 0)
}

/**
 * Parse the restricted YAML subset described at the top of this file.
 * Unknown shapes are kept as their raw string rather than dropped.
 */
export function parseSimpleYaml(yaml: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  const lines = yaml.split(/\r?\n/)

  let pendingKey: string | null = null
  let pendingList: string[] | null = null

  const flush = () => {
    if (pendingKey && pendingList) out[pendingKey] = pendingList
    pendingKey = null
    pendingList = null
  }

  for (const line of lines) {
    if (!line.trim()) continue
    // A whole-line comment.
    if (/^\s*#/.test(line)) continue

    // Block-list continuation: `  - value`
    const item = /^\s*-\s+(.*)$/.exec(line)
    if (item && pendingKey) {
      const val = stripQuotes(stripComment(item[1]))
      if (val) (pendingList ??= []).push(val)
      continue
    }

    const kv = /^([A-Za-z0-9_][A-Za-z0-9_.\- ]*):(.*)$/.exec(line)
    if (!kv) {
      // Something we don't model (nested map, block scalar, anchor). Stop trusting the
      // rest of the block but keep what we already understood.
      flush()
      continue
    }

    flush()
    const key = kv[1].trim()
    const rawValue = stripComment(kv[2]).trim()

    if (!rawValue) {
      // Either an empty value or the header of a block list; decided by the next line.
      pendingKey = key
      pendingList = null
      out[key] = ""
      continue
    }

    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      out[key] = parseFlowList(rawValue)
    } else {
      out[key] = stripQuotes(rawValue)
    }
  }

  flush()
  return out
}
