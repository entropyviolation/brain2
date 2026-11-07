/**
 * lib/baby-game/bestie.ts — The Best Friends BIMBY: what a friend does once they love you (10 hearts)
 *
 * At full friendship a friend stops being polite. They call you **C** (short for the Center of The World), ask you things about
 * yourself in their own words, tell you what they have been reading and what they would like to read next (they know you are the
 * one who brings the books), and now and then leave a note in the mailbox, sometimes with a gift they thought of for you.
 * This file is the pure half: who counts, what the model is told (`bestBrief`), the scripted letters, when letters are posted
 * overnight (`postLetters`) and what picking them up from the mailbox does (`collectMail`). `letters.ts` is the model half: it rewrites
 * a scripted letter in the friend's voice and lets them call the `give_item` / `invent_item` tools (`forge.ts` makes the item).
 * Letters live in `GameState.mail`; what the player told friends lives in `GameState.aboutC`. Nothing here changes a quest, a gate or a heart.
 */

import { resident, RESIDENTS, temper } from "./cast"
import { remember } from "./character"
import { bag, isBestFriend, noteToday, tasteOf, type GameState, type Msg } from "./engine"
import { item, ITEMS } from "./items"

export const CALLED = "C"

export type LetterKind = "question" | "reading" | "note" | "gift"

export type Letter = {
  id: string
  from: string
  day: number
  kind: LetterKind
  text: string
  /** An item id waiting in the envelope until the letter is collected. */
  gift?: string
  read: boolean
  by: "model" | "scripted"
}

/** Most letters kept in the save, newest last. */
export const MAIL_MAX = 60
/** A friend writes at most this often, in days, and never while their last letter is unread. */
export const LETTER_GAP = 2
const GIFT_GAP = 4

const QUESTIONS = [
  "What did you eat this morning? I keep wondering what a morning is like where you come from.",
  "What is the first thing you do when you wake up?",
  "What scares you a little, and do you tell anyone?",
  "What is the best day you can remember?",
  "Is there a place you miss? What does it smell like?",
  "What do you do when you cannot sleep?",
  "Who do you think of when it rains?",
  "What is something small that makes your whole day better?",
  "What would you do with a day with nothing in it?",
  "What do you wish somebody would ask you?",
]

/** What a friend knows of C from what C has said, newest last. */
export const aboutBrief = (s: GameState): string => (s.aboutC?.length ? `What you know about ${CALLED} from what ${CALLED} told you: ${s.aboutC.slice(-8).join(" / ")}.` : "")

/** Their shelf in a few lines: what they are reading, what they took from it, and that C is the one who brings the books. */
export function readingBrief(s: GameState, id: string): string {
  const books = s.shelves?.[id] ?? []
  if (!books.length) return `Your shelf is empty. ${CALLED} is the one who brings you books, and you would love one.`
  const lines = books.slice(-3).map((b) => {
    const last = b.readings.at(-1)
    return `"${b.title}" (${Math.round((Math.min(b.at, b.chars) / Math.max(1, b.chars)) * 100)}% read${last ? `; it left you thinking: ${last.takeaway}` : ""})`
  })
  return `${CALLED} is the one who brings you your books. On your shelf: ${lines.join("; ")}.`
}

/** The paragraph added to a best friend's prompt, and "" for everyone else. */
export function bestBrief(s: GameState, id: string): string {
  if (!isBestFriend(s, id)) return ""
  return [
    `You and the Center of The World are best friends now. Call them ${CALLED}. Be warm and a little bold: you do not need to be careful with them any more.`,
    `Often ask ${CALLED} one short question about themselves in your own words (what they feel, remember, fear or love), something you do not know yet. Do not repeat a question you already asked.`,
    readingBrief(s, id),
    "If it comes up, say what you have been reading and what else you would like to read.",
    aboutBrief(s),
  ].filter(Boolean).join("\n")
}

const lastLetter = (s: GameState, id: string) => (s.mail ?? []).filter((l) => l.from === id).at(-1)

/** A gift they would pick for C without a model: something they love themselves, so it means something. */
export function scriptedGift(s: GameState, id: string, rand: () => number): string | null {
  const r = resident(id)
  if (!r) return null
  const pool = Object.values(ITEMS).filter((d) => (d.kind === "material" || d.kind === "trinket") && d.id !== "gem" && !d.id.startsWith("shell-") && tasteOf(r, d.id) === "love")
  return pool.length ? pool[Math.floor(rand() * pool.length)]!.id : "gem"
}

/** The letter a friend would write with no model. */
export function scriptedLetter(s: GameState, id: string, kind: LetterKind, rand: () => number): Omit<Letter, "id" | "day" | "read"> {
  const r = resident(id)!
  const asked = new Set((s.characters?.[id]?.memory ?? []).filter((m) => m.kind === "asked").map((m) => m.text))
  const fresh = QUESTIONS.filter((q) => ![...asked].some((a) => a.includes(q.slice(0, 24))))
  const books = s.shelves?.[id] ?? []
  const withReading = books.filter((b) => b.readings.length)
  const likes = s.minds?.[id]?.likes ?? []
  if (kind === "question") {
    const q = (fresh.length ? fresh : QUESTIONS)[Math.floor(rand() * (fresh.length || QUESTIONS.length))]!
    return { from: id, kind, text: `${CALLED}, ${q[0]!.toLowerCase()}${q.slice(1)}`, by: "scripted" }
  }
  if (kind === "reading") {
    const b = withReading.at(-1)
    const want = likes.length ? `Next I would like to read something about ${likes[Math.floor(rand() * likes.length)]}.` : "Next I would read anything you bring me."
    return {
      from: id, kind, by: "scripted",
      text: b ? `${CALLED}, I have been reading "${b.title}". ${b.readings.at(-1)!.takeaway} ${want} You always know which book I need.` : `${CALLED}, my shelf is quiet. ${want} You are the one who brings me books.`,
    }
  }
  if (kind === "gift") {
    const g = scriptedGift(s, id, rand) ?? "gem"
    return { from: id, kind, gift: g, by: "scripted", text: `${CALLED}, I thought of you and found this. It is a ${item(g).name}. I hope it is right.` }
  }
  return { from: id, kind: "note", by: "scripted", text: `${CALLED}, I was thinking about you, so I wrote this. That is all. ${r.name}` }
}

/**
 * Overnight: each best friend may leave a letter. Never twice in a row while one is unread, and not more often than every
 * `LETTER_GAP` days. Returns the new state and the letters just posted (so the UI can have a model rewrite them).
 */
export function postLetters(s0: GameState, rand: () => number): { s: GameState; posted: Letter[] } {
  const s: GameState = { ...s0, mail: [...(s0.mail ?? [])], characters: structuredClone(s0.characters) }
  const posted: Letter[] = []
  for (const r of RESIDENTS) {
    if (!isBestFriend(s, r.id)) continue
    const last = lastLetter(s, r.id)
    if (last && (!last.read || s.day - last.day < LETTER_GAP)) continue
    if (rand() > (temper(r.id).cadence === "eager" ? 0.6 : temper(r.id).cadence === "quiet" ? 0.25 : 0.4)) continue
    const lastGift = (s.mail ?? []).filter((l) => l.from === r.id && l.kind === "gift").at(-1)
    const roll = rand()
    const kind: LetterKind = roll < 0.3 ? "question" : roll < 0.6 ? "reading" : roll < 0.8 && (!lastGift || s.day - lastGift.day >= GIFT_GAP) ? "gift" : "note"
    const l: Letter = { ...scriptedLetter(s, r.id, kind, rand), id: `l${s.day}-${r.id}`, day: s.day, read: false }
    s.mail!.push(l)
    posted.push(l)
    remember(s.characters, r.id, s.day, "letter", `left C a ${kind === "gift" ? "note and a gift" : "note"} in the mailbox`)
    if (kind === "question") remember(s.characters, r.id, s.day, "asked", `asked in a note: ${l.text.slice(0, 140)}`)
  }
  s.mail = s.mail!.slice(-MAIL_MAX)
  return { s, posted }
}

/** Replace a posted letter's words (and maybe its gift) after a model has written it. */
export function amendLetter(s: GameState, letterId: string, patch: Partial<Pick<Letter, "text" | "gift" | "by">>): GameState {
  return { ...s, mail: (s.mail ?? []).map((l) => (l.id === letterId && !l.read ? { ...l, ...patch } : l)) }
}

export const unreadLetters = (s: GameState) => (s.mail ?? []).filter((l) => !l.read)

/** Pick up the mailbox: every unread letter is read, and every gift in an envelope goes into the bag. Mutates `n`, which must be a clone. */
export function collectMail(n: GameState): Msg[] {
  const msgs: Msg[] = []
  n.mail = (n.mail ?? []).map((l) => {
    if (l.read) return l
    const name = resident(l.from)?.name ?? l.from
    msgs.push({ text: `A note from ${name}: ${l.text}`, tone: "good" })
    if (l.gift) {
      bag(n, l.gift, 1)
      msgs.push({ text: `+1 ${item(l.gift).name}, from ${name}`, tone: "good" })
    }
    noteToday(n, `Got a note from ${name}${l.gift ? ` and a ${item(l.gift).name}` : ""}.`)
    return { ...l, read: true }
  })
  return msgs
}
