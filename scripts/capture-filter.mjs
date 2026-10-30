/**
 * Which Telegram updates the capture box keeps. Pure functions, Node built-ins only
 * (the VM has no npm install). Deployed next to capture-box.mjs and sealed-box.mjs.
 */

/** The message an update is about: message, edited_message, or a callback's source message. */
export function messageOf(update) {
  if (!update || typeof update !== "object") return null
  const m = update.message || update.edited_message || (update.callback_query && update.callback_query.message)
  return m && m.chat ? m : null
}

/** Chat id as a string, or "" when the update has no chat. */
export function chatOf(update) {
  const m = messageOf(update)
  return m && m.chat.id != null ? String(m.chat.id) : ""
}

/** Telegram chat type ("private", "group", "supergroup", "channel"), or "" when unknown. */
export function chatTypeOf(update) {
  const m = messageOf(update)
  return m && typeof m.chat.type === "string" ? m.chat.type : ""
}

/** "123, -100456" -> Set { "123", "-100456" } */
export function parseChatIds(raw) {
  return new Set(
    String(raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

/**
 * Startup check. `chats` is a Set of ids, `allowAny` the BRAIN2_CAPTURE_ALLOW_ANY_CHAT=1 switch.
 * Returns { ok, error?, warning? }; the caller prints and exits.
 */
export function checkConfig({ chats, allowAny }) {
  if (chats && chats.size) return { ok: true }
  if (allowAny) {
    return {
      ok: true,
      warning:
        "BRAIN2_CAPTURE_ALLOW_ANY_CHAT=1 and no BRAIN2_CAPTURE_CHAT_IDS: keeping texts from ANY private chat with the bot. Set BRAIN2_CAPTURE_CHAT_IDS to your own chat id.",
    }
  }
  return {
    ok: false,
    error:
      "BRAIN2_CAPTURE_CHAT_IDS is empty. Set it to your own Telegram chat id (comma list for more), or set BRAIN2_CAPTURE_ALLOW_ANY_CHAT=1 to accept any private chat (not recommended).",
  }
}

/**
 * Keep an update?
 * - Listed chat ids are always kept (this is how a group is opted in).
 * - Otherwise only private chats, and only when no allowlist is set (allow-any mode).
 *
 * @param {unknown} update
 * @param {{ chats?: Set<string>, allowAny?: boolean }} [opts]
 */
export function shouldKeep(update, opts = {}) {
  const { chats, allowAny = false } = opts
  const id = chatOf(update)
  if (!id) return false
  if (chats && chats.has(id)) return true
  if (chats && chats.size) return false
  return allowAny && chatTypeOf(update) === "private"
}
