/**
 * lib/sweep-rules.ts — Sweep path rules
 *
 * Pure decisions for the Sweep workspace: which cache and preference names
 * stay off the list, which copy of a duplicate is kept, and which paths a
 * clean is allowed to touch. The disk walk lives in `electron/sweep.js` and
 * mirrors these functions (`sweepRules` there). Unit tests lock both copies.
 *
 * Sweep never names another product. It only offers files this user can
 * regenerate or already threw away, plus duplicate copies outside that scan.
 */

export const SWEEP_TEXT_HEAD_CHARS = 2000

export const SWEEP_CATEGORIES = [
  { id: "caches", label: "User caches", permanent: false },
  { id: "logs", label: "User logs", permanent: false },
  { id: "xcode", label: "Xcode", permanent: false },
  { id: "trash", label: "Trash", permanent: true },
  { id: "preferences", label: "Orphan preferences", permanent: false },
] as const

export type SweepCategoryId = (typeof SWEEP_CATEGORIES)[number]["id"]

export type SweepPreviewKind = "image" | "video" | "audio" | "text" | "file"

export interface SweepCopyRef {
  path: string
  size: number
  mtimeMs: number
}

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "heic", "heif"])
const VIDEO_EXT = new Set(["mp4", "m4v", "mov", "webm"])
const AUDIO_EXT = new Set(["mp3", "m4a", "wav", "aiff", "aif", "flac", "ogg", "aac"])
const TEXT_EXT = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "xml", "html", "htm", "css",
  "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "java", "swift", "c", "h",
  "cpp", "rtf", "log", "yml", "yaml", "toml", "ini", "sh",
])

const DUP_SKIP = new Set(["library", ".trash", ".git", "node_modules"])

export function stripSlash(p: string): string {
  if (typeof p !== "string" || p.length <= 1) return typeof p === "string" ? p : ""
  return p.replace(/[/\\]+$/, "")
}

export function pathSegments(p: string): string[] {
  return String(p).split(/[/\\]+/).filter(Boolean)
}

export function pathBase(p: string): string {
  const parts = pathSegments(p)
  return parts[parts.length - 1] || p
}

/** Join under `home` with the separator `home` already uses. */
export function underHome(home: string, ...parts: string[]): string {
  const h = stripSlash(home)
  const sep = h.includes("\\") && !h.includes("/") ? "\\" : "/"
  return [h, ...parts.filter((part) => part !== "")].join(sep)
}

/**
 * True when `realChild` is `realRoot` or a descendant. A sibling prefix
 * (`/a/bc` against `/a/b`) does not count. Both arguments are real paths.
 */
export function pathStaysInside(realChild: string, realRoot: string): boolean {
  const child = stripSlash(realChild)
  const root = stripSlash(realRoot)
  if (!child || !root) return false
  if (child === root) return true
  const sep = root.includes("\\") && !root.includes("/") ? "\\" : "/"
  return child.startsWith(root + sep)
}

export function isSweepPath(p: string): boolean {
  return typeof p === "string" && p.startsWith("/") && !p.includes("\0") && p.length > 1 && p.length < 4096
}

export function isDownloadsPath(p: string): boolean {
  return pathSegments(p).includes("Downloads")
}

/** Account, CloudKit, and HomeKit cache folders stay off the list. */
export function isCacheDenied(name: string): boolean {
  const n = String(name || "").toLowerCase()
  return n.includes("cloudkit") || n.includes("homekit") || n.includes("account")
}

export function isLanguagePackPath(realPath: string): boolean {
  return pathSegments(realPath).some((part) => part.endsWith(".lproj") || part.endsWith(".app"))
}

export function preferenceSkipped(name: string): boolean {
  const base = pathBase(name)
  if (base.startsWith("com.apple.")) return true
  if (base === "ByHost" || base.includes(".ByHost.")) return true
  const parts = pathSegments(name)
  return parts.includes("ByHost")
}

export function plistBundleId(filename: string): string | null {
  const base = pathBase(filename)
  if (!base.endsWith(".plist")) return null
  if (preferenceSkipped(base)) return null
  const id = base.slice(0, -".plist".length)
  if (!id) return null
  return id
}

export function isOrphanPreference(filename: string, bundleIds: ReadonlySet<string>): boolean {
  const id = plistBundleId(filename)
  if (!id) return false
  return !bundleIds.has(id)
}

export function scanGroupChecked(category: SweepCategoryId, name: string): boolean {
  if (category === "caches") return !isCacheDenied(name)
  if (category === "logs") return name !== "DiagnosticReports"
  if (category === "xcode") return name === "DerivedData"
  return false
}

export function forbiddenScanPaths(home: string): string[] {
  const h = stripSlash(home)
  return [
    "/System",
    "/usr",
    "/Library",
    underHome(h, "Library", "Mail"),
    underHome(h, "Library", "Photos"),
    underHome(h, "Library", "Containers", "com.apple.mail"),
    underHome(h, "Library", "Application Support", "MobileSync"),
    underHome(h, "Library", "LaunchAgents"),
    underHome(h, "Pictures", "Photos Library.photoslibrary"),
    underHome(h, "Documents"),
    underHome(h, "Desktop"),
    underHome(h, "Downloads"),
  ]
}

export function isForbiddenScanPath(realPath: string, home: string, extraRoots: readonly string[] = []): boolean {
  const p = stripSlash(realPath)
  if (!p) return true
  if (isLanguagePackPath(p)) return true
  const roots = forbiddenScanPaths(home).concat(extraRoots)
  for (const root of roots) {
    if (root && pathStaysInside(p, root)) return true
  }
  return false
}

export function scanAllowRoot(home: string, category: SweepCategoryId): string {
  if (category === "caches") return underHome(home, "Library", "Caches")
  if (category === "logs") return underHome(home, "Library", "Logs")
  if (category === "xcode") return underHome(home, "Library", "Developer", "Xcode")
  if (category === "trash") return underHome(home, ".Trash")
  return underHome(home, "Library", "Preferences")
}

export function isDeletableSweepPath(
  realPath: string,
  allowRoot: string,
  home: string,
  extraRoots: readonly string[] = [],
): boolean {
  const p = stripSlash(realPath)
  const root = stripSlash(allowRoot)
  const h = stripSlash(home)
  if (!p || !root || p === "/" || p === h || p === root) return false
  if (!pathStaysInside(p, root)) return false
  if (isForbiddenScanPath(p, h, extraRoots)) return false
  return true
}

export function cleanPathAllowed(
  realPath: string,
  allowRoot: string,
  home: string,
  category: SweepCategoryId,
  extraRoots: readonly string[] = [],
): boolean {
  if (!isDeletableSweepPath(realPath, allowRoot, home, extraRoots)) return false
  const base = pathBase(realPath)
  if (category === "caches" && isCacheDenied(base)) return false
  if (category === "preferences" && preferenceSkipped(base)) return false
  if (isLanguagePackPath(realPath)) return false
  return true
}

export function duplicateDirSkipped(name: string): boolean {
  return DUP_SKIP.has(String(name || "").toLowerCase())
}

export function duplicateRootAllowed(realPath: string, home: string): boolean {
  const p = stripSlash(realPath)
  const h = stripSlash(home)
  if (!p || p === "/" || p === h) return false
  if (pathStaysInside(p, "/System") || pathStaysInside(p, "/usr") || pathStaysInside(p, "/Library")) return false
  if (pathStaysInside(p, underHome(h, "Library"))) return false
  if (pathStaysInside(p, underHome(h, ".Trash"))) return false
  if (duplicateDirSkipped(pathBase(p))) return false
  return true
}

export function duplicateCleanAllowed(realPath: string, root: string, home: string): boolean {
  const p = stripSlash(realPath)
  const r = stripSlash(root)
  const h = stripSlash(home)
  if (!p || !r || p === "/" || p === h || p === r) return false
  if (!pathStaysInside(p, r)) return false
  if (!duplicateRootAllowed(r, h)) return false
  return true
}

export function defaultDuplicateRoots(home: string): string[] {
  return ["Desktop", "Documents", "Downloads", "Pictures", "Movies", "Music"].map((name) => underHome(home, name))
}

/**
 * Keep the oldest copy. When a newer copy is the only one outside Downloads,
 * keep that one instead.
 */
export function chooseKeptPath(copies: readonly SweepCopyRef[]): string {
  if (!copies.length) return ""
  const sorted = copies.slice().sort((a, b) => {
    const dt = (Number.isFinite(a.mtimeMs) ? a.mtimeMs : 0) - (Number.isFinite(b.mtimeMs) ? b.mtimeMs : 0)
    if (dt !== 0) return dt
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
  })
  const oldest = sorted[0]
  const oldestMs = Number.isFinite(oldest.mtimeMs) ? oldest.mtimeMs : 0
  const outside = copies.filter((copy) => !isDownloadsPath(copy.path))
  if (outside.length === 1) {
    const only = outside[0]
    const ms = Number.isFinite(only.mtimeMs) ? only.mtimeMs : 0
    if (ms > oldestMs) return only.path
  }
  return oldest.path
}

/** Paths from `requested` that belong to this group and still leave the kept copy. */
export function removableDuplicatePaths(copies: readonly SweepCopyRef[], requested: readonly string[]): string[] {
  if (copies.length < 2) return []
  const keep = chooseKeptPath(copies)
  const inGroup = new Set(copies.map((copy) => copy.path))
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of requested) {
    if (p === keep || !inGroup.has(p) || seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  if (out.length >= copies.length) return []
  return out
}

export function pathsFromLastResult(requested: readonly string[], known: ReadonlySet<string>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of requested) {
    if (!known.has(p) || seen.has(p) || !isSweepPath(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
}

export function sizesWorthHashing<T extends { size: number }>(files: readonly T[]): T[] {
  const counts = new Map<number, number>()
  for (const file of files) {
    if (!file || !(file.size > 0)) continue
    counts.set(file.size, (counts.get(file.size) || 0) + 1)
  }
  return files.filter((file) => file && (counts.get(file.size) || 0) > 1)
}

export function previewKindForPath(filePath: string): SweepPreviewKind {
  const base = pathBase(filePath).toLowerCase()
  const dot = base.lastIndexOf(".")
  const ext = dot >= 0 ? base.slice(dot + 1) : ""
  if (IMAGE_EXT.has(ext)) return "image"
  if (VIDEO_EXT.has(ext)) return "video"
  if (AUDIO_EXT.has(ext)) return "audio"
  if (TEXT_EXT.has(ext)) return "text"
  return "file"
}

export function formatSweepBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  if (i === 0) return `${Math.round(n)} B`
  const text = n >= 10 || Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1)
  return `${text} ${units[i]}`
}
