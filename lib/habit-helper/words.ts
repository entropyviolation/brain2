/**
 * lib/habit-helper/words.ts — Plain word handling: stems, stop words, units, display names
 *
 * Small on purpose. A stem is the word minus a common ending, with a short table for the irregular
 * past tenses people use about habits ("drank", "ran", "went"). Units fold to one name each so
 * "30 mins" and "half an hour" compare.
 */

export const STOP = new Set(
  "i me my we our you a an the to of for in on at by with and or but so then just also really today tonight yesterday this that it its was were am is are be been did do done have had has got get some any all daily habit habits completed complete finished went go going about around like after before until least more another extra again".split(
    " ",
  ),
)

const IRREGULAR: Record<string, string> = {
  drank: "drink",
  drunk: "drink",
  ate: "eat",
  eaten: "eat",
  ran: "run",
  went: "go",
  gone: "go",
  slept: "sleep",
  wrote: "write",
  written: "write",
  did: "do",
  made: "make",
  took: "take",
  meditated: "meditate",
  journaled: "journal",
  journalled: "journal",
  stretched: "stretch",
  swam: "swim",
  rode: "ride",
  biked: "bike",
  walked: "walk",
  cleaned: "clean",
  flossed: "floss",
}

/** `walked` → `walk`, `pages` → `pag`, `exercised` → `exercis`. A final "e" is dropped on both sides so they meet. */
export function stem(word: string): string {
  const s = rawStem(word)
  return s.length > 3 ? s.replace(/e$/, "") : s
}

function rawStem(word: string): string {
  const w = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
  if (IRREGULAR[w]) return IRREGULAR[w]!
  if (w.length > 5 && w.endsWith("ing")) return undouble(w.slice(0, -3))
  if (w.length > 4 && w.endsWith("ied")) return w.slice(0, -3) + "y"
  if (w.length > 4 && w.endsWith("ed")) return undouble(w.slice(0, -2))
  if (w.length > 4 && w.endsWith("es") && /(ch|sh|ss|x)es$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1)
  return w
}

const undouble = (w: string) => (/([^aeiouls])\1$/.test(w) ? w.slice(0, -1) : w)

/** Content words of a phrase, as written (lowercase), with stop words and numbers dropped. */
export function contentWords(text: string): string[] {
  return text
    .split(/[\s/,.;:!?()"“”-]+/)
    .map((w) => w.toLowerCase().replace(/^'+|'+$/g, ""))
    .filter((w) => w.length > 1 && !/^\d/.test(w) && !STOP.has(w))
}

/** Content words of a phrase, stemmed. */
export function contentStems(text: string): string[] {
  return contentWords(text).map(stem).filter((w) => w.length > 1)
}

const UNITS: [RegExp, string, number][] = [
  [/^(min|mins|minute|minutes|m)$/, "min", 1],
  [/^(h|hr|hrs|hour|hours)$/, "min", 60],
  [/^(page|pages|pg|pgs)$/, "page", 1],
  [/^(glass|glasses|cup|cups|bottle|bottles)$/, "glass", 1],
  [/^(step|steps)$/, "step", 1],
  [/^(rep|reps)$/, "rep", 1],
  [/^(mile|miles|mi)$/, "mile", 1],
  [/^(km|kms|kilometer|kilometers|kilometre|kilometres)$/, "km", 1],
  [/^(time|times|x)$/, "time", 1],
  [/^(chapter|chapters)$/, "chapter", 1],
  [/^(word|words)$/, "word", 1],
  [/^(liter|liters|litre|litres|l)$/, "liter", 1],
  [/^(oz|ounce|ounces)$/, "oz", 1],
]

/** A unit word as `[unit, factor]`, or null when it is not one. "hours" is `["min", 60]`. */
export function unitOf(word: string): [string, number] | null {
  const w = word.toLowerCase()
  for (const [re, unit, factor] of UNITS) if (re.test(w)) return [unit, factor]
  return null
}

/** The rule from the shared contract. */
export const displayName = (h: { name: string; shorthand?: string }) => h.shorthand?.trim() || h.name

/** `540` → `9:00`. */
export function clock(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = Math.round(min % 60)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}${h < 12 ? " am" : " pm"}`
}
