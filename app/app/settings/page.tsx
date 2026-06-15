"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import {
  listPresets,
  createPreset,
  deletePreset,
  PRESET_OPTION_FIELDS,
  DEFAULT_OPTIONS,
  type Preset,
  type PresetOptions,
} from "@/lib/presets"

export default function SettingsPage() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [name, setName] = useState("")
  const [options, setOptions] = useState<PresetOptions>({ ...DEFAULT_OPTIONS })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = () => listPresets().then(setPresets).catch(console.error)

  useEffect(() => {
    reload()
  }, [])

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setError(null)
    setSaving(true)
    try {
      await createPreset(trimmed, options)
      setName("")
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preset.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setError(null)
    setDeleting(id)
    try {
      await deletePreset(id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete preset.")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#F0EDE8] font-[family-name:var(--font-syne)]">Settings</h1>
        <p className="text-sm text-[#888480] font-[family-name:var(--font-dm-sans)]">
          Conversion presets (spin profiles)
        </p>
      </div>

      <p className="mb-6 rounded-lg border border-[#1E1E1E] bg-[#161616] px-4 py-3 text-xs text-[#888480] font-[family-name:var(--font-dm-sans)]">
        Presets save and are sent with every conversion now; their effect on output activates once the backend honors options.
      </p>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 font-[family-name:var(--font-dm-sans)]">
          {error}
        </div>
      )}

      {/* Existing presets */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-[#F0EDE8] font-[family-name:var(--font-syne)]">
          Your presets
        </h2>
        {presets.length === 0 ? (
          <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-8 text-center">
            <p className="text-sm text-[#888480] font-[family-name:var(--font-dm-sans)]">
              No presets yet. Create one below.
            </p>
          </div>
        ) : (
          <ul className="rounded-xl border border-[#2A2A2A] overflow-hidden bg-[#0C0C0C]">
            {presets.map((p, i) => (
              <li
                key={p.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  i !== presets.length - 1 ? "border-b border-[#1E1E1E]" : ""
                } hover:bg-[#161616] transition-colors`}
              >
                <span className="text-sm text-[#F0EDE8] font-[family-name:var(--font-dm-sans)]">
                  {p.name}
                  {p.is_default && (
                    <span className="ml-2 text-xs text-[#FF4800]">(default)</span>
                  )}
                </span>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={deleting === p.id}
                  className="flex items-center gap-1.5 rounded-md border border-[#2A2A2A] px-2.5 py-1 text-xs text-[#888480] hover:border-red-500/40 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create preset */}
      <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-5">
        <h2 className="mb-4 text-sm font-semibold text-[#F0EDE8] font-[family-name:var(--font-syne)]">
          Create preset
        </h2>

        <label className="mb-1.5 block text-xs text-[#888480] font-[family-name:var(--font-dm-sans)]">
          Name
        </label>
        <input
          type="text"
          placeholder="e.g. Clean docs"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] px-3 py-2 text-sm text-[#F0EDE8] placeholder-[#4A4A46] focus:border-[#FF4800] focus:outline-none transition-colors font-[family-name:var(--font-dm-sans)]"
        />

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PRESET_OPTION_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="mb-1.5 block text-xs text-[#888480] font-[family-name:var(--font-dm-sans)]">
                {field.label}
              </label>
              <select
                value={options[field.key]}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                className="w-full rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] px-3 py-2 text-sm text-[#F0EDE8] focus:border-[#FF4800] focus:outline-none transition-colors font-[family-name:var(--font-dm-sans)]"
              >
                {field.values.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="flex items-center gap-2 rounded-full bg-[#FF4800] px-5 py-2 text-sm font-semibold text-white hover:bg-[#e04200] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save preset"}
        </button>
      </div>
    </div>
  )
}
