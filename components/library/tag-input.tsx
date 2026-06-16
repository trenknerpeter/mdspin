"use client"

import { useState, type KeyboardEvent } from "react"
import { X } from "lucide-react"

function normalize(raw: string) {
  return raw.trim().replace(/^#/, "").replace(/\s+/g, "-").toLowerCase()
}

export function TagInput({
  value,
  onChange,
}: {
  value: string[]
  onChange: (tags: string[]) => void
}) {
  const [draft, setDraft] = useState("")

  const add = () => {
    const t = normalize(draft)
    setDraft("")
    if (!t || value.includes(t)) return
    onChange([...value, t])
  }

  const remove = (t: string) => onChange(value.filter((x) => x !== t))

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      add()
    } else if (e.key === "Backspace" && !draft && value.length) {
      remove(value[value.length - 1])
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#0E0E0E] p-2 focus-within:border-[#4A4A46]">
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-[#FF4800]/10 px-2 py-0.5 text-xs text-[#FF4800]"
        >
          #{t}
          <button
            type="button"
            onClick={() => remove(t)}
            className="text-[#FF4800]/70 hover:text-[#FF4800]"
            aria-label={`Remove ${t}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
        placeholder={value.length ? "" : "Add a tag…"}
        className="min-w-[80px] flex-1 bg-transparent text-sm text-[#F0EDE8] placeholder:text-[#4A4A46] focus:outline-none"
      />
    </div>
  )
}
