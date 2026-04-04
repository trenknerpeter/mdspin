"use client"

import { useState } from "react"

export function BuyCoffee() {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch("/api/checkout", { method: "POST" })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-full border border-[#2A2A2A] px-4 py-1.5 text-xs font-medium text-[#888480] transition-all hover:border-[#4A4A46] hover:text-[#F0EDE8] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <>
          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Redirecting…
        </>
      ) : (
        <>Buy coffee ☕</>
      )}
    </button>
  )
}
