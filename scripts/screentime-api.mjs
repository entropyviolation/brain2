/**
 * Dev hub for ActivityWatch screen time. Same loopback client as Electron
 * (`electron/activitywatch.js`), exposed on localhost so Chrome on this Mac
 * can query a running aw-server without `window.desktop`.
 *
 * Loopback-only: the Next server binds 0.0.0.0 for phone sync; remote clients
 * must not trigger ActivityWatch requests.
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

function defaultFetchScreenTime(range) {
  const { fetchScreenTime } = require("../electron/activitywatch.js")
  return fetchScreenTime(range)
}

export async function handleScreenTimeApi(req, res, pathname, deps = {}) {
  const path = String(pathname || "").replace(/\/$/, "") || "/"
  if (path !== "/api/screentime" && path !== "/api/screentime/health") return false

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {})
    return true
  }

  if (!isLoopbackRemoteAddress(req.socket?.remoteAddress)) {
    sendJson(res, 403, {
      ok: false,
      code: "forbidden",
      error: "ActivityWatch is only queried on this Mac. Open Brain2 at http://localhost:3000 (or the desktop window), not from a phone.",
    })
    return true
  }

  const fetchScreenTime = deps.fetchScreenTime || defaultFetchScreenTime

  if (path === "/api/screentime/health" && req.method === "GET") {
    const result = await fetchScreenTime({ mode: "health" })
    sendJson(res, 200, result && typeof result === "object" ? result : { ok: false, error: "ActivityWatch health check failed." })
    return true
  }

  if (path === "/api/screentime" && req.method === "POST") {
    let body = {}
    try {
      body = JSON.parse((await readBody(req)) || "{}")
    } catch {
      sendJson(res, 400, { ok: false, code: "invalid-range", error: "Request body must be JSON." })
      return true
    }
    const result = await fetchScreenTime(body)
    sendJson(res, 200, result && typeof result === "object" ? result : { ok: false, error: "Failed to read ActivityWatch." })
    return true
  }

  sendJson(res, 404, { ok: false, error: "unknown screentime route" })
  return true
}
