/**
 * Loopback status for Settings → Phone sync.
 *
 * Reads `data/phone-sync/runs.json` and `enabled.json`, the same files
 * `lib/phone-sync/archive.ts` writes. No message bodies. A phone on the LAN
 * is refused: the log stays on this Mac.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { isLoopbackRemoteAddress } from "./screentime-api.mjs"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

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

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  const tmp = `${file}.partial`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 })
  fs.renameSync(tmp, file)
}

function files(dataDir) {
  const dir = path.join(dataDir, "phone-sync")
  return { runs: path.join(dir, "runs.json"), enabled: path.join(dir, "enabled.json") }
}

export function readPhoneSyncStatus(dataDir) {
  const { runs, enabled } = files(dataDir)
  return {
    ok: true,
    runs: readJson(runs, []),
    enabled: readJson(enabled, {}),
  }
}

export function writePhoneSyncEnabled(dataDir, source, on) {
  const { enabled } = files(dataDir)
  const map = readJson(enabled, {})
  map[source] = on
  writeJson(enabled, map)
  return map
}

export async function handlePhoneSyncApi(req, res, pathname, deps = {}) {
  const route = String(pathname || "").replace(/\/$/, "") || "/"
  if (route !== "/api/phone-sync/status" && route !== "/api/phone-sync/enabled") return false

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {})
    return true
  }

  if (!isLoopbackRemoteAddress(req.socket?.remoteAddress)) {
    sendJson(res, 403, {
      ok: false,
      code: "forbidden",
      error: "The phone sync log stays on this Mac.",
    })
    return true
  }

  const dataDir = deps.dataDir || path.join(ROOT, "data")

  if (route === "/api/phone-sync/status" && req.method === "GET") {
    sendJson(res, 200, readPhoneSyncStatus(dataDir))
    return true
  }

  if (route === "/api/phone-sync/enabled" && req.method === "POST") {
    let body = {}
    try {
      body = JSON.parse((await readBody(req)) || "{}")
    } catch {
      sendJson(res, 400, { ok: false, error: "Request body must be JSON." })
      return true
    }
    const source = typeof body.source === "string" ? body.source : ""
    if (!source || typeof body.on !== "boolean") {
      sendJson(res, 400, { ok: false, error: "Send { source, on }." })
      return true
    }
    const enabled = writePhoneSyncEnabled(dataDir, source, body.on)
    sendJson(res, 200, { ok: true, enabled })
    return true
  }

  sendJson(res, 405, { ok: false, error: "Method not allowed." })
  return true
}
