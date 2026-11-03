/**
 * lib/doc-retrieval/chunk.ts — Split a document into passages a small model can read
 *
 * Structure first: a heading starts a new chunk, then paragraphs are packed up
 * to the size cap, and only a paragraph longer than the cap is cut at sentences,
 * then at words. Each chunk repeats the tail of the one before it (`overlap`)
 * so a fact that straddles a boundary survives. A document short enough to fit
 * one prompt comes back as a single chunk: retrieval on one page only loses context.
 *
 * Sizes are in characters (about 4 per token), so no tokenizer is needed.
 */
import type { DocChunk, DocPage } from "./types"

export interface ChunkOptions {
  /** Cap per chunk, in characters. About 400 tokens. */
  max?: number
  /** Characters of the previous chunk repeated at the start of the next. */
  overlap?: number
  /** At or under this many characters in total, return the whole document as one chunk. */
  wholeUnder?: number
}

export const CHUNK_MAX = 1600
export const CHUNK_OVERLAP = 160
export const WHOLE_DOC_UNDER = 8000

/** A short line with no end punctuation, or a numbered / ALL CAPS title. */
export function isHeading(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 80) return false
  if (/^#{1,6}\s+\S/.test(t)) return true
  if (/^(chapter|section|part|appendix)\s+\w+/i.test(t)) return true
  if (/^\d+(\.\d+)*[.)]?\s+[A-Z]/.test(t) && !/[.!?]$/.test(t)) return true
  return t.length >= 4 && t === t.toUpperCase() && /[A-Z]/.test(t) && !/[.!?]$/.test(t)
}

function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text]
  const parts: string[] = []
  let rest = text
  while (rest.length > max) {
    let cut = Math.max(rest.lastIndexOf(". ", max), rest.lastIndexOf("? ", max), rest.lastIndexOf("! ", max)) + 1
    if (cut < max * 0.4) cut = rest.lastIndexOf(" ", max)
    if (cut < max * 0.4) cut = max
    parts.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) parts.push(rest)
  return parts
}

interface Block {
  text: string
  page: number
  heading: string
  /** True when the block is a heading line, which closes the chunk before it. */
  starts: boolean
}

function blocksOf(pages: readonly DocPage[], max: number): Block[] {
  const blocks: Block[] = []
  let heading = ""
  for (const { page, text } of pages) {
    for (const para of text.split(/\n{2,}/)) {
      const lines = para.split("\n").map((l) => l.trim()).filter(Boolean)
      if (!lines.length) continue
      if (lines.length === 1 && isHeading(lines[0]!)) {
        heading = lines[0]!.replace(/^#{1,6}\s+/, "")
        blocks.push({ text: lines[0]!, page, heading, starts: true })
        continue
      }
      for (const piece of splitLong(lines.join(" "), max)) blocks.push({ text: piece, page, heading, starts: false })
    }
  }
  return blocks
}

export function chunkDocument(docId: string, pages: readonly DocPage[], opts: ChunkOptions = {}): DocChunk[] {
  const max = opts.max ?? CHUNK_MAX
  const overlap = Math.min(opts.overlap ?? CHUNK_OVERLAP, Math.floor(max / 4))
  const whole = opts.wholeUnder ?? WHOLE_DOC_UNDER
  const firstPage = pages.find((p) => p.text.trim())?.page ?? 1

  const total = pages.reduce((n, p) => n + p.text.trim().length, 0)
  if (total === 0) return []
  if (total <= whole) {
    const text = pages.map((p) => p.text.trim()).filter(Boolean).join("\n\n")
    return [{ id: `${docId}#0`, docId, text, page: firstPage, heading: "" }]
  }

  const chunks: DocChunk[] = []
  let cur: Block[] = []
  let size = 0
  let tail = ""

  const flush = () => {
    if (!cur.length) return
    const body = cur.map((b) => b.text).join("\n\n")
    const first = cur.find((b) => !b.starts) ?? cur[0]!
    chunks.push({
      id: `${docId}#${chunks.length}`,
      docId,
      text: tail ? `${tail}\n\n${body}` : body,
      page: first.page,
      heading: first.heading,
    })
    tail = overlap > 0 ? body.slice(-overlap).replace(/^\S*\s/, "") : ""
    cur = []
    size = 0
  }

  for (const block of blocksOf(pages, max)) {
    if (block.starts && size > 0) flush()
    if (size + block.text.length > max && size > 0) flush()
    cur.push(block)
    size += block.text.length
  }
  flush()
  // A lone heading with no body is not a chunk worth returning.
  return chunks.filter((c) => c.text.replace(/\s/g, "").length > 0)
}
