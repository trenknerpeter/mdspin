// Batching for the commit phase of a folder import.
//
// Chunking by SIZE and not just count is the load-bearing detail: Vercel rejects
// route-handler request bodies over 4.5 MB before the handler even runs, and 25 markdown
// files can be anywhere from 20 KB to 20 MB.

export interface ChunkOptions<T> {
  maxCount: number
  maxBytes: number
  /** Byte size of one item. Defaults to the UTF-8 length of its JSON encoding. */
  sizeOf?: (item: T) => number
}

function defaultSizeOf(item: unknown): number {
  // TextEncoder gives real UTF-8 byte length; string .length would undercount
  // non-ASCII content and let a chunk exceed the limit.
  return new TextEncoder().encode(JSON.stringify(item)).length
}

/**
 * Split items into chunks bounded by both count and total byte size.
 *
 * A single item larger than maxBytes gets a chunk to itself rather than being dropped or
 * causing an infinite loop — the server will reject it with a clear per-item error, which
 * is far better than the import silently missing a file.
 */
export function chunkBySize<T>(items: T[], opts: ChunkOptions<T>): T[][] {
  const sizeOf = opts.sizeOf ?? defaultSizeOf
  const maxCount = Math.max(1, opts.maxCount)
  const maxBytes = Math.max(1, opts.maxBytes)

  const chunks: T[][] = []
  let current: T[] = []
  let currentBytes = 0

  for (const item of items) {
    const size = sizeOf(item)

    // Oversize item: flush whatever is pending, then give it its own chunk.
    if (size > maxBytes) {
      if (current.length) {
        chunks.push(current)
        current = []
        currentBytes = 0
      }
      chunks.push([item])
      continue
    }

    const wouldExceed = current.length >= maxCount || currentBytes + size > maxBytes
    if (wouldExceed && current.length) {
      chunks.push(current)
      current = []
      currentBytes = 0
    }

    current.push(item)
    currentBytes += size
  }

  if (current.length) chunks.push(current)
  return chunks
}
