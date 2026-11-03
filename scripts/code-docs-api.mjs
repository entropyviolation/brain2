/**
 * scripts/code-docs-api.mjs — Serve the repo `docs/` folder on the local app.
 *
 * `GET /api/code-docs` is the file list. `GET /api/code-docs/raw/<path>` is
 * one file. Paths cannot leave `docs/`. A public website Origin is refused.
 * This is not a Next.js route (`output: "export"` has none). Both
 * `cogs-dev-server.mjs` and `cogs-prod-server.mjs` call it.
 */
import path from "node:path"
import { fileURLToPath } from "node:url"
import { guardBrowserOrigin } from "../lib/ingest/request-origin.mjs"
import { listDocs, mimeForName, readDocFile, safeDocPath } from "../lib/code-docs-fs.mjs"

const DEFAULT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs")

function sendJson(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  })
  res.end(json)
}

function rawRel(pathname) {
  const prefix = "/api/code-docs/raw/"
  if (!pathname.startsWith(prefix)) return null
  const rest = pathname.slice(prefix.length).replace(/\/+$/, "")
  if (!rest) return null
  return rest
}

export async function handleCodeDocsApi(req, res, pathname, deps = {}) {
  const route = String(pathname || "").replace(/\/+$/, "") || "/"
  const isCatalog = route === "/api/code-docs"
  const isRaw = route.startsWith("/api/code-docs/raw/")
  if (!isCatalog && !isRaw) return false
  if (!guardBrowserOrigin(req, res)) return true

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {})
    return true
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "method" })
    return true
  }

  const root = deps.docsRoot || DEFAULT_ROOT
  if (isCatalog) {
    const listed = listDocs(root)
    sendJson(res, 200, { ok: true, missing: listed.missing, files: listed.files })
    return true
  }

  const rel = rawRel(pathname)
  const abs = rel ? safeDocPath(root, rel) : null
  if (!abs) {
    sendJson(res, 400, { ok: false, error: "bad path" })
    return true
  }
  const file = readDocFile(root, rel)
  if (!file.ok) {
    sendJson(res, file.error === "too large" ? 413 : 404, file)
    return true
  }
  const body = file.encoding === "utf8" ? Buffer.from(file.text, "utf8") : Buffer.from(file.data, "base64")
  const mime = file.mime || mimeForName(path.basename(abs))
  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": body.length,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
  })
  res.end(body)
  return true
}

export function codeDocsRoot() {
  return DEFAULT_ROOT
}
