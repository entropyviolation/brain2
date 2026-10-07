/**
 * lib/log-keywords-store.ts — Phrases the text bot logs with `log` / `log:`
 *
 * Empty until the person adds one. Not cycle marks, and not discrete-event
 * triggers. Storage: `brain2-log-keywords` (persist v1). Hub-safe Zustand
 * persist. Included in the Settings full backup. Clearing the list is allowed.
 * A row may keep an optional `countId`. Saving a phrase does not clear it.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { normalizeLogKeyword } from "@/lib/log-keywords"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

export const LOG_KEYWORDS_STORAGE_KEY = persistKey("log-keywords")

/** Phrase plus an optional count the settings editor does not draw. */
export interface LogKeywordRecord {
  phrase: string
  countId?: string
}

/** A bare phrase, or the same phrase with `countId` left on the row. */
export type LogKeywordEntry = string | LogKeywordRecord

export function logKeywordPhrase(row: LogKeywordEntry): string {
  return normalizeLogKeyword(typeof row === "string" ? row : row.phrase)
}

function countIdOf(row: LogKeywordEntry): string | undefined {
  if (typeof row === "string") return undefined
  const id = row.countId?.trim()
  return id ? id : undefined
}

function storedRow(phrase: string, countId?: string): LogKeywordEntry {
  return countId ? { phrase, countId } : phrase
}

function readPhrase(item: unknown): string {
  if (typeof item === "string") return normalizeLogKeyword(item)
  if (item && typeof item === "object" && typeof (item as { phrase?: unknown }).phrase === "string") {
    return normalizeLogKeyword((item as { phrase: string }).phrase)
  }
  return ""
}

function readCountId(item: unknown): string | undefined {
  if (!item || typeof item !== "object") return undefined
  const id = (item as { countId?: unknown }).countId
  if (typeof id !== "string") return undefined
  const trimmed = id.trim()
  return trimmed ? trimmed : undefined
}

export function sanitizeLogKeywords(value: unknown): LogKeywordEntry[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { keywords?: unknown }).keywords)
      ? (value as { keywords: unknown[] }).keywords
      : []
  const out: LogKeywordEntry[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const phrase = readPhrase(item)
    if (!phrase) continue
    const key = phrase.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(storedRow(phrase, readCountId(item)))
  }
  return out
}

interface LogKeywordsState {
  keywords: LogKeywordEntry[]
  /** False when the phrase is blank or already saved (case-insensitive). */
  addKeyword: (phrase: string) => boolean
  /** False when the new phrase is blank, missing, or a different saved phrase. */
  renameKeyword: (from: string, to: string) => boolean
  removeKeyword: (phrase: string) => void
  /**
   * Keep the phrase and set or clear `countId`.
   * A missing phrase is saved when `countId` is set. Clearing does not remove the phrase.
   */
  linkKeywordCount: (phrase: string, countId?: string) => boolean
}

export const useLogKeywordsStore = create<LogKeywordsState>()(
  persist(
    (set, get) => ({
      keywords: [],
      addKeyword: (phrase) => {
        const next = normalizeLogKeyword(phrase)
        if (!next) return false
        const keywords = get().keywords
        if (keywords.some((row) => logKeywordPhrase(row).toLowerCase() === next.toLowerCase())) return false
        set({ keywords: [...keywords, next] })
        return true
      },
      renameKeyword: (from, to) => {
        const source = normalizeLogKeyword(from).toLowerCase()
        const next = normalizeLogKeyword(to)
        if (!source || !next) return false
        const keywords = get().keywords
        const index = keywords.findIndex((row) => logKeywordPhrase(row).toLowerCase() === source)
        if (index < 0) return false
        const clash = keywords.some(
          (row, i) => i !== index && logKeywordPhrase(row).toLowerCase() === next.toLowerCase(),
        )
        if (clash) return false
        const current = keywords[index]!
        if (logKeywordPhrase(current) === next) return true
        const copy = keywords.slice()
        copy[index] = storedRow(next, countIdOf(current))
        set({ keywords: copy })
        return true
      },
      removeKeyword: (phrase) => {
        const source = normalizeLogKeyword(phrase).toLowerCase()
        if (!source) return
        set({
          keywords: get().keywords.filter((row) => logKeywordPhrase(row).toLowerCase() !== source),
        })
      },
      linkKeywordCount: (phrase, countId) => {
        const next = normalizeLogKeyword(phrase)
        if (!next) return false
        const id = countId?.trim() || undefined
        const keywords = get().keywords
        const index = keywords.findIndex((row) => logKeywordPhrase(row).toLowerCase() === next.toLowerCase())
        if (index < 0) {
          if (!id) return false
          set({ keywords: [...keywords, storedRow(next, id)] })
          return true
        }
        const current = keywords[index]!
        if (countIdOf(current) === id) return true
        const copy = keywords.slice()
        copy[index] = storedRow(logKeywordPhrase(current), id)
        set({ keywords: copy })
        return true
      },
    }),
    {
      name: LOG_KEYWORDS_STORAGE_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ keywords: state.keywords }),
      merge: (persisted, current) => ({
        ...current,
        keywords: sanitizeLogKeywords(persisted),
      }),
    },
  ),
)

/** Phrases the `log` / `log:` matcher and `log keywords` reply use. */
export function savedLogKeywordPhrases(): string[] {
  return useLogKeywordsStore
    .getState()
    .keywords.map(logKeywordPhrase)
    .filter((phrase) => phrase.length > 0)
}
