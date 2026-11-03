/**
 * lib/tracking-helper/places.ts — Which pen, and which place, without asking a model
 *
 * Pens: a name finds the pen already in use when the words match (case, plural, a word
 * left out: "taking out trash" finds "Trash"), so the Helper does not grow a second "dishes".
 * Places: one the person said is matched to a Location pen. One they did not say is **learned from
 * their own data**: where did this activity usually happen on days it was tracked? The most common
 * place wins when it is at least 2 sightings and 60% of them. Chores with no history fall back to
 * Home (flagged `assumed`, so the card says so). Nothing here writes the vault.
 */

import type { HistoryRow, PlaceSource } from "./types"

const STOP = new Set(["a", "an", "the", "my", "some", "out", "up", "on", "in", "at", "to", "of", "for", "and", "then", "doing", "going", "took", "taking", "take"])

const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, "")

/** Content words of a phrase, lowercased and stemmed. */
export function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem)
}

/** The pen whose name says the same thing as `name`: equal words, or every word of the shorter one is in the longer. */
export function matchPen<T extends { name: string }>(name: string, pens: T[]): T | null {
  const w = words(name)
  if (!w.length) return null
  let best: { pen: T; score: number } | null = null
  for (const pen of pens) {
    const p = words(pen.name)
    if (!p.length) continue
    const [short, long] = w.length <= p.length ? [w, p] : [p, w]
    if (!short.every((x) => long.includes(x))) continue
    const score = short.length / long.length
    if (!best || score > best.score) best = { pen, score }
  }
  return best?.pen ?? null
}

const HOME_CHORE = /\b(dish|trash|garbage|laundry|vacuum|sweep|mop|clean|tidy|cook|bake|shower|bath|floss|brush|sleep|nap|dress|fold|iron)/i
const HOME_PEN = /^(home|house|apartment|my place|my house|my apartment)$/i

/** Where this activity usually happened: Location rows that overlapped its Activity rows. */
export function learnedPlace(activity: string, history: HistoryRow[]): { name: string; seen: number } | null {
  const w = words(activity)
  if (!w.length) return null
  const acts = history.filter((r) => r.scopeId === "activity" && words(r.pen).some((x) => w.includes(x)))
  const tally = new Map<string, number>()
  let total = 0
  for (const a of acts) {
    const where = history.filter((r) => r.scopeId === "location" && r.date === a.date && r.startMin < a.endMin && r.endMin > a.startMin)
    const first = where.sort((x, y) => y.endMin - y.startMin - (x.endMin - x.startMin))[0]
    if (!first) continue
    total += 1
    tally.set(first.pen, (tally.get(first.pen) ?? 0) + 1)
  }
  const top = [...tally].sort((a, b) => b[1] - a[1])[0]
  return top && top[1] >= 2 && top[1] / total >= 0.6 ? { name: top[0], seen: top[1] } : null
}

/** A new place is written as a name: "ocean beach" → "Ocean Beach". Words already capitalised are left alone. */
const titleCase = (s: string) => s.replace(/\b(\p{L})(\p{L}*)/gu, (_m, a: string, b: string) => (b === b.toLowerCase() ? a.toUpperCase() + b : a + b))

export interface PlaceRead {
  name: string
  source: PlaceSource
  isNew: boolean
}

/** The place for a block: the one said, else one learned from history, else Home for a chore. */
export function resolvePlace(said: string, activity: string, locationPens: { name: string }[], history: HistoryRow[]): PlaceRead | null {
  const clean = said.trim()
  if (clean) {
    const pen = matchPen(clean, locationPens)
    return { name: pen?.name ?? titleCase(clean), source: "stated", isNew: !pen }
  }
  const learned = learnedPlace(activity, history)
  if (learned) return { name: learned.name, source: "learned", isNew: false }
  if (HOME_CHORE.test(activity)) {
    const home = locationPens.find((p) => HOME_PEN.test(p.name.trim()))
    return { name: home?.name ?? "Home", source: "assumed", isNew: !home }
  }
  return null
}
