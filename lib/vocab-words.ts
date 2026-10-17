/**
 * lib/vocab-words.ts — Vocab word of the day
 *
 * One word a day per language view. The pick is a fixed walk through a
 * seeded permutation of that language's level, so consecutive days do not
 * repeat until the pool is spent and a remount never flickers. Shuffle adds
 * a jump for the day being viewed; tomorrow starts clean. English levels run
 * everyday → SAT / Word Power → advanced → extremely advanced. French,
 * Italian, German, Japanese, Spanish, and Mandarin run common (with pictures)
 * → everyday → advanced, and define each word in that language. Settings
 * persist in `lib/vocab-store.ts`; banks live in `lib/vocab/`. IPA for the
 * bank words is `lib/vocab/bank-ipa.json` (built by
 * `scripts/build-vocab-frequency.py`). Speech is `lib/vocab-speech.ts`.
 */

import { DE_BANK } from "@/lib/vocab/de"
import { EN_BANK } from "@/lib/vocab/en"
import { ES_BANK } from "@/lib/vocab/es"
import { FR_BANK } from "@/lib/vocab/fr"
import { IT_BANK } from "@/lib/vocab/it"
import { JA_BANK } from "@/lib/vocab/ja"
import BANK_IPA from "@/lib/vocab/bank-ipa.json"
import type { VocabBank, VocabEntry, VocabLang, VocabLevel } from "@/lib/vocab/types"
import { ZH_BANK } from "@/lib/vocab/zh"
import { speak } from "@/lib/vocab-speech"

export type { VocabBank, VocabEntry, VocabLang, VocabLevel } from "@/lib/vocab/types"

export const VOCAB_LANGS: VocabLang[] = ["en", "fr", "it", "de", "ja", "es", "zh"]

export const VOCAB_LANG_LABEL: Record<VocabLang, string> = {
  en: "English",
  fr: "French",
  it: "Italian",
  de: "German",
  ja: "Japanese",
  es: "Spanish",
  zh: "Mandarin",
}

/** Name of the language in itself, for the view key. */
export const VOCAB_LANG_ENDONYM: Record<VocabLang, string> = {
  en: "English",
  fr: "Français",
  it: "Italiano",
  de: "Deutsch",
  ja: "日本語",
  es: "Español",
  zh: "中文",
}

/** Short code on the tile caption. */
export const VOCAB_LANG_CODE: Record<VocabLang, string> = {
  en: "EN",
  fr: "FR",
  it: "IT",
  de: "DE",
  ja: "JA",
  es: "ES",
  zh: "ZH",
}

/** BCP 47 tag for speech synthesis. */
export const VOCAB_LANG_SPEECH: Record<VocabLang, string> = {
  en: "en-US",
  fr: "fr-FR",
  it: "it-IT",
  de: "de-DE",
  ja: "ja-JP",
  es: "es-ES",
  zh: "zh-CN",
}

export const VOCAB_LEVELS: VocabLevel[] = ["common", "everyday", "sat", "advanced", "rare"]

export const VOCAB_LEVEL_LABEL: Record<VocabLevel, string> = {
  common: "Common",
  everyday: "Everyday",
  sat: "SAT / Word Power",
  advanced: "Advanced",
  rare: "Extremely advanced",
}

export const VOCAB_LEVEL_NOTE: Record<VocabLevel, string> = {
  common: "First words — the most frequent nouns and verbs, pictured where they can be.",
  everyday: "High-use words a little past the basics.",
  sat: "Test-prep and Word Power words: roots that open whole families.",
  advanced: "Literary and GRE-hard words.",
  rare: "Real but rare dictionary words, for a reader who has the rest.",
}

const BANKS: Record<VocabLang, VocabBank> = {
  en: EN_BANK,
  fr: FR_BANK,
  it: IT_BANK,
  de: DE_BANK,
  ja: JA_BANK,
  es: ES_BANK,
  zh: ZH_BANK,
}

export function isVocabLang(value: unknown): value is VocabLang {
  return typeof value === "string" && (VOCAB_LANGS as string[]).includes(value)
}

export function isVocabLevel(value: unknown): value is VocabLevel {
  return typeof value === "string" && (VOCAB_LEVELS as string[]).includes(value)
}

/** Levels this language actually has words for, easy → hard. */
export function vocabLevelsFor(lang: VocabLang): VocabLevel[] {
  const bank = BANKS[lang]
  return VOCAB_LEVELS.filter((level) => (bank[level]?.length ?? 0) > 0)
}

/** Starting level for a language: SAT for English, common for the rest. */
export function defaultVocabLevel(lang: VocabLang): VocabLevel {
  const levels = vocabLevelsFor(lang)
  const want: VocabLevel = lang === "en" ? "sat" : "common"
  return levels.includes(want) ? want : (levels[0] ?? want)
}

/** A stored level that this language does not have falls to its default. */
export function resolveVocabLevel(lang: VocabLang, level: VocabLevel | undefined): VocabLevel {
  return level && vocabLevelsFor(lang).includes(level) ? level : defaultVocabLevel(lang)
}

export function vocabPool(lang: VocabLang, level: VocabLevel): VocabEntry[] {
  return BANKS[lang][level] ?? []
}

function hashString(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}

/** mulberry32 — small seeded PRNG so the order is stable across reloads. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededOrder(length: number, seed: number): number[] {
  const order = Array.from({ length }, (_, i) => i)
  const rand = seededRandom(seed)
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const swap = order[i]!
    order[i] = order[j]!
    order[j] = swap
  }
  return order
}

/** Whole local days since 1970-01-01 for a `YYYY-MM-DD` key. */
export function vocabDayNumber(dateKey: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return 0
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000)
}

/** Shuffle steps jump by a prime so a shuffled word is not tomorrow's word. */
const SHUFFLE_STRIDE = 7919

export function vocabIndexFor(poolSize: number, lang: VocabLang, level: VocabLevel, dateKey: string, shuffle = 0): number {
  if (poolSize <= 0) return -1
  const order = seededOrder(poolSize, hashString(`${lang}:${level}`))
  const step = vocabDayNumber(dateKey) + Math.max(0, Math.floor(shuffle)) * SHUFFLE_STRIDE
  return order[((step % poolSize) + poolSize) % poolSize]!
}

export type VocabPick = {
  entry: VocabEntry
  /** 1-based place in the level's pool. */
  place: number
  poolSize: number
  lang: VocabLang
  level: VocabLevel
}

export function pickVocabWord(lang: VocabLang, level: VocabLevel, dateKey: string, shuffle = 0): VocabPick | null {
  const resolved = resolveVocabLevel(lang, level)
  const pool = vocabPool(lang, resolved)
  const index = vocabIndexFor(pool.length, lang, resolved, dateKey, shuffle)
  if (index < 0) return null
  return { entry: pool[index]!, place: index + 1, poolSize: pool.length, lang, level: resolved }
}

/** Every word in a language across its levels, keyed by the word string. */
export function findVocabEntry(lang: VocabLang, word: string): { entry: VocabEntry; level: VocabLevel } | null {
  for (const level of VOCAB_LEVELS) {
    const entry = BANKS[lang][level]?.find((item) => item.word === word)
    if (entry) return { entry, level }
  }
  return null
}

/** Favorited words that still exist in the bank, in saved order. */
export function vocabDeck(lang: VocabLang, words: string[] | undefined): { entry: VocabEntry; level: VocabLevel }[] {
  const deck: { entry: VocabEntry; level: VocabLevel }[] = []
  for (const word of words ?? []) {
    const found = findVocabEntry(lang, word)
    if (found) deck.push(found)
  }
  return deck
}

/**
 * Say a word or sentence in its language: the neural voice online, the best
 * installed voice offline (`lib/vocab-speech.ts`).
 */
export function speakVocab(text: string, lang: VocabLang, opts: { slow?: boolean } = {}): void {
  speak(text, VOCAB_LANG_SPEECH[lang], { rate: lang === "en" ? 0.95 : 0.85, slow: opts.slow })
}

const IPA_TABLE = BANK_IPA as Partial<Record<VocabLang, Record<string, string>>>

/** IPA for a bank word, without slashes; undefined when the build found none. */
export function vocabIpa(lang: VocabLang, word: string): string | undefined {
  return IPA_TABLE[lang]?.[word]
}

/** True for every bank but English: the definition is in the target language. */
export function vocabIsTarget(lang: VocabLang): boolean {
  return lang !== "en"
}
