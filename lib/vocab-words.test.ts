import { describe, expect, it } from "vitest"
import { sanitizeVocabSettings, useVocabStore, vocabShuffleCount } from "@/lib/vocab-store"
import {
  VOCAB_LANGS,
  defaultVocabLevel,
  findVocabEntry,
  pickVocabWord,
  resolveVocabLevel,
  vocabLevelsFor,
  vocabDeck,
  vocabPool,
} from "@/lib/vocab-words"

const REQUIRED_LANGS = ["fr", "it", "de", "ja", "es", "zh"] as const

describe("vocab banks", () => {
  it("English runs everyday through extremely advanced", () => {
    expect(vocabLevelsFor("en")).toEqual(["everyday", "sat", "advanced", "rare"])
  })

  it.each(REQUIRED_LANGS)("%s has common words with pictures and target-language definitions", (lang) => {
    expect(vocabLevelsFor(lang)).toContain("common")
    const common = vocabPool(lang, "common")
    expect(common.length).toBeGreaterThanOrEqual(30)
    expect(common.filter((entry) => entry.picture).length).toBeGreaterThan(common.length / 2)
  })

  it.each(VOCAB_LANGS)("%s entries are complete and unique within the bank", (lang) => {
    const seen = new Set<string>()
    for (const level of vocabLevelsFor(lang)) {
      for (const entry of vocabPool(lang, level)) {
        expect(entry.word.trim(), `${lang} ${level}`).not.toBe("")
        expect(entry.definition.trim(), `${lang} ${entry.word}`).not.toBe("")
        expect(entry.pos.trim(), `${lang} ${entry.word}`).not.toBe("")
        if (lang !== "en") {
          expect(entry.gloss?.trim(), `${lang} ${entry.word} gloss`).toBeTruthy()
          expect(entry.definitionEn?.trim(), `${lang} ${entry.word} definitionEn`).toBeTruthy()
        }
        if (lang === "ja" || lang === "zh") {
          expect(entry.reading?.trim(), `${lang} ${entry.word} reading`).toBeTruthy()
        }
        expect(seen.has(entry.word), `${lang} duplicate ${entry.word}`).toBe(false)
        seen.add(entry.word)
      }
    }
  })
})

describe("pickVocabWord", () => {
  it("is stable for a date and changes the next day", () => {
    const a = pickVocabWord("en", "sat", "2026-10-15")
    const again = pickVocabWord("en", "sat", "2026-10-15")
    const next = pickVocabWord("en", "sat", "2026-10-16")
    expect(a?.entry.word).toBe(again?.entry.word)
    expect(a?.entry.word).not.toBe(next?.entry.word)
  })

  it("does not repeat across consecutive days until the pool is spent", () => {
    const size = vocabPool("fr", "common").length
    const words = new Set<string>()
    const start = new Date(2026, 0, 1)
    for (let i = 0; i < size; i++) {
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
      words.add(pickVocabWord("fr", "common", key)!.entry.word)
    }
    expect(words.size).toBe(size)
  })

  it("shuffle draws a different word for the same day", () => {
    const base = pickVocabWord("ja", "common", "2026-10-15", 0)
    const shuffled = pickVocabWord("ja", "common", "2026-10-15", 1)
    expect(base?.entry.word).not.toBe(shuffled?.entry.word)
  })

  it("falls back to the language default when a level is missing", () => {
    expect(defaultVocabLevel("en")).toBe("sat")
    expect(defaultVocabLevel("de")).toBe("common")
    expect(resolveVocabLevel("en", "common")).toBe("sat")
    expect(pickVocabWord("zh", "rare", "2026-10-15")?.level).toBe("common")
  })
})

describe("vocab settings", () => {
  it("keeps a shuffle only on its own date", () => {
    const shuffles = { fr: { date: "2026-10-15", count: 2 } }
    expect(vocabShuffleCount(shuffles, "fr", "2026-10-15")).toBe(2)
    expect(vocabShuffleCount(shuffles, "fr", "2026-10-16")).toBe(0)
  })

  it("sanitizes a damaged blob back to English", () => {
    expect(sanitizeVocabSettings({ languages: ["xx"], active: "fr", levels: { en: "nope" } })).toEqual({
      languages: ["en"],
      active: "en",
      levels: {},
      shuffles: {},
      favorites: {},
    })
    expect(sanitizeVocabSettings({ languages: ["zh", "en"], active: "zh" }).languages).toEqual(["en", "zh"])
  })
})

describe("vocab favorites", () => {
  it("toggles a word in and out of one language's deck", () => {
    const word = vocabPool("fr", "common")[0]!.word
    useVocabStore.getState().toggleFavorite("fr", word)
    expect(useVocabStore.getState().favorites.fr).toEqual([word])
    expect(useVocabStore.getState().favorites.it).toBeUndefined()
    useVocabStore.getState().toggleFavorite("fr", word)
    expect(useVocabStore.getState().favorites.fr).toEqual([])
  })

  it("builds the deck across levels and drops words no longer in the bank", () => {
    const common = vocabPool("es", "common")[2]!.word
    const advanced = vocabPool("es", "advanced")[0]!.word
    const deck = vocabDeck("es", [advanced, "no-such-word", common])
    expect(deck.map((card) => card.entry.word)).toEqual([advanced, common])
    expect(deck.map((card) => card.level)).toEqual(["advanced", "common"])
    expect(findVocabEntry("es", "no-such-word")).toBeNull()
  })

  it("sanitizes favorites: unknown languages and duplicates drop", () => {
    const clean = sanitizeVocabSettings({ favorites: { fr: ["a", "a", "", 3, "b"], xx: ["c"] } })
    expect(clean.favorites).toEqual({ fr: ["a", "b"] })
  })
})
