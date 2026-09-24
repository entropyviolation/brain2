/**
 * Dev hub for Apple Notes ingest. Same Notes.app reader as Electron
 * (`electron/apple-notes.js`), exposed on localhost so Chrome on this Mac
 * can list iCloud / iPhone notes without `window.desktop`.
 *
 * Loopback-only: the Next server binds 0.0.0.0 for phone sync; remote clients
 * must not trigger osascript.
 */
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(fileURLToPath(import.meta.url))

export function isLoopbackRemoteAddress(addr) {
  if (typeof addr !== "string" || !addr) return false
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1"
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  })
  res.end(json)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", (c) => chunks.push(c))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

function defaultFetchAppleNotes(range) {
  const { fetchAppleNotes } = require("../electron/apple-notes.js")
  return fetchAppleNotes(range)
}

export async function handleNotesApi(req, res, pathname, deps = {}) {
  const path = String(pathname || "").replace(/\/$/, "") || "/"
  if (path !== "/api/notes" && path !== "/api/notes/health") return false

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {})
    return true
  }

  if (!isLoopbackRemoteAddress(req.socket?.remoteAddress)) {
    sendJson(res, 403, {
      ok: false,
      code: "forbidden",
      error: "Apple Notes ingest only runs on this Mac. Open Brain2 at http://localhost:3000 (or the desktop window), not from a phone.",
    })
    return true
  }

  if (path === "/api/notes/health" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      available: process.platform === "darwin",
      platform: process.platform,
    })
    return true
  }

  if (path === "/api/notes" && req.method === "POST") {
    let range = {}
    try {
      range = JSON.parse((await readBody(req)) || "{}")
    } catch {
      sendJson(res, 400, { ok: false, code: "invalid-range", error: "A start and end date are required." })
      return true
    }
    const fetchAppleNotes = deps.fetchAppleNotes || defaultFetchAppleNotes
    const result = await fetchAppleNotes(range)
    sendJson(res, 200, result && typeof result === "object" ? result : { ok: false, error: "Failed to read Apple Notes." })
    return true
  }

  sendJson(res, 404, { ok: false, error: "unknown notes route" })
  return true
}
