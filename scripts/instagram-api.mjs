/**
 * Dev hub for the Instagram report. Serves the build that the desktop app
 * made (`electron/instagram-report.js`, same `<userData>/instagram` folder)
 * so Chrome at localhost can show it. Ingest never runs here: Python only
 * runs from the Electron main process.
 *
 *   GET  /api/instagram/status
 *   GET  /api/instagram/removed      unsent or deleted DMs from the archive
 *   GET  /api/instagram/summary      {buildId, text} of summary.json, or null
 *   POST /api/instagram/ui-state     {key, value}
 *   GET  /api/instagram/report/<path>  report.html, thumbs/, media/
 *
 * Loopback-only: the dev server binds 0.0.0.0 for phone sync.
 */
import fs from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { isLoopbackRemoteAddress } from "./screentime-api.mjs"
import { guardBrowserOrigin } from "../lib/ingest/request-origin.mjs"

const require = createRequire(fileURLToPath(import.meta.url))
const ig = require("../electron/instagram-report.js")
const archive = require("../electron/instagram-archive.js")

export const INSTAGRAM_API_REPORT_BASE = "/api/instagram/report/"

function sendJson(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Cache-Control": "no-store",
  })
  res.end(json)
}

function readBody(req, limit = 6_000_000) {
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
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

/** Stream a file, honoring a single Range so videos can seek. */
function sendFile(req, res, file) {
  const st = fs.statSync(file)
  const type = ig.mimeFor(file)
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""))
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]))
    let end = range[1] && range[2] ? Number(range[2]) : st.size - 1
    end = Math.min(end, st.size - 1)
    if (start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${st.size}` })
      res.end()
      return
    }
    res.writeHead(206, {
      "Content-Type": type,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${st.size}`,
      "Accept-Ranges": "bytes",
    })
    fs.createReadStream(file, { start, end }).pipe(res)
    return
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Accept-Ranges": "bytes" })
  fs.createReadStream(file).pipe(res)
}

export async function handleInstagramApi(req, res, pathname, deps = {}) {
  const p = String(pathname || "")
  if (!p.startsWith("/api/instagram")) return false
  if (!guardBrowserOrigin(req, res)) return true
  if (!isLoopbackRemoteAddress(req.socket?.remoteAddress)) {
    sendJson(res, 403, { ok: false, error: "The Instagram report is only served on this Mac." })
    return true
  }
  const root = deps.root || ig.defaultRoot()

  if (p.replace(/\/$/, "") === "/api/instagram/status" && req.method === "GET") {
    sendJson(res, 200, { ...ig.publicStatus(root), reportBase: INSTAGRAM_API_REPORT_BASE, canIngest: false })
    return true
  }

  if (p.replace(/\/$/, "") === "/api/instagram/removed" && req.method === "GET") {
    sendJson(res, 200, archive.removedMessages(root))
    return true
  }
  if (p.replace(/\/$/, "") === "/api/instagram/summary" && req.method === "GET") {
    const state = ig.loadState(root)
    const file = ig.resolveReportPath(root, state, "summary.json")
    if (!file || !state.current) {
      sendJson(res, 200, null)
      return true
    }
    sendJson(res, 200, { buildId: state.current.buildId, text: fs.readFileSync(file, "utf8") })
    return true
  }

  if (p.replace(/\/$/, "") === "/api/instagram/ui-state" && req.method === "POST") {
    let body
    try {
      body = JSON.parse((await readBody(req)) || "{}")
    } catch {
      sendJson(res, 400, { ok: false })
      return true
    }
    const { key, value } = body || {}
    if (!ig.UI_STATE_KEYS.includes(key) || (value !== null && typeof value !== "string")) {
      sendJson(res, 400, { ok: false })
      return true
    }
    ig.saveUiState(root, ig.loadConfig(root), { [key]: value })
    sendJson(res, 200, { ok: true })
    return true
  }

  if (p.startsWith(INSTAGRAM_API_REPORT_BASE) && (req.method === "GET" || req.method === "HEAD")) {
    const file = ig.resolveReportPath(root, ig.loadState(root), p.slice(INSTAGRAM_API_REPORT_BASE.length))
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain" })
      res.end("Not found")
      return true
    }
    if (file.endsWith(".html")) {
      const html = ig.injectBridge(fs.readFileSync(file, "utf8"), ig.loadUiState(root, ig.loadConfig(root)))
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": ig.REPORT_CSP,
        "Cache-Control": "no-store",
      })
      res.end(html)
      return true
    }
    sendFile(req, res, file)
    return true
  }

  sendJson(res, 404, { ok: false })
  return true
}
