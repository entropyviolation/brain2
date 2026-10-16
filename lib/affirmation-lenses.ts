/**
 * lib/affirmation-lenses.ts — Ways to read one affirmation
 *
 * A lens is one column of `AFFIRMATION_BANK`: the original, E-Prime, French,
 * Italian, Spanish, Vivid (feel / senses / sincerity), or Higher Self. A list
 * line finds its bank row by `affirmationKey` (case, accents, and punctuation
 * ignored), against the original or the E-Prime text. A line with no row only
 * has the Original lens. `dailyAffirmationSet` is the widget's five for a date
 * when the morning ritual has not chosen them.
 */
import { AFFIRMATION_BANK, type AffirmationBankRow } from "@/lib/affirmation-bank"
import { pickRandom } from "@/lib/affirmations"

export type AffirmationLens = "original" | "eprime" | "fr" | "it" | "es" | "vivid" | "higher"

export const AFFIRMATION_LENSES: AffirmationLens[] = ["original", "eprime", "fr", "it", "es", "vivid", "higher"]

export const AFFIRMATION_LENS_LABEL: Record<AffirmationLens, string> = {
  original: "Original",
  eprime: "E-Prime",
  fr: "Français",
  it: "Italiano",
  es: "Español",
  vivid: "Vivid",
  higher: "Higher Self",
}

/** Two- or three-letter plate for tabs and the tile caption. */
export const AFFIRMATION_LENS_CODE: Record<AffirmationLens, string> = {
  original: "EN",
  eprime: "E′",
  fr: "FR",
  it: "IT",
  es: "ES",
  vivid: "VIV",
  higher: "HI",
}

export const AFFIRMATION_LENS_NOTE: Record<AffirmationLens, string> = {
  original: "The line as written in your list.",
  eprime: "No forms of “to be”: am, is, are, was, were, be, been, being.",
  fr: "French, feminine agreement.",
  it: "Italian, feminine agreement.",
  es: "Spanish, feminine agreement.",
  vivid: "Feel it as already real, engage the senses, say it sincerely.",
  higher: "Buddhist, Taoist, and Gateway reframing.",
}

/** BCP-47 tag for speech and `lang=`. */
export const AFFIRMATION_LENS_SPEECH: Record<AffirmationLens, "en" | "fr" | "it" | "es"> = {
  original: "en",
  eprime: "en",
  fr: "fr",
  it: "it",
  es: "es",
  vivid: "en",
  higher: "en",
}

export function isAffirmationLens(value: unknown): value is AffirmationLens {
  return typeof value === "string" && (AFFIRMATION_LENSES as string[]).includes(value)
}

/** Stable identity for a line: lowercased, accents and punctuation dropped. */
export function affirmationKey(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

let index: Map<string, AffirmationBankRow> | null = null

export function findBankRow(text: string): AffirmationBankRow | undefined {
  if (!index) {
    index = new Map()
    for (const row of AFFIRMATION_BANK) {
      index.set(affirmationKey(row.original), row)
      if (!index.has(affirmationKey(row.eprime))) index.set(affirmationKey(row.eprime), row)
    }
  }
  return index.get(affirmationKey(text))
}

/** Lenses a line can show: every lens with a bank row, else only Original. */
export function lensesFor(text: string): AffirmationLens[] {
  return findBankRow(text) ? AFFIRMATION_LENSES : ["original"]
}

/** Plain text of a lens, for the face and for speech. Vivid joins its three parts. */
export function lensText(text: string, lens: AffirmationLens): string {
  const row = findBankRow(text)
  if (!row || lens === "original") return text
  if (lens === "vivid") return [row.vivid.feel, row.vivid.senses, row.vivid.sincerity].join(" ")
  return row[lens]
}

/** Seeded 0..1 generator so a date always draws the same set. */
function seeded(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

/** Up to `n` distinct lines for a date; the same date draws the same set. */
export function dailyAffirmationSet(pool: string[], dateKey: string, n = 5): string[] {
  return pickRandom(pool, n, seeded(`affirm:${dateKey}`))
}
