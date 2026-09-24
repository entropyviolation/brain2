#!/usr/bin/env node
/**
 * Optional always-on Telegram poller for Brain2 message ingest.
 *
 *   gitignored `.env.local` with COGS_TELEGRAM_BOT_TOKEN, or
 *   COGS_TELEGRAM_BOT_TOKEN=… npm run ingest
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

function tokenFromEnvFiles() {
  const fromEnv = String(process.env.COGS_TELEGRAM_BOT_TOKEN || "").trim()
  if (fromEnv) return fromEnv
  const root = join(dirname(fileURLToPath(import.meta.url)), "..")
  for (const name of [".env.local", ".env"]) {
    const file = join(root, name)
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
  console.error("[cogs-ingest] Set COGS_TELEGRAM_BOT_TOKEN or gitignored .env.local")
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

async function flushReplies() {
  const store = readIngestStore()
  if (!store.replies.length) return
  const leftover = []
  for (const reply of store.replies) {
    try {
      for (const part of chunkTelegramText(reply.text)) {
        await api("sendMessage", { chat_id: reply.chatId, text: part })
      }
    } catch (err) {
      console.warn("[cogs-ingest] reply failed:", err.message)
      leftover.push(reply)
    }
  }
  writeIngestStore({ ...readIngestStore(), replies: leftover })
}

console.log(`[cogs-ingest] polling Telegram → ${ingestDataPath()}`)
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
      allowed_updates: JSON.stringify(["message", "edited_message"]),
    })
    const store = readIngestStore()
    const pending = [...store.pending]
    for (const update of updates || []) {
      offset = Math.max(offset, (update.update_id || 0) + 1)
      const payload = await hydrateTelegramUpdate(update, TOKEN, api)
      if (payload) pending.push(payload)
    }
    const { writeFileSync } = await import("node:fs")
    writeFileSync(OFFSET_FILE, JSON.stringify({ offset }), "utf8")
    writeIngestStore({ ...store, pending, polling: true })
    await flushReplies()
  } catch (err) {
    console.warn("[cogs-ingest]", err.message)
    await new Promise((r) => setTimeout(r, 4000))
  }
}
