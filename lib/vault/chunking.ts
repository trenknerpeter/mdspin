// Heading-aware chunking for embeddings (Stage 3). Deliberately separate from chunk.ts
// (that file batches ingest-commit PAYLOADS by byte size for the network layer; this one
// splits a single document's CONTENT by heading structure for the embedding pipeline —
// same "never drop, oversize gets its own unit" philosophy as chunk.ts, different unit of
// work). Duplicates title.ts's fence/ATX/setext detection rather than extending
// extractHeadings() with line numbers — see this file's plan task for why.

import { cleanHeadingText } from "./title"
import { estimateTokenCount } from "./tokens"

export interface DocumentChunk {
  /** e.g. "Setup > Installation", or null for content before the first heading. */
  headingPath: string | null
  content: string
  tokenCount: number
}

interface HeadingLine {
  line: number
  level: number
  text: string
}

function scanHeadingLines(lines: string[]): HeadingLine[] {
  const out: HeadingLine[] = []
  let fence: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (!fence) fence = marker
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null
      continue
    }
    if (fence) continue

    const atx = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line)
    if (atx) {
      const text = cleanHeadingText(atx[2].replace(/\s+#+\s*$/, ""))
      if (text) out.push({ line: i, level: atx[1].length, text })
      continue
    }

    const next = i + 1 < lines.length ? lines[i + 1] : ""
    if (line.trim() && /^\s{0,3}(=+|-+)\s*$/.test(next)) {
      const level = next.trim()[0] === "=" ? 1 : 2
      const text = cleanHeadingText(line)
      if (text) out.push({ line: i, level, text })
    }
  }

  return out
}

/** Maintains the nesting stack across the whole document: pop back to (and past) any
 *  sibling/ancestor level, then push the new heading. Mutates `stack` in place. */
function buildHeadingPath(stack: HeadingLine[], heading: HeadingLine): string {
  while (stack.length && stack[stack.length - 1].level >= heading.level) stack.pop()
  stack.push(heading)
  return stack.map((h) => h.text).join(" > ")
}

/** Split one section's raw text into <=maxTokens pieces on blank-line paragraph
 *  boundaries, greedily packing consecutive paragraphs. A single paragraph over
 *  maxTokens (e.g. a huge code block) gets its own piece rather than being cut — never
 *  drop, never split mid-paragraph. Mirrors chunk.ts's chunkBySize oversize handling. */
function packParagraphs(text: string, maxTokens: number): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const pieces: string[] = []
  let current: string[] = []
  let currentTokens = 0

  for (const para of paragraphs) {
    const tokens = estimateTokenCount(para)
    if (tokens > maxTokens) {
      if (current.length) {
        pieces.push(current.join("\n\n"))
        current = []
        currentTokens = 0
      }
      pieces.push(para)
      continue
    }
    if (current.length && currentTokens + tokens > maxTokens) {
      pieces.push(current.join("\n\n"))
      current = []
      currentTokens = 0
    }
    current.push(para)
    currentTokens += tokens
  }
  if (current.length) pieces.push(current.join("\n\n"))
  return pieces
}

export function chunkMarkdownByHeading(markdown: string, maxTokens = 500): DocumentChunk[] {
  if (!markdown.trim()) return []

  const lines = markdown.split(/\r?\n/)
  const headings = scanHeadingLines(lines)

  interface Section {
    headingPath: string | null
    start: number
    end: number
  }
  const sections: Section[] = []
  const stack: HeadingLine[] = []

  if (headings.length === 0 || headings[0].line > 0) {
    sections.push({ headingPath: null, start: 0, end: headings[0]?.line ?? lines.length })
  }
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].line
    const end = i + 1 < headings.length ? headings[i + 1].line : lines.length
    sections.push({ headingPath: buildHeadingPath(stack, headings[i]), start, end })
  }

  const chunks: DocumentChunk[] = []
  for (const section of sections) {
    const text = lines.slice(section.start, section.end).join("\n").trim()
    if (!text) continue
    for (const piece of packParagraphs(text, maxTokens)) {
      chunks.push({ headingPath: section.headingPath, content: piece, tokenCount: estimateTokenCount(piece) })
    }
  }
  return chunks
}
