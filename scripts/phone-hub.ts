/**
 * Always-on Telegram + persist hub. Answers grocery reads while the laptop is
 * closed, as long as *this* process stays up (NAS, VPS, or a Mac that never sleeps).
 *
 *   npm run phone:hub
 *
 * Token: gitignored `.env.local` / COGS_TELEGRAM_BOT_TOKEN
 * Poll is the default. Webhook: COGS_TELEGRAM_WEBHOOK=https://host/telegram/webhook
 * Port (persist + webhook): COGS_PHONE_HUB_PORT=8787
 *
 * Desktop Electron yields when data/phone-hub-status.json is fresh so Telegram
 * is not consumed twice. Push the vault from Settings → Sync vault.
 *
 * See docs/MESSAGE_INGEST.md.
 */
import { readFileSync, writeFileSync, existsSync, watch, mkdirSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { dumpLocalStorage, fillLocalStorage, installPhoneHubGlobals } from "./phone-hub-polyfill.mjs"
import { handlePersistApi, mergeSharedPersistItems, readSharedPersist } from "./persist-api.mjs"
import { hydrateTelegramUpdate } from "./telegram-file.mjs"

installPhoneHubGlobals()

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const STATUS_FILE = join(ROOT, "data", "phone-hub-status.json")
const OFFSET_FILE = join(ROOT, "data", "telegram-offset.json")
const PORT = Number(process.env.COGS_PHONE_HUB_PORT || 8787)
const WEBHOOK = String(process.env.COGS_TELEGRAM_WEBHOOK || "").trim()
const WEBHOOK_SECRET = String(process.env.COGS_TELEGRAM_WEBHOOK_SECRET || "").trim()

function tokenFromEnvFiles() {
  const fromEnv = String(process.env.COGS_TELEGRAM_BOT_TOKEN || "").trim()
  if (fromEnv) return fromEnv
  for (const name of [".env.local", ".env"]) {
    const file = join(ROOT, name)
    if (!existsSync(file)) continue
    try {
      const text = readFileSync(file, "utf8")
      const line = text.split(/\r?\n/).find((row) => row.startsWith("COGS_TELEGRAM_BOT_TOKEN="))
      if (!line) continue
      const value = line.slice("COGS_TELEGRAM_BOT_TOKEN=".length).trim().replace(/^["']|["']$/g, "")
      if (value) return value
    } catch {
      /* ignore */
    }
  }
  return ""
}

const TOKEN = tokenFromEnvFiles()
if (!TOKEN) {
  console.error("[phone-hub] Set COGS_TELEGRAM_BOT_TOKEN or gitignored .env.local")
  process.exit(1)
}

let offset = 0
try {
  offset = Number(JSON.parse(readFileSync(OFFSET_FILE, "utf8")).offset) || 0
} catch {
  offset = 0
}

let ingestIncomingAsync
let deliverIngestReply
let incomingFromTelegram
let stores = []
let flushing = false
let ignoreWatch = false
let lastPersistMtime = 0

function persistFileMtime() {
  try {
    return statSync(join(ROOT, "data", "shared-persist.json")).mtimeMs
  } catch {
    return 0
  }
}

function writeStatus(extra = {}) {
  mkdirSync(join(ROOT, "data"), { recursive: true })
  const payload = {
    ok: true,
    polling: true,
    hub: true,
    mode: WEBHOOK ? "webhook" : "poll",
    pid: process.pid,
    port: PORT,
    at: new Date().toISOString(),
    ...extra,
  }
  writeFileSync(STATUS_FILE, JSON.stringify(payload), "utf8")
}

async function telegramApi(method, params) {
  const url = new URL(`https://api.telegram.org/bot${TOKEN}/${method}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue
      url.searchParams.set(k, String(v))
    }
  }
  const res = await fetch(url)
  const data = await res.json()
  if (!data || data.ok !== true) {
    const desc = data && data.description ? data.description : `HTTP ${res.status}`
    throw new Error(desc)
  }
  return data.result
}

async function waitHydrated(store) {
  const persist = store?.persist
  if (!persist?.hasHydrated) return
  if (persist.hasHydrated()) return
  await new Promise((resolve) => persist.onFinishHydration(() => resolve(undefined)))
}

async function loadStores() {
  fillLocalStorage(readSharedPersist().items)
  const task = await import("../lib/task-store.ts")
  const ingest = await import("../lib/ingest/ingest-store.ts")
  const habits = await import("../lib/habits-store.ts")
  const tracking = await import("../lib/time-tracking-store.ts")
  const sleep = await import("../lib/sleep-store.ts")
  const events = await import("../lib/event-store.ts")
  const work = await import("../lib/work-session-store.ts")
  const penNow = await import("../lib/pen-color-session-store.ts")
  const exec = await import("../lib/ingest/executor.ts")
  const deliver = await import("../lib/ingest/deliver-reply.ts")
  const bridge = await import("../lib/ingest/telegram-bridge.ts")
  stores = [
    task.useTaskStore,
    ingest.useIngestStore,
    habits.useHabitsStore,
    tracking.useTimeTrackingStore,
    sleep.useSleepStore,
    events.useEventStore,
    work.useWorkSessionStore,
    penNow.usePenColorSessionStore,
  ]
  await Promise.all(stores.map(waitHydrated))
  ingestIncomingAsync = exec.ingestIncomingAsync
  deliverIngestReply = deliver.deliverIngestReply
  incomingFromTelegram = bridge.incomingFromTelegram
}

async function rehydrateFromDisk() {
  fillLocalStorage(readSharedPersist().items)
  await Promise.all(
    stores.map(async (store) => {
      try {
        await store.persist?.rehydrate?.()
      } catch {
        /* seed store */
      }
    }),
  )
}

function flushVault() {
  if (flushing) return
  flushing = true
  ignoreWatch = true
  try {
    mergeSharedPersistItems(dumpLocalStorage(), "phone-hub")
  } finally {
    flushing = false
    setTimeout(() => {
      ignoreWatch = false
    }, 250)
  }
}

const transport = {
  async send(chatId, text) {
    const result = await telegramApi("sendMessage", { chat_id: chatId, text })
    return { messageId: result && result.message_id }
  },
  async pin(chatId, messageId, previousId) {
    if (previousId && previousId !== messageId) {
      try {
        await telegramApi("unpinChatMessage", { chat_id: chatId, message_id: previousId })
      } catch {
        /* already unpinned */
      }
    }
    await telegramApi("pinChatMessage", {
      chat_id: chatId,
      message_id: messageId,
      disable_notification: true,
    })
  },
}

async function handlePayload(payload) {
  // A message applied on a stale in-memory vault stamps a fresh contentRev
  // and then flushes that older copy over newer habit titles and cells.
  await rehydrateFromDisk()
  const result = await ingestIncomingAsync(incomingFromTelegram(payload))
  await deliverIngestReply(payload.chatId, result, transport)
  flushVault()
}

const albumWait = new Map()
function pushAlbum(payload) {
  const gid = payload.mediaGroupId
  if (!gid) return handlePayload(payload)
  const row = albumWait.get(gid) || { payloads: [], timer: null }
  row.payloads.push(payload)
  if (row.timer) clearTimeout(row.timer)
  row.timer = setTimeout(() => {
    albumWait.delete(gid)
    const first = row.payloads[0]
    const text = row.payloads.map((p) => p.text).find((value) => String(value || "").trim()) || first.text
    const attachments = row.payloads.flatMap((p) => p.attachments || [])
    void handlePayload({ ...first, text, attachments })
  }, 1100)
  albumWait.set(gid, row)
}

async function pollLoop() {
  while (true) {
    try {
      const updates = await telegramApi("getUpdates", {
        timeout: 25,
        offset,
        allowed_updates: JSON.stringify(["message", "edited_message"]),
      })
      for (const update of updates || []) {
        offset = Math.max(offset, (update.update_id || 0) + 1)
        const payload = await hydrateTelegramUpdate(update, TOKEN, telegramApi)
        if (payload) await pushAlbum(payload)
      }
      mkdirSync(join(ROOT, "data"), { recursive: true })
      writeFileSync(OFFSET_FILE, JSON.stringify({ offset }), "utf8")
      writeStatus()
    } catch (err) {
      console.error("[phone-hub] poll", err instanceof Error ? err.message : err)
      writeStatus({ error: err instanceof Error ? err.message : "poll failed" })
      await new Promise((r) => setTimeout(r, 4000))
    }
  }
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept, X-Telegram-Bot-Api-Secret-Token",
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

async function onRequest(req, res) {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`)
  const pathname = url.pathname
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {})
    return
  }
  if (pathname === "/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true, hub: true, mode: WEBHOOK ? "webhook" : "poll" })
    return
  }
  if (pathname === "/api/ingest/status" && req.method === "GET") {
    sendJson(res, 200, { ok: true, polling: true, hub: true, pending: 0, mode: WEBHOOK ? "webhook" : "poll" })
    return
  }
  if (pathname === "/telegram/webhook" && req.method === "POST") {
    if (WEBHOOK_SECRET) {
      const header = req.headers["x-telegram-bot-api-secret-token"]
      if (header !== WEBHOOK_SECRET) {
        sendJson(res, 403, { ok: false })
        return
      }
    }
    try {
      const update = JSON.parse((await readBody(req)) || "{}")
      const payload = await hydrateTelegramUpdate(update, TOKEN, telegramApi)
      if (payload) await pushAlbum(payload)
      sendJson(res, 200, { ok: true })
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : "bad update" })
    }
    return
  }
  const handled = await handlePersistApi(req, res, pathname)
  if (handled) return
  sendJson(res, 404, { ok: false, error: "not found" })
}

function watchPersist() {
  mkdirSync(join(ROOT, "data"), { recursive: true })
  lastPersistMtime = persistFileMtime()
  let timer
  try {
    watch(join(ROOT, "data"), (_event, name) => {
      if (name !== "shared-persist.json") return
      if (ignoreWatch) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const mtime = persistFileMtime()
        if (mtime === lastPersistMtime) return
        lastPersistMtime = mtime
        void rehydrateFromDisk().catch((err) => {
          console.error("[phone-hub] rehydrate", err instanceof Error ? err.message : err)
        })
      }, 400)
    })
  } catch {
    /* data dir may appear later */
  }
}

await loadStores()
writeStatus()
setInterval(() => writeStatus(), 10000)

const server = createServer((req, res) => {
  void onRequest(req, res).catch((err) => {
    console.error("[phone-hub] http", err instanceof Error ? err.message : err)
    if (!res.headersSent) sendJson(res, 500, { ok: false })
  })
})
await new Promise((resolve) => server.listen(PORT, "0.0.0.0", resolve))
console.log(`[phone-hub] persist + status on http://127.0.0.1:${PORT}`)

if (WEBHOOK) {
  await telegramApi("setWebhook", {
    url: WEBHOOK,
    secret_token: WEBHOOK_SECRET || undefined,
    allowed_updates: JSON.stringify(["message", "edited_message"]),
  })
  console.log(`[phone-hub] webhook ${WEBHOOK}`)
} else {
  try {
    await telegramApi("deleteWebhook", { drop_pending_updates: false })
  } catch {
    /* already polling */
  }
  console.log("[phone-hub] polling getUpdates — do not also run Electron ingest or npm run ingest")
  void pollLoop()
}

watchPersist()

function shutdown() {
  try {
    writeFileSync(
      STATUS_FILE,
      JSON.stringify({ ok: false, polling: false, hub: true, at: new Date().toISOString(), pid: process.pid }),
      "utf8",
    )
  } catch {
    /* ignore */
  }
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
