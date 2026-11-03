/**
 * lib/baby-game/shelf.ts — Every home has a bookshelf; the player shelves PDFs on it and the friend reads them
 *
 * A `Book` is only its metadata in the save (`GameState.shelves[friendId]`): title, page starts, how far they have
 * read, and every sitting. The words live in the browser's attachment store (`components/BabyGame/shelf-io.ts`), so a
 * long PDF never fills the village save.
 *
 * When a friend's schedule says `read` (`mind.ts`), or the player asks from the home view, they read the next
 * `CHUNK` characters. A sitting (`Reading`) is what they took from it: a takeaway in their voice, a short quote that
 * really is in the text, and what it changed. It may add a belief, a goal, or a plan for the next hour (going
 * somewhere the pages put in their head), and it always becomes a `read` memory, so the model sees it when the player
 * talks to them and when they talk to each other (`chatter.ts`). The model writes the sitting when it can
 * (`readWithModel` in `chatter.ts`); `scriptedReading` is the fallback and the test path.
 */

import { RESIDENTS } from "./cast"
import { remember } from "./character"
import type { GameState } from "./engine"
import { addPlan, advanceGoal, BELIEFS_MAX, GOALS_MAX, isPlace, ZONE_ACT, type Place } from "./mind"

export type Reading = {
  day: number
  minute: number
  /** Character offsets read, `[from, to)`. */
  from: number
  to: number
  pageFrom: number
  pageTo: number
  takeaway: string
  quote: string
  /** Plain notes of what changed in them: "New belief: …", "Plan: …". */
  changed: string[]
  feeling: string
  by: "model" | "scripted"
}

export type Book = {
  id: string
  title: string
  /** Attachment uri of the original file, and of its extracted text. */
  fileUri: string
  textUri: string
  chars: number
  /** Character offset where each page starts; `pageStarts.length` is the page count. */
  pageStarts: number[]
  addedDay: number
  /** Characters read so far. */
  at: number
  readings: Reading[]
  /** Spine color, 0..SPINES-1. */
  spine: number
}

export const CHUNK = 2400
export const SHELF_MAX = 18
export const SPINES = 8

/** The page (1-based) a character offset falls on. */
export function pageAt(book: Pick<Book, "pageStarts">, offset: number): number {
  let p = 1
  for (let i = 0; i < book.pageStarts.length; i++) if (book.pageStarts[i]! <= offset) p = i + 1
  return p
}

export const finished = (b: Book) => b.at >= b.chars

/** The next sitting's span: about `CHUNK` characters, ending on a sentence when one is close. */
export function nextSpan(book: Pick<Book, "at" | "chars">, text: string): { from: number; to: number } {
  const from = Math.min(book.at, text.length)
  let to = Math.min(text.length, from + CHUNK)
  if (to < text.length) {
    const cut = text.slice(from + CHUNK * 0.6, to).search(/[.!?]\s[^.!?]*$/)
    if (cut >= 0) to = from + Math.floor(CHUNK * 0.6) + cut + 1
  }
  return { from, to }
}

/** The first unfinished book on a shelf, oldest shelved first. */
export function nextBook(s: GameState, id: string): Book | null {
  return (s.shelves?.[id] ?? []).find((b) => !finished(b)) ?? null
}

export function sentences(text: string): string[] {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/).map((x) => x.trim()).filter((x) => x.length > 0)
}

const STOP = new Set("the a an and or of to in on for with is are was were be it that this as at by from you your their they them we our i my me he she his her its not but so if then".split(" "))

const words = (t: string) => t.toLowerCase().match(/[a-z]{3,}/g)?.filter((w) => !STOP.has(w)) ?? []

/** Places a passage can send a friend to, by what it is about. */
const DRAWS: Array<[RegExp, Place, string]> = [
  [/\b(water|lake|pond|river|sea|ocean|swim|rain|wave)s?\b/i, "zone:pond", "go and look at the water"],
  [/\b(garden|seed|plant|soil|grow|harvest|farm)s?\b/i, "zone:farm", "look at how the crops grow"],
  [/\b(friend|together|talk|conversation|share|community)s?\b/i, "zone:meadow", "find someone to tell about it"],
  [/\b(fire|warm|night|star|dark)s?\b/i, "fire", "sit by the fire and think"],
  [/\b(alone|quiet|silence|still|rest|sleep)\b/i, "home", "sit quietly at home with it"],
  [/\b(walk|path|journey|road|wander|explore)s?\b/i, "spot", "walk it off around the usual spot"],
]

/** A reachable place a passage draws a friend to, if any. */
export function drawOf(text: string, act: number): { place: Place; doing: string } | null {
  for (const [re, place, doing] of DRAWS) {
    if (!re.test(text)) continue
    if (place.startsWith("zone:") && (ZONE_ACT[place.slice(5) as keyof typeof ZONE_ACT] ?? 9) > act) continue
    return { place, doing }
  }
  return null
}

const RULE = /\b(should|must|always|never|need to|the secret|the point|truth|we are|life is|everything|nothing)\b/i

/**
 * A sitting without a model: the sentence that best matches what they care about becomes the quote, a sentence that
 * sounds like a rule becomes a belief, and what the passage is about may send them somewhere next hour.
 */
export function scriptedReading(s: GameState, id: string, book: Book, text: string, act: number): Omit<Reading, "day" | "minute"> & { belief?: string; goal?: string; plan?: { place: Place; doing: string } } {
  const span = nextSpan(book, text)
  const passage = text.slice(span.from, span.to)
  const mind = s.minds?.[id]
  const care = new Set(words([...(mind?.likes ?? []), ...(mind?.motivations ?? []), ...(mind?.goals.map((g) => g.text) ?? []), ...(mind?.beliefs ?? [])].join(" ")))
  const all = sentences(passage).filter((x) => x.length >= 30 && x.length <= 260)
  const scored = all.map((x, i) => ({ x, n: words(x).filter((w) => care.has(w)).length * 3 + (RULE.test(x) ? 2 : 0) + (x.length > 60 && x.length < 180 ? 1 : 0) - i * 0.01 }))
  scored.sort((p, q) => q.n - p.n)
  const quote = (scored[0]?.x ?? passage.slice(0, 140)).slice(0, 220)
  const rule = all.find((x) => RULE.test(x) && x !== quote)
  const name = RESIDENTS.find((r) => r.id === id)?.name ?? "They"
  const plan = drawOf(passage, act)
  return {
    from: span.from,
    to: span.to,
    pageFrom: pageAt(book, span.from),
    pageTo: pageAt(book, Math.max(span.from, span.to - 1)),
    takeaway: `${name} read a while and kept turning one line over: "${quote.length > 120 ? `${quote.slice(0, 117)}…` : quote}"`,
    quote,
    changed: [],
    feeling: scored[0] && scored[0].n >= 3 ? "moved" : "thoughtful",
    by: "scripted",
    belief: rule && rule.length <= 160 ? rule : undefined,
    plan: plan ?? undefined,
  }
}

/**
 * Write a sitting into the save: the book's bookmark and log, a `read` memory, and whatever it changed in the mind
 * (a belief, a goal, the "learn" goal's progress, a plan for the next hour). Pure; returns a new state.
 */
export function applyReading(s0: GameState, id: string, bookId: string, r: Omit<Reading, "day" | "minute" | "changed"> & { belief?: string; goal?: string; plan?: { place: Place; doing: string } }): GameState {
  const s = structuredClone(s0)
  const shelf = s.shelves?.[id]
  const book = shelf?.find((b) => b.id === bookId)
  if (!shelf || !book) return s0
  const day = s.day
  const hour = Math.floor(s.minutes / 60) % 24
  const changed: string[] = []
  const minds = s.minds
  const m = minds[id]
  if (m) {
    if (r.belief && !m.beliefs.includes(r.belief)) {
      minds[id] = { ...m, beliefs: [...m.beliefs, r.belief].slice(-BELIEFS_MAX) }
      changed.push(`New belief: ${r.belief}`)
    }
    if (r.goal && !minds[id]!.goals.some((g) => g.text === r.goal)) {
      const goals = minds[id]!.goals
      minds[id] = { ...minds[id]!, goals: [...goals, { id: `book${Date.now() % 1e6}`, text: r.goal, progress: 0 }].slice(-GOALS_MAX) }
      changed.push(`New goal: ${r.goal}`)
    }
    if (advanceGoal(minds, id, "learn", 25)) changed.push("Finished a goal: learn something new from a book")
    if (r.plan && isPlace(r.plan.place)) {
      addPlan(minds, id, { day, from: (hour + 1) % 24, to: (hour + 2) % 24, doing: r.plan.doing, place: r.plan.place, why: `after reading ${book.title}` })
      changed.push(`Plan at ${(hour + 1) % 24}:00: ${r.plan.doing}`)
    }
  }
  const reading: Reading = { day, minute: s.minutes, from: r.from, to: r.to, pageFrom: r.pageFrom, pageTo: r.pageTo, takeaway: r.takeaway, quote: r.quote, changed, feeling: r.feeling, by: r.by }
  s.shelves[id] = shelf.map((b) => (b.id === bookId ? { ...b, at: Math.max(b.at, r.to), readings: [...b.readings, reading].slice(-60) } : b))
  remember(s.characters, id, day, "read", `read "${book.title}" (p. ${r.pageFrom}${r.pageTo !== r.pageFrom ? `–${r.pageTo}` : ""}): ${r.takeaway}`)
  return s
}

/** Put a book on a friend's shelf. Pure. */
export function shelveBook(s0: GameState, id: string, book: Omit<Book, "at" | "readings" | "addedDay" | "spine">): GameState {
  const s = structuredClone(s0)
  const shelf = s.shelves[id] ?? []
  if (shelf.length >= SHELF_MAX) return s0
  s.shelves[id] = [...shelf, { ...book, at: 0, readings: [], addedDay: s.day, spine: (shelf.length * 3 + book.title.length) % SPINES }]
  return s
}

/** Take a book off a shelf. Pure. The UI deletes its stored words. */
export function unshelveBook(s0: GameState, id: string, bookId: string): GameState {
  const s = structuredClone(s0)
  s.shelves[id] = (s.shelves[id] ?? []).filter((b) => b.id !== bookId)
  return s
}

/** Start a book over from the first page. */
export function rereadBook(s0: GameState, id: string, bookId: string): GameState {
  const s = structuredClone(s0)
  s.shelves[id] = (s.shelves[id] ?? []).map((b) => (b.id === bookId ? { ...b, at: 0 } : b))
  return s
}
