#!/usr/bin/env node
/**
 * Optional always-on Telegram poller for Brain2 message ingest.
 *
 *   gitignored `.env.local` with BRAIN2_TELEGRAM_BOT_TOKEN, or
 *   BRAIN2_TELEGRAM_BOT_TOKEN=… npm run ingest
 *
 * Writes pending messages to data/message-ingest.json. The renderer (with
 * `npm run dev`) drains /api/ingest/pending. Do not run this at the same time
 * as the Electron poller — Telegram allows one getUpdates consumer.
 *
 * See docs/MESSAGE_INGEST.md.
 */
import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { readIngestStore, writeIngestStore, ingestDataPath } from "./ingest-api.mjs"
import { hydrateTelegramUpdate } from "./telegram-file.mjs"
import { chunkTelegramText } from "../electron/telegram-message.mjs"
import { brain2Env, brain2EnvLine } from "../lib/brain2-env.mjs"
import {
  allowedUpdatesParam,
  callbackQueryToIncoming,
  commandMenuRegistration,
} from "../lib/ingest/telegram-ui.mjs"

function tokenFromEnvFiles() {
  const fromEnv = String(brain2Env("TELEGRAM_BOT_TOKEN") || "").trim()
  if (fromEnv) return fromEnv
  const root = join(dirname(fileURLToPath(import.meta.url)), "..")
  for (const name of [".env.local", ".env"]) {
    const file = join(root, name)
    if (!existsSync(file)) continue
    try {
      const value = brain2EnvLine(readFileSync(file, "utf8"), "TELEGRAM_BOT_TOKEN")
      if (value) return value
    } catch {
      /* ignore */
    }
  }
  return ""
}

const TOKEN = tokenFromEnvFiles()
if (!TOKEN) {
  console.error("[brain2-ingest] Set BRAIN2_TELEGRAM_BOT_TOKEN or gitignored .env.local")
  process.exit(1)
}

let offset = 0
const OFFSET_FILE = ingestDataPath().replace(/message-ingest\.json$/, "telegram-offset.json")

try {
  offset = Number(JSON.parse(readFileSync(OFFSET_FILE, "utf8")).offset) || 0
} catch {
  offset = 0
}

async function api(method, params = {}) {
  const url = new URL(`https://api.telegram.org/bot${TOKEN}/${method}`)
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    url.searchParams.set(k, String(v))
  }
  const res = await fetch(url)
  const data = await res.json()
  if (!data.ok) throw new Error(data.description || `HTTP ${res.status}`)
  return data.result
}

async function flushReplies() {
  const store = readIngestStore()
  if (!store.replies.length) return
  const leftover = []
  for (const reply of store.replies) {
    try {
      const parts = chunkTelegramText(reply.text)
      for (let i = 0; i < parts.length; i++) {
        await api("sendMessage", {
          chat_id: reply.chatId,
          text: parts[i],
          reply_markup:
            reply.markup && i === parts.length - 1 ? JSON.stringify(reply.markup) : undefined,
        })
      }
    } catch (err) {
      console.warn("[brain2-ingest] reply failed:", err.message)
      leftover.push(reply)
    }
  }
  writeIngestStore({ ...readIngestStore(), replies: leftover })
}

try {
  for (const call of commandMenuRegistration()) await api(call.method, call.params)
} catch (err) {
  console.warn("[brain2-ingest] commands", err.message)
}

console.log(`[brain2-ingest] polling Telegram → ${ingestDataPath()}`)
writeIngestStore({ ...readIngestStore(), polling: true })

process.on("SIGINT", () => {
  writeIngestStore({ ...readIngestStore(), polling: false })
  process.exit(0)
})

while (true) {
  try {
    const updates = await api("getUpdates", {
      timeout: 25,
      offset,
      allowed_updates: allowedUpdatesParam(),
    })
    const store = readIngestStore()
    const pending = [...store.pending]
    for (const update of updates || []) {
      offset = Math.max(offset, (update.update_id || 0) + 1)
      let payload = await hydrateTelegramUpdate(update, TOKEN, api)
      if (!payload && update && update.callback_query && update.callback_query.id) {
        await api("answerCallbackQuery", { callback_query_id: update.callback_query.id })
        const tapped = callbackQueryToIncoming(update)
        if (tapped) {
          if (tapped.clearMarkup && tapped.clearMarkup.messageId != null) {
            try {
              await api("editMessageReplyMarkup", {
                chat_id: tapped.clearMarkup.chatId,
                message_id: tapped.clearMarkup.messageId,
                reply_markup: JSON.stringify({ inline_keyboard: [] }),
              })
            } catch {
              /* the question markup is already gone */
            }
          }
          payload = tapped.payload
        }
      }
      if (payload) pending.push(payload)
    }
    const { writeFileSync } = await import("node:fs")
    writeFileSync(OFFSET_FILE, JSON.stringify({ offset }), "utf8")
    writeIngestStore({ ...store, pending, polling: true })
    await flushReplies()
  } catch (err) {
    console.warn("[brain2-ingest]", err.message)
    await new Promise((r) => setTimeout(r, 1000))
  }
}
