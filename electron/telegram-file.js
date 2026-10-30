/**
 * electron/telegram-file.js — Download Telegram photo / PDF bytes for ingest.
 * The bodies live in telegram-message.cjs. This file keeps the require path.
 */
const { extractTelegramMessage, hydrateTelegramUpdate } = require("./telegram-message.cjs")

module.exports = { extractTelegramMessage, hydrateTelegramUpdate }
