/**
 * lib/social-bimby/parse.ts — Read a social message: who, their Instagram, how you feel, what to do next
 *
 * Rules, no model. A line is social when it names a person (one already in People I Know, or a capitalized
 * name after a cue like "friend", "met", "dmd", "with") and says something social about them: a DM, a
 * hang-out, an invite, a birthday, a friendship. "serious potential new friend Masha, dmd her yesterday
 * (loureedstrash) asking her to hang out … I need to hang out with her as soon as I get back" reads as:
 * person Masha, Instagram `loureedstrash`, relation "serious potential new friend", a hang-out wanted after
 * the trip to New York, and one invite (Friday) she can't go to.
 *
 * Pure. Known people are passed in, so the reader never touches a store.
 */

export interface KnownPerson {
  id: string
  name: string
  instagram?: string
  nicknames?: string[]
}

export type HangWhen =
  | { kind: "after-trip"; phrase: string }
  | { kind: "next-week"; phrase: string }
  | { kind: "weekend"; phrase: string }
  | { kind: "weekday"; day: number; phrase: string }
  | { kind: "soon"; phrase: string }

export interface SocialEvent {
  what: string
  /** 0 Sunday … 6 Saturday, when a weekday was named. */
  day?: number
  going: boolean
  phrase: string
}

export interface SocialRead {
  name: string
  known?: KnownPerson
  instagram?: string
  relation?: string
  hangOut?: HangWhen
  trip?: string
  birthday?: { month: number; day: number; year?: number; phrase: string }
  events: SocialEvent[]
  /** Warm words said about them ("so sweet", "excited to be friends"). */
  feelings: string[]
  /** Why the line read as social, in order. */
  cues: string[]
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]

/** Capitalized words that are never a person's name here. */
const NOT_NAMES = new Set([
  "i", "im", "i'm", "a", "an", "the", "and", "but", "so", "she", "he", "they", "her", "him", "them", "we", "it", "my", "me",
  "today", "tomorrow", "yesterday", "tonight", "instagram", "insta", "ig", "dm", "dms", "new", "york", "la", "nyc", "sf",
  "bim", "bimby", "social", "friend", "friends", "serious", "potential", "also", "then", "just", "really", "oh", "ok", "okay",
  ...WEEKDAYS, ...MONTHS, ...MONTHS.map((m) => m.slice(0, 3)),
])

const CUE_BEFORE_NAME =
  /\b(?:friend|friends\s+with|girl|guy|person|named|called|met|meeting|dm'?d|dmed|dm|messaged|texted|called|with|invited\s+by|crush|coworker|co-worker|neighbou?r|roommate|date|hang(?:ing)?\s+out\s+with|see|saw|seeing)\s+([A-Z][a-z'’]+(?:\s+[A-Z][a-z'’]+)?)/g
const NAME_POSSESSIVE = /\b([A-Z][a-z]+)['’]s\s+(?:birthday|bday|party|show|thing|place|house|apartment|wedding)\b/g
const NAME_THEN_HANDLE = /\b([A-Z][a-z]+)\s*\((@?[A-Za-z0-9._]{2,30})\)/

/** Said about a person: makes the line social and not a task or a status report. */
const SOCIAL_CUES: [RegExp, string][] = [
  [/\bfriend(?:s|ship)?\b/i, "friendship"],
  [/\bdm['’]?d\b|\bdmed\b|\bdm(?:s)?\b|\bmessaged\b|\btexted\b|\bslid into\b/i, "a message"],
  [/\bhang(?:ing)?\s*out\b|\bhangout\b|\bcatch\s+up\b|\bget\s+(?:coffee|drinks|dinner|lunch)\b|\bmeet\s+up\b/i, "a hang-out"],
  [/\binvit(?:ed|e|ing)\b/i, "an invite"],
  [/\b(?:birthday|bday)\b/i, "a birthday"],
  [/\binstagram\b|\binsta\b|\big\b/i, "Instagram"],
  [/\bmet\b/i, "meeting someone"],
]

const RELATION_WORDS = "(?:serious|potential|possible|new|close|best|old|good|future|real)"
const RELATION_NOUNS = "(?:friend|crush|coworker|co-worker|neighbou?r|roommate|date|bestie)"

function isName(word: string): boolean {
  const w = word.trim()
  if (w.length < 2) return false
  return w.split(/\s+/).every((part) => !NOT_NAMES.has(part.toLowerCase().replace(/['’]s$/, "")))
}

function cleanName(raw: string): string {
  return raw.replace(/['’]s$/, "").trim()
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** A known person named in the text, by name, first name, nickname, or Instagram handle. Longest name wins. */
function findKnown(text: string, people: readonly KnownPerson[]): KnownPerson | undefined {
  let best: { p: KnownPerson; len: number } | undefined
  for (const p of people) {
    const handles = p.instagram ? [p.instagram] : []
    const names = [p.name, ...(p.nicknames ?? [])].map((n) => n.trim()).filter((n) => n.length >= 3)
    const first = p.name.trim().split(/\s+/)[0]
    if (first && first.length >= 3 && first !== p.name.trim()) names.push(first)
    for (const n of names) {
      if (!isName(n)) continue
      // Case matters for a name ("Rose" the friend, not "rose" the flower).
      if (new RegExp(`(^|[^A-Za-z])${escape(n)}(?![A-Za-z])`).test(text) && (!best || n.length > best.len)) best = { p, len: n.length }
    }
    for (const h of handles) {
      if (new RegExp(`(^|[^A-Za-z0-9._])@?${escape(h)}(?![A-Za-z0-9._])`, "i").test(text) && (!best || h.length > best.len)) best = { p, len: h.length }
    }
  }
  return best?.p
}

function newName(text: string): string | undefined {
  const tries: string[] = []
  const handle = NAME_THEN_HANDLE.exec(text)
  if (handle) tries.push(handle[1]!)
  const rel = new RegExp(`\\b${RELATION_WORDS}?\\s*${RELATION_NOUNS}\\s+([A-Z][a-z'’]+)`, "g")
  for (const m of text.matchAll(rel)) tries.push(m[1]!)
  for (const m of text.matchAll(CUE_BEFORE_NAME)) tries.push(m[1]!)
  for (const m of text.matchAll(NAME_POSSESSIVE)) tries.push(m[1]!)
  for (const raw of tries) {
    // "Masha Ivanova" stays whole; "Masha Friday" loses the weekday.
    const parts = cleanName(raw).split(/\s+/).filter((p) => isName(p))
    if (parts.length) return parts.join(" ")
  }
  return undefined
}

function handleIn(text: string, name: string): string | undefined {
  const after = new RegExp(`${escape(name)}\\s*\\((@?[A-Za-z0-9._]{2,30})\\)`).exec(text)
  if (after) return after[1]!.replace(/^@/, "")
  const said = /\b(?:instagram|insta|ig)(?:\s+(?:is|handle|name|account))?\s*[:\-]?\s*@?([A-Za-z0-9._]{2,30})/i.exec(text)
  if (said && !NOT_NAMES.has(said[1]!.toLowerCase())) return said[1]!
  const at = /(?:^|\s)@([A-Za-z0-9._]{2,30})/.exec(text)
  if (at) return at[1]!
  // A lone handle in parentheses, when the line is about a message or Instagram.
  if (/\bdm|\binsta|\big\b|\bmessaged\b/i.test(text)) {
    for (const m of text.matchAll(/\((@?[A-Za-z0-9._]{3,30})\)/g)) {
      const h = m[1]!.replace(/^@/, "")
      if (!NOT_NAMES.has(h.toLowerCase()) && !/^\d+$/.test(h)) return h
    }
  }
  return undefined
}

function relationIn(text: string, name: string): string | undefined {
  const m = new RegExp(`\\b((?:${RELATION_WORDS}\\s+)*${RELATION_NOUNS})\\s+${escape(name.split(/\s+/)[0]!)}`, "i").exec(text)
  if (m) return m[1]!.toLowerCase()
  const is = new RegExp(`${escape(name.split(/\s+/)[0]!)}\\s+is\\s+(?:a|an|my)\\s+((?:${RELATION_WORDS}\\s+)*${RELATION_NOUNS})`, "i").exec(text)
  return is ? is[1]!.toLowerCase() : undefined
}

const WANT = "(?:need|want|wanna|have|gotta|got|should|must|going|plan|planning|hope|hoping|would\\s+love|remind\\s+me)\\s+to"
const HANG = "(?:hang\\s*out|see|get\\s+(?:coffee|drinks|dinner|lunch|a\\s+drink)|meet\\s+up|catch\\s+up|spend\\s+time)"

function hangIn(text: string): HangWhen | undefined {
  const m = new RegExp(`\\b(?:${WANT}|let['’]?s|lets)\\s+${HANG}\\b([^.!?\\n]*)`, "i").exec(text)
  if (!m) return undefined
  const tail = m[1]!.trim()
  const phrase = m[0]!.trim()
  if (/\b(?:get|i['’]?m|am|come|coming|i\s+get)\s+back\b|\breturn\b|\bafter\s+(?:the\s+|my\s+)?trip\b|\bwhen\s+i['’]?m\s+home\b/i.test(tail)) return { kind: "after-trip", phrase }
  if (/\bnext\s+week\b/i.test(tail)) return { kind: "next-week", phrase }
  if (/\b(?:this\s+)?weekend\b/i.test(tail)) return { kind: "weekend", phrase }
  const day = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}\\b`, "i").test(tail))
  if (day >= 0) return { kind: "weekday", day, phrase }
  return { kind: "soon", phrase }
}

function tripIn(text: string): string | undefined {
  const m = /\b(?:going|flying|heading|leaving|traveling|travelling|off)\s+to\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})/.exec(text)
  return m ? m[1]! : undefined
}

function birthdayIn(text: string): SocialRead["birthday"] {
  const m = /\b(?:birthday|bday)\s+(?:is\s+)?(?:on\s+)?(?:(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?|([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?|(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]+)(?:,?\s+(\d{4}))?)/i.exec(text)
  if (!m) return undefined
  let month = -1
  let day = -1
  let year: number | undefined
  if (m[1]) {
    month = Number(m[1]) - 1
    day = Number(m[2])
    if (m[3]) year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  } else if (m[4]) {
    month = MONTHS.findIndex((x) => x.startsWith(m[4]!.toLowerCase().slice(0, 3)))
    day = Number(m[5])
    if (m[6]) year = Number(m[6])
  } else if (m[7]) {
    month = MONTHS.findIndex((x) => x.startsWith(m[8]!.toLowerCase().slice(0, 3)))
    day = Number(m[7])
    if (m[9]) year = Number(m[9])
  }
  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined
  return { month: month + 1, day, ...(year ? { year } : {}), phrase: m[0]! }
}

function eventsIn(text: string): SocialEvent[] {
  const out: SocialEvent[] = []
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const m = /\binvit(?:ed|es)\s+(?:me|us)\s+to\s+([^,.!?]+)/i.exec(sentence) ?? /\b(?:going|go)\s+to\s+(?:her|his|their|[A-Z][a-z]+['’]s)\s+([^,.!?]+)/.exec(sentence)
    if (!m) continue
    const what = m[1]!.replace(/\s+on\s+\w+day\b.*$/i, "").trim()
    const day = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}\\b`, "i").test(sentence))
    const going = !/\b(?:can['’]?t|cannot|can\s+not|won['’]?t|not\s+going|unable|miss(?:ing)?|couldn['’]?t)\b/i.test(sentence)
    out.push({ what, ...(day >= 0 ? { day } : {}), going, phrase: m[0]!.trim() })
  }
  return out
}

function feelingsIn(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/\b(?:was|is|seems|seemed|so|really)\s+(?:so\s+|really\s+|super\s+)?(sweet|kind|nice|lovely|cool|fun|funny|warm|excited[^,.!?]*|awesome|great|amazing)\b/gi)) {
    const word = m[0]!.replace(/^(?:was|is|seems|seemed)\s+/i, "").trim().toLowerCase()
    if (!out.includes(word)) out.push(word)
  }
  return out
}

/**
 * The social reading of a line, or null when it is not about a person. `forced` (the line was handed to the
 * Social BIMBY by name) needs only a person; otherwise a social cue is needed too.
 */
export function readSocial(text: string, people: readonly KnownPerson[] = [], opts: { forced?: boolean } = {}): SocialRead | null {
  const t = text.trim()
  if (!t || t.length > 1500) return null
  // A question is for the ask lanes ("when did I last see Masha?").
  if (!opts.forced && /^\s*(?:when|what|who|how|did|do|does|is|are|have|has|where|why)\b[^.!]*\?\s*$/i.test(t)) return null
  const cues = SOCIAL_CUES.filter(([re]) => re.test(t)).map(([, why]) => why)
  if (!opts.forced && cues.length === 0) return null

  const known = findKnown(t, people)
  const name = known?.name ?? newName(t)
  if (!name) return null

  const instagram = handleIn(t, known ? known.name : name)
  const hangOut = hangIn(t)
  const birthday = cues.includes("a birthday") ? birthdayIn(t) : undefined
  const events = eventsIn(t)
  // Without a hang-out, an invite, a birthday or a new handle, "friend" alone is too thin ("my friend said …").
  if (!opts.forced && !hangOut && !birthday && !events.length && !instagram && !(cues.includes("friendship") && cues.length > 1) && !relationIn(t, name)) return null

  return {
    name,
    ...(known ? { known } : {}),
    ...(instagram ? { instagram } : {}),
    ...(relationIn(t, name) ? { relation: relationIn(t, name)! } : {}),
    ...(hangOut ? { hangOut } : {}),
    ...(tripIn(t) ? { trip: tripIn(t)! } : {}),
    ...(birthday ? { birthday } : {}),
    events,
    feelings: feelingsIn(t),
    cues,
  }
}
