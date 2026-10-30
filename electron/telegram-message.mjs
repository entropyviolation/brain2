import { createRequire } from "node:module"

const {
  locationLines,
  telegramSentAtIso,
  replyTargetId,
  extractTelegramMessage,
  hydrateTelegramUpdate,
  chunkTelegramText,
} = createRequire(import.meta.url)("./telegram-message.cjs")

export {
  locationLines,
  telegramSentAtIso,
  replyTargetId,
  extractTelegramMessage,
  hydrateTelegramUpdate,
  chunkTelegramText,
}
