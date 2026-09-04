import { describe, it, expect } from "vitest"
import { buildConversionRows, buildSpinUpdatePayload, type ConversionFileInput } from "@/lib/library"

const files: ConversionFileInput[] = [
  { filename: "a.pdf", file_type: "pdf", word_count: 10, markdown_text: "# A" },
  { filename: "b.docx", file_type: "docx", word_count: 20, markdown_text: "# B" },
]

describe("buildConversionRows", () => {
  it("maps files to insert rows flagged in_vault with shared project/tags", () => {
    const rows = buildConversionRows(files, { projectId: "p1", tags: ["x"] }, "u1")
    expect(rows).toEqual([
      { user_id: "u1", filename: "a.pdf", file_type: "pdf", word_count: 10, markdown_text: "# A", project_id: "p1", tags: ["x"], in_vault: true, summary_status: "pending" },
      { user_id: "u1", filename: "b.docx", file_type: "docx", word_count: 20, markdown_text: "# B", project_id: "p1", tags: ["x"], in_vault: true, summary_status: "pending" },
    ])
  })

  it("supports a null project and empty tags", () => {
    const rows = buildConversionRows([files[0]], { projectId: null, tags: [] }, "u1")
    expect(rows[0].project_id).toBeNull()
    expect(rows[0].tags).toEqual([])
    expect(rows[0].in_vault).toBe(true)
    expect(rows[0].summary_status).toBe("pending")
  })
})

describe("buildSpinUpdatePayload", () => {
  it("re-queues the summary when the body changes", () => {
    const payload = buildSpinUpdatePayload({ markdown_text: "# New body\n\nrewritten" })
    expect(payload.summary_status).toBe("pending")
    expect(payload.summary_attempts).toBe(0)
    expect(payload.word_count).toBe(4)
  })

  // Retitling or refiling a document does not make its summary stale, so it must not burn
  // a Make operation. Same guard the two vault_* RPCs apply via `p_patch ? 'markdown_text'`.
  it("leaves the summary alone for title/tag/project-only edits", () => {
    const payload = buildSpinUpdatePayload({ title: "Renamed", tags: ["x"], project_id: "p1" })
    expect("summary_status" in payload).toBe(false)
    expect("summary_attempts" in payload).toBe(false)
    expect("word_count" in payload).toBe(false)
  })
})
