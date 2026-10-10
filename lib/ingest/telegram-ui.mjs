/**
 * lib/ingest/telegram-ui.mjs — Private slash menu and question buttons
 *
 * The menu is five commands, private chats only. Typed commands stay as they
 * are. Buttons sit on clarify, duplicate, and receipt questions. A typed
 * number or word still answers the same question. No reply keyboard.
 */

export const PRIVATE_SLASH_MENU = Object.freeze([
  { command: "start", description: "Pair this chat, or say hello" },
  { command: "help", description: "Short phrase list" },
  { command: "now", description: "Now capture: doing | just did | about to" },
  { command: "quicklists", description: "Numbered lists to pull" },
  { command: "info", description: "BIM basics" },
])

export const TELEGRAM_ALLOWED_UPDATES = Object.freeze(["message", "edited_message", "callback_query"])

const NUMBERED_KINDS = new Set(["location", "habit", "track", "start", "mood", "read", "bought"])
const CHOICE_WORDS = new Set(["see", "again", "dismiss", "inv", "skip"])

export function allowedUpdatesParam() {
  return JSON.stringify(TELEGRAM_ALLOWED_UPDATES)
}

/** Calls for a query-string Bot API client. Private menu only; groups stay empty. */
export function commandMenuRegistration() {
  return [
    {
      method: "setMyCommands",
      params: {
        commands: JSON.stringify(PRIVATE_SLASH_MENU),
        scope: JSON.stringify({ type: "all_private_chats" }),
      },
    },
    {
      method: "deleteMyCommands",
      params: { scope: JSON.stringify({ type: "all_group_chats" }) },
    },
    {
      method: "deleteMyCommands",
      params: { scope: JSON.stringify({ type: "default" }) },
    },
  ]
}

function byteLength(value) {
  return new TextEncoder().encode(value).length
}

function clipLabel(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim()
  if (byteLength(raw) <= 64) return raw || "·"
  let cut = raw
  while (cut.length > 0 && byteLength(cut) > 61) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

function button(text, callbackData) {
  if (byteLength(callbackData) < 1 || byteLength(callbackData) > 64) return null
  return { text: clipLabel(text), callback_data: callbackData }
}

/**
 * Inline keyboard for a question the bot already asks.
 * Ritual steps stay plain text. Returns undefined when there is nothing to tap.
 */
export function inlineKeyboardForResult(result) {
  if (!result || result.status !== "needs_clarify" || !result.pending) return undefined
  const pending = result.pending
  const kind = pending.kind
  if (kind === "ritual") return undefined

  if (kind === "duplicate") {
    const rows = ["see", "again", "dismiss"]
      .map((word) => button(word, `w:${word}`))
      .filter(Boolean)
      .map((entry) => [entry])
    return rows.length ? { inline_keyboard: rows } : undefined
  }

  const candidates = Array.isArray(pending.candidates) ? pending.candidates : []
  const rows = []
  if (kind === "receipt" || NUMBERED_KINDS.has(kind)) {
    candidates.forEach((candidate, index) => {
      const n = index + 1
      const name = candidate && candidate.name ? candidate.name : `Choice ${n}`
      const entry = button(`${n}. ${name}`, `n:${n}`)
      if (entry) rows.push([entry])
    })
  }
  if (kind === "receipt") {
    const extras = ["inv", "skip"].map((word) => button(word, `w:${word}`)).filter(Boolean)
    if (extras.length) rows.push(extras)
  }
  if (!rows.length) return undefined
  return { inline_keyboard: rows }
}

/** Map a tap back onto the text the executor already accepts. */
export function choiceTextFromCallback(data) {
  if (typeof data !== "string") return null
  if (byteLength(data) < 1 || byteLength(data) > 64) return null
  const num = /^n:([1-9]\d{0,2})$/.exec(data)
  if (num) return num[1]
  const word = /^w:(see|again|dismiss|inv|skip)$/.exec(data)
  if (word && CHOICE_WORDS.has(word[1])) return word[1]
  return null
}

/**
 * Turn a callback_query into the same incoming shape as a typed reply.
 * Null when this update is not one of our buttons.
 */
export function callbackQueryToIncoming(update) {
  const query = update && update.callback_query
  if (!query || !query.id) return null
  const text = choiceTextFromCallback(query.data)
  if (!text) return null
  const message = query.message
  const chat = message && message.chat
  if (!chat || chat.id == null) return null
  const from = query.from || {}
  const isGroup = chat.type === "group" || chat.type === "supergroup"
  return {
    callbackQueryId: String(query.id),
    clearMarkup: {
      chatId: String(chat.id),
      messageId: message.message_id,
    },
    payload: {
      text,
      chatId: String(chat.id),
      userId: from.id != null ? String(from.id) : String(chat.id),
      username: from.username || undefined,
      isGroup,
      telegramMessageId: message.message_id,
      telegramUpdateId: update.update_id != null ? update.update_id : undefined,
      receivedAt: new Date().toISOString(),
    },
  }
}
