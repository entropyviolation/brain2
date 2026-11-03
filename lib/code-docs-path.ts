/**
 * lib/code-docs-path.ts — Relative links inside a `docs/` page.
 *
 * A link is resolved against the file that contains it and must stay inside
 * the folder. The raw URL is what the dev server serves. Electron `app://`
 * does not use that URL; the viewer fetches bytes instead.
 */

export type DocHref =
  | { kind: "hash" }
  | { kind: "external" }
  | { kind: "file"; path: string; hash: string }

export function codeDocRawUrl(rel: string): string {
  const parts = rel.split("/").filter(Boolean).map((seg) => encodeURIComponent(seg))
  return `/api/code-docs/raw/${parts.join("/")}`
}

/** Resolve `href` as written in `fromFile` (`docs/`-relative, posix). */
export function resolveDocHref(fromFile: string, href: string): DocHref | null {
  const trimmed = href.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("#")) return { kind: "hash" }
  if (trimmed.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return { kind: "external" }
  const hashAt = trimmed.indexOf("#")
  const hash = hashAt >= 0 ? trimmed.slice(hashAt) : ""
  const raw = (hashAt >= 0 ? trimmed.slice(0, hashAt) : trimmed).split("?")[0]
  if (!raw) return { kind: "hash" }
  const base = fromFile.split("/").slice(0, -1).filter(Boolean)
  const parts = [...base]
  for (const seg of raw.split("/")) {
    if (seg === "" || seg === ".") continue
    let decoded = seg
    try {
      decoded = decodeURIComponent(seg)
    } catch {
      return null
    }
    if (decoded === "..") {
      if (parts.length === 0) return null
      parts.pop()
      continue
    }
    if (!decoded || decoded.includes("\0") || decoded.includes("/") || decoded.includes("\\")) return null
    parts.push(decoded)
  }
  if (parts.length === 0) return null
  return { kind: "file", path: parts.join("/"), hash }
}
