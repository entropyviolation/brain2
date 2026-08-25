/**
 * lib/pdf-to-html.ts — Ingest a PDF into editable Docs HTML
 *
 * Uses pdfjs-dist in the browser to extract positioned text, groups items into
 * lines/paragraphs, and emits semantic HTML (headings when font size is large,
 * lists when lines look like bullets/numbers). Formatting is best-effort —
 * scanned/image-only PDFs yield little text.
 */
import { escapeHtmlText, sanitizeDocHtml } from "@/lib/doc-html"

export interface PdfIngestResult {
  html: string
  pageCount: number
  charCount: number
}

interface TextRun {
  str: string
  x: number
  y: number
  h: number
  fontName: string
}

function groupLines(items: TextRun[]): TextRun[][] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: TextRun[][] = []
  let current: TextRun[] = [sorted[0]]
  let lastY = sorted[0].y
  let lastH = sorted[0].h || 12

  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i]
    const threshold = Math.max(lastH, it.h || 12) * 0.55
    if (Math.abs(it.y - lastY) <= threshold) {
      current.push(it)
    } else {
      lines.push(current.sort((a, b) => a.x - b.x))
      current = [it]
      lastY = it.y
      lastH = it.h || 12
    }
  }
  lines.push(current.sort((a, b) => a.x - b.x))
  return lines
}

function lineText(line: TextRun[]): string {
  return line
    .map((r) => r.str)
    .join("")
    .replace(/\s+/g, " ")
    .trim()
}

function avgHeight(line: TextRun[]): number {
  if (!line.length) return 12
  return line.reduce((s, r) => s + (r.h || 12), 0) / line.length
}

function lineToHtml(text: string, height: number, medianH: number): string {
  const escaped = escapeHtmlText(text)
  if (!escaped) return ""

  // Bullet / numbered list heuristics.
  if (/^([•·▪►‣*-])\s+/.test(text)) {
    const body = escapeHtmlText(text.replace(/^([•·▪►‣*-])\s+/, ""))
    return `<li>${body}</li>`
  }
  if (/^\d+[.)]\s+/.test(text)) {
    const body = escapeHtmlText(text.replace(/^\d+[.)]\s+/, ""))
    return `<li data-ordered="1">${body}</li>`
  }

  // Heading by relative font size.
  if (height >= medianH * 1.65) return `<h1>${escaped}</h1>`
  if (height >= medianH * 1.35) return `<h2>${escaped}</h2>`
  if (height >= medianH * 1.18) return `<h3>${escaped}</h3>`

  return `<p>${escaped}</p>`
}

function flushList(buf: string[], ordered: boolean, out: string[]) {
  if (!buf.length) return
  const tag = ordered ? "ol" : "ul"
  out.push(`<${tag}>${buf.join("")}</${tag}>`)
  buf.length = 0
}

function linesToHtml(lines: TextRun[][]): string {
  const heights = lines.map(avgHeight).filter((h) => h > 0)
  const medianH =
    heights.length === 0
      ? 12
      : [...heights].sort((a, b) => a - b)[Math.floor(heights.length / 2)]

  const out: string[] = []
  let ulBuf: string[] = []
  let olBuf: string[] = []

  for (const line of lines) {
    const text = lineText(line)
    if (!text) {
      flushList(ulBuf, false, out)
      flushList(olBuf, true, out)
      continue
    }
    const html = lineToHtml(text, avgHeight(line), medianH)
    if (html.startsWith("<li data-ordered")) {
      flushList(ulBuf, false, out)
      olBuf.push(html.replace(' data-ordered="1"', ""))
    } else if (html.startsWith("<li>")) {
      flushList(olBuf, true, out)
      ulBuf.push(html)
    } else {
      flushList(ulBuf, false, out)
      flushList(olBuf, true, out)
      out.push(html)
    }
  }
  flushList(ulBuf, false, out)
  flushList(olBuf, true, out)
  return out.join("\n")
}

/**
 * Parse a PDF `ArrayBuffer` into editable Docs HTML. Dynamically imports
 * pdfjs-dist so the Docs bundle only loads it when ingesting.
 */
export async function pdfArrayBufferToHtml(data: ArrayBuffer): Promise<PdfIngestResult> {
  const pdfjs = await import("pdfjs-dist")
  // Worker from CDN matching the installed package version (static export friendly).
  const version = (pdfjs as { version?: string }).version ?? "4.10.38"
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) })
  const pdf = await loadingTask.promise
  const pageHtml: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const runs: TextRun[] = []
    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue
      const transform = item.transform as number[]
      const h = Math.abs(transform[3] || item.height || 12)
      runs.push({
        str: item.str,
        x: transform[4] ?? 0,
        y: transform[5] ?? 0,
        h,
        fontName: item.fontName || "",
      })
    }
    const lines = groupLines(runs)
    const html = linesToHtml(lines)
    if (html.trim()) {
      pageHtml.push(
        pageNum === 1
          ? html
          : `<hr /><p><em>Page ${pageNum}</em></p>\n${html}`,
      )
    }
  }

  const joined =
    pageHtml.join("\n") ||
    "<p><em>(No extractable text — this PDF may be image-only.)</em></p>"
  const html = sanitizeDocHtml(joined)
  const charCount = html.replace(/<[^>]+>/g, "").length
  return { html, pageCount: pdf.numPages, charCount }
}
