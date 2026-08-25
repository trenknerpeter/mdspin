import "server-only"

// Resolves an incoming request to a VaultScope + the Supabase client to run it through.
// Header first, cookie second: an explicit bearer token is a deliberate act by the
// caller, a session cookie is ambient on our own origin — see the Cloud Knowledge Hub
// strategy doc's "dual auth" section for the reasoning behind that ordering.
//
// Every branch below is a documented Trap in that doc: calling an RLS-only RPC through
// the service-role client returns zero rows with NO error (Trap 3), and this file's
// entire job is making sure that trap never has a chance to fire — the service-role path
// gets an EXPLICIT userId, never relies on `auth.uid()`.

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"
import { createClient as createServerCookieClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseAuthHeader } from "./api-key"
import { hashApiKey } from "./api-key"
import { VaultError } from "./errors"
import type { VaultScope } from "./types"

export interface AuthResult {
  scope: VaultScope
  client: SupabaseClient
  /** The api_keys row id, set only when auth resolved via an API key — lets a caller
   *  (see server.ts, PATCH /documents/:id) attribute a write to the specific key used,
   *  not just the account. Undefined on the JWT and cookie paths, which have no key row. */
  keyId?: string
}

/** Minimal request shape this needs — just enough to read one header, so this works
 *  against a NextRequest without importing next/server here. */
export interface AuthenticatableRequest {
  headers: { get(name: string): string | null }
}

async function authenticateApiKey(token: string): Promise<AuthResult> {
  const admin = createAdminClient()
  if (!admin) {
    // Fail closed and loudly, per the strategy doc's explicit rejection of
    // lib/rate-limit.ts's fail-open pattern for this layer — a misconfigured server
    // must refuse API-key requests, not silently treat them as unauthenticated.
    throw new VaultError("NOT_CONFIGURED", "API key auth is not configured on this server.")
  }

  const keyHash = await hashApiKey(token)
  const { data, error } = await admin
    .from("api_keys")
    .select("id, user_id")
    .eq("key_hash", keyHash)
    .eq("revoked", false)
    .maybeSingle()

  if (error) throw new VaultError("DB_ERROR", error.message)
  if (!data) {
    // Deliberately the SAME error for "no such key" and "key exists but revoked" — the
    // .eq("revoked", false) above makes both cases produce no row. Per the strategy doc:
    // never let a client distinguish "unknown key" from "revoked key" (an existence
    // oracle); that distinction, if ever needed, belongs in server-side logs, not here.
    throw new VaultError("AUTH_REQUIRED", "Invalid or revoked API key.")
  }

  // Fire-and-forget: a slow or failed touch of last_used_at must never fail the request
  // it's only bookkeeping for. Swallow, don't await.
  void admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id)

  return {
    scope: { enforce: "explicit", userId: data.user_id as string },
    client: admin,
    keyId: data.id as string,
  }
}

async function authenticateJwt(token: string): Promise<AuthResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new VaultError("NOT_CONFIGURED", "Supabase is not configured on this server.")
  }

  // One client serves both purposes: attaching the token as the Authorization header is
  // what makes every later PostgREST call from THIS client RLS-scoped as that user, and
  // calling .auth.getUser(token) on it verifies the token against the auth server rather
  // than trusting a client-decoded JWT.
  const client = createSupabaseClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) {
    throw new VaultError("AUTH_REQUIRED", "Invalid or expired token.")
  }
  return { scope: { enforce: "rls", userId: data.user.id }, client }
}

async function authenticateCookie(): Promise<AuthResult> {
  const client = await createServerCookieClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) {
    throw new VaultError("AUTH_REQUIRED", "Sign in first.")
  }
  return { scope: { enforce: "rls", userId: data.user.id }, client }
}

export async function authenticateRequest(req: AuthenticatableRequest): Promise<AuthResult> {
  const parsed = parseAuthHeader(req.headers.get("authorization"))

  switch (parsed.kind) {
    case "api_key":
      return authenticateApiKey(parsed.token!)
    case "jwt":
      return authenticateJwt(parsed.token!)
    case "absent":
      return authenticateCookie()
    case "malformed":
      // A header was present but not `Bearer <token>` — a caller that tried and got the
      // scheme wrong should fail loudly, not silently fall back to a cookie session.
      throw new VaultError("AUTH_REQUIRED", "Authorization header must be `Bearer <token>`.")
  }
}
