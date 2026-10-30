/**
 * electron/static-file.js — Memoized app:// static resolver
 *
 * Same lookup as a static file server (file, route.html, route/index.html,
 * then the SPA index). Repeated asset requests must not stat the same path
 * again for the life of the process. `out/` does not change while a packaged
 * app is running.
 *
 * A URL pathname is absolute (`/etc/passwd`). `path.join(outDir, pathname)`
 * would drop `outDir` on POSIX and serve a file outside the export. The
 * lookup strips that leading slash, then refuses `..` and a symlink whose
 * real path leaves `out/`.
 */
const path = require("path")

function indexFile(outDir) {
  return path.join(outDir, "index.html")
}

/** True when `candidate` resolves inside `root` (both absolute). */
function isInsideDir(root, candidate) {
  const base = path.resolve(root)
  const resolved = path.resolve(candidate)
  const rel = path.relative(base, resolved)
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel))
}

function realStaysInside(fsImpl, outDir, candidate) {
  if (typeof fsImpl.realpathSync !== "function") return true
  try {
    return isInsideDir(fsImpl.realpathSync(outDir), fsImpl.realpathSync(candidate))
  } catch {
    return false
  }
}

function fileInside(fsImpl, outDir, candidate) {
  if (!isInsideDir(outDir, candidate)) return false
  try {
    if (!fsImpl.existsSync(candidate) || !fsImpl.statSync(candidate).isFile()) return false
  } catch {
    return false
  }
  return realStaysInside(fsImpl, outDir, candidate)
}

function resolveStaticFileUncached(fsImpl, outDir, pathname) {
  const relativePath = decodeURIComponent(pathname)
  if (relativePath === "/" || relativePath === "") {
    return indexFile(outDir)
  }

  const rel = relativePath.replace(/^[/\\]+/, "")
  if (!rel || rel.includes("\0")) return indexFile(outDir)

  const candidate = path.join(outDir, rel)
  if (!isInsideDir(outDir, candidate)) return indexFile(outDir)

  if (fileInside(fsImpl, outDir, candidate)) return candidate

  const htmlCandidate = `${candidate}.html`
  if (fileInside(fsImpl, outDir, htmlCandidate)) return htmlCandidate

  const indexCandidate = path.join(candidate, "index.html")
  if (fileInside(fsImpl, outDir, indexCandidate)) return indexCandidate

  return indexFile(outDir)
}

function createStaticFileResolver(fsImpl, outDir) {
  const memo = new Map()
  return function resolveStaticFile(pathname) {
    const cached = memo.get(pathname)
    if (cached !== undefined) return cached
    const resolved = resolveStaticFileUncached(fsImpl, outDir, pathname)
    memo.set(pathname, resolved)
    return resolved
  }
}

module.exports = { createStaticFileResolver, isInsideDir, resolveStaticFileUncached }
