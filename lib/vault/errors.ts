// Vault-layer error type.
//
// Shape matches app/api/brief/route.ts's existing convention (`{error: "CODE", message}`)
// byte-for-byte, so a future REST route (Stage 2d) can do
// `NextResponse.json(err.toResponse(), {status: err.status})` with zero translation, and a
// future MCP tool (Stage 2e) can read `.code` without parsing a JSON body shape.
//
// Codes are a plain union rather than an enum so this file has zero runtime footprint
// beyond the class itself — types erase, the class doesn't need to.
export type VaultErrorCode =
  | "AUTH_REQUIRED"
  | "NOT_CONFIGURED"
  | "NOT_FOUND"
  | "INVALID_REQUEST"
  | "VERSION_CONFLICT"
  | "IMMUTABLE_SOURCE"
  | "SUSPICIOUS_SHRINK"
  | "WRITE_QUOTA_EXCEEDED"
  | "DB_ERROR"

const STATUS_BY_CODE: Record<VaultErrorCode, number> = {
  AUTH_REQUIRED: 401,
  NOT_CONFIGURED: 503,
  NOT_FOUND: 404,
  INVALID_REQUEST: 400,
  VERSION_CONFLICT: 409,
  IMMUTABLE_SOURCE: 409,
  SUSPICIOUS_SHRINK: 409,
  WRITE_QUOTA_EXCEEDED: 429,
  DB_ERROR: 500,
}

export class VaultError extends Error {
  readonly code: VaultErrorCode
  readonly status: number

  constructor(code: VaultErrorCode, message: string) {
    super(message)
    this.name = "VaultError"
    this.code = code
    this.status = STATUS_BY_CODE[code]
  }

  toResponse(): { error: VaultErrorCode; message: string } {
    return { error: this.code, message: this.message }
  }
}
