/**
 * lib/day-notes-persist.ts — Tracking bottom-notes vault
 *
 * The Home Tracking scratch pad used to live only inside `cogs-timegrid-store`.
 * That blob is huge, goes through the Electron persist hub, and can be replaced
 * by a richer vault of *entries* that never carried the jot. Overlaying notes
 * back onto the chosen snapshot still depended on the same key already having
 * them — a pre-hydrate persist write with `dayNotes: {}` (same entry count, so
 * the shrink guard lets it through) left overlay with nothing to copy.
 *
 * This module is the source of truth: a tiny `brain2-tracking-day-notes` JSON map
 * (legacy `cogs-tracking-day-notes` copied, never deleted), hub-synced on its own.
 * Day keys (`YYYY-MM-DD`) hold the **day summary** — one retrospective prose
 * string. Older values were an append-log envelope; those flatten to prose on
 * read and when a new paragraph is added, so existing notes become the summary
 * instead of being dropped. Week, month, season, and year summaries live in the
 * same map under `week:`, `month:`, `quarter:`, and `year:` keys (see
 * `lib/tracking-summaries.ts`). Those keys are not plan text.
 * Both aliases are **read and unioned**. Plain text: this profile wins. An
 * envelope on either side keeps every paragraph. The timegrid store still
 * mirrors the same stored string in memory; the huge blob is not rewritten on
 * every edit.
 */
"use client"

import { useSyncExternalStore } from "react"

import { cogsStateStorage, registerPersistRehydrator } from "@/lib/persist-storage"
import { persistKey, persistKeyAliases, removeAliasedLocal } from "@/lib/storage-keys"
import {
  type AppendLogEntry,
  emitAppendLogChange,
  makeAppendLogEntry,
  parseAppendLog,
  parseAppendLogDraft,
} from "@/lib/append-log"

export const DAY_NOTES_PERSIST_KEY = persistKey("tracking-day-notes")

export type DayNotesMap = Record<string, string>

const listeners = new Set<() => void>()
/** Keys the user cleared this session — a stale hub GET must not resurrect them. */
const cleared = new Set<string>()
let snapshot: DayNotesMap = load()

function isNotesMap(value: unknown): value is DayNotesMap {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function cleanMap(raw: unknown): DayNotesMap {
  if (!isNotesMap(raw)) return {}
  const out: DayNotesMap = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value) out[key] = value
  }
  return out
}

/** Old day notes were an append-log envelope. A summary is one prose string. */
export function isAppendEnvelope(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false
    const envelope = parsed as { v?: unknown; entries?: unknown }
    return envelope.v === 1 && Array.isArray(envelope.entries)
  } catch {
    return false
  }
}

/**
 * Retrospective text for a stored value. An append-log envelope becomes the
 * joined entry texts (draft included) so an old day note is not dropped when
 * the field becomes one summary. Plain prose is returned as stored.
 */
export function summaryProse(raw: string | null | undefined): string {
  if (!raw) return ""
  if (!isAppendEnvelope(raw)) return raw
  const parts = parseAppendLog(raw)
    .map((entry) => entry.text.trim())
    .filter(Boolean)
  const draft = parseAppendLogDraft(raw).trim()
  if (draft && !parts.includes(draft)) parts.push(draft)
  return parts.join("\n\n")
}

/** Keep every distinct paragraph. Mine stays first. */
export function combineSummaryProse(mine: string, theirs: string): string {
  if (!mine) return theirs
  if (!theirs) return mine
  if (mine.includes(theirs)) return mine
  if (theirs.includes(mine)) return theirs
  const chunks = mine
    .split(/\n\n/)
    .map((part) => part.trim())
    .filter(Boolean)
  for (const part of theirs
    .split(/\n\n/)
    .map((piece) => piece.trim())
    .filter(Boolean)) {
    if (chunks.some((chunk) => chunk === part || chunk.includes(part))) continue
    chunks.push(part)
  }
  return chunks.join("\n\n")
}

/**
 * Plain summaries: this profile's text wins, same as the old legacy-id merge.
 * An append-log envelope on either side flattens to prose and keeps every
 * paragraph, so migrating day notes into a summary does not drop a line.
 */
function unionDayLogs(mine: string, theirs: string): string {
  if (mine === theirs) return mine
  if (isAppendEnvelope(mine) || isAppendEnvelope(theirs)) {
    return combineSummaryProse(summaryProse(mine), summaryProse(theirs))
  }
  return mine || theirs
}

/** `mine` wins any conflict; every entry either side holds survives. */
function unionNoteMaps(mine: DayNotesMap, theirs: DayNotesMap): DayNotesMap {
  const out: DayNotesMap = { ...mine }
  for (const [date, text] of Object.entries(theirs)) {
    if (cleared.has(date)) continue
    out[date] = out[date] ? unionDayLogs(out[date], text) : text
  }
  return out
}

function sameNoteMaps(a: DayNotesMap, b: DayNotesMap): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => a[key] === b[key])
}

/**
 * Read every alias, not just the first one. A write that ran out of origin
 * quota could leave the newest entry on `cogs-tracking-day-notes` while
 * `brain2-tracking-day-notes` kept the shorter log; reading only the canonical
 * key hid a submitted note that was on disk the whole time.
 */
function load(): DayNotesMap {
  if (typeof window === "undefined") return {}
  let out: DayNotesMap = {}
  for (const key of persistKeyAliases(DAY_NOTES_PERSIST_KEY)) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      out = unionNoteMaps(out, cleanMap(JSON.parse(raw)))
    } catch {
      /* skip an unreadable alias; the other one may parse */
    }
  }
  return out
}

function emit() {
  for (const listener of listeners) listener()
}

function write(next: DayNotesMap) {
  snapshot = next
  if (typeof window !== "undefined") {
    try {
      // Small dedicated key, hub-synced. Never ride the huge timegrid blob.
      cogsStateStorage().setItem(DAY_NOTES_PERSIST_KEY, JSON.stringify(snapshot))
    } catch {
      /* private mode — memory still holds the jot for this session */
    }
  }
  emit()
}

export function getDayNotesPersist(): DayNotesMap {
  return snapshot
}

export function getDayNote(date: string): string {
  return snapshot[date] ?? ""
}

export function getDayNoteEntries(date: string): AppendLogEntry[] {
  return parseAppendLog(snapshot[date] ?? null)
}

/**
 * Add a paragraph to the day's summary. Empty text is ignored.
 * Older append-log envelopes flatten first, so a `day:` line joins the
 * retrospective text instead of starting a second log.
 */
export function appendDayNote(date: string, text: string, createdAt: Date = new Date()): AppendLogEntry | null {
  const entry = makeAppendLogEntry(text, createdAt)
  if (!entry) return null
  const next = combineSummaryProse(summaryProse(getDayNote(date)), entry.text)
  setDayNotePersist(date, next)
  return entry
}

/** Replace one day's jot. Empty text drops the key. */
export function setDayNotePersist(date: string, text: string): void {
  const trimmed = text
  const current = snapshot[date] ?? ""
  if (current === trimmed) return
  const next = { ...snapshot }
  if (!trimmed) {
    delete next[date]
    cleared.add(date)
  } else {
    next[date] = trimmed
    cleared.delete(date)
  }
  write(next)
  emitAppendLogChange()
}

/**
 * Fold an older vault (timegrid `dayNotes`, a hub GET) into this one. Missing
 * days are copied; a day both sides hold unions its entries, so a note written
 * in the other window is not dropped just because today already has a log.
 * Days the user cleared stay cleared.
 */
export function seedDayNotesPersist(from: Record<string, string> | undefined): void {
  if (!from) return
  const next = unionNoteMaps(snapshot, cleanMap(from))
  if (!sameNoteMaps(next, snapshot)) write(next)
}

/** Dedicated notes win; then in-memory; then a persist blob. Never let empty overwrite a jot. */
export function mergeDayNotes(
  persisted: Record<string, string> | undefined,
  current: Record<string, string> | undefined,
  dedicated: Record<string, string> = snapshot,
): DayNotesMap {
  const merged: DayNotesMap = {
    ...(persisted ?? {}),
    ...(current ?? {}),
    ...dedicated,
  }
  for (const key of cleared) delete merged[key]
  return merged
}

export function resetDayNotesPersist(): void {
  snapshot = {}
  cleared.clear()
  if (typeof window !== "undefined") {
    try {
      removeAliasedLocal(DAY_NOTES_PERSIST_KEY)
    } catch {
      /* ignore */
    }
  }
  emit()
}

/** Pull the dedicated key through persist (Electron hub GET). Never drops a jot this session already holds. */
export async function hydrateDayNotesFromStorage(): Promise<void> {
  if (typeof window === "undefined") return
  try {
    const raw = await Promise.resolve(cogsStateStorage().getItem(DAY_NOTES_PERSIST_KEY))
    if (typeof raw !== "string" || !raw) return
    seedDayNotesPersist(cleanMap(JSON.parse(raw)))
  } catch {
    /* keep memory */
  }
}

export function subscribeDayNotesPersist(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDayNote(date: string): string {
  const notes = useSyncExternalStore(subscribeDayNotesPersist, getDayNotesPersist, () => snapshot)
  return notes[date] ?? ""
}

registerPersistRehydrator(DAY_NOTES_PERSIST_KEY, () => {
  void hydrateDayNotesFromStorage()
})
