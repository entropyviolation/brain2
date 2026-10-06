/**
 * electron/static-file.js — Memoized app:// static resolver
 *
 * Same lookup as a static file server (file, route.html, route/index.html,
 * then the SPA index). Repeated asset requests must not stat the same path
 * again for the life of the process. `out/` does not change while a packaged
 * app is running.
 */
const path = require("path")

function resolveStaticFileUncached(fsImpl, outDir, pathname) {
  const relativePath = decodeURIComponent(pathname)
  if (relativePath === "/" || relativePath === "") {
    return path.join(outDir, "index.html")
  }

  const candidate = path.join(outDir, relativePath)

  if (fsImpl.existsSync(candidate) && fsImpl.statSync(candidate).isFile()) {
    return candidate
  }

  if (fsImpl.existsSync(`${candidate}.html`)) {
    return `${candidate}.html`
  }

  const indexCandidate = path.join(candidate, "index.html")
  if (fsImpl.existsSync(indexCandidate)) {
    return indexCandidate
  }

  return path.join(outDir, "index.html")
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

module.exports = { createStaticFileResolver, resolveStaticFileUncached }
