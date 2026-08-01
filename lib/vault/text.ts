// Shared word counting. Four copies of `split(/\s+/).filter(Boolean).length` existed
// across use-converter.ts and the vault code; this is the one definition. Matching that
// tokenizer exactly matters — word_count is already stored for 221 rows and the
// dashboard sums it, so a different count would make new rows incomparable to old ones.

export function countWords(text: string | null | undefined): number {
  if (!text) return 0
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}
