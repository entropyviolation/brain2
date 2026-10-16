/**
 * lib/vocab/types.ts — Shape of one vocab word and one language's bank
 *
 * English words carry an English definition. A target-language word carries
 * its definition in that language (`definition`) plus the English the detail
 * reveals on Translate (`gloss`, `definitionEn`, `exampleEn`). Nouns in French,
 * Italian, German, and Spanish keep their article in `word` (`le chat`,
 * `der Hund`). Japanese and Mandarin keep the kana or pinyin in `reading`.
 * `picture` is one emoji for a concrete common word; abstract words leave it out.
 */

export type VocabLang = "en" | "fr" | "it" | "de" | "ja" | "es" | "zh"

/** Common → extremely advanced. A bank only fills the levels that make sense for it. */
export type VocabLevel = "common" | "everyday" | "sat" | "advanced" | "rare"

export type VocabEntry = {
  word: string
  /** Kana (Japanese) or tone-marked pinyin (Mandarin). */
  reading?: string
  /** Romaji for Japanese. */
  romanization?: string
  /** Part of speech, in English: noun, verb, adjective, adverb, phrase. */
  pos: string
  /** In the bank's own language. */
  definition: string
  /** English for the word itself (target languages only). */
  gloss?: string
  /** English translation of `definition` (target languages only). */
  definitionEn?: string
  /** One short sentence in the bank's own language. */
  example?: string
  exampleEn?: string
  /** One emoji, only when the word is concrete enough to picture. */
  picture?: string
  /** Word-power root or origin note (English banks). */
  root?: string
}

export type VocabBank = Partial<Record<VocabLevel, VocabEntry[]>>
