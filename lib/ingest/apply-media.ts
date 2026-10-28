/**
 * lib/ingest/apply-media.ts — Photos → journal Docs / receipt checkout; PDFs → Docs
 *
 * Downloads already happened in the poller. This module OCRs, deskews, and
 * writes Zustand the same way the text executor does.
 */
import { itemTitle } from "@/lib/item-utils"
import { escapeHtmlText, sanitizeDocHtml } from "@/lib/doc-html"
import { pdfArrayBufferToHtml } from "@/lib/pdf-to-html"
import { attachmentUri, dataUrlToBlob, deleteAttachment, getAttachmentDataUrl, putAttachment } from "@/lib/attachments"
import { formatLocalDateKey } from "@/lib/date-utils"
import { fileLogPhoto } from "@/lib/log-photo"
import { useWardrobeStore } from "@/lib/wardrobe"
import { applyReceiptText } from "./apply-receipt"
import { createScanDocument, parkScanDocument, SCAN_DOCS_FOLDER } from "./apply-scan-doc"
import { dataUrlToBytes } from "./bytes"
import { jpegPagesToPdf, dataUrlToJpegPage } from "./jpeg-pdf"
import { ocrImages } from "./ocr"
import { looksLikeReceipt } from "./receipt-parse"
import { asJpegDataUrl, enhanceScan } from "./scan-page"
import { expandIngestText } from "./expand"
import { parseMessage } from "./parse-message"
import type { ApplyResult, IncomingAttachment, IncomingMessage, PendingClarify } from "./types"

export const MEDIA_QUESTION = "Journal, outfit, or log?"

export async function applyMedia(message: IncomingMessage, now = new Date()): Promise<ApplyResult> {
  const attachments = message.attachments ?? []
  const caption = expandIngestText(message.text || "")
  const route = captionRoute(caption)
  const intent = parseMessage(caption)
  const forced =
    intent.kind === "receipt" || intent.kind === "journal" || intent.kind === "pdf"
      ? intent.kind
      : route?.kind ?? null
  const titleHint = route ? route.note : forced ? intent.payload.trim() : caption.trim()

  const photos = attachments.filter((row) => row.kind === "photo")
  const pdfs = attachments.filter((row) => row.kind === "pdf")

  if (forced === "outfit") return fileOutfitPhotos(photos, titleHint, now)
  if (forced === "log") return fileLogPhotos(photos, titleHint, now)

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
    return askMediaRoute(photos, caption, now)
  }

  const replies: string[] = []
  const ids: string[] = []

  if (pdfs.length) {
    for (const pdf of pdfs) {
      const doc = await ingestPdfAttachment(pdf, titleHint, now)
      replies.push(`Docs: ${itemTitle(doc)}`)
      ids.push(doc.id)
    }
  }

  if (photos.length) {
    const doc = await ingestJournalPhotos(photos, titleHint || defaultJournalTitle(now), now, message.ocrText)
    replies.push(`Docs: ${itemTitle(doc)} (${photos.length} page${photos.length === 1 ? "" : "s"})`)
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

const CAPTION_ROUTES: { kind: "outfit" | "log"; aliases: string[] }[] = [
  { kind: "outfit", aliases: ["outfit", "look", "wore"] },
  { kind: "log", aliases: ["log", "photo"] },
]

/** Caption on a photo. Colon optional, same shape as `journal:`. Text-only `log:` stays a tracking note. */
export function captionRoute(caption: string): { kind: "outfit" | "log"; note: string } | null {
  const text = caption.replace(/^\uFEFF/, "").trim()
  const breakAt = text.indexOf("\n")
  const first = (breakAt === -1 ? text : text.slice(0, breakAt)).trim()
  const rest = breakAt === -1 ? "" : text.slice(breakAt + 1).trim()
  const lower = first.toLowerCase()
  for (const route of CAPTION_ROUTES) {
    for (const alias of route.aliases) {
      if (!lower.startsWith(alias)) continue
      const after = first.slice(alias.length)
      if (after.length > 0 && after[0] !== ":" && after[0] !== "：" && !/\s/.test(after[0]!)) continue
      const note = [after.replace(/^[:：]\s*/, "").trim(), rest].filter(Boolean).join("\n")
      return { kind: route.kind, note }
    }
  }
  return null
}

function newHoldId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `hold_${crypto.randomUUID()}`
  return `hold_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

async function holdPhoto(photo: IncomingAttachment): Promise<string | null> {
  if (!photo.dataUrl || photo.dataUrl.startsWith("idb:")) return photo.dataUrl?.startsWith("idb:") ? photo.dataUrl : null
  const id = newHoldId()
  const blob = dataUrlToBlob(photo.dataUrl)
  if (!blob.size && !photo.dataUrl.startsWith("data:")) return null
  const uri = await putAttachment(id, blob, { name: photo.name || "photo.jpg", mime: photo.mime || blob.type || "image/jpeg" })
  return uri || attachmentUri(id)
}

export async function releaseMediaHold(pending: PendingClarify): Promise<void> {
  for (const id of pending.mediaHold?.attachmentIds ?? []) {
    if (id.startsWith("data:")) continue
    await deleteAttachment(id)
  }
}

function mediaPending(ids: string[], caption: string, now: Date): PendingClarify {
  return {
    kind: "media",
    query: caption.slice(0, 80),
    candidates: [],
    createdAt: now.toISOString(),
    mediaHold: { attachmentIds: ids, sentAt: now.toISOString(), caption: caption.slice(0, 500) },
  }
}

function askAgain(pending: PendingClarify): ApplyResult {
  return {
    status: "needs_clarify",
    kind: "unknown",
    reply: MEDIA_QUESTION,
    pending,
  }
}

async function askMediaRoute(photos: IncomingAttachment[], caption: string, now: Date): Promise<ApplyResult> {
  const ids: string[] = []
  for (const photo of photos) {
    const uri = await holdPhoto(photo)
    if (uri && !uri.startsWith("data:")) ids.push(uri)
  }
  if (!ids.length) {
    return { status: "error", kind: "unknown", reply: "Nothing to scan. Send a photo or a PDF." }
  }
  return askAgain(mediaPending(ids, caption, now))
}

function dayReply(count: number, noun: string, now: Date, tail: string): string {
  const day = formatLocalDateKey(now)
  const lead = count === 1 ? noun : `${count} ${noun}${noun.endsWith("s") ? "" : "s"}`
  return `${lead} · ${day}. ${tail}`
}

async function fileOutfitPhotos(photos: IncomingAttachment[], note: string, now: Date): Promise<ApplyResult> {
  const ids: string[] = []
  for (const photo of photos) {
    const uri = await holdPhoto(photo)
    if (!uri || uri.startsWith("data:")) continue
    const id = useWardrobeStore.getState().addOutfit({
      dayKey: formatLocalDateKey(now),
      startMin: now.getHours() * 60 + now.getMinutes(),
      photoUri: uri,
      note: note || undefined,
      source: "bim",
    })
    if (id) ids.push(id)
  }
  if (!ids.length) return { status: "error", kind: "unknown", reply: "Send a photo with outfit:." }
  return {
    status: "ok",
    kind: "unknown",
    reply: dayReply(ids.length, "Outfit", now, "Tag the pieces on the Tracking log."),
    summary: `Outfit · ${formatLocalDateKey(now)}`,
    itemIds: ids,
  }
}

async function fileLogPhotos(photos: IncomingAttachment[], note: string, now: Date): Promise<ApplyResult> {
  const ids: string[] = []
  for (const photo of photos) {
    const uri = photo.dataUrl?.startsWith("idb:") ? photo.dataUrl : await holdPhoto(photo)
    if (!uri || uri.startsWith("data:")) continue
    const filed = await fileLogPhoto({
      takenAt: now,
      uri,
      title: note || undefined,
      name: photo.name || "log.jpg",
    })
    if (filed) ids.push(filed.id)
  }
  if (!ids.length) return { status: "error", kind: "unknown", reply: "Send a photo with log: or photo:." }
  return {
    status: "ok",
    kind: "unknown",
    reply: dayReply(ids.length, "Log photo", now, "It is on the day summary."),
    summary: `Log photo · ${formatLocalDateKey(now)}`,
    itemIds: ids,
  }
}

async function fileHeld(pending: PendingClarify, mode: "journal" | "outfit" | "log"): Promise<ApplyResult> {
  const ids = pending.mediaHold?.attachmentIds ?? []
  const sentAt = pending.mediaHold?.sentAt ? new Date(pending.mediaHold.sentAt) : new Date()
  const now = Number.isNaN(sentAt.getTime()) ? new Date() : sentAt
  const note = (pending.mediaHold?.caption ?? "").trim()
  if (mode === "outfit") {
    const made: string[] = []
    for (const uri of ids) {
      const id = useWardrobeStore.getState().addOutfit({
        dayKey: formatLocalDateKey(now),
        startMin: now.getHours() * 60 + now.getMinutes(),
        photoUri: uri,
        note: note || undefined,
        source: "bim",
      })
      if (id) made.push(id)
    }
    if (!made.length) return { status: "error", kind: "unknown", reply: "That photo is gone. Send it again." }
    return {
      status: "ok",
      kind: "unknown",
      reply: dayReply(made.length, "Outfit", now, "Tag the pieces on the Tracking log."),
      summary: `Outfit · ${formatLocalDateKey(now)}`,
      itemIds: made,
    }
  }
  if (mode === "log") {
    const made: string[] = []
    for (const uri of ids) {
      const filed = await fileLogPhoto({ takenAt: now, uri, title: note || undefined })
      if (filed) made.push(filed.id)
    }
    if (!made.length) return { status: "error", kind: "unknown", reply: "That photo is gone. Send it again." }
    return {
      status: "ok",
      kind: "unknown",
      reply: dayReply(made.length, "Log photo", now, "It is on the day summary."),
      summary: `Log photo · ${formatLocalDateKey(now)}`,
      itemIds: made,
    }
  }
  const photos: IncomingAttachment[] = []
  for (const uri of ids) {
    const dataUrl = await getAttachmentDataUrl(uri)
    if (!dataUrl) continue
    photos.push({ kind: "photo", mime: "image/jpeg", name: "page.jpg", dataUrl })
  }
  if (!photos.length) return { status: "error", kind: "journal", reply: "That photo is gone. Send it again." }
  const doc = await ingestJournalPhotos(photos, note || defaultJournalTitle(now), now)
  return {
    status: "ok",
    kind: "journal",
    reply: `Docs: ${itemTitle(doc)} (${photos.length} page${photos.length === 1 ? "" : "s"})`,
    summary: `Journal “${itemTitle(doc)}”`,
    itemIds: [doc.id],
  }
}

export async function resolveMediaChoice(pending: PendingClarify, text: string, now = new Date()): Promise<ApplyResult> {
  const answer = text.trim().toLowerCase()
  if (answer === "skip") {
    await releaseMediaHold(pending)
    return { status: "ok", kind: "unknown", reply: "Skipped.", summary: "Photo skipped" }
  }
  const mode =
    answer === "journal" || answer === "1"
      ? "journal"
      : answer === "outfit" || answer === "2"
        ? "outfit"
        : answer === "log" || answer === "3"
          ? "log"
          : null
  if (!mode) return askAgain(pending)
  return fileHeld(pending, mode)
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
    reply: `Docs: ${itemTitle(doc)}`,
    summary: `Journal “${itemTitle(doc)}”`,
    itemIds: [doc.id],
  }
}
