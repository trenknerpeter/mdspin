const HINTS_KEY = "apiKeyHints"
const FULL_KEY = "apiKeysFull"

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

export function saveFullKey(id: string, fullKey: string) {
  const map = readMap(FULL_KEY)
  map[id] = fullKey
  writeMap(FULL_KEY, map)
}

export function getFullKey(id: string): string | null {
  return readMap(FULL_KEY)[id] ?? null
}

export function getAllFullKeys(): Record<string, string> {
  return readMap(FULL_KEY)
}

export function removeKeyData(id: string) {
  const hints = readMap(HINTS_KEY)
  delete hints[id]
  writeMap(HINTS_KEY, hints)

  const full = readMap(FULL_KEY)
  delete full[id]
  writeMap(FULL_KEY, full)
}
