import { createClient } from "@/lib/supabase/client"

export const PRESET_OPTION_FIELDS = [
  { key: "frontmatter", label: "Front matter", values: ["none", "basic", "full"] },
  { key: "images", label: "Images", values: ["inline", "link", "strip"] },
  { key: "headings", label: "Headings", values: ["preserve", "normalize"] },
  { key: "tables", label: "Tables", values: ["preserve", "strip"] },
] as const

export const DEFAULT_OPTIONS = {
  frontmatter: "none",
  images: "inline",
  headings: "preserve",
  tables: "preserve",
} as const

export type PresetOptions = Record<string, string>

export interface Preset {
  id: string
  name: string
  options: PresetOptions
  is_default: boolean
}

export async function listPresets(): Promise<Preset[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("conversion_presets")
    .select("id, name, options, is_default")
    .order("created_at", { ascending: true })
  if (error) throw error
  return (data ?? []) as Preset[]
}

export async function createPreset(name: string, options: PresetOptions, isDefault = false) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not signed in")
  const { error } = await supabase.from("conversion_presets").insert({
    user_id: user.id, name, options, is_default: isDefault,
  })
  if (error) throw error
}

export async function deletePreset(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from("conversion_presets").delete().eq("id", id)
  if (error) throw error
}
