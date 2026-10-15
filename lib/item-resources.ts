/**
 * lib/item-resources.ts — Files attached to an item as resources (`Task.resources`)
 *
 * Any file can be attached: a PDF, a picture, a recording, a spreadsheet.
 * Bytes go to the attachments IndexedDB (`lib/attachments.ts`) exactly like
 * `file` attributes; the item keeps a small `ItemResource` record.
 */
import type { FileValue, ItemResource } from "@/lib/types"

export type ResourceKind = "image" | "pdf" | "audio" | "video" | "text" | "sheet" | "archive" | "other"

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|html?|css|js|ts|tsx|py|rtf|log|yaml|yml)$/i
const SHEET_EXT = /\.(xlsx?|numbers|ods|csv|tsv)$/i
const ARCHIVE_EXT = /\.(zip|rar|7z|tar|gz|tgz)$/i
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg|heic)$/i

export function resourceKind(file: Pick<FileValue, "mime" | "name">): ResourceKind {
  const mime = (file.mime || "").toLowerCase()
  const name = file.name || ""
  if (mime.startsWith("image/") || IMAGE_EXT.test(name)) return "image"
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf"
  if (mime.startsWith("audio/")) return "audio"
  if (mime.startsWith("video/")) return "video"
  if (SHEET_EXT.test(name) || mime.includes("spreadsheet") || mime.includes("excel")) return "sheet"
  if (ARCHIVE_EXT.test(name) || mime.includes("zip")) return "archive"
  if (mime.startsWith("text/") || mime === "application/json" || TEXT_EXT.test(name)) return "text"
  return "other"
}

/** Short engraved label for a kind ("PDF", "IMG", …). */
export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  image: "IMG",
  pdf: "PDF",
  audio: "AUD",
  video: "VID",
  text: "TXT",
  sheet: "SHT",
  archive: "ZIP",
  other: "FILE",
}

/** Human-readable size ("12 KB"). Empty when unknown. */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return ""
  const units = ["B", "KB", "MB", "GB"]
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`
}

export function toResource(file: FileValue, now: Date = new Date()): ItemResource {
  return { ...file, addedAt: now.toISOString() }
}

/** Total bytes across resources (unknown sizes count as 0). */
export function resourcesTotalBytes(resources: readonly ItemResource[] | undefined): number {
  return (resources ?? []).reduce((sum, r) => sum + (r.size ?? 0), 0)
}

/** Searchable text: names, captions, and any extracted text. */
export function resourcesText(resources: readonly ItemResource[] | undefined): string {
  return (resources ?? [])
    .map((r) => [r.name, r.caption, r.extractedText].filter(Boolean).join(" "))
    .join("\n")
}
