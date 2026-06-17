export type FileItem = {
  id: string
  name: string          // display name — filename for uploads, host+path for URLs
  file?: File           // present for uploaded files; absent for URL conversions
  sourceUrl?: string    // present for URL conversions
  status: 'queued' | 'converting' | 'done' | 'failed'
  markdown?: string
  error?: string
  wordCount?: number
  fileType?: string
  conversionId?: string // id of the auto-saved conversions row (signed-in); used for "Add to Vault"
}

export type ConverterContext = "teaser" | "app"
export type ConversionOptions = Record<string, unknown>
