/**
 * lib/resource-links.ts — Linked resources: keep a file where it is
 *
 * A linked `ItemResource` stores the file's path instead of its bytes
 * (`ItemResource.link`, `uri` = `link:<id>`). Desktop only: the bridge is
 * `window.desktop.fileLinks` (`electron/file-links.js`). The web build and the
 * phone show a linked resource's name, size, and searchable text, and cannot
 * open it. Plan and limits: `docs/RESOURCE_LINKS.md`.
 */
import type { ItemResource, ResourceLink } from "@/lib/types"

export const LINK_URI_PREFIX = "link:"

/** Auto mode links a file at or above this size and copies smaller ones. */
export const LINK_SUGGEST_BYTES = 50 * 1024 * 1024

export const FOLDER_MIME = "inode/directory"

/** What main reports about a path (`statLink`). */
export interface LinkStat extends ResourceLink {
  name: string
  size: number
}

export type LinkStatus = "ok" | "moved" | "missing"

export interface LinkResolution {
  status: LinkStatus
  link?: LinkStat
  /** How a moved file was found: `bookmark`, `fileId`, or `name-size`. */
  how?: string
}

export interface FileLinkBridge {
  pathForFile: (file: File) => string
  pick: (opts: { folders: boolean }) => Promise<LinkStat[]>
  stat: (path: string) => Promise<LinkStat | null>
  resolve: (link: ResourceLink & { size?: number }) => Promise<LinkResolution>
  /** Resolves to "" on success, else a short reason. */
  open: (path: string) => Promise<string>
  reveal: (path: string) => void
  extractText: (path: string) => Promise<string>
  previewUrl: (path: string) => Promise<string>
}

export type AttachMode = "auto" | "copy" | "link"

export function getFileLinkBridge(): FileLinkBridge | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { desktop?: { fileLinks?: FileLinkBridge } }).desktop?.fileLinks
}

export function isLinkedResource(r: Pick<ItemResource, "link" | "uri">): boolean {
  return !!r.link || r.uri.startsWith(LINK_URI_PREFIX)
}

/** Auto mode: link folders and big files, copy the rest. */
export function shouldLink(mode: AttachMode, stat: Pick<LinkStat, "isDir" | "size">): boolean {
  if (stat.isDir) return true
  if (mode === "link") return true
  if (mode === "copy") return false
  return stat.size >= LINK_SUGGEST_BYTES
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  heic: "image/heic",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  aiff: "audio/aiff",
  flac: "audio/flac",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
  zip: "application/zip",
}

/** Best guess from the extension; folders are `inode/directory`. */
export function mimeForPath(name: string, isDir = false): string {
  if (isDir) return FOLDER_MIME
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? ""
  return MIME_BY_EXT[ext] ?? "application/octet-stream"
}

function linkFields(stat: LinkStat): ResourceLink {
  const link: ResourceLink = { path: stat.path, isDir: stat.isDir }
  if (stat.fileId) link.fileId = stat.fileId
  if (stat.mtimeMs != null) link.mtimeMs = stat.mtimeMs
  if (stat.bookmark) link.bookmark = stat.bookmark
  if (stat.fileCount != null) link.fileCount = stat.fileCount
  if (stat.truncated) link.truncated = true
  return link
}

/** A new linked resource from a stat. */
export function linkedResource(stat: LinkStat, now: Date = new Date()): ItemResource {
  const id = `link_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    name: stat.name,
    mime: mimeForPath(stat.name, stat.isDir),
    uri: `${LINK_URI_PREFIX}${id}`,
    size: stat.size,
    addedAt: now.toISOString(),
    link: linkFields(stat),
  }
}

/**
 * Point an existing linked resource at a fresh stat (moved, or relocated by
 * hand). Keeps id, caption, addedAt, and extracted text. The name follows the
 * file, so a rename shows.
 */
export function relinkResource(resource: ItemResource, stat: LinkStat): ItemResource {
  return {
    ...resource,
    name: stat.name,
    mime: mimeForPath(stat.name, stat.isDir),
    size: stat.size,
    link: { ...linkFields(stat), bookmark: stat.bookmark ?? resource.link?.bookmark },
  }
}

/** True when a resolution changed where the resource points. */
export function resolutionMoved(resource: ItemResource, res: LinkResolution): boolean {
  return res.status === "moved" && !!res.link && res.link.path !== resource.link?.path
}

/** Bytes kept inside Brain2 vs. bytes left on disk. */
export function resourceBytesSplit(resources: readonly ItemResource[] | undefined): { stored: number; linked: number } {
  let stored = 0
  let linked = 0
  for (const r of resources ?? []) {
    if (isLinkedResource(r)) linked += r.size ?? 0
    else stored += r.size ?? 0
  }
  return { stored, linked }
}

/** Short folder label for the path line ("~/Design/Clients"). */
export function displayPath(p: string): string {
  const home = /^(\/Users\/[^/]+|\/home\/[^/]+|[A-Z]:\\Users\\[^\\]+)/.exec(p)?.[0]
  return home ? `~${p.slice(home.length)}` : p
}
