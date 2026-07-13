// Single source of truth for the document formats MDSpin accepts as input.
// Imported by the converter UI and the API proxy routes so the list never drifts.

export const SUPPORTED_EXTS = [
  'pdf', 'docx', 'doc', 'pptx', 'gslides', 'rtf', 'txt', 'pages', 'html', 'htm',
  'png', 'jpg', 'jpeg',
] as const

export type SupportedExt = (typeof SUPPORTED_EXTS)[number]

// Uppercase labels shown as badges in the UI.
export const SUPPORTED_FORMATS = [
  'PDF', 'DOC', 'DOCX', 'PPTX', 'GSLIDES', 'PAGES', 'TXT', 'RTF', 'HTML', 'PNG', 'JPG',
] as const

// Image extensions are converted via AI vision on the backend and are capped
// per batch (Gemini free-tier rate limit) — keep in sync with mdc-api.
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg'] as const
export const MAX_IMAGES_PER_BATCH = 5

export function isImageExt(ext: string): boolean {
  return (IMAGE_EXTS as readonly string[]).includes(ext.toLowerCase())
}

export const MIME_TYPES: Record<string, string> = {
  pdf:     'application/pdf',
  docx:    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc:     'application/msword',
  pptx:    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  gslides: 'application/vnd.google-apps.presentation',
  rtf:     'application/rtf',
  txt:     'text/plain',
  pages:   'application/x-iwork-pages-sffpages',
  html:    'text/html',
  htm:     'text/html',
  png:     'image/png',
  jpg:     'image/jpeg',
  jpeg:    'image/jpeg',
}

// Value for an <input type="file" accept="..."> attribute, e.g. ".pdf,.docx,...".
export const ACCEPT_ATTR = SUPPORTED_EXTS.map((e) => `.${e}`).join(',')

export function isSupportedExt(ext: string): boolean {
  return (SUPPORTED_EXTS as readonly string[]).includes(ext.toLowerCase())
}
