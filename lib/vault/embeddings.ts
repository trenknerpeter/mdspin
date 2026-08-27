// Client for the "embed" Supabase Edge Function (gte-small, 384 dims) that backs Stage
// 3's hybrid search. Every call degrades to `null` on ANY failure (missing config,
// network error, non-2xx, malformed response) rather than throwing — search must never
// break because embedding infrastructure hiccuped; it just falls back to keyword-only
// ranking, which is exactly what a null p_query_embedding already means to
// vault_search_documents (see the Task 10 migration).
//
// Not marked "server-only": lib/vault/repo.ts (this file's only caller) is deliberately
// client-importable too (Stage 2a), and its browserVault() export is unused today but
// exists for a future browser path. If that path is ever wired up,
// SUPABASE_SERVICE_ROLE_KEY simply won't be defined in the client bundle (Next strips
// non-NEXT_PUBLIC_ env vars from client code), so this degrades to the same null-fallback
// as any other misconfiguration — never a leak.

const EMBED_TIMEOUT_MS = 3_000
const MAX_BATCH = 100

function embedFunctionUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return base ? `${base}/functions/v1/embed` : null
}

async function callEmbedFunction(texts: string[]): Promise<number[][] | null> {
  const url = embedFunctionUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || texts.length === 0) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ texts }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { embeddings?: unknown }
    if (!Array.isArray(data.embeddings)) return null
    return data.embeddings as number[][]
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** Embed up to MAX_BATCH texts in one call. Returns null on any runtime failure (see file
 *  header); throws only when the CALLER passes more texts than one call supports — that's
 *  a caller bug (see lib/vault/limits.ts's EMBED_REQUEST_BATCH, which keeps every real
 *  caller under this limit), not a runtime condition to swallow. */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (texts.length > MAX_BATCH) {
    throw new RangeError(`embedTexts: ${texts.length} exceeds the ${MAX_BATCH} batch limit.`)
  }
  return callEmbedFunction(texts)
}

/** Convenience for the hot search path: embed one query string, or null on failure. */
export async function embedQueryOrNull(query: string): Promise<number[] | null> {
  const result = await embedTexts([query])
  return result?.[0] ?? null
}
