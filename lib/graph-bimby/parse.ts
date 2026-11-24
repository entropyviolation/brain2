/**
 * lib/graph-bimby/parse.ts — Read what you tell BIM about one item (pure)
 *
 * The line comes from the GRAPH tab's **Tell BIM about this** key: "Tell BIM about Linda Gibbins Croft: …".
 * `parseTellLead` takes the name and the words. `readAbout` reads the words, sentence by sentence, into
 * typed reads about that one subject. Rules only; `llm.ts` may add reads for sentences the rules left.
 *
 *   place    "She lives at 245 Wallaby Way"                         → an address (a Location item + the profile)
 *   kin      "… is my boyfriend Elijah Gibbins Croft's biological mother" → a link to that person (mother-of)
 *   relation "She is my aunt"                                       → how they relate to you
 *   fact     "She is a former social worker and currently a remote therapist" → a standing fact
 *   seen     "Saw her at Thanksgiving and she made me mad"          → a Last seen interaction, dated
 *   todo     "She wants me to send my Christmas list ASAP"          → a To Do about them (or an amend of one)
 *   birthday "Her birthday is March 3"
 *   contact  "Her number is 951 201 5076", "ig @lindagc", "email linda@x.com"
 *   step     on a project: "next I need to book the venue"           → a proposed part of it (a child item)
 *   consider "Thinking about moving it to spring", "maybe I should …" → a dated "Considering" note
 *
 * Every read keeps the sentence it came from (`quote`), which the card shows as evidence.
 */

import { findDay, isoOf } from "@/lib/ingest/bim-tell"
import { relationWord } from "@/lib/person-relations"

export interface Subject {
  id: string
  name: string
  person: boolean
  /** Has parts or steps: a plan said about it becomes a proposed part, not a loose To Do. */
  project?: boolean
}

export interface KnownPerson {
  id: string
  name: string
}

export type GraphRead =
  | { kind: "place"; text: string; precision: "mailing" | "neighborhood"; quote: string }
  | { kind: "kin"; relation: string; role: string; qualifier?: string; otherName: string; otherId?: string; toMe?: string; quote: string }
  | { kind: "relation"; word: string; relation?: string; quote: string }
  | { kind: "fact"; text: string; quote: string }
  | { kind: "seen"; date: string; dateSaid: boolean; text: string; quote: string }
  | { kind: "todo"; title: string; urgent: boolean; quote: string }
  | { kind: "step"; title: string; urgent: boolean; quote: string }
  | { kind: "consider"; text: string; quote: string }
  | { kind: "birthday"; date: string; quote: string }
  | { kind: "contact"; phones: string[]; handles: string[]; emails: string[]; quote: string }

/**
 * "Tell BIM about Linda Gibbins Croft: she …" → the name and the words. A group is names joined by " + "
 * ("Tell BIM about Linda + Elijah: …"), which is what the GRAPH key writes for several selected nodes.
 * Null for any other line.
 */
export function parseTellLead(text: string): { name: string; names: string[]; body: string } | null {
  const m = /^\s*tell\s+(?:bim\s+)?about\s+(.+?)\s*:\s*([\s\S]*\S)\s*$/i.exec(text)
  if (!m) return null
  const name = m[1].trim()
  if (!name || name.length > 240) return null
  const names = name.split(/\s+\+\s+/).map((n) => n.trim()).filter(Boolean)
  return { name, names, body: m[2].trim() }
}

/** The lead the GRAPH key puts in the compose well, for one node or a group. */
export const tellLead = (name: string | readonly string[]): string => `Tell BIM about ${typeof name === "string" ? name : name.join(" + ")}: `

/** Sentences: split after . ! ? and at line breaks and semicolons. "etc etc" tails are dropped. */
export function sentences(body: string): string[] {
  return body
    .split(/(?<=[.!?])\s+|\n+|;\s*/)
    .map((s) => s.replace(/\b(?:etc\.?\s*)+$/i, "").replace(/\s+/g, " ").trim())
    .filter((s) => s.replace(/[^\p{L}\p{N}]/gu, "").length >= 3)
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const trimEnd = (s: string) => s.replace(/[\s,.;:!?]+$/, "").trim()
const firstOf = (name: string) => name.trim().split(/\s+/)[0] ?? name

// ---------------------------------------------------------------- days

const HOLIDAYS: { re: RegExp; day: (y: number) => Date }[] = [
  { re: /\bthanksgiving\b/i, day: (y) => nthWeekday(y, 10, 4, 4) },
  { re: /\bchristmas eve\b/i, day: (y) => new Date(y, 11, 24) },
  { re: /\bchristmas\b|\bxmas\b/i, day: (y) => new Date(y, 11, 25) },
  { re: /\bnew year'?s eve\b/i, day: (y) => new Date(y, 11, 31) },
  { re: /\bnew year'?s(?: day)?\b/i, day: (y) => new Date(y, 0, 1) },
  { re: /\bhalloween\b/i, day: (y) => new Date(y, 9, 31) },
  { re: /\bfourth of july\b|\bjuly 4th\b/i, day: (y) => new Date(y, 6, 4) },
  { re: /\bvalentine'?s(?: day)?\b/i, day: (y) => new Date(y, 1, 14) },
  { re: /\beaster\b/i, day: (y) => easter(y) },
]

/** The n-th weekday (0 = Sunday) of a month. Thanksgiving is the 4th Thursday of November. */
function nthWeekday(y: number, month: number, weekday: number, n: number): Date {
  const first = new Date(y, month, 1)
  const offset = (weekday - first.getDay() + 7) % 7
  return new Date(y, month, 1 + offset + (n - 1) * 7)
}

function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  return new Date(y, month - 1, ((h + l - 7 * m + 114) % 31) + 1)
}

/** A day named in a sentence, holidays included. Past tense takes the nearest one on or before today. */
export function dayIn(text: string, now: Date, prefer: "past" | "future"): string | null {
  // A find, not a for-of with an early return: Turbopack (Next 15.2) left the bim-tell import after that loop
  // unbound in the browser bundle ("findDay is not defined").
  const h = HOLIDAYS.find((x) => x.re.test(text))
  if (!h) return findDay(text, now, prefer)?.iso ?? null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let d = h.day(now.getFullYear())
  if (prefer === "past" && d > today) d = h.day(now.getFullYear() - 1)
  if (prefer === "future" && d < today) d = h.day(now.getFullYear() + 1)
  return isoOf(d)
}

// ---------------------------------------------------------------- one sentence at a time

const QUALIFIERS = "biological|birth|adoptive|adopted|step|half|real|ex|future|late"

/** "… Elijah Gibbins Croft's biological mother" → the owner, the role word and its seed (from the subject's side). */
function readKin(s: string, subject: Subject, people: readonly KnownPerson[]): Extract<GraphRead, { kind: "kin" }> | null {
  const re = new RegExp(`((?:[\\p{L}-]+\\s+){0,3}[\\p{L}-]+)['’]s\\s+(?:(${QUALIFIERS})[\\s-]+)?([a-z]+(?:\\s+[a-z]+)?)`, "giu")
  for (const m of s.matchAll(re)) {
    const roleWords = m[3].toLowerCase().split(/\s+/)
    // "best friend" before "best"; a role is the first one or two words that read as a relation.
    const role = [roleWords.join(" "), roleWords[0]].find((w) => relationWord(w))
    if (!role) continue
    const seed = relationWord(role)!
    const words = m[1].split(/\s+/)
    // The owner: the longest known name that ends the words, else the capitalized words at the end.
    const low = words.map((w) => w.toLowerCase())
    let otherName = ""
    let otherId: string | undefined
    for (let n = Math.min(4, words.length); n >= 1 && !otherName; n--) {
      const tail = low.slice(-n).join(" ")
      const hit = people.find((p) => p.id !== subject.id && p.name.toLowerCase() === tail) ?? (n === 1 ? people.find((p) => p.id !== subject.id && firstOf(p.name).toLowerCase() === tail) : undefined)
      if (hit) {
        otherName = hit.name
        otherId = hit.id
      }
    }
    if (!otherName) {
      const caps: string[] = []
      for (let i = words.length - 1; i >= 0 && /^\p{Lu}/u.test(words[i]) && !/^(?:I|My|She|He|They|Is|Was)$/.test(words[i]); i--) caps.unshift(words[i])
      otherName = caps.join(" ")
    }
    if (!otherName || otherName.toLowerCase() === subject.name.toLowerCase()) continue
    // "my boyfriend Elijah's mother": the word after "my" says who the owner is to you.
    const before = s.slice(0, m.index! + m[1].length - otherName.length)
    const toMe = /\bmy\s+([a-z]+(?:\s+friend)?)\s*$/i.exec(before)?.[1]?.toLowerCase()
    return { kind: "kin", relation: seed.personRelation, role, qualifier: m[2]?.toLowerCase(), otherName, otherId, ...(toMe && relationWord(toMe) ? { toMe } : {}), quote: s }
  }
  return null
}

const PRONOUN = "she|he|they|her|him|them"

function readPlace(s: string): Extract<GraphRead, { kind: "place" }> | null {
  const m = /\b(?:lives|living|resides|stays|moved)\s+(?:at|on|in|to)\s+(.+)$|\b(?:address|house|home|place)\s+is\s+(?:at\s+|on\s+|in\s+)?(.+)$/i.exec(s)
  const text = trimEnd(m?.[1] ?? m?.[2] ?? "")
  if (!text || text.length > 120) return null
  return { kind: "place", text, precision: /\d/.test(text) ? "mailing" : "neighborhood", quote: s }
}

function readContact(s: string): Extract<GraphRead, { kind: "contact" }> | null {
  const emails = [...s.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map((m) => trimEnd(m[0]))
  const rest = s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, " ")
  const handles = /\b(?:instagram|insta|ig)\b|@/i.test(rest) ? [...rest.matchAll(/@([a-z0-9._]{2,30})|\b(?:instagram|insta|ig)(?:\s+is)?[:\s]+@?([a-z0-9._]{2,30})/gi)].map((m) => (m[1] ?? m[2]).replace(/\.$/, "")).filter((h) => !/^(?:is|at|her|his)$/i.test(h)) : []
  const phones = /\b(?:number|phone|cell|mobile|tel)\b/i.test(rest) ? [...rest.matchAll(/\+?\d[\d\s().-]{7,}\d/g)].map((m) => m[0].trim()) : []
  if (!emails.length && !handles.length && !phones.length) return null
  return { kind: "contact", phones, handles, emails, quote: s }
}

function readBirthday(s: string, now: Date): Extract<GraphRead, { kind: "birthday" }> | null {
  if (!/\bbirthday\b|\bborn on\b|\bbday\b/i.test(s)) return null
  const year = /\b(19\d\d|20\d\d)\b/.exec(s)?.[1]
  const iso = dayIn(s.replace(/\b(19\d\d|20\d\d)\b/, ""), now, "future")
  if (!iso) return null
  return { kind: "birthday", date: year ? `${year}${iso.slice(4)}` : iso, quote: s }
}

function readSeen(s: string, subject: Subject, now: Date): Extract<GraphRead, { kind: "seen" }> | null {
  const first = firstOf(subject.name)
  const who = `(?:${PRONOUN}|${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`
  const re = new RegExp(`\\b(?:saw|seen|visited|ran into|hung out with|met up with|caught up with|spent [\\w\\s]+ with|had (?:lunch|dinner|coffee|drinks|breakfast) with)\\s+${who}\\b|\\b${who}\\s+(?:came over|visited|stopped by)\\b`, "i")
  if (!re.test(s)) return null
  const date = dayIn(s, now, "past")
  return { kind: "seen", date: date ?? isoOf(now), dateSaid: !!date, text: s, quote: s }
}

const TO_VERBS = /^(?:send|give|mail|email|show|bring|return|lend|pay|forward|ship)\b/i

function readTodo(s: string, subject: Subject, name = true): Extract<GraphRead, { kind: "todo" }> | null {
  const first = firstOf(subject.name)
  const m =
    /\b(?:wants|asked|needs|told|reminded|begged|expects)\s+me\s+to\s+(.+)$/i.exec(s) ??
    /\bi\s+(?:need|have|gotta|got to|should|must|want|promised)\s+to\s+(.+)$/i.exec(s) ??
    /\b(?:don'?t forget|remember)\s+to\s+(.+)$/i.exec(s)
  if (!m) return null
  const urgent = /\b(?:asap|right now|today|tonight|immediately|urgent(?:ly)?|now)\b|!{2,}/i.test(s)
  let what = trimEnd(m[1].replace(/\b(?:asap|right now|immediately|urgent(?:ly)?)\b/gi, " ").replace(/!+/g, " ").replace(/\s+/g, " "))
  if (!what || what.split(" ").length > 16) return null
  const named = new RegExp(`\\b(?:${PRONOUN})\\b`, "i")
  if (!name) {
    // A project's own step: "it" is the project, and its name is not added.
  } else if (named.test(what)) what = what.replace(new RegExp(`\\b(?:${PRONOUN})\\b`, "i"), first)
  else if (!what.toLowerCase().includes(first.toLowerCase())) what = TO_VERBS.test(what) ? `${what} to ${first}` : `${what} (${first})`
  return { kind: "todo", title: cap(what), urgent, quote: s }
}

/** "Thinking about moving it to spring", "not sure whether to invite her": weighed, not decided. */
function readConsider(s: string, subject: Subject): Extract<GraphRead, { kind: "consider" }> | null {
  if (!/\b(?:considering|thinking about|thinking of|not sure (?:whether|if|about)|wondering (?:whether|if)|maybe (?:i|we) should|might|torn between|on the fence|worried (?:about|that)|debating|weighing|undecided)\b/i.test(s)) return null
  const first = firstOf(subject.name)
  return { kind: "consider", text: cap(trimEnd(s.replace(new RegExp(`^(?:${PRONOUN})\\b`, "i"), first))), quote: s }
}

/** A plan said about a project: "next I need to book the venue", "the plan is to ship it in March". */
function readStep(s: string, subject: Subject): Extract<GraphRead, { kind: "step" }> | null {
  const todo = readTodo(s, subject, false)
  const m = /\b(?:next step is(?: to)?|next is to|next,? (?:i'?ll|we'?ll)|the plan is to|plan is to|then (?:i'?ll|we'?ll)|i'?ll|i will|we'?ll|we will|going to|gonna)\s+(.+)$/i.exec(s)
  const what = todo?.title ?? (m ? cap(trimEnd(m[1].replace(/\b(?:asap|right now|immediately)\b/gi, " ").replace(/\s+/g, " "))) : "")
  if (!what || what.split(" ").length > 16) return null
  return { kind: "step", title: what, urgent: todo?.urgent ?? /\b(?:asap|today|tonight|right now)\b/i.test(s), quote: s }
}

/** "She is my aunt", "Linda is my boyfriend's mother" — how they are to you. */
function readRelationToMe(s: string): Extract<GraphRead, { kind: "relation" }> | null {
  const m = /\b(?:is|was)\s+my\s+((?:[a-z]+['’]s\s+)?(?:(?:best|old|new|close|childhood)\s+)?(?:[a-z]+(?:\s+friend)?))\b/i.exec(s)
  if (!m) return null
  const word = m[1].toLowerCase()
  // "my boyfriend Elijah's mother" is kin, not "my boyfriend".
  if (/['’]s\s+\S/.test(s.slice(m.index + m[0].length, m.index + m[0].length + 40)) && !/['’]s/.test(word)) return null
  const plain = relationWord(word)
  return { kind: "relation", word, ...(plain ? { relation: plain.personRelation } : {}), quote: s }
}

/** A stable thing about them: "she is a former social worker", "works at the hospital", "loves gardening". */
function readFact(s: string, subject: Subject): Extract<GraphRead, { kind: "fact" }> | null {
  const first = firstOf(subject.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const lead = new RegExp(`^(?:(?:${PRONOUN}|${first}(?:\\s+[\\p{L}-]+){0,3}|it)\\s+)(?:is|was|are|were|'s|works|worked|work|used to|has|had|likes|loves|hates|grew up|studied|went to|teaches|runs|owns|plays|speaks|lives with|drives|can't|cannot|doesn't|does not|never|always)\\b`, "iu")
  if (!lead.test(s)) return null
  // "She"/"he" first reads as the subject's name, so the fact stands alone on their page. "They" stays: it may be a group.
  const text = trimEnd(s.replace(/^(?:she|he)\b/i, firstOf(subject.name)))
  return { kind: "fact", text: cap(text), quote: s }
}

/**
 * Every read in the words, in order. A sentence gives its specific reads (place, kin, contact, birthday,
 * seen, relation, then a consideration or else a to-do — a step on a project); a sentence that gives none and
 * states something stable about the subject is a fact.
 * People-only reads are skipped for an item that is not a person.
 */
export function readAbout(body: string, subject: Subject, people: readonly KnownPerson[], now: Date): { reads: GraphRead[]; sentences: string[]; unread: string[] } {
  const all = sentences(body)
  const reads: GraphRead[] = []
  const unread: string[] = []
  for (const s of all) {
    const here: GraphRead[] = []
    const push = (r: GraphRead | null) => r && here.push(r)
    if (subject.person) {
      const kin = readKin(s, subject, people)
      push(kin)
      if (!kin) push(readRelationToMe(s))
      push(readPlace(s))
      push(readContact(s))
      push(readBirthday(s, now))
      push(readSeen(s, subject, now))
    }
    const consider = readConsider(s, subject)
    push(consider)
    if (!consider) push(subject.project ? readStep(s, subject) : readTodo(s, subject))
    if (!here.length) push(readFact(s, subject))
    if (!here.length) unread.push(s)
    reads.push(...here)
  }
  return { reads, sentences: all, unread }
}
