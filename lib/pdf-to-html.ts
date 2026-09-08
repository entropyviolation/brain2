/**
 * lib/pdf-to-html.ts — Ingest a PDF into editable Docs HTML
 *
 * Uses pdfjs-dist in the browser to extract positioned text, groups items into
 * lines/paragraphs, and emits semantic HTML (headings when font size is large,
 * lists when lines look like bullets/numbers). Each run keeps a mapped
 * Google/system font plus bold/italic so uploaded PDFs keep a similar look.
 */
import { escapeHtmlText, sanitizeDocHtml } from "@/lib/doc-html"
import { fontFamilyCss, mapPdfFontToAllowed, type GoogleFontName } from "@/lib/google-fonts"

export interface PdfIngestResult {
  html: string
  pageCount: number
  charCount: number
  /** Most common body font mapped onto the Docs allow-list. */
  dominantFont?: GoogleFontName
}

export interface PdfTextRun {
  str: string
  x: number
  y: number
  h: number
  fontName: string
}

function groupLines(items: PdfTextRun[]): PdfTextRun[][] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: PdfTextRun[][] = []
  let current: PdfTextRun[] = [sorted[0]]
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

function lineText(line: PdfTextRun[]): string {
  return line
    .map((r) => r.str)
    .join("")
    .replace(/\s+/g, " ")
    .trim()
}

function avgHeight(line: PdfTextRun[]): number {
  if (!line.length) return 12
  return line.reduce((s, r) => s + (r.h || 12), 0) / line.length
}

/** PDF user-space units are roughly points; convert to CSS pixels and clamp. */
export function pdfHeightToPx(height: number): number {
  const px = Math.round((Math.max(1, height) * 96) / 72)
  return Math.min(48, Math.max(10, px))
}

function runInnerHtml(run: PdfTextRun): string {
  const text = escapeHtmlText(run.str)
  if (!text) return ""
  const mapped = mapPdfFontToAllowed(run.fontName)
  const size = pdfHeightToPx(run.h || 12)
  const weight = mapped.bold ? "700" : "400"
  const style = mapped.italic ? "italic" : "normal"
  const family = fontFamilyCss(mapped.family)
  return `<span style="font-family:${family};font-size:${size}px;font-weight:${weight};font-style:${style}">${text}</span>`
}

function styledLineInner(line: PdfTextRun[]): string {
  return line.map(runInnerHtml).join("")
}

function lineToHtml(line: PdfTextRun[], medianH: number): string {
  const text = lineText(line)
  if (!text) return ""
  const inner = styledLineInner(line)
  const height = avgHeight(line)

  if (/^([•·▪►‣*-])\s+/.test(text)) {
    return `<li>${inner}</li>`
  }
  if (/^\d+[.)]\s+/.test(text)) {
    return `<li data-ordered="1">${inner}</li>`
  }

  if (height >= medianH * 1.65) return `<h1>${inner}</h1>`
  if (height >= medianH * 1.35) return `<h2>${inner}</h2>`
  if (height >= medianH * 1.18) return `<h3>${inner}</h3>`

  return `<p>${inner}</p>`
}

function flushList(buf: string[], ordered: boolean, out: string[]) {
  if (!buf.length) return
  const tag = ordered ? "ol" : "ul"
  out.push(`<${tag}>${buf.join("")}</${tag}>`)
  buf.length = 0
}

function dominantBodyFont(lines: PdfTextRun[][], medianH: number): GoogleFontName | undefined {
  const counts = new Map<GoogleFontName, number>()
  for (const line of lines) {
    if (avgHeight(line) >= medianH * 1.18) continue
    for (const run of line) {
      const family = mapPdfFontToAllowed(run.fontName).family
      counts.set(family, (counts.get(family) ?? 0) + (run.str?.length ?? 0))
    }
  }
  let best: GoogleFontName | undefined
  let bestN = 0
  for (const [family, n] of counts) {
    if (n > bestN) {
      best = family
      bestN = n
    }
  }
  return best
}

function linesToHtml(lines: PdfTextRun[][]): { html: string; dominantFont?: GoogleFontName } {
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
    const html = lineToHtml(line, medianH)
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
  return { html: out.join("\n"), dominantFont: dominantBodyFont(lines, medianH) }
}

/** Testable: convert extracted PDF text runs into styled Docs HTML. */
export function pdfRunsToHtml(runs: PdfTextRun[]): { html: string; dominantFont?: GoogleFontName } {
  return linesToHtml(groupLines(runs))
}

/**
 * Parse a PDF `ArrayBuffer` into editable Docs HTML. Dynamically imports
 * pdfjs-dist so the Docs bundle only loads it when ingesting.
 */
export async function pdfArrayBufferToHtml(data: ArrayBuffer): Promise<PdfIngestResult> {
  const pdfjs = await import("pdfjs-dist")
  const version = (pdfjs as { version?: string }).version ?? "4.10.38"
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) })
  const pdf = await loadingTask.promise
  const pageHtml: string[] = []
  const fontVotes = new Map<GoogleFontName, number>()

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const runs: PdfTextRun[] = []
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
    const converted = pdfRunsToHtml(runs)
    if (converted.dominantFont) {
      fontVotes.set(converted.dominantFont, (fontVotes.get(converted.dominantFont) ?? 0) + 1)
    }
    if (converted.html.trim()) {
      pageHtml.push(
        pageNum === 1
          ? converted.html
          : `<hr /><p><em>Page ${pageNum}</em></p>\n${converted.html}`,
      )
    }
  }

  const joined =
    pageHtml.join("\n") ||
    "<p><em>(No extractable text — this PDF may be image-only.)</em></p>"
  const html = sanitizeDocHtml(joined)
  const charCount = html.replace(/<[^>]+>/g, "").length
  let dominantFont: GoogleFontName | undefined
  let best = 0
  for (const [family, n] of fontVotes) {
    if (n > best) {
      dominantFont = family
      best = n
    }
  }
  return { html, pageCount: pdf.numPages, charCount, dominantFont }
}
