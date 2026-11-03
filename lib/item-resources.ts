/**
 * lib/item-resources.ts — Files attached to an item as resources (`Task.resources`)
 *
 * Any file can be attached: a PDF, a picture, a recording, a spreadsheet.
 * Bytes go to the attachments IndexedDB (`lib/attachments.ts`) exactly like
 * `file` attributes; the item keeps a small `ItemResource` record. On desktop a
 * file or folder can instead be linked where it lives (`lib/resource-links.ts`).
 * A web link stores `url` and a `url:<id>` uri, not bytes. `useNote` is what
 * the resource is for on the item that holds it (an operation's use of it).
 */
import type { FileValue, ItemResource } from "@/lib/types"

export const URL_URI_PREFIX = "url:"

export type ResourceKind = "image" | "pdf" | "audio" | "video" | "text" | "sheet" | "archive" | "folder" | "link" | "other"

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|html?|css|js|ts|tsx|py|rtf|log|yaml|yml)$/i
const SHEET_EXT = /\.(xlsx?|numbers|ods|csv|tsv)$/i
const ARCHIVE_EXT = /\.(zip|rar|7z|tar|gz|tgz)$/i
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg|heic)$/i

export function resourceKind(file: Pick<FileValue, "mime" | "name"> & { url?: string }): ResourceKind {
  const mime = (file.mime || "").toLowerCase()
  const name = file.name || ""
  if (file.url) return "link"
  if (mime === "inode/directory") return "folder"
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
  folder: "DIR",
  link: "LINK",
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

export function isWebLinkResource(resource: Pick<ItemResource, "url" | "uri">): boolean {
  return !!resource.url || resource.uri.startsWith(URL_URI_PREFIX)
}

/** A web address as an item resource. Null when it is not an http(s) URL. */
export function webLinkResource(raw: string, now: Date = new Date()): ItemResource | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    return null
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
  if (!parsed.hostname.includes(".")) return null
  const id = `url_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`
  const path = parsed.pathname === "/" ? "" : parsed.pathname
  return {
    id,
    name: `${parsed.hostname.replace(/^www\./, "")}${path}`,
    mime: "text/uri-list",
    uri: `${URL_URI_PREFIX}${id}`,
    addedAt: now.toISOString(),
    url: parsed.toString(),
  }
}

/** Total bytes across resources (unknown sizes count as 0). */
export function resourcesTotalBytes(resources: readonly ItemResource[] | undefined): number {
  return (resources ?? []).reduce((sum, r) => sum + (r.size ?? 0), 0)
}

/** Searchable text: names, captions, use notes, web addresses, and any extracted text. */
export function resourcesText(resources: readonly ItemResource[] | undefined): string {
  return (resources ?? [])
    .map((r) => [r.name, r.caption, r.useNote, r.url, r.extractedText].filter(Boolean).join(" "))
    .join("\n")
}
