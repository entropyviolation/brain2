/**
 * lib/social-bimby/future.ts — "I'm excited to hang out with Masha and I want to go on a trip with Shelby"
 *
 * A line about what you want to do with a few people, later. Each person gets their own clause, and each clause
 * says what you want: a hang-out (this coming week) or a trip (this season). "Note texts and dms from each" asks
 * BIM to go over their texts and DMs with you after the card (`session.ts`).
 *
 * The card, per person: find or make them (with an Instagram from your mutuals when they have none), a note of
 * what you said, the intention kept on their page, and the plan-log entry (Week Plan for a hang-out, Season Plan
 * for a trip). A trip also offers a maybe-line on the Year Plan. Nothing is saved until Accept.
 *
 * One person with only a hang-out stays with `parse.ts` (the older, richer reading): this reader takes a line
 * with two people or more, a trip, or a texts review. Pure: people, mutuals and contacts are passed in.
 */
import { quarterKey, quarterLabel } from "@/lib/seasons"
import { fmtDateTime } from "@/lib/report-bimby/time"
import type { Effect, EffectField, ReportPlan } from "@/lib/report-bimby/types"
import { mutualCandidates, type Mutual } from "./mutuals"
import type { KnownPerson } from "./parse"

export type IntentKind = "hang" | "trip"
export type Horizon = "week" | "season" | "year"

export interface FutureIntent {
  kind: IntentKind
  horizon: Horizon
  /** The words that said it ("excited to hang out with Masha"). */
  phrase: string
  /** "excited", "want to": how it was said. */
  feeling?: string
}

export interface FuturePerson {
  name: string
  known?: KnownPerson
  intents: FutureIntent[]
  /** The clause about them, as said. */
  clause: string
}

export interface FutureRead {
  people: FuturePerson[]
  /** "note texts and dms from each": go over their texts and DMs after the card. */
  review: boolean
  cues: string[]
}

/** Lower-case words that are never a person's name after "with". */
const NOT_NAMES = new Set([
  "her", "him", "them", "me", "you", "us", "my", "mine", "a", "an", "the", "friends", "friend", "people", "everyone",
  "someone", "somebody", "family", "mom", "dad", "it", "this", "that", "each", "both", "all", "everybody", "myself",
])

const NAME = String.raw`(?:my\s+(?:friend|bf|gf|boyfriend|girlfriend|sister|brother|cousin)\s+)?([\p{L}][\p{L}'’-]+)(?:\s+([\p{Lu}][\p{L}'’-]+))?`
const TRIP = new RegExp(String.raw`\b(?:(?:go(?:ing)?|take|taking|plan(?:ning)?)\s+(?:on\s+)?(?:a\s+)?(?:little\s+|short\s+|big\s+)?)?(?:trip|vacation|road\s*trip|getaway)\s+(?:with|w\/?)\s+${NAME}`, "iu")
const HANG = new RegExp(String.raw`\b(?:hang(?:ing)?\s*out|hang|chill(?:ing)?|get\s+(?:dinner|drinks|coffee|lunch|food)|meet\s+up|spend\s+time)\s+(?:with|w\/?)\s+${NAME}`, "iu")
const REVIEW = /\b(?:note|go\s+over|look\s+(?:at|over|through)|read|review|pull\s+up|check|save)\b.{0,40}?\b(?:texts?|dms?|messages?|convos?)\b/i
const FEELING = /\b(excited|so excited|can'?t wait|looking forward|really want(?:\s+to)?|want(?:\s+to)?|wanna|would love(?:\s+to)?|hope(?:\s+to)?|need(?:\s+to)?)\b/i
const FUTURE = /\b(?:in terms of the future|in the future|for the future|future|someday|eventually|at some point)\b/i

const YEAR_WORDS = /\b(?:this year|next year|someday|eventually|at some point|in 20\d\d)\b/i
const SEASON_WORDS = /\b(?:this (?:season|summer|winter|spring|fall|autumn)|next (?:summer|winter|spring|fall)|in (?:the )?(?:summer|winter|spring|fall)|this quarter)\b/i
const WEEK_WORDS = /\b(?:this week(?:end)?|next week(?:end)?|soon|asap|this coming week|upcoming week)\b/i

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const low = (s: string) => s.toLowerCase().replace(/[’]/g, "'")

/** A person by first name, full name or nickname. */
function knownBy(name: string, people: readonly KnownPerson[]): KnownPerson | undefined {
  const n = low(name)
  const exact = people.find((p) => low(p.name) === n || p.nicknames?.some((x) => low(x) === n))
  if (exact) return exact
  const byFirst = people.filter((p) => low(p.name).split(/\s+/)[0] === n)
  return byFirst.length === 1 ? byFirst[0] : undefined
}

function horizonOf(kind: IntentKind, clause: string): Horizon {
  if (WEEK_WORDS.test(clause)) return "week"
  if (SEASON_WORDS.test(clause)) return "season"
  if (YEAR_WORDS.test(clause)) return "year"
  return kind === "trip" ? "season" : "week"
}

/** The line in clauses: semicolons, sentences, and "and I …" / "also …" joins. */
export function clausesOf(text: string): string[] {
  return text
    .split(/\s*;\s*|\.\s+|\s*,\s*(?=(?:and\s+)?(?:i|i'm|im|also|plus)\b)|\s+(?:and|but|plus)\s+(?=(?:i|i'm|im|also)\b)|\s+also\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** The name the regex caught, or null when it is a pronoun or a common word. */
function nameFrom(m: RegExpMatchArray, people: readonly KnownPerson[]): { name: string; known?: KnownPerson; phrase: string } | null {
  const who = nameOnly(m, people)
  if (!who) return null
  // The phrase ends at the name: "go on a trip with Kai", not "… with Kai this".
  const phrase = m[2] && !who.name.toLowerCase().includes(low(m[2])) ? m[0].slice(0, m[0].length - m[2].length).trimEnd() : m[0]
  return { ...who, phrase }
}

function nameOnly(m: RegExpMatchArray, people: readonly KnownPerson[]): { name: string; known?: KnownPerson } | null {
  const first = m[1]!.replace(/[’']s$/, "")
  if (NOT_NAMES.has(low(first))) return null
  // A second name word must be capitalized as typed (the regex is case-blind): "Kai this year" is Kai.
  const second = m[2] && /^\p{Lu}/u.test(m[2]) && !NOT_NAMES.has(low(m[2])) ? m[2] : undefined
  const full = second ? `${first} ${second}` : first
  const known = knownBy(full, people) ?? knownBy(first, people)
  if (known) return { name: known.name, known }
  // An unknown name must look like one: capitalized as typed ("Jo"), or long enough not to be a word ("shelby").
  if (first.length < 3 && !/^\p{Lu}/u.test(first)) return null
  return { name: capital(second ? `${first} ${second}` : first) }
}

export function readFuture(text: string, people: readonly KnownPerson[]): FutureRead | null {
  const line = text.replace(/\s+/g, " ").trim()
  if (!line || line.length > 600 || /\?\s*$/.test(line)) return null
  const byName = new Map<string, FuturePerson>()
  const cues: string[] = []
  let review = false
  for (const clause of clausesOf(line)) {
    if (REVIEW.test(clause)) {
      review = true
      cues.push(`"${clause}": go over their texts and DMs`)
    }
    // Every trip and hang-out in the clause, in order. A hang-out inside a trip's words is the trip's.
    const hits = (["trip", "hang"] as const)
      .flatMap((kind) => [...clause.matchAll(new RegExp((kind === "trip" ? TRIP : HANG).source, "giu"))].map((m) => ({ kind, m })))
      .sort((a, b) => a.m.index! - b.m.index!)
      .filter((h, i, all) => !all.some((o, j) => j !== i && o.kind === "trip" && h.kind === "hang" && h.m.index! >= o.m.index! && h.m.index! < o.m.index! + o.m[0].length))
    hits.forEach(({ kind, m }, i) => {
      const who = nameFrom(m, people)
      if (!who) return
      const key = low(who.name)
      const person = byName.get(key) ?? { name: who.name, ...(who.known ? { known: who.known } : {}), intents: [], clause }
      if (person.intents.some((x) => x.kind === kind)) return
      // When and how are read from this hit's own words: up to the next hit, and from the clause start for the feeling.
      const own = clause.slice(m.index!, hits[i + 1]?.m.index ?? clause.length)
      const feeling = FEELING.exec(clause.slice(0, m.index! + m[0].length))?.[1]?.toLowerCase()
      person.intents.push({ kind, horizon: horizonOf(kind, own), phrase: who.phrase, ...(feeling ? { feeling } : {}) })
      byName.set(key, person)
      cues.push(`"${who.phrase}": ${kind === "trip" ? "a trip" : "a hang-out"} with ${who.name}`)
    })
  }
  const found = [...byName.values()]
  if (!found.length) return null
  const trip = found.some((p) => p.intents.some((i) => i.kind === "trip"))
  // One person, one hang-out, nothing else: the older Social BIMBY reading (`parse.ts`) is richer for that.
  if (found.length < 2 && !trip && !review && !FUTURE.test(line)) return null
  if (FUTURE.test(line)) cues.unshift("Said about the future.")
  return { people: found, review, cues }
}

// ---------------------------------------------------------------- the card

export interface ContactInfo {
  phones: string[]
  instagram?: string
}

export interface FutureDeps {
  /** Your Instagram mutuals (`mutuals.ts`). */
  mutuals: readonly Mutual[]
  /** What a known person already has for reaching them. */
  contactOf: (personId: string) => ContactInfo
}

/** A question back, asked one at a time after the card (`session.ts`). */
export interface ContactAsk {
  person: string
  /** Mutuals that could be them, when more than one. */
  candidates: Mutual[]
  question: string
}

export interface FuturePlan {
  plan: ReportPlan
  asks: ContactAsk[]
  /** People whose texts and DMs to go over, in order. */
  review: string[]
}

const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const longDay = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

/** The coming week: the one that starts next Monday (Monday itself counts as "this" week only on Sunday). */
export function upcomingMonday(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
  return d
}

let seq = 0
const effectId = (kind: string) => `soc-${kind}-${Date.now().toString(36)}-${++seq}`
const field = (key: string, label: string, value: string): EffectField => ({ key, label, type: "text", value })
const effect = (kind: Effect["kind"], title: string, reasoning: string[], evidence: string[], fields: EffectField[]): Effect => ({
  id: effectId(kind),
  kind,
  title,
  reasoning,
  evidence,
  fields,
  status: "pending",
})

export const PLAN_PERIODS = ["day", "week", "quarter", "year"] as const

export function intentText(kind: IntentKind, name: string): string {
  const first = name.split(/\s+/)[0]!
  return kind === "trip" ? `Go on a trip with ${first}` : `Hang out with ${first}`
}

/** Where an intent lands in the Plan logs, and the day that names its period. */
export function intentPeriod(intent: FutureIntent, now: Date): { period: (typeof PLAN_PERIODS)[number]; on: Date; label: string } {
  if (intent.horizon === "week") {
    const on = upcomingMonday(now)
    return { period: "week", on, label: `the Week Plan for the week of ${longDay(on)}` }
  }
  if (intent.horizon === "season") return { period: "quarter", on: now, label: `the Season Plan, ${quarterLabel(quarterKey(now))}` }
  return { period: "year", on: now, label: `the Year Plan for ${now.getFullYear()}` }
}

export function buildFuturePlan(read: FutureRead, message: string, now: Date, deps: FutureDeps): FuturePlan {
  const effects: Effect[] = []
  const asks: ContactAsk[] = []
  const trace = [...read.cues]
  for (const p of read.people) {
    const first = p.name.split(/\s+/)[0]!
    const contact = p.known ? deps.contactOf(p.known.id) : { phones: [] }
    const instagram = p.known?.instagram ?? contact.instagram
    const why: string[] = []
    const evidence: string[] = []
    let handle = ""
    if (!instagram) {
      const found = mutualCandidates(p.name, deps.mutuals)
      if (found.length === 1) {
        handle = found[0]!.username
        why.push(`${first} has no Instagram on file. One of your mutuals is ${found[0]!.name} (@${handle}), so that is filled in. Clear it if it is someone else.`)
        evidence.push(`Instagram mutual: ${found[0]!.name} @${handle}`)
      } else if (found.length > 1) {
        asks.push({
          person: p.name,
          candidates: found.slice(0, 5),
          question: `Which one is ${first}? ${found.slice(0, 5).map((m, i) => `${i + 1}. ${m.name} @${m.username}`).join("  ")} (a number, a handle, or skip)`,
        })
        why.push(`${found.length} of your mutuals could be ${first}; I'll ask which.`)
      } else if (!contact.phones.length) {
        asks.push({ person: p.name, candidates: [], question: `I can't find a number or an Instagram for ${first}, and none of your mutuals matches. What's ${first}'s number or @handle? (or skip)` })
        why.push(`${first} has no number or Instagram, and no mutual matches; I'll ask.`)
      }
    }
    if (!p.known || handle) {
      effects.push(
        effect("person", p.known ? `Update ${p.name}` : `New person: ${p.name}`, [p.known ? `${p.name} is in People I Know.` : `${p.name} is not in People I Know yet: make them.`, ...why], evidence, [
          field("name", "Name", p.name),
          field("instagram", "Instagram", handle),
          field("phone", "Phone", ""),
          field("relation", "Relation", ""),
        ]),
      )
    } else {
      trace.push(`${p.name} is already in People I Know${instagram ? ` (@${instagram})` : contact.phones.length ? " with a number" : ""}.`)
    }
    effects.push(
      effect("person-note", `Note on ${first}`, ["Keep what you said about them, word for word, on their Notes log, dated today."], [], [
        field("person", "Person", p.name),
        { key: "at", label: "When", type: "datetime", value: fmtDateTime(now.getTime(), true) },
        field("text", "Note", p.clause),
      ]),
    )
    for (const intent of p.intents) {
      const what = intentText(intent.kind, p.name)
      const where = intentPeriod(intent, now)
      effects.push(
        effect("intention", `Intention: ${what.toLowerCase()}`, [`You said "${intent.phrase}"${intent.feeling ? ` (${intent.feeling})` : ""}.`, `Keep it on ${first}'s page, so it shows until it happens.`], [], [
          field("person", "Person", p.name),
          { key: "kind", label: "Kind", type: "select", value: intent.kind, options: ["hang", "trip"] },
          field("text", "Intention", what),
          { key: "horizon", label: "By", type: "select", value: intent.horizon, options: ["week", "season", "year"] },
        ]),
      )
      effects.push(
        effect("plan-entry", `${what}, on ${where.period === "quarter" ? "the Season Plan" : where.period === "week" ? "next week's plan" : "the Year Plan"}`, [`Add it to ${where.label}.`], [], [
          { key: "period", label: "Plan log", type: "select", value: where.period, options: [...PLAN_PERIODS] },
          field("on", "Day in it", ymd(where.on)),
          field("text", "Entry", what),
        ]),
      )
      // A trip is big enough to keep on the year too, as a maybe. Reject it if the Season Plan is enough.
      if (intent.kind === "trip" && where.period !== "year") {
        effects.push(
          effect("plan-entry", `Maybe: ${what.toLowerCase()}, on the Year Plan`, [`A trip is worth seeing from the year. This is a maybe: reject it if the Season Plan is enough.`], [], [
            { key: "period", label: "Plan log", type: "select", value: "year", options: [...PLAN_PERIODS] },
            field("on", "Day in it", ymd(now)),
            field("text", "Entry", `Maybe: ${what.toLowerCase()}`),
          ]),
        )
      }
    }
  }
  const plan: ReportPlan = { id: `social-future-${Date.now().toString(36)}-${++seq}`, text: message, at: now.toISOString(), trace, effects }
  return { plan, asks, review: read.review ? read.people.map((p) => p.name) : [] }
}
