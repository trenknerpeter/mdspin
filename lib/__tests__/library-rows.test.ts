import { describe, it, expect } from "vitest"
import { buildConversionRows, type ConversionFileInput } from "@/lib/library"

const files: ConversionFileInput[] = [
  { filename: "a.pdf", file_type: "pdf", word_count: 10, markdown_text: "# A" },
  { filename: "b.docx", file_type: "docx", word_count: 20, markdown_text: "# B" },
]

describe("buildConversionRows", () => {
  it("maps files to insert rows flagged in_vault with shared project/tags", () => {
    const rows = buildConversionRows(files, { projectId: "p1", tags: ["x"] }, "u1")
    expect(rows).toEqual([
      { user_id: "u1", filename: "a.pdf", file_type: "pdf", word_count: 10, markdown_text: "# A", project_id: "p1", tags: ["x"], in_vault: true },
      { user_id: "u1", filename: "b.docx", file_type: "docx", word_count: 20, markdown_text: "# B", project_id: "p1", tags: ["x"], in_vault: true },
    ])
  })

  it("supports a null project and empty tags", () => {
    const rows = buildConversionRows([files[0]], { projectId: null, tags: [] }, "u1")
    expect(rows[0].project_id).toBeNull()
    expect(rows[0].tags).toEqual([])
    expect(rows[0].in_vault).toBe(true)
  })
})
