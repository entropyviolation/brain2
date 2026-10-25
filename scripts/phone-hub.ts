/**
 * Always-on Telegram + persist hub. Answers grocery reads while the laptop is
 * closed, as long as *this* process stays up (NAS, VPS, or a Mac that never sleeps).
 *
 *   npm run phone:hub
 *
 * Token: gitignored `.env.local` / COGS_TELEGRAM_BOT_TOKEN
 * Poll is the default. Webhook: COGS_TELEGRAM_WEBHOOK=https://host/telegram/webhook
 * Port (persist + webhook): COGS_PHONE_HUB_PORT=8787
 * Capture box (Oracle VM keeps sealed texts, this drains them): COGS_CAPTURE_BOX_URL + COGS_CAPTURE_TOKEN
 * Drain extras: COGS_DRAIN_STALE_MINUTES (default 30; older texts get a "(from 3h ago)" reply line),
 *   COGS_DRAIN_HEALTHCHECK_URL (pinged <= 1/min after a good fetch, `/fail` on fetch or decrypt errors)
 * Vault API token (set on any public host): COGS_PHONE_HUB_TOKEN
 *
 * Desktop Electron yields when data/phone-hub-status.json is fresh so Telegram
 * is not consumed twice. Push the vault from Settings → Sync vault.
 *
 * See docs/MESSAGE_INGEST.md.
 */
import { readFileSync, writeFileSync, existsSync, watch, mkdirSync, statSync } from "node:fs"
import { createServer, type IncomingMessage as HttpRequest, type ServerResponse } from "node:http"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { dumpLocalStorage, fillLocalStorage, installPhoneHubGlobals } from "./phone-hub-polyfill.mjs"
import { handlePersistApi, mergeSharedPersistItems, readSharedPersist } from "./persist-api.mjs"
import { open as openSealed } from "./sealed-box.mjs"
import { hydrateTelegramUpdate } from "./telegram-file.mjs"
import { flushScheduledPersist } from "../lib/persist-storage"
import { hubRequestAuthorized, isGatedHubPath } from "../lib/ingest/hub-auth"
import { createChatQueue } from "../lib/ingest/chat-queue"
import { advanceConfirmedOffset } from "../lib/ingest/confirm-updates"
import { createDeferredAlbum } from "../lib/ingest/deferred-album"
import { compareSentOrder } from "../lib/ingest/message-time"
import { createDrainHeartbeat } from "../lib/ingest/drain-heartbeat"
import { drainStaleMinutes, prefixStaleReply, staleReplyNote } from "../lib/ingest/drain-stale"
import {
  allowedUpdatesParam,
  callbackQueryToIncoming,
  commandMenuRegistration,
} from "../lib/ingest/telegram-ui.mjs"
import type { IngestTransport } from "../lib/ingest/deliver-reply"
import type { IncomingTelegramPayload } from "../lib/ingest/telegram-bridge"

type ExecutorModule = typeof import("../lib/ingest/executor")
type HydratedStore = {
  persist?: {
    hasHydrated?: () => boolean
    onFinishHydration: (fn: () => void) => unknown
    rehydrate?: () => Promise<void> | void
  }
}
type TelegramUpdate = { update_id?: number; callback_query?: { id?: string } }
type PollRow = { update: TelegramUpdate; payload: IncomingTelegramPayload | null; failed: boolean }

installPhoneHubGlobals()

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const STATUS_FILE = join(ROOT, "data", "phone-hub-status.json")
const OFFSET_FILE = join(ROOT, "data", "telegram-offset.json")
const PHONE_SYNC_MS = Math.max(15, Number(process.env.COGS_PHONE_SYNC_SECONDS) || 60) * 1000
/** Let gitignored .env.local / .env supply any COGS_* setting the shell did not. */
function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const file = join(ROOT, name)
    if (!existsSync(file)) continue
    try {
      for (const row of readFileSync(file, "utf8").split(/\r?\n/)) {
        const m = /^\s*(COGS_[A-Z0-9_]+)\s*=\s*(.*)$/.exec(row)
        if (!m || process.env[m[1]!] !== undefined) continue
        const value = m[2]!.trim().replace(/^["']|["']$/g, "")
        if (value) process.env[m[1]!] = value
      }
    } catch {
      /* ignore */
    }
  }
}
loadEnvFiles()

const PORT = Number(process.env.COGS_PHONE_HUB_PORT || 8787)
const WEBHOOK = String(process.env.COGS_TELEGRAM_WEBHOOK || "").trim()
/** Bearer token for the vault API. Empty = open (localhost only!). */
const HUB_TOKEN = String(process.env.COGS_PHONE_HUB_TOKEN || "").trim()
/** Capture-box mode: pull sealed updates from the Oracle VM instead of polling Telegram. */
const CAPTURE_URL = String(process.env.COGS_CAPTURE_BOX_URL || "").trim().replace(/\/+$/, "")
const CAPTURE_TOKEN = String(process.env.COGS_CAPTURE_TOKEN || "").trim()
const CAPTURE_KEY_FILE =
  String(process.env.COGS_CAPTURE_PRIVATE_KEY_FILE || "").trim() || join(homedir(), ".brain2", "capture-private.key")
const CAPTURE_STATE_FILE = join(ROOT, "data", "capture-drain.json")
const DRAIN_STALE_MINUTES = drainStaleMinutes(process.env.COGS_DRAIN_STALE_MINUTES)
const DRAIN_HEALTHCHECK_URL = String(process.env.COGS_DRAIN_HEALTHCHECK_URL || "").trim()
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

let ingestIncomingAsync: ExecutorModule["ingestIncomingAsync"]
let dropLocationDuringRitual: ExecutorModule["dropLocationDuringRitual"] | undefined
let deliverIngestReply: typeof import("../lib/ingest/deliver-reply")["deliverIngestReply"]
let incomingFromTelegram: typeof import("../lib/ingest/telegram-bridge")["incomingFromTelegram"]
let stores: HydratedStore[] = []
let trackingKey = ""
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

function writeStatus(extra: Record<string, unknown> = {}) {
  mkdirSync(join(ROOT, "data"), { recursive: true })
  const payload = {
    ok: true,
    polling: true,
    hub: true,
    mode: CAPTURE_URL ? "capture-box" : WEBHOOK ? "webhook" : "poll",
    pid: process.pid,
    port: PORT,
    at: new Date().toISOString(),
    ...extra,
  }
  writeFileSync(STATUS_FILE, JSON.stringify(payload), "utf8")
}

async function telegramApi(method: string, params?: Record<string, unknown>) {
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

async function waitHydrated(store: HydratedStore) {
  const persist = store?.persist
  if (!persist?.hasHydrated) return
  if (persist.hasHydrated()) return
  await new Promise((resolve) => persist.onFinishHydration(() => resolve(undefined)))
}

async function loadStores() {
  fillLocalStorage(readSharedPersist().items)
  const task = await import("../lib/task-store")
  const ingest = await import("../lib/ingest/ingest-store")
  const habits = await import("../lib/habits-store")
  const tracking = await import("../lib/time-tracking-store")
  const sleep = await import("../lib/sleep-store")
  const events = await import("../lib/event-store")
  const work = await import("../lib/work-session-store")
  const penNow = await import("../lib/pen-color-session-store")
  const exec = await import("../lib/ingest/executor")
  const deliver = await import("../lib/ingest/deliver-reply")
  const bridge = await import("../lib/ingest/telegram-bridge")
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
  trackingKey = tracking.useTimeTrackingStore.persist.getOptions().name ?? ""
  ingestIncomingAsync = exec.ingestIncomingAsync
  dropLocationDuringRitual = exec.dropLocationDuringRitual
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

/** Push the hub's localStorage to the vault. `onlyKeys` limits it to those keys. */
function flushVault(onlyKeys?: string[]) {
  if (flushing) return
  flushing = true
  ignoreWatch = true
  try {
    flushScheduledPersist()
    const items = dumpLocalStorage() as Record<string, string>
    const pushed = onlyKeys ? Object.fromEntries(onlyKeys.filter((k) => k in items).map((k) => [k, items[k]])) : items
    mergeSharedPersistItems(pushed, "phone-hub")
  } finally {
    flushing = false
    setTimeout(() => {
      ignoreWatch = false
    }, 250)
  }
}

const transport: IngestTransport = {
  async send(chatId, text, markup) {
    const result = await telegramApi("sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: markup ? JSON.stringify(markup) : undefined,
    })
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
  async edit(chatId, messageId, text, markup) {
    await telegramApi("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: JSON.stringify(markup || { inline_keyboard: [] }),
    })
  },
}

/** Drained texts only: the first chunk of a late reply says how old the question was. */
function lateTransport(note: string): IngestTransport {
  let noted = false
  return {
    ...transport,
    async send(chatId, text, markup) {
      const body = noted ? text : prefixStaleReply(text, note)
      noted = true
      return transport.send(chatId, body, markup)
    },
    async edit(chatId, messageId, text, markup) {
      const body = noted ? text : prefixStaleReply(text, note)
      noted = true
      return transport.edit!(chatId, messageId, body, markup)
    },
  }
}

async function handlePayload(payload: IncomingTelegramPayload, rehydrate = false, drained = false) {
  // Rehydrate once per poll batch, not before every text. A per-message
  // reload was reading the vault from before this turn's persist flush and
  // dropping the open ritual, so the next line looked like a new command.
  if (rehydrate) await rehydrateFromDisk()
  if (
    dropLocationDuringRitual?.({
      channel: "telegram",
      chatId: String(payload.chatId),
      text: payload.text,
      locationUpdate: Boolean(payload.locationUpdate),
    })
  ) {
    return
  }
  const result = await ingestIncomingAsync(incomingFromTelegram(payload))
  const note = drained ? staleReplyNote(payload.receivedAt, Date.now(), DRAIN_STALE_MINUTES) : ""
  await deliverIngestReply(payload.chatId, result, note ? lateTransport(note) : transport)
  flushVault()
}

const enqueueChat = createChatQueue()
const album = createDeferredAlbum((payload: IncomingTelegramPayload) => handlePayload(payload, Boolean(payload.rehydrateHub)))

/**
 * Vault writes for one poll batch. Text stays in send order. Album parts share
 * one write. Confirmation follows update id order so a failed write leaves a hole.
 */
async function applyHydrated(rows: PollRow[], drained = false) {
  const orderedIds = rows.map((row) => Number(row.update && row.update.update_id) || 0)
  const doneById = new Map<number, Promise<boolean>>()
  let textChain: Promise<void> = Promise.resolve()
  const writes = rows
    .filter((row): row is PollRow & { payload: IncomingTelegramPayload } => row.payload != null)
    .sort((a, b) => compareSentOrder(a.payload, b.payload))
  for (const row of writes) {
    const id = Number(row.update && row.update.update_id) || 0
    if (row.payload.mediaGroupId) {
      doneById.set(id, album.push(row.payload).then(() => true, () => false))
      continue
    }
    const run = textChain.then(() => handlePayload(row.payload, Boolean(row.payload.rehydrateHub), drained))
    textChain = run.then(
      () => undefined,
      () => undefined,
    )
    doneById.set(id, run.then(() => true, () => false))
  }
  const confirmed = new Set<number>()
  for (let i = 0; i < rows.length; i++) {
    const id = orderedIds[i]!
    if (rows[i]!.failed) continue
    if (!rows[i]!.payload) {
      confirmed.add(id)
      continue
    }
    if (await doneById.get(id)) confirmed.add(id)
  }
  return { orderedIds, confirmed }
}

async function registerCommandMenu() {
  for (const call of commandMenuRegistration()) {
    await telegramApi(call.method, call.params)
  }
}

/** Typed messages stay on hydrate. A question-button tap becomes that same text. */
async function payloadFromUpdate(update: TelegramUpdate): Promise<IncomingTelegramPayload | null> {
  const payload = await hydrateTelegramUpdate(update, TOKEN, telegramApi)
  if (payload) return payload as IncomingTelegramPayload
  const query = update && update.callback_query
  if (!query || !query.id) return null
  try {
    await telegramApi("answerCallbackQuery", { callback_query_id: query.id })
  } catch {
    /* a drained tap can be too old to answer; still apply it */
  }
  const tapped = callbackQueryToIncoming(update)
  if (!tapped) return null
  if (tapped.clearMarkup && tapped.clearMarkup.messageId != null) {
    try {
      await telegramApi("editMessageReplyMarkup", {
        chat_id: tapped.clearMarkup.chatId,
        message_id: tapped.clearMarkup.messageId,
        reply_markup: JSON.stringify({ inline_keyboard: [] }),
      })
    } catch {
      /* the question markup is already gone */
    }
  }
  return tapped.payload
}

async function pollLoop() {
  while (true) {
    try {
      const updates = await telegramApi("getUpdates", {
        timeout: 25,
        offset,
        allowed_updates: allowedUpdatesParam(),
      })
      const rows: PollRow[] = []
      for (const update of (updates || []) as TelegramUpdate[]) {
        try {
          const payload = await payloadFromUpdate(update)
          rows.push({ update, payload, failed: false })
        } catch {
          rows.push({ update, payload: null, failed: true })
        }
      }
      if (rows.some((row) => row.payload)) await rehydrateFromDisk()
      const startOffset = offset
      const { orderedIds, confirmed } = await applyHydrated(rows)
      offset = advanceConfirmedOffset(startOffset, orderedIds, confirmed)
      if (offset !== startOffset) {
        mkdirSync(join(ROOT, "data"), { recursive: true })
        writeFileSync(OFFSET_FILE, JSON.stringify({ offset }), "utf8")
      } else if (orderedIds.length > 0 && confirmed.size < orderedIds.length) {
        await new Promise((r) => setTimeout(r, 1000))
      }
      writeStatus()
    } catch (err) {
      console.error("[phone-hub] poll", err instanceof Error ? err.message : err)
      writeStatus({ error: err instanceof Error ? err.message : "poll failed" })
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}

/**
 * Capture-box drain. The VM stores sealed updates; this device opens them with
 * the private key and applies them through the same path as a live poll. The
 * box is told to forget a text only after its vault write finished.
 */
async function drainLoop() {
  let privateKey = ""
  try {
    privateKey = readFileSync(CAPTURE_KEY_FILE, "utf8").trim()
  } catch {
    console.error(`[phone-hub] capture box: no private key at ${CAPTURE_KEY_FILE} (node scripts/capture-keygen.mjs)`)
    process.exit(1)
  }
  let seq = 0
  try {
    seq = Number(JSON.parse(readFileSync(CAPTURE_STATE_FILE, "utf8")).seq) || 0
  } catch {
    seq = 0
  }
  const headers = { Authorization: `Bearer ${CAPTURE_TOKEN}` }
  const heartbeat = createDrainHeartbeat(DRAIN_HEALTHCHECK_URL)
  let queued = 0
  let lastError = ""
  while (true) {
    let idle = true
    try {
      const res = await fetch(`${CAPTURE_URL}/queue?after=${seq}&limit=100`, { headers, signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new Error(`capture box HTTP ${res.status}`)
      const items = ((await res.json()).items || []) as { seq: number; sealed: string }[]
      queued = items.length
      void heartbeat.ok()
      if (items.length) {
        idle = false
        const rows: PollRow[] = []
        const seqByUpdate = new Map<number, number>()
        for (const item of items) {
          const update = JSON.parse(openSealed(privateKey, item.sealed).toString("utf8")) as TelegramUpdate
          // Undecryptable data throws above: stop and keep it queued rather than drop it.
          seqByUpdate.set(Number(update.update_id) || 0, item.seq)
          try {
            rows.push({ update, payload: await payloadFromUpdate(update), failed: false })
          } catch {
            rows.push({ update, payload: null, failed: true })
          }
        }
        if (rows.some((row) => row.payload)) await rehydrateFromDisk()
        const { orderedIds, confirmed } = await applyHydrated(rows, true)
        let upto = seq
        for (let i = 0; i < items.length; i++) {
          const id = orderedIds[i]!
          if (!confirmed.has(id)) break
          upto = Math.max(upto, seqByUpdate.get(id) ?? items[i]!.seq)
        }
        if (upto > seq) {
          seq = upto
          writeFileSync(CAPTURE_STATE_FILE, JSON.stringify({ seq }), "utf8")
          await fetch(`${CAPTURE_URL}/ack`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ upto }),
            signal: AbortSignal.timeout(20000),
          })
        } else {
          idle = true
        }
      }
      lastError = ""
      writeStatus({ mode: "capture-box", captureSeq: seq, queued, lastError: null })
    } catch (err) {
      console.error("[phone-hub] capture drain", err instanceof Error ? err.message : err)
      lastError = err instanceof Error ? err.message : "drain failed"
      void heartbeat.fail()
      writeStatus({ mode: "capture-box", captureSeq: seq, queued, error: lastError, lastError })
    }
    await new Promise((r) => setTimeout(r, idle ? 5000 : 200))
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-Telegram-Bot-Api-Secret-Token",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  })
  res.end(json)
}

function readBody(req: HttpRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (c: Buffer) => chunks.push(c))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

async function onRequest(req: HttpRequest, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`)
  const pathname = url.pathname
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {})
    return
  }
  if (pathname === "/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true, hub: true, mode: CAPTURE_URL ? "capture-box" : WEBHOOK ? "webhook" : "poll" })
    return
  }
  if (pathname === "/api/ingest/status" && req.method === "GET") {
    sendJson(res, 200, { ok: true, polling: true, hub: true, pending: 0, mode: CAPTURE_URL ? "capture-box" : WEBHOOK ? "webhook" : "poll" })
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
    let update: TelegramUpdate
    try {
      update = JSON.parse((await readBody(req)) || "{}")
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : "bad update" })
      return
    }
    try {
      const payload = await payloadFromUpdate(update)
      if (payload) {
        const chatId = String(payload.chatId)
        await enqueueChat(chatId, () => album.push({ ...payload, rehydrateHub: true }))
      }
      sendJson(res, 200, { ok: true })
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err instanceof Error ? err.message : "write failed" })
    }
    return
  }
  if (isGatedHubPath(pathname) && !hubRequestAuthorized(HUB_TOKEN, req.headers.authorization)) {
    sendJson(res, 401, { ok: false, error: "hub token required" })
    return
  }
  const handled = await handlePersistApi(req, res, pathname)
  if (handled) return
  sendJson(res, 404, { ok: false, error: "not found" })
}

function watchPersist() {
  mkdirSync(join(ROOT, "data"), { recursive: true })
  lastPersistMtime = persistFileMtime()
  let timer: ReturnType<typeof setTimeout> | undefined
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

// One async entry, not top-level await: jiti loads this file as CommonJS.
async function main() {
  await loadStores()
  writeStatus()
  setInterval(() => writeStatus(), 10000)

  const server = createServer((req, res) => {
    void onRequest(req, res).catch((err) => {
      console.error("[phone-hub] http", err instanceof Error ? err.message : err)
      if (!res.headersSent) sendJson(res, 500, { ok: false })
    })
  })
  await new Promise<void>((resolve) => server.listen(PORT, "0.0.0.0", resolve))
  console.log(`[phone-hub] persist + status on http://127.0.0.1:${PORT}`)
  if (!HUB_TOKEN) {
    console.warn("[phone-hub] COGS_PHONE_HUB_TOKEN is unset: the vault API is open to anyone who can reach this port. Set it on any public host.")
  }

  try {
    await registerCommandMenu()
  } catch (err) {
    console.error("[phone-hub] commands", err instanceof Error ? err.message : err)
  }

  if (CAPTURE_URL) {
    if (!CAPTURE_TOKEN) {
      console.error("[phone-hub] COGS_CAPTURE_BOX_URL needs COGS_CAPTURE_TOKEN")
      process.exit(1)
    }
    console.log(`[phone-hub] capture-box drain from ${CAPTURE_URL} — the VM polls Telegram; do not also poll here or run Electron ingest`)
    void drainLoop()
    // iPhone location batches (POST /upload on the box), sealed by the app.
    try {
      const { startLocationDrain } = await import("../lib/phone-sync/location-drain")
      const { openPhoneArchive } = await import("../lib/phone-sync/archive")
      const locationArchive = openPhoneArchive(join(ROOT, "data"))
      startLocationDrain({
        boxUrl: CAPTURE_URL,
        token: CAPTURE_TOKEN,
        privateKey: readFileSync(CAPTURE_KEY_FILE, "utf8").trim(),
        open: openSealed,
        archive: locationArchive,
        beforeApply: rehydrateFromDisk,
        onWrote: flushTracking,
        paused: () => !locationArchive.getEnabled("location"),
      })
    } catch (err) {
      console.error(`[phone-hub] location drain off: ${err instanceof Error ? err.message : err}`)
    }
  } else if (WEBHOOK) {
    await telegramApi("setWebhook", {
      url: WEBHOOK,
      secret_token: WEBHOOK_SECRET || undefined,
      allowed_updates: allowedUpdatesParam(),
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
  void startPhoneSync().catch((err) => {
    console.error("[phone-hub] phone sync", err instanceof Error ? err.message : err)
  })
}

/**
 * Phone sync (docs/PHONE_SYNC_PLAN.md): run every registered reader on a timer,
 * archive message bodies under data/phone-sync/, and flush the vault after a
 * run that wrote rows. No readers registered means nothing runs.
 */
async function startPhoneSync() {
  const { loadPhoneReaders } = await import("../lib/phone-sync/readers")
  const readers = await loadPhoneReaders()
  if (readers.length === 0) return
  const { openPhoneArchive } = await import("../lib/phone-sync/archive")
  const { runPhoneSync } = await import("../lib/phone-sync/runner")
  const { applyPhoneRecords, textDaysFromEnv } = await import("../lib/phone-sync/write")
  const textDays = textDaysFromEnv(process.env.COGS_PHONE_SYNC_TEXT_DAYS)
  const archive = openPhoneArchive(join(ROOT, "data"))
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const apply = (records: Parameters<typeof applyPhoneRecords>[0]) => applyPhoneRecords(records, undefined, { textDays })
      // Catch up in one go: keep reading while a source still hands back rows (first run reads years of texts).
      for (let pass = 0; pass < 1000; pass++) {
        // Pick up edits the app made since the last read. A stale copy that lacks
        // a newer Tracking block is refused whole by the vault guard, phone rows too.
        await rehydrateFromDisk()
        const runs = await runPhoneSync(
          { archive, apply, onWrote: flushTracking, enabled: (source) => archive.getEnabled(source) },
          readers,
        )
        for (const run of runs) {
          if (run.error) console.error(`[phone-hub] phone sync ${run.source}: ${run.error}`)
          else if (run.written) console.log(`[phone-hub] phone sync ${run.source}: +${run.written}`)
        }
        if (!runs.some((run) => !run.error && run.read > 0)) break
      }
    } finally {
      running = false
    }
  }
  console.log(`[phone-hub] phone sync: ${readers.map((r) => r.source).join(", ")} every ${PHONE_SYNC_MS / 1000}s`)
  // A disk error in one tick is logged; the next interval tries again.
  const runTick = () =>
    tick().catch((err) => console.error(`[phone-hub] phone sync tick: ${err instanceof Error ? err.message : err}`))
  void runTick()
  setInterval(() => void runTick(), PHONE_SYNC_MS)
}

/**
 * Phone sync and location only change Tracking. Pushing every key would send
 * the hub's copy of stores the app changed since the last read, and the vault
 * guard refuses those as stale.
 */
function flushTracking() {
  flushVault(trackingKey ? [trackingKey] : undefined)
}

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

void main().catch((err) => {
  console.error("[phone-hub] start", err instanceof Error ? err.message : err)
  process.exit(1)
})
