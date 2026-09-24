/**
 * lib/ingest — Phone-message ingest (Telegram first)
 *
 * Parse key phrases and apply them through the same capture / habit / tracking
 * writes as the desktop UI. See docs/MESSAGE_INGEST.md.
 */
export { parseMessage, looksLikeVerb } from "./parse-message"
export { expandIngestText } from "./expand"
export { parseBulkBuckets } from "./parse-bulk"
export { ingestIncoming, ingestIncomingAsync } from "./executor"
export { INGEST_HELP, INGEST_INFO } from "./help"
export { chunkTelegramText } from "./chunk-text"
export { generatePairingCode, pairingCodeValid, chatKey, PAIRING_TTL_MS } from "./pairing"
export { useIngestStore, makeIngestEventId } from "./ingest-store"
export { findGroceryList, applyGrocery, applyBought } from "./apply-grocery"
export { applyNeeded, findNeededList } from "./apply-needed"
export { applyNote } from "./apply-note"
export { applyIphoneNotes, parseIphoneNoteDump } from "./apply-iphone-notes"
export { applyIphoneScreen } from "./apply-phone-screen"
export { applyIphoneCall, applyIphoneText } from "./apply-phone-life"
export { applyInventory, findInventoryList } from "./apply-inventory"
export { applyReceiptText } from "./apply-receipt"
export { parseReceiptLines, looksLikeReceipt } from "./receipt-parse"
export {
  DEFAULT_DISCRETE_EVENT_TRIGGERS,
  DEFAULT_HABIT_TRIGGER_PRESETS,
  matchHabitTextTrigger,
  matchDiscreteEventTrigger,
} from "./text-triggers"
export type {
  IngestIntent,
  IngestIntentKind,
  IngestSource,
  IngestEvent,
  IncomingMessage,
  IncomingAttachment,
  ApplyResult,
} from "./types"
