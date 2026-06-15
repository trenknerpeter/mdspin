"use client"

import { useEffect, useState } from "react"
import { Converter } from "@/components/converter/converter"
import { listPresets, type Preset } from "@/lib/presets"

export default function AppConvertPage() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    listPresets()
      .then((ps) => {
        setPresets(ps)
        setActiveId((ps.find((p) => p.is_default) ?? ps[0])?.id ?? null)
      })
      .catch(console.error)
  }, [])

  const active = presets.find((p) => p.id === activeId)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#F0EDE8]">Convert</h1>
        {presets.length > 0 && (
          <select
            value={activeId ?? ""}
            onChange={(e) => setActiveId(e.target.value)}
            className="rounded-lg border border-[#2A2A2A] bg-[#161616] px-3 py-1.5 text-sm text-[#F0EDE8]"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <Converter context="app" options={active?.options} />
    </div>
  )
}
