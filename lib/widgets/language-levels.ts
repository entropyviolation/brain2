/**
 * lib/widgets/language-levels.ts — Levels for Language study
 *
 * A studied language sits on the CEFR ladder (A1 to C2). The level picks the
 * word pool from the existing Vocab banks (`lib/vocab-words.ts`): A1 and A2
 * read common words, B1 everyday words, and B2 and up the harder banks where
 * that language has them. A native language skips the ladder and keeps the
 * Vocab bank levels (Everyday to Extremely advanced). Each language names the
 * real exam its placement quiz is modeled on.
 */

import type { VocabLang, VocabLevel } from "@/lib/vocab/types"

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

export type LanguageRole = "studied" | "native"

export const CEFR_LABEL: Record<CefrLevel, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper intermediate",
  C1: "Advanced",
  C2: "Mastery",
}

export const CEFR_NOTE: Record<CefrLevel, string> = {
  A1: "Familiar words and very basic phrases about yourself and things around you.",
  A2: "Simple, routine exchanges: shopping, family, work, directions.",
  B1: "The main points of clear talk on familiar topics; travel; simple connected text.",
  B2: "The main ideas of complex text, and fluent talk with native speakers without strain.",
  C1: "Demanding, longer texts and implicit meaning; flexible use for social and work life.",
  C2: "Almost everything heard or read, with fine shades of meaning.",
}

export function isCefrLevel(value: unknown): value is CefrLevel {
  return typeof value === "string" && (CEFR_LEVELS as readonly string[]).includes(value)
}

/** The Vocab bank level a CEFR level reads. `has` is the levels that language's bank fills. */
export function vocabLevelForCefr(level: CefrLevel, has: VocabLevel[]): VocabLevel {
  const want: VocabLevel[] =
    level === "A1" || level === "A2"
      ? ["common", "everyday"]
      : level === "B1"
        ? ["everyday", "common"]
        : level === "B2"
          ? ["sat", "advanced", "everyday"]
          : level === "C1"
            ? ["advanced", "sat", "rare"]
            : ["rare", "advanced", "sat"]
  return want.find((option) => has.includes(option)) ?? has[0] ?? "common"
}

/** Best CEFR guess for a level saved by the old Vocab widget. */
export function cefrFromVocabLevel(level: string | undefined): CefrLevel {
  if (level === "everyday") return "B1"
  if (level === "sat" || level === "advanced") return "B2"
  if (level === "rare") return "C2"
  return "A1"
}

export type LanguageExam = {
  /** The exam family the placement quiz follows. */
  name: string
  /** Who runs it, in a few words. */
  body: string
  /** How that exam names its levels, mapped onto CEFR. */
  levels: Partial<Record<CefrLevel, string>>
}

export const LANGUAGE_EXAMS: Record<VocabLang, LanguageExam> = {
  fr: {
    name: "DELF / DALF",
    body: "France Éducation international",
    levels: { A1: "DELF A1", A2: "DELF A2", B1: "DELF B1", B2: "DELF B2", C1: "DALF C1", C2: "DALF C2" },
  },
  es: {
    name: "DELE",
    body: "Instituto Cervantes",
    levels: { A1: "DELE A1", A2: "DELE A2", B1: "DELE B1", B2: "DELE B2", C1: "DELE C1", C2: "DELE C2" },
  },
  it: {
    name: "CELI",
    body: "Università per Stranieri di Perugia",
    levels: { A1: "CELI Impatto", A2: "CELI 1", B1: "CELI 2", B2: "CELI 3", C1: "CELI 4", C2: "CELI 5" },
  },
  de: {
    name: "Goethe-Zertifikat",
    body: "Goethe-Institut",
    levels: { A1: "Start Deutsch 1", A2: "Goethe A2", B1: "Goethe B1", B2: "Goethe B2", C1: "Goethe C1", C2: "Goethe C2 (GDS)" },
  },
  ja: {
    name: "JLPT",
    body: "Japan Foundation and JEES",
    levels: { A1: "N5", A2: "N4", B1: "N3", B2: "N2", C1: "N1", C2: "N1" },
  },
  zh: {
    name: "HSK",
    body: "Chinese Testing International",
    levels: { A1: "HSK 1–2", A2: "HSK 3", B1: "HSK 4", B2: "HSK 5", C1: "HSK 6", C2: "HSK 7–9" },
  },
  en: {
    name: "Cambridge English",
    body: "Cambridge University Press & Assessment",
    levels: { A2: "A2 Key", B1: "B1 Preliminary", B2: "B2 First", C1: "C1 Advanced", C2: "C2 Proficiency" },
  },
}

/** "B1 · DELF B1" for a level line. */
export function examLevelName(lang: VocabLang, level: CefrLevel): string {
  return LANGUAGE_EXAMS[lang].levels[level] ?? level
}
