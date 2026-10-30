/**
 * scripts/telegram-file.mjs — Download Telegram photo / PDF bytes for ingest.
 * The bodies live in electron/telegram-message.cjs. This file keeps the import path.
 */
export { extractTelegramMessage, hydrateTelegramUpdate } from "../electron/telegram-message.mjs"
