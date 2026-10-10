/**
 * lib/blocked-reason.ts — Why a push was blocked
 *
 * Preset reasons stay tokens (`no-time`, …). Other stores the token and, when
 * the person typed something, the words. An empty Other is the token alone.
 */
import type { BlockedReason, StoredBlockedReason } from "@/lib/types"

export const BLOCKED_REASON_OPTIONS: { id: BlockedReason; label: string }[] = [
  { id: "no-energy", label: "No energy" },
  { id: "missing-input", label: "Missing input" },
  { id: "procrastination", label: "Procrastination" },
  { id: "no-time", label: "No time" },
  { id: "blocked-by-other", label: "Blocked by other" },
  { id: "other", label: "Other" },
]

const LABELS: Record<BlockedReason, string> = {
  "no-energy": "No energy",
  "missing-input": "Missing input",
  procrastination: "Procrastination",
  "no-time": "No time",
  "blocked-by-other": "Blocked by other",
  other: "Other",
}

export function blockedReasonToken(value: StoredBlockedReason | undefined): BlockedReason | "" {
  if (!value) return ""
  if (typeof value === "string") return value
  return value.reason
}

export function blockedReasonNote(value: StoredBlockedReason | undefined): string {
  if (!value || typeof value === "string") return ""
  return value.note?.trim() ?? ""
}

/** Words for Other when they were written; otherwise the preset label. */
export function blockedReasonLabel(value: StoredBlockedReason | undefined): string {
  const token = blockedReasonToken(value)
  if (!token) return ""
  const note = blockedReasonNote(value)
  if (token === "other" && note) return note
  return LABELS[token] ?? token
}

/**
 * Pack a choice for storage. Presets ignore any leftover note.
 * Other with blank text stays the token `"other"`.
 */
export function packBlockedReason(reason: BlockedReason, note: string): StoredBlockedReason {
  if (reason !== "other") return reason
  const text = note.trim()
  if (!text) return "other"
  return { reason: "other", note: text }
}

/**
 * Pack a prompt that can hold a preset and a note together.
 * A note with no preset is Other plus those words. Blank is nothing.
 * A preset with no note stays the token. Ritual packing still uses
 * `packBlockedReason`, which drops notes on presets.
 */
export function packReasonKeepingNote(reason: BlockedReason | "", note: string): StoredBlockedReason | undefined {
  const text = note.trim()
  if (!reason && !text) return undefined
  if (!reason) return { reason: "other", note: text }
  if (!text) return reason
  return { reason, note: text }
}

/** Habit cells store a string: the typed note, otherwise the preset label. */
export function missReasonAsText(value: StoredBlockedReason | undefined): string | undefined {
  if (!value) return undefined
  const note = blockedReasonNote(value)
  if (note) return note
  const label = blockedReasonLabel(value)
  return label || undefined
}

/** Words for a stored reason. A preset with a note shows both. */
export function storedReasonText(value: StoredBlockedReason | undefined): string {
  const token = blockedReasonToken(value)
  if (!token) return ""
  const note = blockedReasonNote(value)
  if (token === "other") return note || LABELS.other
  const label = LABELS[token] ?? token
  return note ? `${label} — ${note}` : label
}

/** Match a habit's free string to a preset id or its label. Otherwise no token. */
export function presetIdForText(text: string): BlockedReason | "" {
  const norm = text.trim().toLowerCase()
  if (!norm) return ""
  for (const option of BLOCKED_REASON_OPTIONS) {
    if (option.id === norm || option.label.toLowerCase() === norm) return option.id
  }
  return ""
}
