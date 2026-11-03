/**
 * lib/vocab-store.ts — Vocab widget settings
 *
 * Which language views are added, which one the square shows, the level per
 * language, today's shuffle count per language, and the favorited words per
 * language (the flashcard deck). A shuffle belongs to one date; another date
 * reads it as zero. Favorites are word strings, newest last; a word no longer
 * in the bank drops out of the deck. Storage: `brain2-home-vocab` (persist
 * v2 adds favorites). Included in the Settings full backup.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import {
  VOCAB_LANGS,
  isVocabLang,
  isVocabLevel,
  type VocabLang,
  type VocabLevel,
} from "@/lib/vocab-words"
import { registerPhoneWindowStore } from "@/lib/phone-window"

export type VocabShuffle = { date: string; count: number }

type VocabSettings = {
  languages: VocabLang[]
  active: VocabLang
  levels: Partial<Record<VocabLang, VocabLevel>>
  shuffles: Partial<Record<VocabLang, VocabShuffle>>
  favorites: Partial<Record<VocabLang, string[]>>
}

interface VocabState extends VocabSettings {
  addLanguage: (lang: VocabLang) => void
  removeLanguage: (lang: VocabLang) => void
  setActive: (lang: VocabLang) => void
  setLevel: (lang: VocabLang, level: VocabLevel) => void
  shuffle: (lang: VocabLang, dateKey: string) => void
  unshuffle: (lang: VocabLang) => void
  toggleFavorite: (lang: VocabLang, word: string) => void
}

const EMPTY: VocabSettings = {
  languages: ["en"],
  active: "en",
  levels: {},
  shuffles: {},
  favorites: {},
}

/** Today's shuffle count for a language; a count saved on another date is zero. */
export function vocabShuffleCount(shuffles: VocabSettings["shuffles"], lang: VocabLang, dateKey: string): number {
  const entry = shuffles[lang]
  return entry && entry.date === dateKey ? entry.count : 0
}

export function sanitizeVocabSettings(raw: unknown): VocabSettings {
  const value = (raw ?? {}) as Partial<Record<keyof VocabSettings, unknown>>
  const languages = Array.isArray(value.languages)
    ? VOCAB_LANGS.filter((lang) => (value.languages as unknown[]).includes(lang))
    : []
  const safeLanguages = languages.length > 0 ? languages : [...EMPTY.languages]
  const active = isVocabLang(value.active) && safeLanguages.includes(value.active) ? value.active : safeLanguages[0]!
  const levels: VocabSettings["levels"] = {}
  if (value.levels && typeof value.levels === "object") {
    for (const [lang, level] of Object.entries(value.levels as Record<string, unknown>)) {
      if (isVocabLang(lang) && isVocabLevel(level)) levels[lang] = level
    }
  }
  const shuffles: VocabSettings["shuffles"] = {}
  if (value.shuffles && typeof value.shuffles === "object") {
    for (const [lang, entry] of Object.entries(value.shuffles as Record<string, unknown>)) {
      const e = entry as Partial<VocabShuffle> | null
      if (isVocabLang(lang) && e && typeof e.date === "string" && typeof e.count === "number" && e.count > 0) {
        shuffles[lang] = { date: e.date, count: Math.floor(e.count) }
      }
    }
  }
  const favorites: VocabSettings["favorites"] = {}
  if (value.favorites && typeof value.favorites === "object") {
    for (const [lang, words] of Object.entries(value.favorites as Record<string, unknown>)) {
      if (!isVocabLang(lang) || !Array.isArray(words)) continue
      const clean = [...new Set(words.filter((w): w is string => typeof w === "string" && w.trim() !== ""))]
      if (clean.length > 0) favorites[lang] = clean
    }
  }
  return { languages: safeLanguages, active, levels, shuffles, favorites }
}

export const useVocabStore = create<VocabState>()(
  persist(
    (set) => ({
      ...EMPTY,
      addLanguage: (lang) =>
        set((state) => {
          const languages = VOCAB_LANGS.filter((id) => id === lang || state.languages.includes(id))
          return { languages, active: lang }
        }),
      removeLanguage: (lang) =>
        set((state) => {
          if (state.languages.length <= 1) return state
          const languages = state.languages.filter((id) => id !== lang)
          return { languages, active: state.active === lang ? languages[0]! : state.active }
        }),
      setActive: (lang) =>
        set((state) => (state.languages.includes(lang) ? { active: lang } : state)),
      setLevel: (lang, level) =>
        set((state) => ({
          levels: { ...state.levels, [lang]: level },
          shuffles: { ...state.shuffles, [lang]: undefined },
        })),
      shuffle: (lang, dateKey) =>
        set((state) => ({
          shuffles: {
            ...state.shuffles,
            [lang]: { date: dateKey, count: vocabShuffleCount(state.shuffles, lang, dateKey) + 1 },
          },
        })),
      unshuffle: (lang) =>
        set((state) => ({ shuffles: { ...state.shuffles, [lang]: undefined } })),
      toggleFavorite: (lang, word) =>
        set((state) => {
          const current = state.favorites[lang] ?? []
          const next = current.includes(word) ? current.filter((w) => w !== word) : [...current, word]
          return { favorites: { ...state.favorites, [lang]: next } }
        }),
    }),
    {
      name: persistKey("home-vocab"),
      version: 2,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({
        languages: state.languages,
        active: state.active,
        levels: state.levels,
        shuffles: state.shuffles,
        favorites: state.favorites,
      }),
      migrate: (persisted) => persisted as VocabSettings,
      merge: (persisted, current) => ({ ...current, ...sanitizeVocabSettings(persisted) }),
    },
  ),
)

registerPhoneWindowStore(useVocabStore)
