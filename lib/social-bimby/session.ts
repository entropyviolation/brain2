/**
 * lib/social-bimby/session.ts — After the card: ask for what is missing, then go over texts and DMs together
 *
 * A future line ("hang out with Masha … trip with Shelby; note texts and dms from each") leaves two things to do
 * in chat, one line at a time:
 *
 * 1. **Asks.** A person with no number and no Instagram, and no single mutual that matches, gets one question:
 *    "What's Shelby's number or @handle?" The answer (a number, a handle, a pick from the list, or skip) becomes
 *    a card with one `person` change. Nothing is saved until Accept.
 * 2. **Review.** For each person, BIM shows your last few conversations with them (texts and Instagram DMs,
 *    oldest first) and asks one question about each. What you type back is kept as a note; "next" shows the
 *    next conversation, "skip" moves to the next person, "done" stops. Your notes come back as a card of
 *    `person-note` changes when that person is finished.
 *
 * The `social-follow` lane (`lib/ingest/bim-lanes.ts`) offers each line here while a session is open. A line
 * that is a command (`log: …`), or a long line that answers nothing, is left to the other lanes. A session
 * nobody touches for 30 minutes is dropped. In memory only. Loaders and the card store are passed in.
 */
import { fmtDateTime } from "@/lib/report-bimby/time"
import type { Effect, ReportPlan } from "@/lib/report-bimby/types"
import type { ContactAsk } from "./future"

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

interface Session {
  asks: ContactAsk[]
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

/** What a contact answer holds: a pick from the list, a phone number, or an Instagram handle. */
export function readContactAnswer(text: string, ask: ContactAsk): { instagram?: string; phone?: string } | null {
  const t = text.trim()
  const pick = /^#?(\d)$/.exec(t)
  if (pick && ask.candidates.length) {
    const m = ask.candidates[Number(pick[1]) - 1]
    return m ? { instagram: m.username } : null
  }
  const out: { instagram?: string; phone?: string } = {}
  const phone = /(\+?\(?\d[\d\s().-]{5,}\d)/.exec(t)
  if (phone && phone[1]!.replace(/\D/g, "").length >= 7) out.phone = phone[1]!.trim()
  const handle =
    /@([a-z0-9._]{1,30})/i.exec(t)?.[1] ??
    /\b(?:ig|insta(?:gram)?|handle)\b\s*(?:is|:)?\s*([a-z0-9._]{2,30})/i.exec(t)?.[1] ??
    (!out.phone && /^[a-z0-9._]{3,30}$/i.test(t) && /[._\d]/.test(t) ? t : undefined) ??
    ask.candidates.find((c) => c.username.toLowerCase() === t.toLowerCase())?.username
  if (handle) out.instagram = handle.replace(/^@/, "").toLowerCase()
  return out.phone || out.instagram ? out : null
}

function contactPlan(name: string, got: { instagram?: string; phone?: string }, now: Date): ReportPlan {
  const effect: Effect = {
    id: `soc-person-${Date.now().toString(36)}-${++seq}`,
    kind: "person",
    title: `Contact for ${name}`,
    reasoning: [`You told me ${first(name)}'s ${[got.phone ? "number" : "", got.instagram ? "Instagram" : ""].filter(Boolean).join(" and ")}.`, "Save it on their page."],
    evidence: [],
    fields: [
      { key: "name", label: "Name", type: "text", value: name },
      { key: "instagram", label: "Instagram", type: "text", value: got.instagram ?? "" },
      { key: "phone", label: "Phone", type: "text", value: got.phone ?? "" },
      { key: "relation", label: "Relation", type: "text", value: "" },
    ],
    status: "pending",
  }
  return { id: planId(), text: `${name}'s contact`, at: now.toISOString(), trace: [], effects: [effect] }
}

/** What BIM says next: the open question, or the next person to go over, or that it is over. */
function nextPrompt(): string {
  if (!session) return ""
  const ask = session.asks[0]
  if (ask) return ask.question
  const who = session.review[0]
  if (who) return `Want to go over ${first(who)}'s texts and DMs with me? Say go (or skip, or done).`
  session = null
  return "That's everyone."
}

/** Opens the session after the card. Returns what to say under the card, or "" when there is nothing to follow. */
export function startSocialSession(asks: readonly ContactAsk[], review: readonly string[], now = Date.now()): string {
  if (!asks.length && !review.length) return ""
  session = { asks: [...asks], review: [...review], touched: now }
  return nextPrompt()
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
  if (!t || /^[\p{L}][\p{L} ]{0,24}:\s*\S/u.test(t)) return null
  session.touched = now.getTime()

  if (STOP.test(t)) {
    const done = finishCurrent(now, deps)
    session = null
    return { text: [done.said, "Okay, stopping here."].filter(Boolean).join(" "), route: "SOCIAL · follow · code", ...(done.reportId ? { reportId: done.reportId } : {}) }
  }

  const ask = session.asks[0]
  if (ask) {
    if (SKIP.test(t)) {
      session.asks.shift()
      return { text: [`Okay, nothing saved for ${first(ask.person)}.`, nextPrompt()].filter(Boolean).join("\n\n"), route: "SOCIAL · ask · code" }
    }
    const got = readContactAnswer(t, ask)
    if (!got) {
      if (t.length > 60) return null
      return { text: `I didn't catch a number or an @handle. ${ask.question}`, route: "SOCIAL · ask · code" }
    }
    session.asks.shift()
    const plan = contactPlan(ask.person, got, now)
    deps.putPlan(plan)
    return { text: [`${first(ask.person)}'s ${got.phone ? `number ${got.phone}` : ""}${got.phone && got.instagram ? " and " : ""}${got.instagram ? `@${got.instagram}` : ""}: on the card below, saved when you accept.`, nextPrompt()].filter(Boolean).join("\n\n"), route: "SOCIAL · ask · code", reportId: plan.id }
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
  cur.notes.push(t)
  return { text: `Kept that for ${first(cur.name)}. Another thought, or next for the next conversation.`, route: "SOCIAL · review · code" }
}
