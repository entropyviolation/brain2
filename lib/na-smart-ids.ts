/**
 * lib/na-smart-ids.ts — Ids of the Next Actions smart lists and scheduled folder
 *
 * Leaf module (no imports) so `archive-lists` and `scheduled-lists-sync` can
 * both read these at load time without an import cycle through `task-store`.
 */
export const NA_SMART_DAILY = "na-smart-daily"
export const NA_SMART_WEEKLY = "na-smart-weekly"
export const NA_SMART_MONTHLY = "na-smart-monthly"
export const NA_SMART_COMPLETED = "na-smart-completed"
export const NA_SMART_MISSED = "na-smart-missed"
export const NA_SCHEDULED_FOLDER = "na-scheduled"
