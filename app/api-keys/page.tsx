"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Key, Plus, Copy, Check, Trash2, X, AlertCircle } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
import {
  saveKeyHint,
  saveFullKey,
  getAllKeyHints,
  getAllFullKeys,
  removeKeyData,
  formatKeyHint,
} from "@/lib/api-key-storage"

type ApiKey = {
  id: string
  name: string | null
  created_at: string
  last_used_at: string | null
  revoked: boolean
}

type NewKeyModal = {
  key: string
  copied: boolean
}

function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export default function ApiKeysPage() {
  const { user, isLoading: authLoading } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState("")
  const [newKeyModal, setNewKeyModal] = useState<NewKeyModal | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)
  const [keyHints, setKeyHints] = useState<Record<string, string>>({})
  const [fullKeys, setFullKeys] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  const fetchKeys = async () => {
    const token = await getToken()
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch("/api/api-keys", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        const list = Array.isArray(data) ? data : Array.isArray(data?.keys) ? data.keys : []
        setKeys(list)
        setFetchError(null)
      } else {
        setFetchError(data?.message ?? "Failed to load API keys.")
      }
    } catch {
      setFetchError("Network error — could not load API keys.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setKeyHints(getAllKeyHints())
    setFullKeys(getAllFullKeys())
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    fetchKeys()
  }, [user, authLoading])

  const handleGenerate = async () => {
    setGenerateError(null)
    setGenerating(true)
    const token = await getToken()
    if (!token) { setGenerating(false); return }
    try {
      const name = nameInput.trim().slice(0, 100) || null
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewKeyModal({ key: data.key, copied: false })
        setNameInput("")
        await fetchKeys()
        if (data.id && data.key) {
          saveKeyHint(data.id, data.key)
          saveFullKey(data.id, data.key)
          setKeyHints((prev) => ({ ...prev, [data.id]: formatKeyHint(data.key) }))
          setFullKeys((prev) => ({ ...prev, [data.id]: data.key }))
        }
      } else {
        setGenerateError(data?.message ?? "Failed to generate key.")
      }
    } catch {
      setGenerateError("Network error — could not generate key.")
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyKey = async () => {
    if (!newKeyModal) return
    await navigator.clipboard.writeText(newKeyModal.key)
    setNewKeyModal((prev) => prev ? { ...prev, copied: true } : null)
  }

  const handleCopyInline = async (id: string, key: string) => {
    await navigator.clipboard.writeText(key)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRevokeConfirm = (id: string) => {
    setConfirmRevoke(id)
  }

  const handleRevokeCancel = () => {
    setConfirmRevoke(null)
  }

  const handleRevoke = async (id: string) => {
    setConfirmRevoke(null)
    setRevoking(id)
    const token = await getToken()
    if (!token) { setRevoking(null); return }
    try {
      const res = await fetch(`/api/api-keys/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setKeys((prev) => prev.map((k) => k.id === id ? { ...k, revoked: true } : k))
        removeKeyData(id)
        setKeyHints((prev) => { const next = { ...prev }; delete next[id]; return next })
        setFullKeys((prev) => { const next = { ...prev }; delete next[id]; return next })
      }
    } catch {
      // network error — button unfreezes via finally
    } finally {
      setRevoking(null)
    }
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never"
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center">
        <Spinner className="h-6 w-6 text-[#FF4800]" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#F0EDE8] font-[family-name:var(--font-syne)] mb-2">
            Sign in to manage API keys
          </h1>
          <p className="text-[#888480] text-sm mb-6 font-[family-name:var(--font-dm-sans)]">
            Create an account to generate API keys for programmatic access.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/auth/sign-in"
              className="rounded-full bg-[#FF4800] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#e04200] transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/"
              className="rounded-full border border-[#2A2A2A] px-6 py-2.5 text-sm text-[#888480] hover:text-[#F0EDE8] hover:border-[#4A4A46] transition-colors"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const activeKeys = keys.filter((k) => !k.revoked)
  const revokedKeys = keys.filter((k) => k.revoked)

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-[#F0EDE8]">
      {/* One-time key modal */}
      {newKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-[#2A2A2A] bg-[#161616] p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold font-[family-name:var(--font-syne)]">Your new API key</h2>
                <p className="text-xs text-[#888480] mt-1 font-[family-name:var(--font-dm-sans)]">
                  Copy this key now — it will never be shown again.
                </p>
              </div>
              <button
                onClick={() => setNewKeyModal(null)}
                className="text-[#4A4A46] hover:text-[#F0EDE8] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] p-3 mb-4">
              <code className="flex-1 text-xs text-[#FF4800] font-mono break-all leading-relaxed">
                {newKeyModal.key}
              </code>
              <button
                onClick={handleCopyKey}
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md border border-[#2A2A2A] text-[#4A4A46] hover:border-[#4A4A46] hover:text-[#F0EDE8] transition-colors"
                title="Copy key"
              >
                {newKeyModal.copied ? (
                  <Check className="h-3.5 w-3.5 text-[#FF4800]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <button
              onClick={() => setNewKeyModal(null)}
              className="w-full rounded-full bg-[#FF4800] py-2.5 text-sm font-semibold text-white hover:bg-[#e04200] transition-colors"
            >
              I&apos;ve saved this key
            </button>
          </div>
        </div>
      )}

      {/* Revoke confirmation modal */}
      {confirmRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#2A2A2A] bg-[#161616] p-6 shadow-2xl">
            <h2 className="text-base font-bold font-[family-name:var(--font-syne)] mb-2">Revoke this key?</h2>
            <p className="text-sm text-[#888480] font-[family-name:var(--font-dm-sans)] mb-6">
              This is permanent. Any integrations using this key will stop working immediately.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleRevokeCancel}
                className="flex-1 rounded-full border border-[#2A2A2A] py-2 text-sm text-[#888480] hover:text-[#F0EDE8] hover:border-[#4A4A46] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(confirmRevoke)}
                className="flex-1 rounded-full bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2A2A2A] text-[#888480] hover:text-[#F0EDE8] hover:border-[#4A4A46] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-syne)]">API Keys</h1>
            <p className="text-sm text-[#888480] font-[family-name:var(--font-dm-sans)]">
              {activeKeys.length} active key{activeKeys.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Fetch error banner */}
        {fetchError && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 font-[family-name:var(--font-dm-sans)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {fetchError}
          </div>
        )}

        {/* Generate new key */}
        <div className="mb-8 rounded-xl border border-[#2A2A2A] bg-[#161616] p-5">
          <h2 className="text-sm font-semibold mb-3 font-[family-name:var(--font-syne)]">Generate new key</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Key name (optional)"
              value={nameInput}
              maxLength={100}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleGenerate() }}
              className="flex-1 rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] px-3 py-2 text-sm text-[#F0EDE8] placeholder-[#4A4A46] focus:border-[#FF4800] focus:outline-none transition-colors font-[family-name:var(--font-dm-sans)]"
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 rounded-full bg-[#FF4800] px-5 py-2 text-sm font-semibold text-white hover:bg-[#e04200] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? <Spinner /> : <Plus className="h-3.5 w-3.5" />}
              Generate
            </button>
          </div>
          {generateError && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400 font-[family-name:var(--font-dm-sans)]">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {generateError}
            </p>
          )}
        </div>

        {/* Active keys table */}
        {activeKeys.length === 0 ? (
          <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-12 text-center">
            <Key className="mx-auto h-8 w-8 text-[#4A4A46] mb-3" />
            <p className="text-sm text-[#888480] font-[family-name:var(--font-dm-sans)]">
              No active API keys. Generate one above to get started.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#2A2A2A] overflow-hidden">
            <table className="w-full text-sm font-[family-name:var(--font-dm-sans)]">
              <thead>
                <tr className="border-b border-[#2A2A2A] bg-[#161616]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#4A4A46] uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#4A4A46] uppercase tracking-wide">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#4A4A46] uppercase tracking-wide">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#4A4A46] uppercase tracking-wide">Last used</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="bg-[#0C0C0C]">
                {activeKeys.map((k, i) => {
                  const hint = keyHints[k.id]
                  const fullKey = fullKeys[k.id]
                  const isLast = i === activeKeys.length - 1
                  return (
                    <tr key={k.id} className={`${!isLast ? "border-b border-[#1E1E1E]" : ""} hover:bg-[#161616] transition-colors`}>
                        <td className="px-4 py-3 text-[#F0EDE8]">
                          {k.name ?? <span className="text-[#4A4A46] italic">Unnamed</span>}
                        </td>
                        <td className="px-4 py-3">
                          {hint ? (
                            <button
                              onClick={fullKey ? () => handleCopyInline(k.id, fullKey) : undefined}
                              className={`inline-flex items-center gap-1.5 font-mono text-xs rounded-md px-2 py-1 transition-colors ${
                                fullKey
                                  ? "text-[#F0EDE8] bg-[#1E1E1E] hover:bg-[#2A2A2A] cursor-pointer"
                                  : "text-[#4A4A46] bg-[#141414] cursor-default"
                              }`}
                              title={fullKey ? "Click to copy" : "Full key not available"}
                            >
                              {hint}
                              {copiedId === k.id ? (
                                <Check className="h-3 w-3 text-[#FF4800]" />
                              ) : (
                                <Copy className="h-3 w-3 opacity-40" />
                              )}
                            </button>
                          ) : (
                            <span className="font-mono text-xs text-[#4A4A46] px-2 py-1">
                              ••••••••••••
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#888480]">{formatDate(k.created_at)}</td>
                        <td className="px-4 py-3 text-[#888480]">{formatDate(k.last_used_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRevokeConfirm(k.id)}
                            disabled={revoking === k.id}
                            className="flex items-center gap-1.5 ml-auto rounded-md border border-[#2A2A2A] px-2.5 py-1 text-xs text-[#888480] hover:border-red-500/40 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Revoke key"
                          >
                            {revoking === k.id ? <Spinner className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
                            Revoke
                          </button>
                        </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Revoked keys count */}
        {revokedKeys.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-[#4A4A46] font-[family-name:var(--font-dm-sans)]">
              {revokedKeys.length} revoked key{revokedKeys.length !== 1 ? "s" : ""} not shown
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
