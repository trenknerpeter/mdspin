// lib/roi.ts
//
// Pure ROI / token-savings math, shared by the marketing converter's
// "Conversion Impact" panel and the logged-in Dashboard "Insights" panel.
// Keeping this in one place means both surfaces show identical numbers and
// the assumptions (densities, pricing) live in a single, testable spot.

// Bytes-to-tokens density per source format — how "token-dense" each byte is.
// These are marketing-grade estimates, not backend-verified.
export const TEXT_DENSITY: Record<string, number> = {
  pdf: 0.35, docx: 0.45, doc: 0.30,
  txt: 0.90, rtf: 0.55, pages: 0.35,
}

// Fallback density for unknown formats.
export const DEFAULT_DENSITY = 0.40

// Standard LLM tokenization assumption: ~1.33 tokens per word of Markdown.
export const TOKENS_PER_WORD = 1.33

// Per-token price assumption (Claude input pricing ballpark): $0.000015/token.
export const PRICE_PER_TOKEN = 0.000015

// Estimated token count of the original (pre-conversion) file.
export function estimateOriginalTokens(sourceBytes: number, ext: string): number {
  const density = TEXT_DENSITY[ext.toLowerCase()] ?? DEFAULT_DENSITY
  return Math.round((sourceBytes * density) / 4)
}

// Estimated token count of the converted Markdown.
export function estimateMarkdownTokens(wordCount: number): number {
  return Math.round(wordCount * TOKENS_PER_WORD)
}

export interface Savings {
  reductionPct: number // clamped 5–90 when there's a positive original estimate, else 0
  monthlySavings: number // dollars saved per month at `monthlyCalls` reuse
}

// Token reduction % (clamped 5–90) and extrapolated monthly $ savings.
export function computeSavings({
  origTokens,
  mdTokens,
  monthlyCalls,
}: {
  origTokens: number
  mdTokens: number
  monthlyCalls: number
}): Savings {
  const reductionPct =
    origTokens > 0
      ? Math.min(90, Math.max(5, Math.round((1 - mdTokens / origTokens) * 100)))
      : 0
  const monthlySavings = (origTokens - mdTokens) * PRICE_PER_TOKEN * monthlyCalls
  return { reductionPct, monthlySavings }
}
