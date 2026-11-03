/**
 * lib/code-docs-fs.mjs — Read-only walk of the repo `docs/` folder.
 *
 * Shared by the dev server (`scripts/code-docs-api.mjs`) and Electron
 * (`electron/code-docs.js`). Paths stay inside `docs/`. Symlinks are skipped.
 * A missing folder returns `missing: true` and no files.
 */
import fs from "node:fs"
import path from "node:path"

const SKIP = new Set([".DS_Store"])
const MAX_BYTES = 32 * 1024 * 1024

const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"])
const HTML = new Set(["html", "htm"])
const MARKDOWN = new Set(["md", "markdown"])
const TEXT = new Set([
  "txt",
  "json",
  "js",
  "mjs",
  "cjs",
  "css",
  "sh",
  "yml",
  "yaml",
  "toml",
  "csv",
  "xml",
  "svg",
])

const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  markdown: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  cjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  sh: "text/plain; charset=utf-8",
  woff: "font/woff",
  woff2: "font/woff2",
}

function extOf(name) {
  const i = name.lastIndexOf(".")
  return i <= 0 ? "" : name.slice(i + 1).toLowerCase()
}

export function kindForName(name) {
  const ext = extOf(name)
  if (MARKDOWN.has(ext)) return "markdown"
  if (HTML.has(ext)) return "html"
  if (IMAGE.has(ext)) return "image"
  if (TEXT.has(ext)) return "text"
  return "binary"
}

export function mimeForName(name) {
  return MIME[extOf(name)] || (kindForName(name) === "text" ? "text/plain; charset=utf-8" : "application/octet-stream")
}

/**
 * Relative path inside `root`, or null when it would leave the folder.
 * `rel` is posix (`screenshots/a.png`). Empty, absolute, and `..` are refused.
 */
export function safeDocPath(root, rel) {
  if (typeof rel !== "string" || !rel || rel.includes("\0") || rel.includes("\\")) return null
  const trimmed = rel.replace(/^\/+/, "")
  if (!trimmed) return null
  const parts = []
  for (const seg of trimmed.split("/")) {
    if (seg === "" || seg === "." || seg === "..") return null
    try {
      parts.push(decodeURIComponent(seg))
    } catch {
      return null
    }
  }
  if (parts.some((seg) => seg === "" || seg === "." || seg === ".." || seg.includes("\0") || seg.includes("/") || seg.includes("\\"))) {
    return null
  }
  const rootResolved = path.resolve(root)
  const abs = path.resolve(rootResolved, ...parts)
  if (abs !== rootResolved && !abs.startsWith(rootResolved + path.sep)) return null
  return abs
}

export function listDocs(root) {
  const rootResolved = path.resolve(root)
  if (!fs.existsSync(rootResolved)) return { missing: true, files: [] }
  const files = []
  const walk = (dir, rel) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      if (SKIP.has(ent.name) || ent.name.startsWith(".")) continue
      if (ent.isSymbolicLink()) continue
      const childRel = rel ? `${rel}/${ent.name}` : ent.name
      const childAbs = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        walk(childAbs, childRel)
        continue
      }
      if (!ent.isFile()) continue
      let size = 0
      try {
        size = fs.statSync(childAbs).size
      } catch {
        continue
      }
      files.push({
        path: childRel,
        name: ent.name,
        dir: rel,
        kind: kindForName(ent.name),
        bytes: size,
      })
    }
  }
  walk(rootResolved, "")
  files.sort((a, b) => a.path.localeCompare(b.path))
  return { missing: false, files }
}

export function readDocFile(root, rel) {
  const abs = safeDocPath(root, rel)
  if (!abs) return { ok: false, error: "bad path" }
  let st
  try {
    st = fs.statSync(abs)
  } catch {
    return { ok: false, error: "missing" }
  }
  if (!st.isFile()) return { ok: false, error: "not a file" }
  if (st.size > MAX_BYTES) return { ok: false, error: "too large" }
  const mime = mimeForName(path.basename(abs))
  const kind = kindForName(path.basename(abs))
  if (kind === "image" || kind === "binary") {
    const data = fs.readFileSync(abs).toString("base64")
    return { ok: true, mime, encoding: "base64", data, bytes: st.size }
  }
  return { ok: true, mime, encoding: "utf8", text: fs.readFileSync(abs, "utf8"), bytes: st.size }
}
