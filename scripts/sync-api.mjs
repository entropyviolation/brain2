/**
 * Shared sync API handlers (backup snapshot on disk).
 * Used by the standalone sync server and the unified Next+sync dev server.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const DATA_DIR = path.join(ROOT, "data")
const DATA_FILE = path.join(DATA_DIR, "mobile-sync.json")

const USER = process.env.COGS_SYNC_USER || "admin"
const PASS = process.env.COGS_SYNC_PASS || "admin"

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function syncDataPath() {
  return DATA_FILE
}

export function readSyncStore() {
  ensureDataDir()
  if (!fs.existsSync(DATA_FILE)) return { backup: null, updatedAt: null }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))
  } catch {
    return { backup: null, updatedAt: null }
  }
}

export function writeSyncStore(backup) {
  ensureDataDir()
  const payload = { backup, updatedAt: new Date().toISOString() }
  const tmp = `${DATA_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8")
  fs.renameSync(tmp, DATA_FILE)
  return payload
}

function backupStats(backup) {
  if (!backup?.stores || typeof backup.stores !== "object") {
    return { taskCount: 0, eventCount: 0, listCount: 0, storeCount: 0 }
  }
  const taskStore = backup.stores["cogs-task-storage"]
  const eventStore = backup.stores["cogs-event-storage"]
  const taskState = taskStore?.state || taskStore
  const eventState = eventStore?.state || eventStore
  return {
    taskCount: Array.isArray(taskState?.tasks) ? taskState.tasks.length : 0,
    eventCount: Array.isArray(eventState?.events) ? eventState.events.length : 0,
    listCount: Array.isArray(taskState?.lists) ? taskState.lists.length : 0,
    storeCount: Object.keys(backup.stores).length,
  }
}

function isMeaningfulBackup(backup) {
  const stats = backupStats(backup)
  return stats.storeCount > 0 && (stats.taskCount > 0 || stats.eventCount > 0 || stats.listCount > 0)
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  })
  res.end(json)
}

function unauthorized(res) {
  res.writeHead(401, {
    "Content-Type": "application/json; charset=utf-8",
    "WWW-Authenticate": 'Basic realm="cogs-mobile-sync"',
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  })
  res.end(JSON.stringify({ ok: false, error: "Unauthorized" }))
}

function checkAuth(req) {
  const header = req.headers.authorization || ""
  if (!header.startsWith("Basic ")) return false
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8")
    const idx = decoded.indexOf(":")
    if (idx < 0) return false
    return decoded.slice(0, idx) === USER && decoded.slice(idx + 1) === PASS
  } catch {
    return false
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", (c) => chunks.push(c))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

/** @returns {Promise<boolean>} true if the request was handled */
export async function handleSyncApi(req, res, pathname) {
  if (req.method === "OPTIONS" && (pathname.startsWith("/api/sync") || pathname === "/api/health")) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    })
    res.end()
    return true
  }

  if (pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "cogs-mobile-sync" })
    return true
  }

  if (!pathname.startsWith("/api/sync")) return false

  if (!checkAuth(req)) {
    unauthorized(res)
    return true
  }

  if (req.method === "GET" && pathname === "/api/sync/status") {
    const store = readSyncStore()
    const stats = backupStats(store.backup)
    sendJson(res, 200, {
      ok: true,
      hasData: isMeaningfulBackup(store.backup),
      updatedAt: store.updatedAt,
      exportedAt: store.backup?.exportedAt ?? null,
      stats,
    })
    return true
  }

  if (req.method === "GET" && pathname === "/api/sync/pull") {
    const store = readSyncStore()
    sendJson(res, 200, {
      ok: true,
      backup: store.backup,
      updatedAt: store.updatedAt,
    })
    return true
  }

  if (req.method === "POST" && pathname === "/api/sync/push") {
    try {
      const raw = await readBody(req)
      const body = JSON.parse(raw || "{}")
      const backup = body.backup
      if (!backup || backup.app !== "cogs" || typeof backup.stores !== "object") {
        sendJson(res, 400, { ok: false, error: "Invalid backup payload" })
        return true
      }
      // Refuse to overwrite a good hub with a blank / near-empty snapshot.
      const incomingStats = backupStats(backup)
      const existing = readSyncStore()
      const existingStats = backupStats(existing.backup)
      if (!isMeaningfulBackup(backup)) {
        sendJson(res, 400, { ok: false, error: "Empty snapshot — nothing to store" })
        return true
      }
      // Guard: a tiny client must not clobber a full vault (e.g. phone before Pull).
      if (
        existingStats.taskCount >= 20 &&
        incomingStats.taskCount < Math.floor(existingStats.taskCount * 0.25)
      ) {
        sendJson(res, 409, {
          ok: false,
          error: `Refusing shrink from ${existingStats.taskCount} → ${incomingStats.taskCount} tasks`,
        })
        return true
      }
      const stored = writeSyncStore(backup)
      sendJson(res, 200, { ok: true, updatedAt: stored.updatedAt })
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: err instanceof Error ? err.message : "Invalid JSON",
      })
    }
    return true
  }

  sendJson(res, 404, { ok: false, error: "Not found" })
  return true
}
