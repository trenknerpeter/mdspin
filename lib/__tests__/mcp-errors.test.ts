import { describe, it, expect } from "vitest"
import { toolError } from "@/lib/mcp/errors"
import { VaultError } from "@/lib/vault/errors"

describe("toolError", () => {
  it("formats a VaultError as isError content carrying its code and message", () => {
    expect(toolError(new VaultError("NOT_FOUND", "Document not found."))).toEqual({
      content: [{ type: "text", text: "NOT_FOUND: Document not found." }],
      isError: true,
    })
  })
  it("maps a non-VaultError to a generic message without leaking it", () => {
    expect(toolError(new Error("raw secret"))).toEqual({
      content: [{ type: "text", text: "Unexpected error." }],
      isError: true,
    })
  })
})
