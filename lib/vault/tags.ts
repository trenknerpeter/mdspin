// Tag normalisation, shared by the tag input, frontmatter parsing and folder mapping.
//
// The rule set is lifted verbatim from components/library/tag-input.tsx so that a tag
// typed by hand and a tag derived from an Obsidian file land on the same string. If
// these ever diverge, the vault gets "Client-Work" and "client-work" as separate facets.

/** Trim, drop a leading `#`, spaces become dashes, lowercase. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#/, "").replace(/\s+/g, "-").toLowerCase()
}

/** Normalise, drop empties, de-duplicate, preserving first-seen order. */
export function normalizeTags(raw: Iterable<string>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of raw) {
    const t = normalizeTag(r)
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/**
 * Read tags out of a frontmatter value.
 *
 * Obsidian writes all three of these, so all three are accepted:
 *   tags: [a, b]      -> array
 *   tags: a, b        -> comma-separated string
 *   tags: a b         -> space-separated string
 */
export function tagsFromFrontmatter(value: string | string[] | undefined | null): string[] {
  if (!value) return []
  if (Array.isArray(value)) return normalizeTags(value)
  // A comma anywhere means comma-separated; otherwise split on whitespace.
  const parts = value.includes(",") ? value.split(",") : value.split(/\s+/)
  return normalizeTags(parts)
}
