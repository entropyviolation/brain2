/**
 * electron/telegram-ingest.js — Telegram long-poll in the Electron main process
 *
 * Token: userData via safeStorage, or gitignored `.env.local` /
 * `COGS_TELEGRAM_BOT_TOKEN`. The poller never touches Zustand; it forwards
 * private messages to the renderer over IPC. Replies go back through
 * sendMessage. See docs/MESSAGE_INGEST.md.
 */
const { app, ipcMain, safeStorage } = require("electron")
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
const MESSAGE = "cogs:telegram:message"
const POLL_STATUS = "cogs:telegram:pollStatus"

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
      const updates = await telegramApi(token, "getUpdates", {
        timeout: 25,
        offset,
        allowed_updates: JSON.stringify(["message", "edited_message"]),
      })
      for (const update of updates || []) {
        offset = Math.max(offset, (update.update_id || 0) + 1)
        const payload = await hydrateTelegramUpdate(update, token, (method, params) =>
          telegramApi(token, method, params),
        )
        if (payload && sendToRenderer) sendToRenderer(MESSAGE, payload)
      }
      writeOffset(offset)
    } catch (err) {
      if (sendToRenderer) {
        sendToRenderer(POLL_STATUS, { ok: false, error: err && err.message ? err.message : "poll failed" })
      }
      await new Promise((r) => setTimeout(r, 4000))
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
  ipcMain.handle(STATUS, () => ({
    ok: true,
    polling,
    hasToken: Boolean(readToken()),
    hub: phoneHubOwnsTelegram(),
  }))
  ipcMain.handle(SEND, async (_e, chatId, text) => {
    const token = readToken()
    if (!token) return { ok: false, error: "No bot token stored" }
    try {
      const messageIds = []
      for (const part of chunkTelegramText(text)) {
        const result = await telegramApi(token, "sendMessage", { chat_id: chatId, text: part })
        if (result && result.message_id != null) messageIds.push(result.message_id)
      }
      return { ok: true, messageIds, messageId: messageIds[0] }
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : "send failed" }
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
