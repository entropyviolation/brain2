/**
 * Dev hub for phone-message ingest. The poller (scripts/telegram-ingest.mjs)
 * writes pending Telegram messages; the renderer drains them and posts replies.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const DATA_DIR = path.join(ROOT, "data")
const DATA_FILE = path.join(DATA_DIR, "message-ingest.json")

export function ingestDataPath() {
  return DATA_FILE
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function emptyStore() {
  return { pending: [], replies: [], updatedAt: null, polling: false }
}

export function readIngestStore() {
  ensureDataDir()
  if (!fs.existsSync(DATA_FILE)) return emptyStore()
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))
    return {
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
      replies: Array.isArray(parsed.replies) ? parsed.replies : [],
      updatedAt: parsed.updatedAt ?? null,
      polling: Boolean(parsed.polling),
    }
  } catch {
    return emptyStore()
  }
}

export function writeIngestStore(next) {
  ensureDataDir()
  const current = readIngestStore()
  const payload = {
    pending: next.pending ?? current.pending,
    replies: next.replies ?? current.replies,
    polling: next.polling ?? current.polling,
    updatedAt: new Date().toISOString(),
  }
  const tmp = `${DATA_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8")
  fs.renameSync(tmp, DATA_FILE)
  return payload
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

export async function handleIngestApi(req, res, pathname) {
  if (!pathname.startsWith("/api/ingest")) return false
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {})
    return true
  }

  if (pathname === "/api/ingest/status" && req.method === "GET") {
    const store = readIngestStore()
    sendJson(res, 200, {
      ok: true,
      pending: store.pending.length,
      polling: store.polling,
      updatedAt: store.updatedAt,
    })
    return true
  }

  if (pathname === "/api/ingest/pending" && req.method === "GET") {
    const store = readIngestStore()
    writeIngestStore({ ...store, pending: [] })
    sendJson(res, 200, { pending: store.pending })
    return true
  }

  if (pathname === "/api/ingest/enqueue" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}")
    const store = readIngestStore()
    const pending = [...store.pending, body]
    writeIngestStore({ ...store, pending })
    sendJson(res, 200, { ok: true, pending: pending.length })
    return true
  }

  if (pathname === "/api/ingest/reply" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}")
    if (!body.chatId || !body.text) {
      sendJson(res, 400, { ok: false, error: "chatId and text required" })
      return true
    }
    const store = readIngestStore()
    writeIngestStore({
      ...store,
      replies: [...store.replies, { chatId: String(body.chatId), text: String(body.text) }],
    })
    sendJson(res, 200, { ok: true })
    return true
  }

  sendJson(res, 404, { ok: false, error: "unknown ingest route" })
  return true
}
