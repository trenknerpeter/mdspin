// supabase/functions/embed/index.ts
//
// Embeds text with the Edge Runtime's built-in gte-small model (384 dims) — free, no API
// key, runs next to the data (Stage 3 of the Cloud Knowledge Hub strategy). Called from
// lib/vault/embeddings.ts, authenticated with the service-role key as a Bearer token:
// verify_jwt stays ON (a service-role key IS a valid Supabase-signed JWT), so this file
// needs no custom auth logic.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const session = new Supabase.ai.Session("gte-small")
const MAX_BATCH = 100

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), { status: 405 })
  }

  let body: { texts?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", message: "Body must be JSON." }),
      { status: 400 }
    )
  }

  const texts = body.texts
  if (!Array.isArray(texts) || texts.length === 0 || !texts.every((t) => typeof t === "string")) {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", message: "texts must be a non-empty string array." }),
      { status: 400 }
    )
  }
  if (texts.length > MAX_BATCH) {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", message: `texts must have at most ${MAX_BATCH} items.` }),
      { status: 400 }
    )
  }

  const embeddings: number[][] = []
  for (const text of texts) {
    const output = await session.run(text, { mean_pool: true, normalize: true })
    embeddings.push(Array.from(output as Iterable<number>))
  }

  return new Response(JSON.stringify({ embeddings }), {
    headers: { "Content-Type": "application/json" },
  })
})
