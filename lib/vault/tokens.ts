// Cheap token-count heuristic — no tokenizer dependency. ~4 chars/token is the standard
// rule-of-thumb for English text; exactness doesn't matter here, only that chunk sizing
// (lib/vault/chunking.ts) stays in the right ballpark for gte-small's context window.
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}
