"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    })
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-12 h-12 bg-[#FF4800]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#FF4800]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#F0EDE8] font-[family-name:var(--font-syne)] mb-2">Check your email</h1>
          <p className="text-[#999] text-sm font-[family-name:var(--font-dm-sans)] mb-6">
            We sent a confirmation link to <span className="text-[#F0EDE8]">{email}</span>. Click the link to activate your account.
          </p>
          <Link href="/" className="text-[#FF4800] text-sm hover:underline font-[family-name:var(--font-dm-sans)]">
            Back to MDSpin
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-[#FF4800] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm font-[family-name:var(--font-syne)]">M</span>
            </div>
            <span className="text-[#F0EDE8] font-bold text-xl font-[family-name:var(--font-syne)]">MDSpin</span>
          </Link>
          <h1 className="text-2xl font-bold text-[#F0EDE8] font-[family-name:var(--font-syne)]">Create your account</h1>
          <p className="text-[#999] text-sm mt-1 font-[family-name:var(--font-dm-sans)]">Sign up to save your conversion history</p>
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

        <form onSubmit={handleSignUp} className="space-y-4">
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
              minLength={6}
              className="w-full px-3 py-2.5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-[#F0EDE8] placeholder-[#555] text-sm focus:outline-none focus:border-[#FF4800] transition-colors font-[family-name:var(--font-dm-sans)]"
              placeholder="At least 6 characters"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm font-[family-name:var(--font-dm-sans)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#FF4800] text-white font-semibold text-sm hover:bg-[#E04000] transition-colors disabled:opacity-50 font-[family-name:var(--font-dm-sans)]"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-[#666] mt-6 font-[family-name:var(--font-dm-sans)]">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="text-[#FF4800] hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
