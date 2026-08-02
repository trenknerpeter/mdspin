import { describe, it, expect } from "vitest"
import {
  partitionIncomingFiles,
  groupRejections,
  describeRejection,
  MAX_CONVERT_FILE_SIZE,
} from "@/lib/converter-intake"

const f = (name: string, size = 1000) => ({ name, size })
const names = (arr: { name: string }[]) => arr.map((x) => x.name)

describe("partitionIncomingFiles", () => {
  it("accepts supported files", () => {
    const r = partitionIncomingFiles([], [f("a.pdf"), f("b.docx")])
    expect(names(r.accepted)).toEqual(["a.pdf", "b.docx"])
    expect(r.rejected).toEqual([])
  })

  it("reports unsupported formats instead of dropping them silently", () => {
    const r = partitionIncomingFiles([], [f("a.zip"), f("b.exe")])
    expect(r.accepted).toEqual([])
    expect(r.rejected).toEqual([
      { name: "a.zip", reason: "unsupported" },
      { name: "b.exe", reason: "unsupported" },
    ])
  })

  it("gives markdown its own reason, not the generic unsupported", () => {
    const r = partitionIncomingFiles([], [f("notes.md"), f("x.markdown"), f("y.mdx")])
    expect(r.rejected.map((x) => x.reason)).toEqual([
      "markdown_goes_to_vault",
      "markdown_goes_to_vault",
      "markdown_goes_to_vault",
    ])
  })

  it("does not divert .txt, which the converter genuinely supports", () => {
    const r = partitionIncomingFiles([], [f("a.txt")])
    expect(names(r.accepted)).toEqual(["a.txt"])
  })

  it("reports oversize files", () => {
    const r = partitionIncomingFiles([], [f("big.pdf", MAX_CONVERT_FILE_SIZE + 1)])
    expect(r.accepted).toEqual([])
    expect(r.rejected).toEqual([{ name: "big.pdf", reason: "too_large" }])
  })

  it("accepts a file exactly at the size limit", () => {
    const r = partitionIncomingFiles([], [f("edge.pdf", MAX_CONVERT_FILE_SIZE)])
    expect(names(r.accepted)).toEqual(["edge.pdf"])
  })

  it("reports duplicates against the existing selection", () => {
    const r = partitionIncomingFiles([f("a.pdf", 500)], [f("a.pdf", 500)])
    expect(r.rejected).toEqual([{ name: "a.pdf", reason: "duplicate" }])
  })

  it("treats same name with a different size as a different file", () => {
    const r = partitionIncomingFiles([f("a.pdf", 500)], [f("a.pdf", 600)])
    expect(names(r.accepted)).toEqual(["a.pdf"])
  })

  it("reports duplicates within the same incoming batch", () => {
    const r = partitionIncomingFiles([], [f("a.pdf", 1), f("a.pdf", 1)])
    expect(names(r.accepted)).toEqual(["a.pdf"])
    expect(r.rejected).toEqual([{ name: "a.pdf", reason: "duplicate" }])
  })

  it("reports files past the 20-file cap instead of slicing them off", () => {
    const existing = Array.from({ length: 20 }, (_, i) => f(`e${i}.pdf`))
    const r = partitionIncomingFiles(existing, [f("new.pdf")])
    expect(r.accepted).toEqual([])
    expect(r.rejected).toEqual([{ name: "new.pdf", reason: "over_file_limit" }])
  })

  it("fills up to the cap and reports only the overflow", () => {
    const existing = Array.from({ length: 18 }, (_, i) => f(`e${i}.pdf`))
    const r = partitionIncomingFiles(existing, [f("a.pdf"), f("b.pdf"), f("c.pdf")])
    expect(names(r.accepted)).toEqual(["a.pdf", "b.pdf"])
    expect(r.rejected).toEqual([{ name: "c.pdf", reason: "over_file_limit" }])
  })

  it("reports images past the per-batch image cap", () => {
    const imgs = Array.from({ length: 7 }, (_, i) => f(`i${i}.png`))
    const r = partitionIncomingFiles([], imgs)
    expect(r.accepted).toHaveLength(5)
    expect(r.rejected).toEqual([
      { name: "i5.png", reason: "over_image_limit" },
      { name: "i6.png", reason: "over_image_limit" },
    ])
  })

  it("counts images already in the existing selection toward the cap", () => {
    const existing = Array.from({ length: 5 }, (_, i) => f(`e${i}.jpg`))
    const r = partitionIncomingFiles(existing, [f("new.png")])
    expect(r.rejected).toEqual([{ name: "new.png", reason: "over_image_limit" }])
  })

  it("does not evict already-accepted images when non-images are added", () => {
    // The regression this function exists to prevent: the old chain re-filtered the
    // combined list, so caps could retroactively remove earlier selections.
    const existing = [f("a.png"), f("b.png")]
    const r = partitionIncomingFiles(existing, [f("doc.pdf"), f("doc2.pdf")])
    expect(names(r.accepted)).toEqual(["doc.pdf", "doc2.pdf"])
    expect(r.rejected).toEqual([])
  })

  it("still admits non-images once the image cap is reached", () => {
    const existing = Array.from({ length: 5 }, (_, i) => f(`e${i}.png`))
    const r = partitionIncomingFiles(existing, [f("x.png"), f("y.pdf")])
    expect(names(r.accepted)).toEqual(["y.pdf"])
    expect(r.rejected).toEqual([{ name: "x.png", reason: "over_image_limit" }])
  })

  it("handles an empty incoming batch", () => {
    expect(partitionIncomingFiles([f("a.pdf")], [])).toEqual({ accepted: [], rejected: [] })
  })

  it("handles a file with no extension", () => {
    expect(partitionIncomingFiles([], [f("README")]).rejected).toEqual([
      { name: "README", reason: "unsupported" },
    ])
  })

  it("is case-insensitive about extensions", () => {
    expect(names(partitionIncomingFiles([], [f("A.PDF")]).accepted)).toEqual(["A.PDF"])
  })
})

describe("groupRejections", () => {
  it("groups by reason preserving first-encountered order", () => {
    expect(
      groupRejections([
        { name: "a", reason: "too_large" },
        { name: "b", reason: "unsupported" },
        { name: "c", reason: "too_large" },
      ])
    ).toEqual([
      { reason: "too_large", names: ["a", "c"] },
      { reason: "unsupported", names: ["b"] },
    ])
  })

  it("returns an empty array for no rejections", () => {
    expect(groupRejections([])).toEqual([])
  })
})

describe("describeRejection", () => {
  it("pluralises on count", () => {
    expect(describeRejection("too_large", 1)).toContain("1 file skipped")
    expect(describeRejection("too_large", 3)).toContain("3 files skipped")
  })

  it("points markdown at the vault", () => {
    expect(describeRejection("markdown_goes_to_vault", 2)).toContain("Vault")
  })

  it("uses correct singular/plural grammar for the markdown notice", () => {
    // Regression: verified live in-browser that "1 markdown file don't need
    // converting" is a real subject/verb disagreement, not just a nitpick.
    expect(describeRejection("markdown_goes_to_vault", 1)).toBe(
      "1 markdown file doesn't need converting — add it straight to your Vault"
    )
    expect(describeRejection("markdown_goes_to_vault", 2)).toBe(
      "2 markdown files don't need converting — add them straight to your Vault"
    )
  })

  it("covers every reason", () => {
    const reasons = [
      "unsupported",
      "too_large",
      "duplicate",
      "over_file_limit",
      "over_image_limit",
      "markdown_goes_to_vault",
    ] as const
    for (const r of reasons) {
      expect(describeRejection(r, 1)).toBeTruthy()
    }
  })
})
