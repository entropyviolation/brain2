/**
 * lib/append-log.ts — Timestamped append-only writing log
 *
 * One kind of record: an immutable entry stamped with the writing time
 * (`9/20 9pm - …`). Used by Plan (day/week/month) and Tracking day notes;
 * other dated notes can join later. List / Bulk / Latest is the shared view.
 *
 * A stored value is either a versioned JSON envelope or a legacy plaintext
 * blob (migrated on read as one "earlier" entry).
 */
export type AppendLogViewMode = "list" | "bulk" | "latest"

export interface AppendLogEntry {
  id: string
  createdAt: string | null
  text: string
  /**
   * Shown after the date/time stamp (e.g. `from text` for Telegram plan-for-rn).
   * Omitted on ordinary UI submits.
   */
  stampSuffix?: string
}

import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

const LOG_VERSION = 1
const VIEW_KEY = persistKey("appendLogView")
const LEGACY_VIEW_KEY = "planTextView"
export const APPEND_LOG_CHANGE_EVENT = "cogs-append-log-change"

export function newAppendLogId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `al_${crypto.randomUUID()}`
  }
  return `al_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function isEntry(value: unknown): value is AppendLogEntry {
  if (!value || typeof value !== "object") return false
  const v = value as AppendLogEntry
  if (typeof v.id !== "string" || typeof v.text !== "string") return false
  if (!(v.createdAt === null || typeof v.createdAt === "string")) return false
  if (v.stampSuffix != null && typeof v.stampSuffix !== "string") return false
  return true
}

export function parseAppendLog(raw: string | null | undefined): AppendLogEntry[] {
  if (raw == null || raw === "") return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const envelope = parsed as { v?: number; entries?: unknown }
      if (envelope.v === LOG_VERSION && Array.isArray(envelope.entries)) {
        return envelope.entries.filter(isEntry)
      }
    }
    if (Array.isArray(parsed) && parsed.every(isEntry)) return parsed
  } catch {
    /* plaintext blob from before the log */
  }
  return [{ id: "legacy", createdAt: null, text: raw }]
}

export function serializeAppendLog(entries: AppendLogEntry[], draft = ""): string {
  if (draft) return JSON.stringify({ v: LOG_VERSION, entries, draft })
  return JSON.stringify({ v: LOG_VERSION, entries })
}

/** Unsubmitted composer text stored beside entries. Legacy plaintext has none. */
export function parseAppendLogDraft(raw: string | null | undefined): string {
  if (raw == null || raw === "") return ""
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const draft = (parsed as { draft?: unknown }).draft
      return typeof draft === "string" ? draft : ""
    }
  } catch {
    /* leftover plaintext is an entry, not a draft */
  }
  return ""
}

export function sortAppendLogNewestFirst(entries: AppendLogEntry[]): AppendLogEntry[] {
  return [...entries].sort((a, b) => {
    if (a.createdAt === b.createdAt) return 0
    if (!a.createdAt) return 1
    if (!b.createdAt) return -1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0")
}

/** Compact writing-time stamp: `9/20 9pm`, `9/20 9:17pm`, or `9/20/25 9pm`. */
export function formatAppendStamp(iso: string | null, now = new Date()): string {
  if (!iso) return "earlier"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "earlier"
  const sameYear = d.getFullYear() === now.getFullYear()
  const datePart = sameYear
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`
  const h = d.getHours()
  const mins = d.getMinutes()
  const h12 = h % 12 || 12
  const ampm = h < 12 ? "am" : "pm"
  const timePart = mins === 0 ? `${h12}${ampm}` : `${h12}:${pad2(mins)}${ampm}`
  return `${datePart} ${timePart}`
}

export function formatAppendEntry(entry: AppendLogEntry, now = new Date()): string {
  const stamp = formatAppendStamp(entry.createdAt, now)
  const suffix = entry.stampSuffix?.trim() ? ` ${entry.stampSuffix.trim()}` : ""
  const body = entry.text.replace(/\s+$/, "")
  const lines = body.split("\n")
  return [`${stamp}${suffix} - ${lines[0] ?? ""}`, ...lines.slice(1)].join("\n")
}

/** Stamp line for UI list rows: `9/23 1:42pm from text`. */
export function formatAppendStampLine(entry: AppendLogEntry, now = new Date()): string {
  const stamp = formatAppendStamp(entry.createdAt, now)
  const suffix = entry.stampSuffix?.trim()
  return suffix ? `${stamp} ${suffix}` : stamp
}

export function formatAppendLog(entries: AppendLogEntry[], mode: "all" | "latest" = "all", now = new Date()): string {
  const ordered = sortAppendLogNewestFirst(entries)
  const slice = mode === "latest" ? ordered.slice(0, 1) : ordered
  return slice.map((entry) => formatAppendEntry(entry, now)).join("\n\n")
}

export function appendLogBodies(entries: AppendLogEntry[]): string | null {
  if (entries.length === 0) return null
  return sortAppendLogNewestFirst(entries)
    .map((e) => e.text)
    .join("\n\n")
}

export function makeAppendLogEntry(
  text: string,
  createdAt: Date = new Date(),
  opts?: { stampSuffix?: string },
): AppendLogEntry | null {
  const trimmed = text.replace(/^\s+/, "").replace(/\s+$/, "")
  if (!trimmed) return null
  const stampSuffix = opts?.stampSuffix?.trim()
  return {
    id: newAppendLogId(),
    createdAt: createdAt.toISOString(),
    text: trimmed,
    ...(stampSuffix ? { stampSuffix } : {}),
  }
}

export function emitAppendLogChange(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(APPEND_LOG_CHANGE_EVENT))
}

export function subscribeAppendLog(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  const handler = () => onChange()
  window.addEventListener(APPEND_LOG_CHANGE_EVENT, handler)
  window.addEventListener("storage", handler)
  return () => {
    window.removeEventListener(APPEND_LOG_CHANGE_EVENT, handler)
    window.removeEventListener("storage", handler)
  }
}

function isViewMode(value: string | null): value is AppendLogViewMode {
  return value === "list" || value === "bulk" || value === "latest"
}

export function getAppendLogViewMode(): AppendLogViewMode {
  if (typeof window === "undefined") return "list"
  const raw = readAliasedLocal(VIEW_KEY) ?? (typeof localStorage !== "undefined" ? localStorage.getItem(LEGACY_VIEW_KEY) : null)
  return isViewMode(raw) ? raw : "list"
}

export function setAppendLogViewMode(mode: AppendLogViewMode): void {
  if (typeof window === "undefined") return
  writeAliasedLocal(VIEW_KEY, mode)
  emitAppendLogChange()
}
