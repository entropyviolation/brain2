/**
 * scripts/speed-read-api.mjs — the Speed Read PDF library, kept on this Mac.
 *
 * Every PDF opened in the Speed Read module is posted here once, so the iPhone
 * app can list and open the same files.
 *
 * - `GET  /api/speed-read`            the library, newest first: `{ id, name, bytes, addedAt, openedAt }`.
 * - `POST /api/speed-read`            raw PDF body, `X-File-Name` (URI-encoded). Same bytes = same id, so a
 *                                     re-upload only bumps `openedAt`.
 * - `GET  /api/speed-read/file/<id>`  the PDF.
 * - `PATCH  /api/speed-read/<id>`     JSON `{ page, word? }` saves where the book was left (page 1-based,
 *                                     word 0-based on that page) and stamps `savedAt`.
 * - `DELETE /api/speed-read/<id>`     removes one from the library.
 *
 * Files live in `data/speed-read/` (gitignored), the list in `data/speed-read/library.json`.
 * A public website Origin is refused. When `BRAIN2_PHONE_HUB_TOKEN` is set, a request from
 * off this Mac needs `Authorization: Bearer <token>`, the same token the phone already holds.
 * Not a Next.js route (`output: "export"` has none). Both dev and prod servers call it.
 */
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { guardBrowserOrigin } from "../lib/ingest/request-origin.mjs"
import { isLoopbackRemoteAddress } from "./screentime-api.mjs"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const PREFIX = "/api/speed-read"
export const SPEED_READ_MAX_BYTES = 200 * 1024 * 1024

export const speedReadDir = () => process.env.BRAIN2_SPEED_READ_DIR || path.join(ROOT, "data", "speed-read")

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-File-Name",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  }
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(json), ...cors() })
  res.end(json)
}

function authorized(req) {
  const token = process.env.BRAIN2_PHONE_HUB_TOKEN || ""
  if (!token || isLoopbackRemoteAddress(req.socket?.remoteAddress)) return true
  const header = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization
  const given = typeof header === "string" ? header.replace(/^Bearer\s+/i, "") : ""
  const a = Buffer.from(token)
  const b = Buffer.from(given)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const libraryPath = (dir) => path.join(dir, "library.json")
const validId = (id) => typeof id === "string" && /^[a-f0-9]{16}$/.test(id)

export function loadLibrary(dir = speedReadDir()) {
  try {
    const parsed = JSON.parse(fs.readFileSync(libraryPath(dir), "utf8"))
    return Array.isArray(parsed?.items) ? parsed.items.filter((x) => x && validId(x.id)) : []
  } catch {
    return []
  }
}

function saveLibrary(dir, items) {
  fs.mkdirSync(dir, { recursive: true })
  const file = libraryPath(dir)
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, items }, null, 2))
  fs.renameSync(tmp, file)
}

const sorted = (items) => [...items].sort((a, b) => (b.openedAt || b.addedAt) - (a.openedAt || a.addedAt))

/** A display name from an upload header: no folders, no `.pdf`, at most 160 chars. */
export function cleanPdfName(raw) {
  let name = ""
  try {
    name = decodeURIComponent(String(raw || ""))
  } catch {
    name = String(raw || "")
  }
  name = name.split(/[\\/]/).pop().replace(/\.pdf$/i, "").replace(/[\u0000-\u001f]/g, "").trim()
  return name.slice(0, 160) || "Untitled"
}

/** Store one PDF. Returns the library entry. Throws a plain message. */
export function addPdf(dir, bytes, rawName, now = Date.now()) {
  if (!bytes || bytes.length < 5 || bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("That is not a PDF.")
  const id = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16)
  const items = loadLibrary(dir)
  const hit = items.find((x) => x.id === id)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${id}.pdf`)
  if (!fs.existsSync(file)) fs.writeFileSync(file, bytes)
  let entry
  if (hit) {
    hit.openedAt = now
    entry = hit
  } else {
    entry = { id, name: cleanPdfName(rawName), bytes: bytes.length, addedAt: now, openedAt: now }
    items.push(entry)
  }
  saveLibrary(dir, items)
  return entry
}

/**
 * Save where a book was left: `page` (1-based) and, when given, `word` (0-based index on that page).
 * `savedAt` lets another device tell its copy is older. Returns the entry, or null for an unknown id.
 */
export function setPdfPage(dir, id, page, word, now = Date.now()) {
  if (!validId(id)) return null
  const items = loadLibrary(dir)
  const hit = items.find((x) => x.id === id)
  if (!hit) return null
  hit.page = Math.min(100000, Math.max(1, Math.round(Number(page)) || 1))
  const w = Math.round(Number(word))
  hit.word = Number.isFinite(w) ? Math.min(1000000, Math.max(0, w)) : 0
  hit.savedAt = now
  saveLibrary(dir, items)
  return hit
}

export function removePdf(dir, id) {
  if (!validId(id)) return false
  const items = loadLibrary(dir)
  const next = items.filter((x) => x.id !== id)
  if (next.length === items.length) return false
  saveLibrary(dir, next)
  try {
    fs.unlinkSync(path.join(dir, `${id}.pdf`))
  } catch {
    /* already gone */
  }
  return true
}

function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on("data", (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error("too large"))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

export async function handleSpeedReadApi(req, res, pathname, deps = {}) {
  const route = String(pathname || "").replace(/\/+$/, "") || "/"
  if (route !== PREFIX && !route.startsWith(`${PREFIX}/`)) return false
  if (!guardBrowserOrigin(req, res)) return true
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors())
    res.end()
    return true
  }
  if (!authorized(req)) {
    sendJson(res, 401, { ok: false, error: "hub token required" })
    return true
  }
  const dir = deps.dir || speedReadDir()

  if (route === PREFIX && req.method === "GET") {
    sendJson(res, 200, { ok: true, items: sorted(loadLibrary(dir)) })
    return true
  }

  if (route === PREFIX && req.method === "POST") {
    let bytes
    try {
      bytes = await readRaw(req, SPEED_READ_MAX_BYTES)
    } catch {
      sendJson(res, 413, { ok: false, error: "PDF is over 200 MB." })
      return true
    }
    try {
      sendJson(res, 200, { ok: true, item: addPdf(dir, bytes, req.headers["x-file-name"]) })
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) })
    }
    return true
  }

  if (route.startsWith(`${PREFIX}/file/`) && req.method === "GET") {
    const id = route.slice(`${PREFIX}/file/`.length)
    const file = validId(id) ? path.join(dir, `${id}.pdf`) : ""
    if (!file || !fs.existsSync(file)) {
      sendJson(res, 404, { ok: false, error: "not found" })
      return true
    }
    const body = fs.readFileSync(file)
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": body.length,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      ...cors(),
    })
    res.end(body)
    return true
  }

  if (req.method === "PATCH" && route.startsWith(`${PREFIX}/`)) {
    let body = {}
    try {
      body = JSON.parse((await readRaw(req, 4096)).toString("utf8") || "{}")
    } catch {
      sendJson(res, 400, { ok: false, error: "bad body" })
      return true
    }
    const item = setPdfPage(dir, route.slice(`${PREFIX}/`.length), body?.page, body?.word)
    sendJson(res, item ? 200 : 404, item ? { ok: true, item } : { ok: false, error: "not found" })
    return true
  }

  if (req.method === "DELETE") {
    const id = route.slice(`${PREFIX}/`.length)
    const removed = removePdf(dir, id)
    sendJson(res, removed ? 200 : 404, { ok: removed })
    return true
  }

  sendJson(res, 405, { ok: false, error: "method" })
  return true
}
