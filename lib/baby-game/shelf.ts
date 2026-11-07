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

/** A named idea a friend took from a book: what talks and teaching draw on. */
export type Idea = {
  name: string
  /** The author's claim in plain words. */
  gist: string
  /** Page it came from. */
  page: number
  /** Start offset of the sitting that found it, so editing that sitting replaces its ideas. */
  at: number
  /** How many times they have talked about it with a friend. */
  shared: number
}

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
  /** The idea explained to a younger friend, in their own picture. */
  explain?: string
  /** A real question the pages left them with. */
  question?: string
  /** Ideas this sitting found (`name`, `gist`). */
  ideas?: Array<{ name: string; gist: string }>
  /** Text a player has corrected (`replaceReading`). */
  edited?: boolean
  by: "model" | "scripted" | "you"
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
  /** What they have understood of the whole book so far, rewritten each sitting; read back before the next. */
  digest?: string
  /** Ideas found, newest last (`IDEAS_MAX`). */
  ideas?: Idea[]
  /** A manifesto copy (`study.ts`): the friend who wrote it. The words are `inline`, not in the attachment store. */
  manifestoBy?: string
  inline?: string
}

/** How a friend reads: a sitting in the hours their day sets aside, or the whole book until stopped. */
export type ReadStyle = "hourly" | "allatonce"

/**
 * A sitting the player corrected, kept as a worked example: the pages, what the model made of them, what the player
 * says it should have made, and a note about what the agent got wrong. The best few go into the reading prompt as
 * examples (`goldShots`); the whole list can be copied out to improve prompts, tools and the loop (`GOLD_MAX`).
 */
export type GoldExample = {
  day: number
  friend: string
  book: string
  passage: string
  model: { takeaway: string; quote: string; explain?: string; question?: string; ideas?: Array<{ name: string; gist: string }> }
  gold: { takeaway: string; quote: string; explain?: string; question?: string; ideas?: Array<{ name: string; gist: string }> }
  note: string
}

export const CHUNK = 4000
export const IDEAS_MAX = 24
export const GOLD_MAX = 30
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
export type SittingInput = Omit<Reading, "day" | "minute" | "changed"> & { belief?: string; goal?: string; plan?: { place: Place; doing: string }; digest?: string }

export function applyReading(s0: GameState, id: string, bookId: string, r: SittingInput): GameState {
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
  const reading: Reading = { day, minute: s.minutes, from: r.from, to: r.to, pageFrom: r.pageFrom, pageTo: r.pageTo, takeaway: r.takeaway, quote: r.quote, changed, feeling: r.feeling, by: r.by, ...(r.explain ? { explain: r.explain } : {}), ...(r.question ? { question: r.question } : {}), ...(r.ideas?.length ? { ideas: r.ideas } : {}) }
  const found: Idea[] = (r.ideas ?? []).map((i) => ({ name: i.name, gist: i.gist, page: r.pageFrom, at: r.from, shared: 0 }))
  s.shelves[id] = shelf.map((b) => (b.id === bookId ? { ...b, at: Math.max(b.at, r.to), readings: [...b.readings, reading].slice(-60), digest: r.digest || b.digest, ideas: [...(b.ideas ?? []), ...found].slice(-IDEAS_MAX) } : b))
  remember(s.characters, id, day, "read", readMemory(book.title, reading))
  return s
}

const readMemory = (title: string, r: Pick<Reading, "pageFrom" | "pageTo" | "takeaway" | "question">) =>
  `read "${title}" (p. ${r.pageFrom}${r.pageTo !== r.pageFrom ? `–${r.pageTo}` : ""}): ${r.takeaway}${r.question ? ` Still wondering: ${r.question}` : ""}`

/** The ideas a friend holds from every book, least talked about first (newest first among equals). */
export function ideasOf(s: GameState, id: string): Array<Idea & { book: string; bookId: string }> {
  const all = (s.shelves?.[id] ?? []).flatMap((b) => (b.ideas ?? []).map((i, n) => ({ ...i, book: b.title, bookId: b.id, n })))
  return all.sort((p, q) => p.shared - q.shared || q.n - p.n).map(({ n: _n, ...i }) => i)
}

/** Count an idea as talked about, so the next talk reaches for another. Pure. */
export function shareIdea(s0: GameState, id: string, bookId: string, name: string): GameState {
  const s = structuredClone(s0)
  s.shelves[id] = (s.shelves[id] ?? []).map((b) => (b.id === bookId ? { ...b, ideas: (b.ideas ?? []).map((i) => (i.name === name ? { ...i, shared: i.shared + 1 } : i)) } : b))
  return s
}

export type SittingEdit = { takeaway: string; quote: string; explain?: string; question?: string; ideas?: Array<{ name: string; gist: string }>; belief?: string; goal?: string }

/**
 * The player's corrected version of a sitting replaces it: the log entry, the `read` memory, the ideas it found, and
 * the belief or goal the model had added from it. With `note` it is also kept as a gold example (`GoldExample`) for the
 * reading prompt. Pure.
 */
export function replaceReading(s0: GameState, id: string, bookId: string, index: number, edit: SittingEdit, passage: string, note?: string): GameState {
  const s = structuredClone(s0)
  const shelf = s.shelves?.[id]
  const book = shelf?.find((b) => b.id === bookId)
  const old = book?.readings[index]
  if (!shelf || !book || !old) return s0
  const m = s.minds[id]
  if (m) {
    const gone = (prefix: string) => old.changed.filter((c) => c.startsWith(prefix)).map((c) => c.slice(prefix.length))
    const beliefs = gone("New belief: ")
    const goals = gone("New goal: ")
    m.beliefs = m.beliefs.filter((b) => !beliefs.includes(b))
    m.goals = m.goals.filter((g) => !goals.includes(g.text))
    if (edit.belief && !m.beliefs.includes(edit.belief)) m.beliefs = [...m.beliefs, edit.belief].slice(-BELIEFS_MAX)
    if (edit.goal && !m.goals.some((g) => g.text === edit.goal)) m.goals = [...m.goals, { id: `book${Date.now() % 1e6}`, text: edit.goal, progress: 0 }].slice(-GOALS_MAX)
  }
  const changed = old.changed.filter((c) => !c.startsWith("New belief: ") && !c.startsWith("New goal: "))
  if (edit.belief) changed.push(`New belief: ${edit.belief}`)
  if (edit.goal) changed.push(`New goal: ${edit.goal}`)
  const next: Reading = { ...old, takeaway: edit.takeaway, quote: edit.quote, explain: edit.explain || undefined, question: edit.question || undefined, ideas: edit.ideas?.length ? edit.ideas : undefined, changed, edited: true, by: "you" }
  const found: Idea[] = (edit.ideas ?? []).map((i) => ({ name: i.name, gist: i.gist, page: old.pageFrom, at: old.from, shared: 0 }))
  s.shelves[id] = shelf.map((b) => (b.id === bookId ? { ...b, readings: b.readings.map((r, n) => (n === index ? next : r)), ideas: [...(b.ideas ?? []).filter((i) => i.at !== old.from), ...found].slice(-IDEAS_MAX) } : b))
  const c = s.characters[id]
  if (c) {
    const was = c.memory.findIndex((x) => x.kind === "read" && x.text.includes(old.takeaway.slice(0, 40)))
    const text = readMemory(book.title, next)
    if (was >= 0) c.memory[was] = { ...c.memory[was]!, text }
    else remember(s.characters, id, s.day, "read", text)
  }
  if (note !== undefined) {
    const shot: GoldExample = {
      day: s.day, friend: id, book: book.title, passage: passage.slice(0, CHUNK + 400),
      model: { takeaway: old.takeaway, quote: old.quote, explain: old.explain, question: old.question, ideas: old.ideas },
      gold: { takeaway: edit.takeaway, quote: edit.quote, explain: edit.explain, question: edit.question, ideas: edit.ideas },
      note: note.trim().slice(0, 400),
    }
    s.gold = [...(s.gold ?? []), shot].slice(-GOLD_MAX)
  }
  return s
}

/** Gold examples for a reading prompt: this friend's first, then the newest, with the passage cut to a window around the quote. */
export function goldShots(s: GameState, id: string, n = 1): GoldExample[] {
  const all = [...(s.gold ?? [])].reverse()
  const pick = [...all.filter((g) => g.friend === id), ...all.filter((g) => g.friend !== id)].slice(0, n)
  return pick.map((g) => {
    const at = Math.max(0, g.passage.indexOf(g.gold.quote.slice(0, 30)))
    const from = Math.max(0, at - 350)
    return { ...g, passage: `${from ? "…" : ""}${g.passage.slice(from, from + 900)}…` }
  })
}

export function setReadStyle(s0: GameState, id: string, style: ReadStyle): GameState {
  return { ...s0, readStyle: { ...(s0.readStyle ?? {}), [id]: style } }
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
