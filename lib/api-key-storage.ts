const HINTS_KEY = "apiKeyHints"

// Legacy store that held FULL plaintext `mdspin_` keys so the table could offer
// click-to-copy after the one-time reveal. That contradicted the reveal modal
// ("it will never be shown again") and left long-lived credentials in localStorage,
// where any XSS on the origin could read them. Removed — we now keep only the
// display hint. `purgeLegacyFullKeys()` clears whatever is already stored.
const LEGACY_FULL_KEY = "apiKeysFull"

export function formatKeyHint(key: string): string {
  if (key.length <= 12) return key
  return `${key.slice(0, 8)}...${key.slice(-4)}`
}

function readMap(storageKey: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeMap(storageKey: string, map: Record<string, string>) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(map))
  } catch {
    // private browsing or quota exceeded
  }
}

export function saveKeyHint(id: string, fullKey: string) {
  const map = readMap(HINTS_KEY)
  map[id] = formatKeyHint(fullKey)
  writeMap(HINTS_KEY, map)
}

export function getAllKeyHints(): Record<string, string> {
  return readMap(HINTS_KEY)
}

// One-shot cleanup for keys persisted by the previous version. Safe to call on
// every mount: removeItem on an absent key is a no-op.
export function purgeLegacyFullKeys() {
  try {
    localStorage.removeItem(LEGACY_FULL_KEY)
  } catch {
    // private browsing
  }
}

export function removeKeyData(id: string) {
  const hints = readMap(HINTS_KEY)
  delete hints[id]
  writeMap(HINTS_KEY, hints)
}
