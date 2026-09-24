/**
 * lib/ingest/jpeg-pdf.ts — Embed JPEG page scans in a one-file PDF
 *
 * Telegram photos are JPEG. Wrapping them as DCTDecode XObjects keeps the
 * scan lossless relative to the photo and needs no extra PDF library.
 */
import { dataUrlMime, dataUrlToBytes } from "./bytes"

export interface JpegPage {
  bytes: Uint8Array
  width: number
  height: number
}

const LETTER_W = 612
const LETTER_H = 792

/** SOF0 / SOF2 width and height from a JPEG bitstream. */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return { width: LETTER_W, height: LETTER_H }
  }
  let i = 2
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1
      continue
    }
    const marker = bytes[i + 1]!
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2
      continue
    }
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!
    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = (bytes[i + 5]! << 8) | bytes[i + 6]!
      const width = (bytes[i + 7]! << 8) | bytes[i + 8]!
      if (width > 0 && height > 0) return { width, height }
    }
    i += 2 + len
  }
  return { width: LETTER_W, height: LETTER_H }
}

export function dataUrlToJpegPage(dataUrl: string): JpegPage | null {
  const mime = dataUrlMime(dataUrl)
  if (!/^image\/jpeg/i.test(mime) && !dataUrl.includes("/jpeg") && !dataUrl.includes("/jpg")) {
    const bytes = dataUrlToBytes(dataUrl)
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      const size = jpegSize(bytes)
      return { bytes, ...size }
    }
    return null
  }
  const bytes = dataUrlToBytes(dataUrl)
  if (bytes.length < 2) return null
  return { bytes, ...jpegSize(bytes) }
}

/**
 * Build a PDF 1.4 whose pages are the given JPEGs, scaled to fit letter.
 */
export function jpegPagesToPdf(pages: JpegPage[]): Uint8Array {
  const usable = pages.filter((page) => page.bytes.length > 0 && page.width > 0 && page.height > 0)
  if (usable.length === 0) return new Uint8Array()

  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  let pos = 0
  const offsets: number[] = [0]

  const add = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? enc.encode(part) : part
    chunks.push(bytes)
    pos += bytes.length
  }
  const obj = (id: number, body: string | Uint8Array) => {
    offsets[id] = pos
    add(`${id} 0 obj\n`)
    add(body)
    add("\nendobj\n")
  }

  add("%PDF-1.4\n%\x80\x80\x80\x80\n")

  const pageIds: number[] = []
  let nextId = 3
  const imageParts: { id: number; pageId: number; contentId: number; page: JpegPage; boxW: number; boxH: number }[] = []

  for (const page of usable) {
    const scale = Math.min(LETTER_W / page.width, LETTER_H / page.height, 1)
    const boxW = Math.max(1, Math.round(page.width * scale))
    const boxH = Math.max(1, Math.round(page.height * scale))
    const imageId = nextId++
    const contentId = nextId++
    const pageId = nextId++
    pageIds.push(pageId)
    imageParts.push({ id: imageId, pageId, contentId, page, boxW, boxH })
  }

  obj(1, "<< /Type /Catalog /Pages 2 0 R >>")
  obj(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`)

  for (const part of imageParts) {
    const stream = `q ${part.boxW} 0 0 ${part.boxH} 0 0 cm /Im0 Do Q`
    obj(
      part.pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${part.boxW} ${part.boxH}] /Contents ${part.contentId} 0 R /Resources << /XObject << /Im0 ${part.id} 0 R >> >> >>`,
    )
    obj(part.contentId, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    offsets[part.id] = pos
    add(`${part.id} 0 obj\n`)
    add(
      `<< /Type /XObject /Subtype /Image /Width ${part.page.width} /Height ${part.page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${part.page.bytes.length} >>\nstream\n`,
    )
    add(part.page.bytes)
    add("\nendstream\nendobj\n")
  }

  const xrefAt = pos
  add(`xref\n0 ${nextId}\n`)
  add("0000000000 65535 f \n")
  for (let i = 1; i < nextId; i++) {
    add(`${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`)
  }
  add(`trailer << /Size ${nextId} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`)

  const out = new Uint8Array(pos)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}
