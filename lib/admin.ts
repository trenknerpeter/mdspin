/**
 * Admin access for the internal metrics page.
 *
 * Deliberately an env var rather than a database flag: there is exactly one
 * admin, the page is read-only, and a missing/empty var must fail closed so a
 * misconfigured deploy cannot expose cross-user data.
 *
 * Not marked "server-only" so this gate can be unit-tested under plain
 * `vitest run` — see the same note in lib/mcp/context.ts. It is only imported
 * from a server component.
 */
export function isAdminUser(userId: string | undefined | null): boolean {
  if (!userId) return false
  const ids = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  return ids.includes(userId)
}
