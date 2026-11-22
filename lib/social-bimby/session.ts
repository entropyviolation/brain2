/**
 * lib/social-bimby/session.ts — After the card: ask for what is missing, then go over texts and DMs together
 *
 * A future line ("hang out with Masha … trip with Shelby; note texts and dms from each") leaves two things to do
 * in chat, one line at a time:
 *
 * 1. **Asks.** Every open question is listed at once, numbered ("1. Masha's number or @handle? 2. Which is
 *    Shelby? a. … b. …"). Answer any of them, in one line or several, in any order: "1 951 201 5076 @loureedstrash
 *    2 a and b", or by name ("shelby @one @two"). Several numbers and handles each are fine, and "last name Seal"
 *    adds a full name. Each answered person becomes a card with one `person` change. Nothing is saved until Accept.
 * 2. **Review.** For each person, BIM shows your last few conversations with them (texts and Instagram DMs,
 *    oldest first) and asks one question about each. What you type back is kept as a note; "next" shows the
 *    next conversation, "skip" moves to the next person, "done" stops. Your notes come back as a card of
 *    `person-note` changes when that person is finished.
 *
 * The `social-follow` lane (`lib/ingest/bim-lanes.ts`) offers each line here while a session is open. A line
 * that is a command (`log: …`), or one that answers no question, is left to the other lanes: the asks stay open. A session
 * nobody touches for 30 minutes is dropped. In memory only. Loaders and the card store are passed in.
 */
import { fmtDateTime } from "@/lib/report-bimby/time"
import type { Effect, ReportPlan } from "@/lib/report-bimby/types"
import { LETTERS, type ContactAsk } from "./future"

export interface ReviewLine {
  /** Epoch ms. */
  at: number
  dir: "in" | "out"
  text: string
  via: "text" | "dm"
}

export interface SessionDeps {
  loadTexts: (name: string) => Promise<ReviewLine[] | null>
  loadDms: (name: string) => Promise<ReviewLine[] | null>
  putPlan: (plan: ReportPlan) => void
}

export interface FollowReply {
  text: string
  route: string
  reportId?: string
}

interface Current {
  name: string
  chunks: ReviewLine[][]
  i: number
  notes: string[]
}

/** An open question and the number it was shown with. */
interface OpenAsk extends ContactAsk {
  n: number
}

interface Session {
  asks: OpenAsk[]
  review: string[]
  current?: Current
  touched: number
}

/** Conversations shown per person, newest ones. */
export const REVIEW_CHUNKS = 4
/** Lines shown from one conversation. */
const CHUNK_LINES = 10
/** Messages this far apart are two conversations. */
const GAP_MS = 60 * 60 * 1000
const IDLE_MS = 30 * 60 * 1000

let session: Session | null = null

const first = (name: string) => name.split(/\s+/)[0]!
const GO = /^(?:go|yes|y|yeah|yea|yep|ok(?:ay)?|sure|next|more|n|continue|keep going|ready|let'?s go)[.!]*$/i
const SKIP = /^(?:skip|pass|no|nah|idk|i don'?t know|dunno|not now|none|next person)[.!]*$/i
const STOP = /^(?:done|stop|cancel|end|enough|that'?s (?:all|it)|i'?m done|quit)[.!]*$/i

/** A plan, chore or errand: "need to", "order", "buy", a deadline. */
const TASK =
  /\b(?:need(?:s)? to|have to|has to|gotta|got to|must|remember to|don'?t forget|remind me|to-?do|order|buy|pick up|schedule|book|appointment|clean|laundry|groceries|pay|due|deadline|before|tomorrow|tonight|today|by (?:mon|tues|wednes|thurs|fri|satur|sun)day|the \d{1,2}(?:st|nd|rd|th)?)\b/i
const word = (alts: string) => new RegExp(String.raw`(?:^|[^\p{L}])(?:${alts})(?:'s)?(?![\p{L}])`, "iu")
const SHARED = word("we|us|our|they|them|their")

/**
 * A note about the person under review: it names them or says she / he / her / him.
 * Without that, a line saying we / they still counts ("we should go again"), unless it reads as a to-do.
 * Everything else is unrelated.
 */
export function isNote(t: string, name: string): boolean {
  const names = [name, first(name)].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
  if (word(`${names}|she|he|her|hers|him|his`).test(t)) return true
  return SHARED.test(t) && !TASK.test(t)
}

export function socialSessionOpen(now = Date.now()): boolean {
  if (session && now - session.touched > IDLE_MS) session = null
  return !!session
}

export function endSocialSession(): void {
  session = null
}

/** The conversations to go over: texts and DMs together, split where they go quiet for an hour; the last few. */
export function reviewChunks(lines: readonly ReviewLine[], max = REVIEW_CHUNKS): ReviewLine[][] {
  const sorted = [...lines].filter((l) => l.text.trim()).sort((a, b) => a.at - b.at)
  const chunks: ReviewLine[][] = []
  for (const l of sorted) {
    const last = chunks[chunks.length - 1]
    if (last && l.at - last[last.length - 1]!.at <= GAP_MS) last.push(l)
    else chunks.push([l])
  }
  return chunks.slice(-max)
}

const QUESTIONS = [
  (n: string) => `What do you want to remember about ${n} from this?`,
  (n: string) => `Anything ${n} cares about that you'd bring up when you see them?`,
  (n: string) => `How did this one feel?`,
  (n: string) => `Anything to follow up on with ${n}?`,
]

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** One conversation as BIM shows it, with a question at the end. */
export function chunkText(name: string, chunk: readonly ReviewLine[], i: number, of: number): string {
  const n = first(name)
  const day = new Date(chunk[0]!.at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  const via = chunk.every((l) => l.via === "dm") ? "Instagram DMs" : chunk.every((l) => l.via === "text") ? "texts" : "texts and DMs"
  const shown = chunk.slice(-CHUNK_LINES)
  const cut = chunk.length - shown.length
  const body = shown.map((l) => `${l.dir === "in" ? n : "You"}: ${clip(l.text.replace(/\s+/g, " ").trim(), 200)}`).join("\n")
  return `${n}, ${i + 1} of ${of} · ${via} · ${day}${cut ? ` (last ${shown.length} of ${chunk.length})` : ""}\n${body}\n\n${QUESTIONS[i % QUESTIONS.length]!(n)} (type a note, or next, skip, done)`
}

let seq = 0
const planId = () => `social-follow-${Date.now().toString(36)}-${++seq}`

function notesPlan(name: string, notes: readonly string[], now: Date): ReportPlan {
  const effects: Effect[] = notes.map((note, i) => ({
    id: `soc-person-note-${Date.now().toString(36)}-${++seq}-${i}`,
    kind: "person-note",
    title: `Note on ${first(name)}`,
    reasoning: ["You said this going over your texts and DMs with them."],
    evidence: [],
    fields: [
      { key: "person", label: "Person", type: "text", value: name },
      { key: "at", label: "When", type: "datetime", value: fmtDateTime(now.getTime(), true) },
      { key: "text", label: "Note", type: "text", value: note },
    ],
    status: "pending",
  }))
  return { id: planId(), text: `Going over ${name}'s texts and DMs`, at: now.toISOString(), trace: [`${notes.length} note${notes.length === 1 ? "" : "s"} from the review.`], effects }
}

export interface ContactAnswer {
  phones: string[]
  instagrams: string[]
  /** "last name Seal" → "Shelby Seal". */
  fullName?: string
}

const IG_WORD = /^(?:ig|igs|insta|instas|instagram|instagrams|handle|handles|account|accounts|@)$/i
const FILLER = /^(?:is|are|it'?s|her|his|their|both|and|or|also|plus|her's|the|one|ones|other|another|second|main|old|new|private|priv|spam|finsta|-|:|=|&|\/)$/i
const STOPS = /^(?:number|numbers|phone|phones|cell|#|last|full|name|names)$/i
const HANDLE = /^[a-z0-9._]{2,30}$/i
const looksHandle = (t: string) => HANDLE.test(t) && /[a-z]/i.test(t)
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

/**
 * What an answer holds: picks from the lettered choices, every phone number, every Instagram handle, a last
 * or full name. Null when it holds none of these.
 */
export function readContactAnswer(text: string, ask: ContactAsk): ContactAnswer | null {
  let t = ` ${text.replace(/\s+/g, " ").trim()} `
  const out: ContactAnswer = { phones: [], instagrams: [] }
  const addIg = (h: string) => {
    const c = h.replace(/^@+/, "").toLowerCase()
    if (c && !out.instagrams.includes(c)) out.instagrams.push(c)
  }
  const addPhone = (p: string) => {
    const d = p.replace(/\D/g, "")
    if (d.length < 7 || out.phones.some((x) => x.replace(/\D/g, "") === d)) return
    out.phones.push(p.trim())
  }
  const first = ask.person.split(/\s+/)[0]!

  // A last or full name.
  const full = /\bfull\s*name\s*(?:is|:|-|=)?\s*([\p{L}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+)+)/u.exec(t) ?? /\bfull\s*name\s*(?:is|:|-|=)?\s*([\p{L}][\p{L}'’-]+\s+[\p{L}][\p{L}'’-]+)/iu.exec(t)
  const last = /\blast\s*name\s*(?:is|:|-|=)?\s*([\p{L}][\p{L}'’-]+)/iu.exec(t)
  if (full) {
    out.fullName = full[1]!.split(" ").map(cap).join(" ")
    t = t.replace(full[0], " ")
  } else if (last) {
    out.fullName = `${first} ${cap(last[1]!)}`
    t = t.replace(last[0], " ")
  }

  // Lettered picks: the whole answer is letters ("b", "a and c", "a, b").
  const choices = [...ask.candidates.map((m) => ({ instagram: m.username })), ...(ask.cards ?? []).map((c) => ({ phones: c.phones, name: c.name }))]
  if (choices.length && /^\s*(?:[a-j](?:\s*(?:,|&|\+|and|or)?\s*|\s+))+$/i.test(t) && t.trim()) {
    for (const l of t.toLowerCase().match(/\b[a-j]\b/g) ?? []) {
      const c = choices[LETTERS.indexOf(l)]
      if (!c) continue
      if ("instagram" in c && c.instagram) addIg(c.instagram)
      if ("phones" in c && c.phones) {
        c.phones.forEach(addPhone)
        if (!out.fullName && c.name && c.name.split(/\s+/).length > ask.person.split(/\s+/).length) out.fullName = c.name
      }
    }
    return out.phones.length || out.instagrams.length ? out : null
  }

  // Phone numbers: every run of 7+ digits (two 10-digit numbers typed with only spaces between are split).
  for (const m of t.matchAll(/(?<![\w@.])\+?\(?\d[\d\s().-]{5,}\d(?![\w@])/g)) {
    const d = m[0].replace(/\D/g, "")
    if (d.length === 20 && !m[0].trim().startsWith("+")) {
      addPhone(d.slice(0, 10))
      addPhone(d.slice(10))
    } else addPhone(m[0])
    t = t.replace(m[0], " ")
  }

  // Handles: every @handle, and the words after "ig" / "instagram" / "handle" until a word that is not one.
  const tokens = t.split(/[\s,;]+/).map((w) => w.replace(/^[(:"'“-]+|[)."'”!?:-]+$/g, "")).filter(Boolean)
  let igMode = false
  for (const w of tokens) {
    if (w.startsWith("@") && looksHandle(w.slice(1))) {
      addIg(w)
      igMode = true
      continue
    }
    if (IG_WORD.test(w)) {
      igMode = true
      continue
    }
    if (STOPS.test(w)) {
      igMode = false
      continue
    }
    if (FILLER.test(w) || w.toLowerCase() === first.toLowerCase()) continue
    if (igMode && looksHandle(w)) addIg(w)
    else igMode = false
  }
  // A bare handle alone ("shelbyrose_"), or a handle from the list typed out.
  const bare = t.trim()
  if (!out.instagrams.length && !out.phones.length) {
    const listed = ask.candidates.find((c) => c.username.toLowerCase() === bare.toLowerCase())
    if (listed) addIg(listed.username)
    else if (/^[a-z0-9._]{3,30}$/i.test(bare) && /[._\d]/.test(bare)) addIg(bare)
  }
  return out.phones.length || out.instagrams.length || out.fullName ? out : null
}

function contactPlan(name: string, got: ContactAnswer, now: Date): ReportPlan {
  const told = [got.phones.length ? (got.phones.length > 1 ? "numbers" : "number") : "", got.instagrams.length ? (got.instagrams.length > 1 ? "Instagrams" : "Instagram") : "", got.fullName ? "full name" : ""].filter(Boolean)
  const effect: Effect = {
    id: `soc-person-${Date.now().toString(36)}-${++seq}`,
    kind: "person",
    title: `Contact for ${name}`,
    reasoning: [`You told me ${first(name)}'s ${told.join(" and ")}.`, got.instagrams.length > 1 ? "The first handle is the main one when they have none; the rest are kept as their other accounts." : "Save it on their page."],
    evidence: [],
    fields: [
      { key: "name", label: "Name", type: "text", value: name },
      { key: "fullName", label: "Full name", type: "text", value: got.fullName ?? "" },
      { key: "instagram", label: "Instagram", type: "text", value: got.instagrams.join(", ") },
      { key: "phone", label: "Phone", type: "text", value: got.phones.join(", ") },
      { key: "relation", label: "Relation", type: "text", value: "" },
    ],
    status: "pending",
  }
  return { id: planId(), text: `${name}'s contact`, at: now.toISOString(), trace: [], effects: [effect] }
}

const possessive = (names: string[]) => {
  const ps = names.map((n) => `${first(n)}'s`)
  return ps.length > 1 ? `${ps.slice(0, -1).join(", ")} and ${ps[ps.length - 1]}` : (ps[0] ?? "")
}

function asksList(asks: readonly OpenAsk[]): string {
  return asks.map((a) => `${a.n}. ${a.question}`).join("\n")
}

/** What BIM says next: the open questions, or the next person to go over, or that it is over. */
function nextPrompt(lead = "Still open:"): string {
  if (!session) return ""
  if (session.asks.length) return `${lead}\n${asksList(session.asks)}`
  const who = session.review[0]
  if (who) return `Want to go over ${first(who)}'s texts and DMs with me? Say go (or skip, or done).`
  session = null
  return "That's everyone."
}

/** Opens the session after the card. Returns what to say under the card, or "" when there is nothing to follow. */
export function startSocialSession(asks: readonly ContactAsk[], review: readonly string[], now = Date.now()): string {
  if (!asks.length && !review.length) return ""
  session = { asks: asks.map((a, i) => ({ ...a, n: i + 1 })), review: [...review], touched: now }
  if (!asks.length) return nextPrompt()
  const how = asks.length > 1 ? 'Answer any of them, by number or by name, in one line or a few ("1 … 2 …"), or skip:' : "Answer, or skip:"
  const then = review.length ? `\n\nWhen you're ready, say go and we'll go over ${possessive([...review])} texts and DMs.` : ""
  return `${asks.length > 1 ? "A few things I couldn't find." : "One thing I couldn't find."} ${how}\n${asksList(session.asks)}${then}`
}

type Part = { ask: OpenAsk; text: string }

/** The line cut into one piece per question: by "1 …  2 …" markers, else by their names, else all for one. */
export function splitAnswers(text: string, asks: readonly OpenAsk[]): Part[] {
  if (!asks.length) return []
  const marks: { at: number; end: number; ask: OpenAsk }[] = []
  for (const m of text.matchAll(/(?:^|[\s,;])(\d{1,2})(?!\d)(?:\s*[.):-]\s*|\s+|(?=[a-j]\b))/gi)) {
    const ask = asks.find((a) => a.n === Number(m[1]))
    if (ask) marks.push({ at: m.index!, end: m.index! + m[0].length, ask })
  }
  if (!marks.length) {
    for (const ask of asks) {
      const name = first(ask.person).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      for (const m of text.matchAll(new RegExp(String.raw`(?:^|[^\p{L}])(${name})(?:'s)?(?![\p{L}])`, "giu"))) marks.push({ at: m.index!, end: m.index! + m[0].length, ask })
    }
  }
  marks.sort((x, y) => x.at - y.at)
  if (!marks.length) return [{ ask: asks[0]!, text }]
  return marks.map((m, i) => ({ ask: m.ask, text: text.slice(m.end, marks[i + 1]?.at ?? text.length).trim() })).filter((p) => p.text)
}

/** Answers to the open asks: cards for what was given, skips dropped. Null when the line answers none of them. */
function takeAnswers(t: string, now: Date, deps: SessionDeps): FollowReply | null {
  if (!session) return null
  if (SKIP.test(t)) {
    const names = session.asks.map((a) => first(a.person))
    session.asks = []
    return { text: [`Okay, nothing saved for ${names.join(" or ")}.`, nextPrompt()].filter(Boolean).join("\n\n"), route: "SOCIAL · ask · code" }
  }
  const got = new Map<OpenAsk, ContactAnswer>()
  const skipped = new Set<OpenAsk>()
  for (const part of splitAnswers(t, session.asks)) {
    if (/^(?:skip|pass|idk|i don'?t know|dunno|none|no|nah|not sure)\b[.!]*$/i.test(part.text)) {
      skipped.add(part.ask)
      continue
    }
    const a = readContactAnswer(part.text, part.ask)
    if (!a) continue
    const had = got.get(part.ask)
    got.set(part.ask, had ? { phones: [...new Set([...had.phones, ...a.phones])], instagrams: [...new Set([...had.instagrams, ...a.instagrams])], ...((a.fullName ?? had.fullName) ? { fullName: a.fullName ?? had.fullName } : {}) } : a)
  }
  if (!got.size && !skipped.size) return null
  const said: string[] = []
  let reportId: string | undefined
  for (const [ask, a] of got) {
    const plan = contactPlan(ask.person, a, now)
    deps.putPlan(plan)
    reportId ??= plan.id
    const bits = [a.phones.length ? `${a.phones.length > 1 ? "numbers" : "number"} ${a.phones.join(", ")}` : "", a.instagrams.length ? a.instagrams.map((h) => `@${h}`).join(", ") : "", a.fullName ? `full name ${a.fullName}` : ""].filter(Boolean)
    said.push(`${first(ask.person)}: ${bits.join(" and ")}.`)
  }
  for (const ask of skipped) said.push(`Nothing saved for ${first(ask.person)}.`)
  const done = new Set<OpenAsk>([...got.keys(), ...skipped])
  session.asks = session.asks.filter((a) => !done.has(a))
  const cards = got.size ? (got.size > 1 ? " On the cards below, saved when you accept." : " On the card below, saved when you accept.") : ""
  return { text: [`${said.join(" ")}${cards}`, nextPrompt()].filter(Boolean).join("\n\n"), route: "SOCIAL · ask · code", ...(reportId ? { reportId } : {}) }
}

/** Finish the person under review: their notes go on a card. */
function finishCurrent(now: Date, deps: SessionDeps): { said: string; reportId?: string } {
  const cur = session?.current
  if (!session || !cur) return { said: "" }
  session.current = undefined
  session.review = session.review.filter((n) => n !== cur.name)
  if (!cur.notes.length) return { said: `Done with ${first(cur.name)}.` }
  const plan = notesPlan(cur.name, cur.notes, now)
  deps.putPlan(plan)
  return { said: `Done with ${first(cur.name)}: ${cur.notes.length} note${cur.notes.length === 1 ? "" : "s"} below. Nothing is saved until you accept.`, reportId: plan.id }
}

async function openNext(now: Date, deps: SessionDeps, lead: string[]): Promise<FollowReply> {
  while (session && session.review.length) {
    const name = session.review[0]!
    const [texts, dms] = await Promise.all([deps.loadTexts(name).catch(() => null), deps.loadDms(name).catch(() => null)])
    const chunks = reviewChunks([...(texts ?? []), ...(dms ?? [])])
    if (chunks.length) {
      session.current = { name, chunks, i: 0, notes: [] }
      const missing = texts === null && dms === null ? "" : texts === null ? " (texts could not be read; DMs only)" : dms === null ? " (DMs could not be read; texts only)" : ""
      return { text: [...lead, `${chunkText(name, chunks[0]!, 0, chunks.length)}${missing}`].join("\n\n"), route: "SOCIAL · review · code" }
    }
    lead.push(texts === null && dms === null ? `I couldn't reach your texts or DMs for ${first(name)} (is the Mac hub on?).` : `No texts or DMs with ${first(name)} that I can read.`)
    session.review.shift()
  }
  const end = nextPrompt()
  return { text: [...lead, end].filter(Boolean).join("\n\n"), route: "SOCIAL · review · code" }
}

/** A line while a session is open. Null leaves it to the other lanes. */
export async function trySocialFollow(text: string, now: Date, deps: SessionDeps): Promise<FollowReply | null> {
  if (!socialSessionOpen(now.getTime()) || !session) return null
  const t = text.replace(/\s+/g, " ").trim()
  if (!t) return null
  // "log: …" is a command for another lane; "shelby: @one" answers a question.
  const prefix = /^([\p{L}][\p{L} ]{0,24}):\s*\S/u.exec(t)?.[1]?.trim().toLowerCase()
  if (prefix && !session.asks.some((a) => first(a.person).toLowerCase() === prefix || a.person.toLowerCase() === prefix)) return null
  session.touched = now.getTime()

  if (STOP.test(t)) {
    const done = finishCurrent(now, deps)
    session = null
    return { text: [done.said, "Okay, stopping here."].filter(Boolean).join(" "), route: "SOCIAL · follow · code", ...(done.reportId ? { reportId: done.reportId } : {}) }
  }

  if (session.asks.length) {
    // "go" with questions still open: leave them, go over texts and DMs.
    if (GO.test(t) && session.review.length && !/^(?:n|next)$/i.test(t)) {
      session.asks = []
      return openNext(now, deps, [])
    }
    // Anything that answers no question is someone else's line ("i need to text ruggles back"); the asks stay open.
    return takeAnswers(t, now, deps)
  }

  const cur = session.current
  if (!cur) {
    if (GO.test(t)) return openNext(now, deps, [])
    if (SKIP.test(t)) {
      session.review.shift()
      return { text: nextPrompt(), route: "SOCIAL · review · code" }
    }
    return null
  }

  if (GO.test(t)) {
    cur.i += 1
    if (cur.i < cur.chunks.length) return { text: chunkText(cur.name, cur.chunks[cur.i]!, cur.i, cur.chunks.length), route: "SOCIAL · review · code" }
    const done = finishCurrent(now, deps)
    const next = await openNext(now, deps, [done.said])
    return { ...next, ...(done.reportId ? { reportId: done.reportId } : {}) }
  }
  if (SKIP.test(t)) {
    const done = finishCurrent(now, deps)
    const next = await openNext(now, deps, [done.said])
    return { ...next, ...(done.reportId ? { reportId: done.reportId } : {}) }
  }
  // Only a line about this person is a note. Anything else ("need to clean house before elijah gets back")
  // goes on to the other lanes, which file it as usual; the review stays open.
  if (!isNote(t, cur.name)) return null
  cur.notes.push(t)
  return { text: `Kept that for ${first(cur.name)}. Another thought, or next for the next conversation.`, route: "SOCIAL · review · code" }
}
