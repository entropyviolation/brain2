/**
 * Dev-only shared persist hub so Chrome (localhost:3000) and Electron
 * (same URL, different Chromium profile) share Zustand localStorage keys.
 *
 * Chrome remains the seed of truth: scripts/dump-chrome-localstorage.mjs
 * writes this file from Chrome's profile. Electron hydrates from it.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const DATA_DIR = path.join(ROOT, "data")
const DATA_FILE = path.join(DATA_DIR, "shared-persist.json")

export function sharedPersistPath() {
  return DATA_FILE
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function readSharedPersist() {
  ensureDataDir()
  if (!fs.existsSync(DATA_FILE)) {
    return { updatedAt: null, source: null, items: {} }
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))
    return {
      updatedAt: parsed.updatedAt ?? null,
      source: parsed.source ?? null,
      items: parsed.items && typeof parsed.items === "object" ? parsed.items : {},
    }
  } catch {
    return { updatedAt: null, source: null, items: {} }
  }
}

export function writeSharedPersist(next) {
  ensureDataDir()
  const payload = {
    updatedAt: new Date().toISOString(),
    source: next.source ?? readSharedPersist().source ?? "hub",
    items: next.items && typeof next.items === "object" ? next.items : {},
  }
  const tmp = `${DATA_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(payload), "utf8")
  fs.renameSync(tmp, DATA_FILE)
  return payload
}

export function upsertSharedPersistItem(name, value, source) {
  const current = readSharedPersist()
  const items = { ...current.items, [name]: value }
  return writeSharedPersist({ items, source: source ?? current.source ?? "hub" })
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
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

/** @returns {Promise<boolean>} true if handled */
export async function handlePersistApi(req, res, pathname) {
  if (pathname !== "/api/persist" && pathname !== "/api/persist/health") return false

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    })
    res.end()
    return true
  }

  if (pathname === "/api/persist/health" && req.method === "GET") {
    const store = readSharedPersist()
    sendJson(res, 200, {
      ok: true,
      keyCount: Object.keys(store.items).length,
      updatedAt: store.updatedAt,
      source: store.source,
    })
    return true
  }

  if (req.method === "GET") {
    sendJson(res, 200, { ok: true, ...readSharedPersist() })
    return true
  }

  if (req.method === "PUT") {
    try {
      const body = JSON.parse((await readBody(req)) || "{}")
      if (!body.items || typeof body.items !== "object") {
        sendJson(res, 400, { ok: false, error: "Expected { items }" })
        return true
      }
      const stored = writeSharedPersist({ items: body.items, source: body.source ?? "put" })
      sendJson(res, 200, { ok: true, updatedAt: stored.updatedAt, keyCount: Object.keys(stored.items).length })
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" })
    }
    return true
  }

  if (req.method === "POST") {
    try {
      const body = JSON.parse((await readBody(req)) || "{}")
      if (typeof body.name !== "string" || typeof body.value !== "string") {
        sendJson(res, 400, { ok: false, error: "Expected { name, value }" })
        return true
      }
      // Chrome localhost is the vault. Ignore Electron upserts so a stale
      // desktop profile cannot overwrite the dump / live Chrome mirror.
      if (body.source === "electron") {
        const current = readSharedPersist()
        sendJson(res, 200, { ok: true, skipped: true, updatedAt: current.updatedAt })
        return true
      }
      const stored = upsertSharedPersistItem(body.name, body.value, body.source)
      sendJson(res, 200, { ok: true, updatedAt: stored.updatedAt })
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" })
    }
    return true
  }

  sendJson(res, 405, { ok: false, error: "Method not allowed" })
  return true
}
