import "server-only"

// GitHub App authentication: app-level JWTs and per-installation access tokens.
//
// Deliberately no @octokit/app or jsonwebtoken dependency — RS256 over a JWT this small
// is a handful of node:crypto calls, and pulling in a library for it would be the only
// new dependency this whole feature needs. node:crypto, not WebCrypto: GitHub issues
// PKCS#1 ("BEGIN RSA PRIVATE KEY") private keys, which node:crypto's createSign accepts
// directly but WebCrypto's importKey rejects outright. Every route that imports this
// file needs `export const runtime = "nodejs"` for that reason.
//
// "No tokens are stored" is the whole point of using a GitHub App over an OAuth App:
// installation access tokens are minted on demand from GITHUB_APP_PRIVATE_KEY, live one
// hour, and never touch the database — only the installation id (a non-secret, GitHub-
// controlled integer visible to anyone who can see the installation itself) does.

import { createSign } from "node:crypto"

const GITHUB_API = "https://api.github.com"
const JWT_TTL_SECONDS = 9 * 60 // GitHub allows up to 10 minutes; 9 leaves clock-skew room.
const INSTALLATION_TOKEN_TTL_MS = 55 * 60 * 1000 // GitHub's own tokens live 1h; refresh at 55m.

function base64url(input: Buffer | string): string {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/** Vercel env vars mangle PEM newlines into literal `\n` sequences; without this the
 *  key fails to parse with an opaque "error:0909006C" from OpenSSL. */
function normalizePrivateKey(raw: string): string {
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

/** Sign a short-lived app-level JWT (RS256), per GitHub's documented App auth flow. */
export function signAppJwt(now: number = Date.now()): string {
  const appId = requireEnv("GITHUB_APP_ID")
  const privateKey = normalizePrivateKey(requireEnv("GITHUB_APP_PRIVATE_KEY"))

  const iat = Math.floor(now / 1000) - 60 // backdate 60s for clock skew, mirrors GitHub's own docs
  const exp = iat + JWT_TTL_SECONDS
  const header = { alg: "RS256", typ: "JWT" }
  const payload = { iat, exp, iss: appId }

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKey)
  return `${signingInput}.${base64url(signature)}`
}

interface CachedToken {
  token: string
  expiresAtMs: number
}

// Module-scope cache, keyed by installation id. A warm Lambda reuses this across
// invocations and skips both the JWT signing and the token-mint round trip most of the
// time — the cache is memory-only by design, so a cold start just re-mints, never a
// correctness issue.
const installationTokenCache = new Map<string, CachedToken>()

/** Mint (or reuse a cached) installation access token. Rate limits are a non-issue:
 *  installation tokens allow 5,000 req/hr per installation, and a typical sync touches
 *  a handful of files. */
export async function getInstallationToken(installationId: string): Promise<string> {
  const cached = installationTokenCache.get(installationId)
  if (cached && cached.expiresAtMs > Date.now()) return cached.token

  const jwt = signAppJwt()
  const res = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  })
  if (!res.ok) {
    throw new Error(`Failed to mint installation token (${res.status}): ${await res.text()}`)
  }
  const data = (await res.json()) as { token: string }
  installationTokenCache.set(installationId, {
    token: data.token,
    expiresAtMs: Date.now() + INSTALLATION_TOKEN_TTL_MS,
  })
  return data.token
}

// Webhook signature verification lives in ./webhook-signature.ts, deliberately outside
// this file's server-only boundary — see that file's header comment for why.

// ---------------------------------------------------------------------------
// User-identity leg — used ONLY at connect time, to prove the signed-in MDSpin user
// actually controls the installation_id they're claiming. The token this produces is
// used once (to call /user/installations) and then discarded; it is never persisted.
// Without this step, `?installation_id=` in the OAuth callback is an unverified,
// attacker-suppliable query parameter, and since tokens are minted from the APP's key
// (not the user's), a forged id would read someone else's private repos straight into
// the attacker's vault.
// ---------------------------------------------------------------------------

export async function exchangeCodeForUserToken(code: string): Promise<string> {
  const clientId = requireEnv("GITHUB_APP_CLIENT_ID")
  const clientSecret = requireEnv("GITHUB_APP_CLIENT_SECRET")

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  })
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string }
  if (!data.access_token) {
    throw new Error(`GitHub OAuth exchange failed: ${data.error_description ?? data.error ?? "unknown error"}`)
  }
  return data.access_token
}

/** The installation ids a user access token can see — i.e. installations that user is
 *  actually a member/admin of. Discard the token immediately after this call. */
export async function listUserInstallationIds(userAccessToken: string): Promise<Set<string>> {
  const ids = new Set<string>()
  let url: string | null = `${GITHUB_API}/user/installations?per_page=100`
  while (url) {
    const res: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    })
    if (!res.ok) throw new Error(`Failed to list user installations (${res.status}).`)
    const data = (await res.json()) as { installations: Array<{ id: number }> }
    for (const inst of data.installations) ids.add(String(inst.id))

    // GitHub paginates via a Link header, not a body cursor.
    const link = res.headers.get("link")
    const next = link?.split(",").find((part) => part.includes('rel="next"'))
    const match = next?.match(/<([^>]+)>/)
    url = match ? match[1] : null
  }
  return ids
}
