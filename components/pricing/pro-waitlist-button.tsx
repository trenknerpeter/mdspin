"use client"

import { useState } from "react"
import { useAuth } from "@/components/auth-provider"

// Client island on the (server-rendered) pricing page. Signed in: one click,
// joins with the account email. Signed out: asks for an email first.
export function ProWaitlistButton() {
  const { user } = useAuth()
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)

  const join = async () => {
    setState("saving")
    setMessage(null)
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user ? {} : { email }),
      })
      if (res.ok) { setState("done"); return }
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      setMessage(data.message ?? "Something went wrong. Try again.")
      setState("error")
    } catch {
      setMessage("Network error. Try again.")
      setState("error")
    }
  }

  if (state === "done") {
    return <p className="text-center text-sm text-[#F0EDE8]">You’re on the list — we’ll email you once, when Pro is ready.</p>
  }

  return (
    <div className="space-y-2">
      {!user && (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-full border border-[#2A2A2A] bg-[#0C0C0C] px-4 py-2.5 text-sm text-[#F0EDE8] placeholder:text-[#4A4A46] focus:border-[#FF4800] focus:outline-none"
        />
      )}
      <button
        type="button"
        onClick={join}
        disabled={state === "saving" || (!user && email.trim() === "")}
        className="flex w-full items-center justify-center rounded-full border border-[#FF4800] px-6 py-2.5 text-sm font-semibold text-[#FF4800] transition-all hover:bg-[#FF4800] hover:text-white disabled:opacity-50"
      >
        {state === "saving" ? "Adding you…" : "Notify me"}
      </button>
      {message && <p className="text-center text-xs text-red-400">{message}</p>}
    </div>
  )
}
