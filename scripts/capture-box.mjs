#!/usr/bin/env node
/**
 * Sealed capture box — the part that runs on the Oracle VM.
 *
 * Long-polls Telegram and stores every incoming update ENCRYPTED to your public
 * key (`scripts/sealed-box.mjs`). It has no vault and no private key, so nothing
 * it stores can be read on this machine. Your own device pulls the queue,
 * decrypts it, and applies it (`COGS_CAPTURE_BOX_URL` on `npm run phone:hub`).
 *
 * Needs only Node 20+ and four files: capture-box.mjs, sealed-box.mjs, capture-filter.mjs, capture-upload.mjs. No npm install.
 *
 * Env:
 *   COGS_TELEGRAM_BOT_TOKEN   bot token (the one secret this machine holds)
 *   COGS_CAPTURE_PUBLIC_KEY   from `node scripts/capture-keygen.mjs`
 *   COGS_CAPTURE_TOKEN        bearer token your device sends to pull/ack
 *   COGS_CAPTURE_UPLOAD_TOKEN bearer token the iPhone app sends to POST /upload (add only)
 *   COGS_CAPTURE_CHAT_IDS     REQUIRED, comma list of your chat id(s): other chats are dropped
 *                             (offset still advances). Groups/channels are kept only if listed.
 *   COGS_CAPTURE_ALLOW_ANY_CHAT  set 1 to start with no list (keeps any private chat; loud warning)
 *   COGS_CAPTURE_BIND         listen address, default 0.0.0.0; use the Tailscale 100.x address
 *   COGS_CAPTURE_PORT         default 8788
 *   COGS_CAPTURE_DIR          default ./capture-data
 *   COGS_HEALTHCHECK_URL      healthchecks.io ping URL (alerts you on Telegram if pings stop)
 *   COGS_CAPTURE_MAX_MB       queue cap, default 50
 *
 * Routes: GET /health (open, counts only) · GET /queue?after=N (bearer) · POST /ack {upto} (bearer)
 */
import crypto from "node:crypto"
import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { createUploadRoutes } from "./capture-upload.mjs"
import { checkConfig, parseChatIds, shouldKeep } from "./capture-filter.mjs"
import { seal } from "./sealed-box.mjs"

const env = (k, d = "") => String(process.env[k] ?? d).trim()
const BOT = env("COGS_TELEGRAM_BOT_TOKEN")
const PUB = env("COGS_CAPTURE_PUBLIC_KEY")
const TOKEN = env("COGS_CAPTURE_TOKEN")
const PORT = Number(env("COGS_CAPTURE_PORT", "8788"))
const DIR = path.resolve(env("COGS_CAPTURE_DIR", "capture-data"))
const PING = env("COGS_HEALTHCHECK_URL").replace(/\/+$/, "")
const MAX_BYTES = Number(env("COGS_CAPTURE_MAX_MB", "50")) * 1024 * 1024
const BIND = env("COGS_CAPTURE_BIND", "0.0.0.0")
const CHATS = parseChatIds(env("COGS_CAPTURE_CHAT_IDS"))
const ALLOW_ANY = env("COGS_CAPTURE_ALLOW_ANY_CHAT") === "1"
const MAX_UPDATE_BYTES = 256 * 1024
const ALLOWED = JSON.stringify(["message", "edited_message", "callback_query"])

if (!BOT || !PUB || !TOKEN) {
  console.error("[capture-box] Set COGS_TELEGRAM_BOT_TOKEN, COGS_CAPTURE_PUBLIC_KEY and COGS_CAPTURE_TOKEN")
  process.exit(1)
}
const config = checkConfig({ chats: CHATS, allowAny: ALLOW_ANY })
if (!config.ok) {
  console.error(`[capture-box] ${config.error}`)
  process.exit(1)
}
if (config.warning) console.warn(`[capture-box] WARNING: ${config.warning}`)

const QUEUE = path.join(DIR, "queue.jsonl")
const STATE = path.join(DIR, "state.json")
fs.mkdirSync(DIR, { recursive: true, mode: 0o700 })

let state = { offset: 0, nextSeq: 1 }
try {
  state = { ...state, ...JSON.parse(fs.readFileSync(STATE, "utf8")) }
} catch {
  /* first run */
}
let lastPollAt = 0
let lastError = ""

const saveState = () => fs.writeFileSync(STATE, JSON.stringify(state), { mode: 0o600 })
const queueBytes = () => {
  try {
    return fs.statSync(QUEUE).size
  } catch {
    return 0
  }
}
function readQueue() {
  let text = ""
  try {
    text = fs.readFileSync(QUEUE, "utf8")
  } catch {
    return []
  }
  const rows = []
  for (const line of text.split("\n")) {
    if (!line) continue
    try {
      rows.push(JSON.parse(line))
    } catch {
      /* torn last line after a crash */
    }
  }
  return rows
}

/** Append sealed rows and fsync before Telegram is told to forget them. */
function append(rows) {
  const fd = fs.openSync(QUEUE, "a", 0o600)
  try {
    fs.writeSync(fd, rows.map((r) => JSON.stringify(r) + "\n").join(""))
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
}

async function pollOnce() {
  const url = new URL(`https://api.telegram.org/bot${BOT}/getUpdates`)
  url.searchParams.set("timeout", "25")
  url.searchParams.set("offset", String(state.offset))
  url.searchParams.set("allowed_updates", ALLOWED)
  const res = await fetch(url, { signal: AbortSignal.timeout(40000) })
  const data = await res.json()
  if (!data.ok) throw new Error(data.description || `telegram ${res.status}`)
  lastPollAt = Date.now()
  const updates = data.result || []
  if (!updates.length) return
  const rows = []
  for (const update of updates) {
    if (!shouldKeep(update, { chats: CHATS, allowAny: ALLOW_ANY })) continue // dropped, but the offset still advances below
    const plain = JSON.stringify(update)
    if (Buffer.byteLength(plain) > MAX_UPDATE_BYTES) continue
    rows.push({ seq: state.nextSeq++, at: new Date().toISOString(), sealed: seal(PUB, plain) })
  }
  if (rows.length) append(rows)
  state.offset = Math.max(...updates.map((u) => u.update_id)) + 1
  saveState()
}

async function pollLoop() {
  for (;;) {
    if (queueBytes() >= MAX_BYTES) {
      lastError = "queue full: pull and ack from your device"
      await new Promise((r) => setTimeout(r, 10000))
      continue
    }
    try {
      await pollOnce()
      lastError = ""
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      console.error("[capture-box] poll", lastError)
      await new Promise((r) => setTimeout(r, 3000))
    }
  }
}

async function heartbeat() {
  if (!PING) return
  const healthy = !lastError && Date.now() - lastPollAt < 90000
  try {
    await fetch(healthy ? PING : `${PING}/fail`, { signal: AbortSignal.timeout(10000) })
  } catch {
    /* the monitor will notice the silence */
  }
}

const authorized = (req) => {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "")
  if (!m) return false
  const a = Buffer.from(m[1].trim())
  const b = Buffer.from(TOKEN)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
const send = (res, status, body) => {
  const json = JSON.stringify(body)
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(json) })
  res.end(json)
}
const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on("data", (c) => {
      size += c.length
      if (size > 64 * 1024) {
        reject(new Error("too large"))
        req.destroy()
      } else chunks.push(c)
    })
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })

const uploads = createUploadRoutes({ dir: DIR, uploadToken: env("COGS_CAPTURE_UPLOAD_TOKEN"), pullToken: TOKEN })

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://x")
    if (await uploads.handle(req, res, url)) return
    if (url.pathname === "/health" && req.method === "GET") {
      const healthy = !lastError && Date.now() - lastPollAt < 90000
      return send(res, healthy ? 200 : 503, { ok: healthy, queued: readQueue().length, lastPollAt, error: lastError || undefined })
    }
    if (url.pathname === "/queue" && req.method === "GET") {
      if (!authorized(req)) return send(res, 401, { ok: false })
      const after = Number(url.searchParams.get("after")) || 0
      const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500)
      return send(res, 200, { ok: true, items: readQueue().filter((r) => r.seq > after).slice(0, limit) })
    }
    if (url.pathname === "/ack" && req.method === "POST") {
      if (!authorized(req)) return send(res, 401, { ok: false })
      const upto = Number(JSON.parse((await readBody(req)) || "{}").upto)
      if (!Number.isFinite(upto)) return send(res, 400, { ok: false })
      const keep = readQueue().filter((r) => r.seq > upto)
      const tmp = QUEUE + ".tmp"
      fs.writeFileSync(tmp, keep.map((r) => JSON.stringify(r) + "\n").join(""), { mode: 0o600 })
      fs.renameSync(tmp, QUEUE)
      return send(res, 200, { ok: true, remaining: keep.length })
    }
    send(res, 404, { ok: false })
  } catch (err) {
    send(res, 500, { ok: false, error: err instanceof Error ? err.message : "error" })
  }
})

server.listen(PORT, BIND, () =>
  console.log(`[capture-box] http ${BIND}:${PORT}, queue ${QUEUE}, chats ${CHATS.size ? [...CHATS].join(",") : "any private"}`),
)
// A webhook would starve getUpdates; drop it, keep pending updates.
fetch(`https://api.telegram.org/bot${BOT}/deleteWebhook?drop_pending_updates=false`).catch(() => {})
void pollLoop()
setInterval(heartbeat, 60000)
void heartbeat()
