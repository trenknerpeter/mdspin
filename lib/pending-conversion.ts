// Carries a signed-out user's original file across the sign-in round trip.
//
// Guests only ever receive a preview (lib/preview.ts), so there is no full
// result to stash. Instead we keep the File itself in IndexedDB (localStorage
// cannot hold binary) and re-convert it once the user is signed in. Nothing is
// stored server-side for guests. One slot: a newer stash replaces an older one.

export type PendingAction = "copy" | "download" | "vault" | "view" | "limit"

export interface PendingConversion {
  file: File
  action: PendingAction
  createdAt: number
}

export const PENDING_TTL_MS = 60 * 60 * 1000

const DB_NAME = "mdspin"
const STORE = "pending"
const KEY = "conversion"

export function isPendingFresh(createdAt: number, now: number = Date.now()): boolean {
  const age = now - createdAt
  return age >= 0 && age <= PENDING_TTL_MS
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        t.oncomplete = () => { db.close(); resolve(req.result) }
        t.onerror = () => { db.close(); reject(t.error) }
      })
  )
}

export async function savePendingConversion(p: PendingConversion): Promise<boolean> {
  try {
    await tx("readwrite", (s) => s.put(p, KEY))
    return true
  } catch {
    return false
  }
}

export async function takePendingConversion(): Promise<PendingConversion | null> {
  try {
    const p = await tx<PendingConversion | undefined>("readonly", (s) => s.get(KEY))
    if (!p) return null
    await tx("readwrite", (s) => s.delete(KEY))
    return p.file instanceof Blob && isPendingFresh(p.createdAt) ? p : null
  } catch {
    return null
  }
}
