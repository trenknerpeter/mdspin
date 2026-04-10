"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

function OAuthConsentForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [consenting, setConsenting] = useState(false)
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [returnedFromGoogle, setReturnedFromGoogle] = useState(false)
  const searchParams = useSearchParams()
  const supabase = createClient()

  const clientId = searchParams.get("client_id")
  const redirectUri = searchParams.get("redirect_uri")
  const state = searchParams.get("state")

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://mdc-api-murex.vercel.app"

  // Validate required OAuth params
  useEffect(() => {
    if (!clientId || !redirectUri || !state) {
      setError("Invalid authorization request. Missing required parameters.")
    }
  }, [clientId, redirectUri, state])

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      // Check if returning from Google SSO (sessionStorage flag)
      const wasGoogleSSO = sessionStorage.getItem("oauth_google_sso")
      if (wasGoogleSSO) {
        sessionStorage.removeItem("oauth_google_sso")
        setReturnedFromGoogle(true)
      }

      if (session?.user?.email) {
        setLoggedInEmail(session.user.email)

        // Auto-consent only if returning from Google SSO redirect
        if (wasGoogleSSO && clientId && redirectUri && state) {
          await handleConsent()
        }
      }
      setCheckingSession(false)
    }
    checkSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Exchange Supabase session for an OAuth authorization code
  const handleConsent = async () => {
    setConsenting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError("Authentication succeeded but no session found. Please try again.")
        setConsenting(false)
        return
      }

      const res = await fetch(`${apiUrl}/oauth/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabase_access_token: session.access_token,
          client_id: clientId,
          redirect_uri: redirectUri,
          state,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || "Failed to authorize. Please try again.")
        setConsenting(false)
        return
      }

      // Redirect back to Make.com with the authorization code
      window.location.href = data.redirect_url
    } catch (err) {
      setError("Something went wrong. Please try again.")
      setConsenting(false)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      await handleConsent()
    }
  }

  const handleGoogleSignIn = async () => {
    // Set a flag so we know to auto-consent after the Google SSO callback
    sessionStorage.setItem("oauth_google_sso", "true")

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          `/auth/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri!)}&state=${state}`
        )}`,
        scopes: "https://www.googleapis.com/auth/documents.readonly https://www.googleapis.com/auth/drive.readonly",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setLoggedInEmail(null)
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center px-4">
        <p className="text-[#999] font-[family-name:var(--font-dm-sans)]">Loading...</p>
      </div>
    )
  }

  if (consenting) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-8 h-8 bg-[#FF4800] rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-sm font-[family-name:var(--font-syne)]">M</span>
          </div>
          <p className="text-[#F0EDE8] font-[family-name:var(--font-dm-sans)]">Connecting to Make.com...</p>
        </div>
      </div>
    )
  }

  // ── Already logged in: show consent screen ──
  if (loggedInEmail) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-[#FF4800] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm font-[family-name:var(--font-syne)]">M</span>
              </div>
              <span className="text-[#F0EDE8] font-bold text-xl font-[family-name:var(--font-syne)]">MDSpin</span>
            </div>
            <h1 className="text-2xl font-bold text-[#F0EDE8] font-[family-name:var(--font-syne)]">Authorize Make.com</h1>
            <p className="text-[#999] text-sm mt-1 font-[family-name:var(--font-dm-sans)]">
              Allow Make.com to access your MDSpin account
            </p>
          </div>

          <div className="mb-6 px-4 py-4 rounded-lg border border-[#2A2A2A] bg-[#141414]">
            <p className="text-[#F0EDE8] text-sm font-[family-name:var(--font-dm-sans)] mb-1">
              Signed in as
            </p>
            <p className="text-[#FF4800] text-sm font-medium font-[family-name:var(--font-dm-sans)]">
              {loggedInEmail}
            </p>
          </div>

          <div className="mb-6 px-4 py-3 rounded-lg border border-[#2A2A2A] bg-[#141414]">
            <p className="text-[#999] text-xs font-[family-name:var(--font-dm-sans)] mb-2">
              Make.com will be able to:
            </p>
            <ul className="text-[#999] text-xs font-[family-name:var(--font-dm-sans)] space-y-1">
              <li>- Convert Google Docs and Slides to Markdown</li>
              <li>- Convert uploaded files (PDF, DOCX) to Markdown</li>
              <li>- Save files to your Google Drive</li>
            </ul>
          </div>

          {error && (
            <p className="text-red-400 text-sm font-[family-name:var(--font-dm-sans)] mb-4">{error}</p>
          )}

          <button
            onClick={handleConsent}
            className="w-full py-2.5 rounded-lg bg-[#FF4800] text-white font-semibold text-sm hover:bg-[#E04000] transition-colors font-[family-name:var(--font-dm-sans)] mb-3"
          >
            Authorize
          </button>

          <button
            onClick={handleSignOut}
            className="w-full py-2.5 rounded-lg border border-[#2A2A2A] bg-transparent text-[#999] text-sm hover:bg-[#1A1A1A] transition-colors font-[family-name:var(--font-dm-sans)]"
          >
            Use a different account
          </button>
        </div>
      </div>
    )
  }

  // ── Not logged in: show login form ──
  return (
    <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-[#FF4800] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm font-[family-name:var(--font-syne)]">M</span>
            </div>
            <span className="text-[#F0EDE8] font-bold text-xl font-[family-name:var(--font-syne)]">MDSpin</span>
          </div>
          <h1 className="text-2xl font-bold text-[#F0EDE8] font-[family-name:var(--font-syne)]">Connect to Make.com</h1>
          <p className="text-[#999] text-sm mt-1 font-[family-name:var(--font-dm-sans)]">
            Sign in to authorize Make.com to access your MDSpin account
          </p>
        </div>

        <div className="mb-6 px-4 py-3 rounded-lg border border-[#2A2A2A] bg-[#141414]">
          <p className="text-[#999] text-xs font-[family-name:var(--font-dm-sans)]">
            Make.com will be able to convert documents and manage files on your behalf.
          </p>
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] text-[#F0EDE8] hover:bg-[#222] transition-colors font-[family-name:var(--font-dm-sans)] text-sm mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-[#2A2A2A]" />
          <span className="text-[#666] text-xs font-[family-name:var(--font-dm-sans)]">or</span>
          <div className="flex-1 h-px bg-[#2A2A2A]" />
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-[#999] mb-1.5 font-[family-name:var(--font-dm-sans)]">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-[#F0EDE8] placeholder-[#555] text-sm focus:outline-none focus:border-[#FF4800] transition-colors font-[family-name:var(--font-dm-sans)]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm text-[#999] mb-1.5 font-[family-name:var(--font-dm-sans)]">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-[#F0EDE8] placeholder-[#555] text-sm focus:outline-none focus:border-[#FF4800] transition-colors font-[family-name:var(--font-dm-sans)]"
              placeholder="Your password"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm font-[family-name:var(--font-dm-sans)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !clientId}
            className="w-full py-2.5 rounded-lg bg-[#FF4800] text-white font-semibold text-sm hover:bg-[#E04000] transition-colors disabled:opacity-50 font-[family-name:var(--font-dm-sans)]"
          >
            {loading ? "Signing in..." : "Sign in & Authorize"}
          </button>
        </form>

        <p className="text-center text-sm text-[#666] mt-6 font-[family-name:var(--font-dm-sans)]">
          Don&apos;t have an account?{" "}
          <Link
            href={`/auth/sign-up?next=${encodeURIComponent(
              `/auth/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri || "")}&state=${state}`
            )}`}
            className="text-[#FF4800] hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function OAuthConsentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center">
        <p className="text-[#999]">Loading...</p>
      </div>
    }>
      <OAuthConsentForm />
    </Suspense>
  )
}
