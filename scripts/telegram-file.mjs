/**
 * scripts/telegram-file.mjs — Download Telegram photo / PDF bytes for ingest
 */
const MAX_BYTES = 12 * 1024 * 1024

function locationLines(msg) {
  const loc = msg && msg.location
  if (!loc || typeof loc.latitude !== "number" || typeof loc.longitude !== "number") return null
  const title = msg.venue && typeof msg.venue.title === "string" ? msg.venue.title.trim() : ""
  const live = typeof loc.live_period === "number" && loc.live_period > 0
  // A restaurant card is a place someone shared, not where the phone is standing.
  if (title && !live) {
    return ["gps:", "shared-place", title, `${loc.latitude},${loc.longitude}`].join("\n")
  }
  const lines = [title ? `gps: ${title}` : "gps:"]
  lines.push(`${loc.latitude},${loc.longitude}`)
  if (typeof loc.horizontal_accuracy === "number") lines.push(`±${Math.round(loc.horizontal_accuracy)}m`)
  return lines.join("\n")
}

/** Original send time (`message.date`). Edit time is not when they sent it. */
function telegramSentAtIso(msg) {
  const unix = Number(msg && msg.date)
  if (!Number.isFinite(unix) || unix <= 0) return new Date().toISOString()
  return new Date(unix * 1000).toISOString()
}

export function extractTelegramMessage(update) {
  const msg = update && (update.message || update.edited_message)
  if (!msg) return null
  const chat = msg.chat || {}
  const from = msg.from || {}
  const isGroup = chat.type === "group" || chat.type === "supergroup"
  const caption = typeof msg.caption === "string" ? msg.caption : ""
  const text = typeof msg.text === "string" ? msg.text : caption
  const base = {
    text: text || "",
    chatId: String(chat.id),
    userId: from.id != null ? String(from.id) : String(chat.id),
    username: from.username || undefined,
    isGroup,
    telegramMessageId: msg.message_id,
    telegramUpdateId: update && update.update_id != null ? update.update_id : undefined,
    receivedAt: telegramSentAtIso(msg),
    mediaGroupId: msg.media_group_id != null ? String(msg.media_group_id) : undefined,
  }

  if (Array.isArray(msg.photo) && msg.photo.length) {
    const biggest = msg.photo[msg.photo.length - 1]
    return {
      ...base,
      fileId: biggest.file_id,
      fileKind: "photo",
      mime: "image/jpeg",
      fileName: "photo.jpg",
    }
  }

  const doc = msg.document
  if (doc && doc.file_id) {
    const name = doc.file_name || "file"
    const mime = doc.mime_type || ""
    const isPdf = mime === "application/pdf" || /\.pdf$/i.test(name)
    const isImage = /^image\//i.test(mime)
    if (isPdf || isImage) {
      return {
        ...base,
        fileId: doc.file_id,
        fileKind: isPdf ? "pdf" : "photo",
        mime: mime || (isPdf ? "application/pdf" : "image/jpeg"),
        fileName: name,
      }
    }
  }

  const located = locationLines(msg)
  if (located) return { ...base, text: located, locationUpdate: true }

  // Voice / audio notes — no download needed; ritual advance treats them as answers.
  const voice = msg.voice || msg.audio
  if (voice && voice.file_id) {
    return {
      ...base,
      attachments: [
        {
          kind: msg.voice ? "voice" : "audio",
          mime: voice.mime_type || "audio/ogg",
          name: msg.voice ? "voice.ogg" : voice.file_name || "audio",
          dataUrl: "",
        },
      ],
    }
  }

  if (base.text) return base
  return null
}

export async function hydrateTelegramUpdate(update, token, telegramApi) {
  const extracted = extractTelegramMessage(update)
  if (!extracted) return null
  if (!extracted.fileId) return extracted
  try {
    const info = await telegramApi("getFile", { file_id: extracted.fileId })
    const filePath = info && info.file_path
    if (!filePath || (info.file_size && info.file_size > MAX_BYTES)) {
      delete extracted.fileId
      delete extracted.fileKind
      delete extracted.mime
      delete extracted.fileName
      return extracted.text ? extracted : null
    }
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`)
    const buf = Buffer.from(await res.arrayBuffer())
    extracted.attachments = [
      {
        kind: extracted.fileKind,
        mime: extracted.mime,
        name: extracted.fileName,
        dataUrl: `data:${extracted.mime};base64,${buf.toString("base64")}`,
        mediaGroupId: extracted.mediaGroupId,
      },
    ]
  } catch {
    /* caption-only fallback */
  }
  delete extracted.fileId
  delete extracted.fileKind
  delete extracted.mime
  delete extracted.fileName
  if (!extracted.text && !(extracted.attachments && extracted.attachments.length)) return null
  return extracted
}
