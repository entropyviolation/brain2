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
 * (legacy `cogs-tracking-day-notes` copied, never deleted),
 * written as an append log (submit-stamped entries) and hub-synced on its own.
 * Both aliases are **read and unioned** — an append log has immutable, id'd
 * entries, so no copy of a day is ever the loser. That heals a pair split by a
 * write that ran out of origin quota, and lets a hub or timegrid copy add
 * entries to a day this profile already has. The
 * timegrid store still mirrors the same stored string in memory so older readers keep
 * working; that jot is not rewritten into the huge timegrid blob on every
 * submit.
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
  serializeAppendLog,
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

/**
 * Entries are immutable, so their id is identity and two copies of one day
 * union cleanly. Nothing here is ever dropped — a merge only adds.
 */
function unionDayLogs(mine: string, theirs: string): string {
  if (mine === theirs) return mine
  const entries = parseAppendLog(mine)
  const seen = new Set(entries.map((entry) => entry.id))
  let added = false
  for (const entry of parseAppendLog(theirs)) {
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    entries.push(entry)
    added = true
  }
  if (!added) return mine
  entries.sort((a, b) => {
    if (a.createdAt === b.createdAt) return 0
    if (!a.createdAt) return -1
    if (!b.createdAt) return 1
    return a.createdAt.localeCompare(b.createdAt)
  })
  return serializeAppendLog(entries)
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

/** Append a stamped note. Past entries stay. Empty text is ignored. */
export function appendDayNote(date: string, text: string, createdAt: Date = new Date()): AppendLogEntry | null {
  const entry = makeAppendLogEntry(text, createdAt)
  if (!entry) return null
  const next = serializeAppendLog([...getDayNoteEntries(date), entry])
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
