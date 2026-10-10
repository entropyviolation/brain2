/**
 * electron/telegram-ingest.js — Telegram long-poll in the Electron main process
 *
 * Token: userData via safeStorage, or gitignored `.env.local` /
 * `COGS_TELEGRAM_BOT_TOKEN`. The poller never touches Zustand; it forwards
 * private messages to the renderer over IPC. The poll offset advances when the
 * renderer acks, after apply and flush — not when the IPC send returns.
 * Replies go back through sendMessage. See docs/MESSAGE_INGEST.md.
 */
const { app, ipcMain, safeStorage } = require("electron")
const { pathToFileURL } = require("url")
const { extractTelegramMessage, hydrateTelegramUpdate } = require("./telegram-file")
const fs = require("fs")
const path = require("path")

const SET_TOKEN = "cogs:telegram:setToken"
const CLEAR_TOKEN = "cogs:telegram:clearToken"
const HAS_TOKEN = "cogs:telegram:hasToken"
const START = "cogs:telegram:start"
const STOP = "cogs:telegram:stop"
const STATUS = "cogs:telegram:status"
const SEND = "cogs:telegram:send"
const PIN = "cogs:telegram:pin"
const EDIT = "cogs:telegram:edit"
const MESSAGE = "cogs:telegram:message"
const POLL_STATUS = "cogs:telegram:pollStatus"
const ACK = "cogs:telegram:ack"
const ACK_WAIT_MS = 120000

/** Same rule as lib/ingest/confirm-updates.ts — prefix of finished writes only. */
function advanceConfirmedOffset(startOffset, orderedUpdateIds, confirmed) {
  let offset = startOffset
  for (const id of orderedUpdateIds) {
    if (!confirmed.has(id)) break
    offset = Math.max(offset, id + 1)
  }
  return offset
}

const ackWaiters = new Map()

function waitForUpdateAck(updateId) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ackWaiters.delete(updateId)
      resolve(false)
    }, ACK_WAIT_MS)
    ackWaiters.set(updateId, () => {
      clearTimeout(timer)
      ackWaiters.delete(updateId)
      resolve(true)
    })
  })
}

function hubStatusPath() {
  return path.join(process.cwd(), "data", "phone-hub-status.json")
}

function phoneHubOwnsTelegram() {
  try {
    const parsed = JSON.parse(fs.readFileSync(hubStatusPath(), "utf8"))
    if (!parsed || parsed.polling !== true) return false
    const at = Date.parse(parsed.at)
    if (!Number.isFinite(at)) return false
    return Date.now() - at < 45_000
  } catch {
    return false
  }
}

function tokenPath() {
  return path.join(app.getPath("userData"), "telegram-bot-token.enc")
}

/** Gitignored `.env.local` / `COGS_TELEGRAM_BOT_TOKEN` — never committed. */
function tokenFromEnvFiles() {
  const fromEnv = String(process.env.COGS_TELEGRAM_BOT_TOKEN || "").trim()
  if (fromEnv) return fromEnv
  const roots = [process.cwd()]
  try {
    roots.push(path.join(__dirname, ".."))
  } catch {
    /* ignore */
  }
  const names = [".env.local", ".env"]
  for (const root of roots) {
    for (const name of names) {
      const file = path.join(root, name)
      if (!fs.existsSync(file)) continue
      try {
        const text = fs.readFileSync(file, "utf8")
        const line = text.split(/\r?\n/).find((row) => row.startsWith("COGS_TELEGRAM_BOT_TOKEN="))
        if (!line) continue
        const value = line.slice("COGS_TELEGRAM_BOT_TOKEN=".length).trim().replace(/^["']|["']$/g, "")
        if (value) return value
      } catch {
        /* ignore unreadable env files */
      }
    }
  }
  return null
}

function offsetPath() {
  return path.join(app.getPath("userData"), "telegram-update-offset.json")
}

function readToken() {
  try {
    const file = tokenPath()
    if (fs.existsSync(file)) {
      const buf = fs.readFileSync(file)
      const stored = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(buf)
        : buf.toString("utf8")
      const trimmed = String(stored || "").trim()
      if (trimmed) return trimmed
    }
  } catch {
    /* fall through to env files */
  }
  return tokenFromEnvFiles()
}

function writeToken(token) {
  const file = tokenPath()
  const trimmed = String(token || "").trim()
  if (!trimmed) {
    if (fs.existsSync(file)) fs.rmSync(file)
    return
  }
  const payload = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(trimmed)
    : Buffer.from(trimmed, "utf8")
  fs.writeFileSync(file, payload)
}

function readOffset() {
  try {
    const parsed = JSON.parse(fs.readFileSync(offsetPath(), "utf8"))
    return Number(parsed.offset) || 0
  } catch {
    return 0
  }
}

function writeOffset(offset) {
  fs.writeFileSync(offsetPath(), JSON.stringify({ offset }), "utf8")
}

let polling = false
let pollAbort = false
let menuRegistered = false
let telegramUiPromise = null

function telegramUi() {
  if (!telegramUiPromise) {
    telegramUiPromise = import(pathToFileURL(path.join(__dirname, "../lib/ingest/telegram-ui.mjs")).href)
  }
  return telegramUiPromise
}

async function ensureCommandMenu(token) {
  if (menuRegistered) return
  const ui = await telegramUi()
  for (const call of ui.commandMenuRegistration()) {
    await telegramApi(token, call.method, call.params)
  }
  menuRegistered = true
}

async function payloadFromUpdate(update, token) {
  const payload = await hydrateTelegramUpdate(update, token, (method, params) =>
    telegramApi(token, method, params),
  )
  if (payload) return payload
  const query = update && update.callback_query
  if (!query || !query.id) return null
  await telegramApi(token, "answerCallbackQuery", { callback_query_id: query.id })
  const ui = await telegramUi()
  const tapped = ui.callbackQueryToIncoming(update)
  if (!tapped) return null
  if (tapped.clearMarkup && tapped.clearMarkup.messageId != null) {
    try {
      await telegramApi(token, "editMessageReplyMarkup", {
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
/** @type {((channel: string, payload: unknown) => void) | null} */
let sendToRenderer = null

async function telegramApi(token, method, params) {
  const url = new URL(`https://api.telegram.org/bot${token}/${method}`)
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

function extractMessage(update) {
  return extractTelegramMessage(update)
}

async function pollLoop() {
  let offset = readOffset()
  while (polling && !pollAbort) {
    if (phoneHubOwnsTelegram()) {
      polling = false
      if (sendToRenderer) sendToRenderer(POLL_STATUS, { ok: true, hub: true })
      break
    }
    const token = readToken()
    if (!token) {
      polling = false
      break
    }
    try {
      try {
        await ensureCommandMenu(token)
      } catch (err) {
        console.error("[telegram] commands", err && err.message ? err.message : err)
      }
      const ui = await telegramUi()
      const updates = await telegramApi(token, "getUpdates", {
        timeout: 25,
        offset,
        allowed_updates: ui.allowedUpdatesParam(),
      })
      const rows = []
      for (const update of updates || []) {
        const id = Number(update && update.update_id) || 0
        let payload = null
        let failed = false
        try {
          payload = await payloadFromUpdate(update, token)
        } catch {
          failed = true
        }
        const ack = payload && sendToRenderer ? waitForUpdateAck(id) : null
        rows.push({ id, payload, failed, ack })
      }
      const sendable = rows.filter((row) => row.payload)
      sendable.sort((a, b) => {
        const at = Date.parse(a.payload.receivedAt || "") || 0
        const bt = Date.parse(b.payload.receivedAt || "") || 0
        if (at !== bt) return at - bt
        return (a.payload.telegramMessageId || 0) - (b.payload.telegramMessageId || 0)
      })
      for (const row of sendable) {
        if (sendToRenderer) sendToRenderer(MESSAGE, row.payload)
      }
      const confirmed = new Set()
      const orderedIds = []
      for (const row of rows) {
        orderedIds.push(row.id)
        if (row.failed) break
        if (!row.payload) {
          confirmed.add(row.id)
          continue
        }
        if (!row.ack) break
        if (await row.ack) confirmed.add(row.id)
        else break
      }
      const next = advanceConfirmedOffset(offset, orderedIds, confirmed)
      if (next !== offset) writeOffset(next)
      offset = next
      if (orderedIds.length > 0 && confirmed.size < orderedIds.length) {
        await new Promise((r) => setTimeout(r, 1000))
      }
    } catch (err) {
      if (sendToRenderer) {
        sendToRenderer(POLL_STATUS, { ok: false, error: err && err.message ? err.message : "poll failed" })
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}

function startPolling() {
  if (phoneHubOwnsTelegram()) {
    return { ok: true, polling: false, hub: true }
  }
  if (polling) return { ok: true, polling: true }
  if (!readToken()) return { ok: false, error: "No bot token stored" }
  polling = true
  pollAbort = false
  pollLoop()
  return { ok: true, polling: true }
}

function stopPolling() {
  polling = false
  pollAbort = true
  return { ok: true, polling: false }
}

/** Telegram sendMessage cap is 4096; split on newlines so list dumps stay readable. */
function chunkTelegramText(text, max = 3900) {
  const source = String(text || "")
  if (!source) return []
  if (source.length <= max) return [source]
  const chunks = []
  let rest = source
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max)
    if (cut < max * 0.45) cut = rest.lastIndexOf(" ", max)
    if (cut < max * 0.45) cut = max
    chunks.push(rest.slice(0, cut).replace(/[ \t]+$/g, ""))
    rest = rest.slice(cut).replace(/^\n+/, "")
  }
  if (rest) chunks.push(rest)
  return chunks.filter((part) => part.length > 0)
}

function registerTelegramIpc(getMainWindow) {
  sendToRenderer = (channel, payload) => {
    const win = getMainWindow && getMainWindow()
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }

  ipcMain.handle(SET_TOKEN, (_e, token) => {
    writeToken(token)
    return { ok: true, hasToken: Boolean(readToken()) }
  })
  ipcMain.handle(CLEAR_TOKEN, () => {
    writeToken("")
    stopPolling()
    return { ok: true, hasToken: false }
  })
  ipcMain.handle(HAS_TOKEN, () => ({ ok: true, hasToken: Boolean(readToken()) }))
  ipcMain.handle(START, () => startPolling())
  ipcMain.handle(STOP, () => stopPolling())
  ipcMain.on(ACK, (_event, ids) => {
    const list = Array.isArray(ids) ? ids : []
    for (const id of list) {
      const wake = ackWaiters.get(Number(id))
      if (wake) wake()
    }
  })
  ipcMain.handle(STATUS, () => ({
    ok: true,
    polling,
    hasToken: Boolean(readToken()),
    hub: phoneHubOwnsTelegram(),
  }))
  ipcMain.handle(SEND, async (_e, chatId, text, markup) => {
    const token = readToken()
    if (!token) return { ok: false, error: "No bot token stored" }
    try {
      const messageIds = []
      const parts = chunkTelegramText(text)
      for (let i = 0; i < parts.length; i++) {
        const params = { chat_id: chatId, text: parts[i] }
        if (markup && i === parts.length - 1) {
          params.reply_markup = typeof markup === "string" ? markup : JSON.stringify(markup)
        }
        const result = await telegramApi(token, "sendMessage", params)
        if (result && result.message_id != null) messageIds.push(result.message_id)
      }
      return { ok: true, messageIds, messageId: messageIds[0] }
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : "send failed" }
    }
  })
  ipcMain.handle(EDIT, async (_e, chatId, messageId, text, markup) => {
    const token = readToken()
    if (!token) return { ok: false, error: "No bot token stored" }
    try {
      await telegramApi(token, "editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: JSON.stringify(markup || { inline_keyboard: [] }),
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : "edit failed" }
    }
  })
  ipcMain.handle(PIN, async (_e, chatId, messageId, previousId) => {
    const token = readToken()
    if (!token) return { ok: false, error: "No bot token stored" }
    try {
      if (previousId && previousId !== messageId) {
        try {
          await telegramApi(token, "unpinChatMessage", { chat_id: chatId, message_id: previousId })
        } catch {
          /* already unpinned */
        }
      }
      await telegramApi(token, "pinChatMessage", {
        chat_id: chatId,
        message_id: messageId,
        disable_notification: true,
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : "pin failed" }
    }
  })
}

module.exports = {
  registerTelegramIpc,
  SET_TOKEN,
  CLEAR_TOKEN,
  HAS_TOKEN,
  START,
  STOP,
  STATUS,
  SEND,
  PIN,
  MESSAGE,
  POLL_STATUS,
}
