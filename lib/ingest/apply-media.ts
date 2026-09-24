/**
 * lib/ingest/apply-media.ts — Photos → journal Docs / receipt checkout; PDFs → Docs
 *
 * Downloads already happened in the poller. This module OCRs, deskews, and
 * writes Zustand the same way the text executor does.
 */
import { escapeHtmlText, sanitizeDocHtml } from "@/lib/doc-html"
import { pdfArrayBufferToHtml } from "@/lib/pdf-to-html"
import { applyReceiptText } from "./apply-receipt"
import { createScanDocument, parkScanDocument, SCAN_DOCS_FOLDER } from "./apply-scan-doc"
import { dataUrlToBytes } from "./bytes"
import { jpegPagesToPdf, dataUrlToJpegPage } from "./jpeg-pdf"
import { ocrImages } from "./ocr"
import { looksLikeReceipt } from "./receipt-parse"
import { asJpegDataUrl, enhanceScan } from "./scan-page"
import { expandIngestText } from "./expand"
import { parseMessage } from "./parse-message"
import type { ApplyResult, IncomingAttachment, IncomingMessage } from "./types"

export async function applyMedia(message: IncomingMessage, now = new Date()): Promise<ApplyResult> {
  const attachments = message.attachments ?? []
  const caption = expandIngestText(message.text || "")
  const intent = parseMessage(caption)
  const forced =
    intent.kind === "receipt" || intent.kind === "journal" || intent.kind === "pdf" ? intent.kind : null
  const titleHint = forced ? intent.payload.trim() : caption.trim()

  const photos = attachments.filter((row) => row.kind === "photo")
  const pdfs = attachments.filter((row) => row.kind === "pdf")

  if (forced === "receipt" || (forced !== "journal" && forced !== "pdf" && photos.length > 0 && pdfs.length === 0)) {
    const ocr = message.ocrText?.trim() || (await ocrPhotoPages(photos, "receipt"))
    if (forced === "receipt" || looksLikeReceipt(ocr)) {
      if (!ocr.trim()) {
        return {
          status: "error",
          kind: "receipt",
          reply: "Couldn't read that receipt. Better light, or type got milk.",
        }
      }
      return applyReceiptText(ocr, now)
    }
    if (forced === "receipt") return applyReceiptText(ocr, now)
  }

  const replies: string[] = []
  const ids: string[] = []

  if (pdfs.length && forced !== "receipt") {
    for (const pdf of pdfs) {
      const doc = await ingestPdfAttachment(pdf, titleHint, now)
      replies.push(`Docs: ${doc.description}`)
      ids.push(doc.id)
    }
  }

  if (photos.length && forced !== "receipt") {
    const doc = await ingestJournalPhotos(photos, titleHint || defaultJournalTitle(now), now, message.ocrText)
    replies.push(`Docs: ${doc.description} (${photos.length} page${photos.length === 1 ? "" : "s"})`)
    ids.push(doc.id)
  }

  if (!replies.length) {
    return {
      status: "error",
      kind: "journal",
      reply: "Nothing to scan. Send a photo or a PDF.",
    }
  }

  return {
    status: "ok",
    kind: pdfs.length && !photos.length ? "pdf" : "journal",
    reply: replies.join(" "),
    summary: replies.join(" "),
    itemIds: ids,
  }
}

async function ocrPhotoPages(photos: IncomingAttachment[], mode: "receipt" | "page"): Promise<string> {
  const enhanced: string[] = []
  for (const photo of photos) {
    if (!photo.dataUrl) continue
    const jpeg = await asJpegDataUrl(photo.dataUrl)
    const page = await enhanceScan(jpeg)
    enhanced.push(page.dataUrl)
  }
  const texts = await ocrImages(enhanced, mode)
  return texts.filter(Boolean).join("\n")
}

async function ingestJournalPhotos(
  photos: IncomingAttachment[],
  title: string,
  now: Date,
  ocrText?: string,
) {
  const pages: { dataUrl: string; text: string }[] = []
  for (const photo of photos) {
    if (!photo.dataUrl && ocrText) {
      pages.push({ dataUrl: "", text: ocrText })
      continue
    }
    if (!photo.dataUrl) continue
    const jpeg = await asJpegDataUrl(photo.dataUrl)
    const enhanced = await enhanceScan(jpeg)
    const text = ocrText && photos.length === 1 ? ocrText : (await ocrImages([enhanced.dataUrl], "page"))[0] || ""
    pages.push({ dataUrl: enhanced.dataUrl, text })
  }

  const jpegPages = pages
    .map((page) => (page.dataUrl ? dataUrlToJpegPage(page.dataUrl) : null))
    .filter((page): page is NonNullable<typeof page> => page != null)
  const pdfBytes = jpegPages.length ? jpegPagesToPdf(jpegPages) : new Uint8Array()
  const searchable = pages.map((page) => page.text).filter(Boolean).join("\n\n") || ocrText || ""
  const body = journalHtml(title, pages, now)
  return createScanDocument({
    title,
    body,
    folder: SCAN_DOCS_FOLDER,
    pdf: pdfBytes.length
      ? { bytes: pdfBytes, name: `${slugFile(title)}.pdf`, extractedText: searchable }
      : undefined,
    now,
  })
}

async function ingestPdfAttachment(pdf: IncomingAttachment, titleHint: string, now: Date) {
  const bytes = dataUrlToBytes(pdf.dataUrl)
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  let html = ""
  let extracted = ""
  try {
    const converted = await pdfArrayBufferToHtml(buf)
    html = converted.html
    extracted = converted.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  } catch {
    html = ""
  }
  if (!extracted) {
    extracted = await extractPdfPlain(pdf.dataUrl)
    if (extracted) {
      html = `<p>${escapeHtmlText(extracted).replace(/\n+/g, "</p><p>")}</p>`
    }
  }
  if (!html.trim()) {
    html = "<p><em>(No extractable text — image-only PDF. Open the attached file.)</em></p>"
  }
  const name = (pdf.name || "document.pdf").replace(/\.pdf$/i, "")
  const title = titleHint || name || defaultJournalTitle(now)
  const header = `<p><em>Forwarded PDF · ${escapeHtmlText(pdf.name || "document.pdf")}</em></p>`
  return createScanDocument({
    title,
    body: sanitizeDocHtml(`${header}${html}`),
    folder: SCAN_DOCS_FOLDER,
    pdf: bytes.length
      ? { bytes, name: pdf.name || `${slugFile(title)}.pdf`, extractedText: extracted }
      : undefined,
    now,
  })
}

async function extractPdfPlain(dataUrl: string): Promise<string> {
  if (typeof window !== "undefined") {
    const desktop = (window as unknown as { desktop?: { extractPdfText?: (url: string) => Promise<string> } }).desktop
    if (desktop?.extractPdfText) {
      try {
        return (await desktop.extractPdfText(dataUrl)).trim()
      } catch {
        return ""
      }
    }
    return ""
  }
  try {
    const mod = await import("pdf-parse")
    const parse = (mod as { default?: (buf: Buffer) => Promise<{ text?: string }> }).default ?? (mod as unknown as (buf: Buffer) => Promise<{ text?: string }>)
    const bytes = dataUrlToBytes(dataUrl)
    const result = await parse(Buffer.from(bytes))
    return String(result?.text || "").trim()
  } catch {
    return ""
  }
}

function journalHtml(title: string, pages: { dataUrl: string; text: string }[], now: Date): string {
  const when = now.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  const parts = [
    `<p><em>Journal scan · ${escapeHtmlText(title)} · ${escapeHtmlText(when)}</em></p>`,
  ]
  pages.forEach((page, i) => {
    if (i > 0) parts.push("<hr />")
    parts.push(`<p><strong>Page ${i + 1}</strong></p>`)
    if (page.text) {
      const paras = escapeHtmlText(page.text).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br />")}</p>`)
      parts.push(paras.join(""))
    } else {
      parts.push("<p><em>(No readable text on this page.)</em></p>")
    }
    if (page.dataUrl) {
      parts.push(`<p><img src="${page.dataUrl}" alt="Page ${i + 1}" /></p>`)
    }
  })
  return sanitizeDocHtml(parts.join("\n"))
}

function defaultJournalTitle(now: Date): string {
  return `Journal ${now.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
}

function slugFile(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "scan"
  )
}

export function applyJournalText(payload: string, now = new Date()): ApplyResult {
  const text = payload.trim()
  if (!text) {
    return {
      status: "error",
      kind: "journal",
      reply: "Send a photo of the page, or journal: title plus the words.",
    }
  }
  const title = text.split(/\n/)[0]!.slice(0, 80) || defaultJournalTitle(now)
  const body = `<p>${escapeHtmlText(text).replace(/\n+/g, "</p><p>")}</p>`
  const doc = parkScanDocument({ title, body: sanitizeDocHtml(body), now })
  return {
    status: "ok",
    kind: "journal",
    reply: `Docs: ${doc.description}`,
    summary: `Journal “${doc.description}”`,
    itemIds: [doc.id],
  }
}
