/**
 * lib/passing-bimby/parse.ts — things said in passing that Tracking should know (pure, rules only)
 *
 * "my new playlist i spent a few hrs or whatever building this morning", "ive been working on brain2 for a few
 * hrs already", "Elijah gets home 2pm", "felt so tired", "was at the laundromat with Marilyn". None of these is a
 * command, so no lane files it. `readPassing` reads each one as a `PassingNote`: an activity (with how long and
 * when, when said), an event at a clock, a place, company, or a mood. It never guesses a block: a note keeps the
 * words and how sure they were, so a later reader (the Tracking BIMBY, the Day Log BIMBY, a person) can place it.
 * Plans ("going to", "need to", "gonna") are not activities; an event may be in the future.
 */

import { readAnchor } from "@/lib/before-bimby/parse"
import { parseClock, parseDuration } from "@/lib/ingest/bim-facts"
import { sentences } from "@/lib/thought-patterns/patterns"

export type PassingKind = "activity" | "event" | "place" | "company" | "mood"

export interface PassingNote {
  kind: PassingKind
  /** "music discovery/making playlists", "Elijah gets home", "the laundromat", "Marilyn", "tired". */
  what: string
  /** Minutes said for it. */
  minutes?: number
  /** The length or clock was hedged ("a few", "ish", "or whatever", "about"). */
  approx?: boolean
  /** "this morning", "last night", "until now" (said with "already"), "earlier". */
  when?: string
  /** Clock for an event, minutes past midnight. */
  atMin?: number
  /** People named with it. */
  with?: string[]
  /** The sentence it came from. */
  source: string
}

const HEDGE = /\b(?:ish|or whatever|or so|about|around|roughly|maybe|like|probably|prob|i think|it seems|approx(?:imately)?)\b|~|-ish/i
const FUTURE = /\b(?:gonna|going to|go to have|have to|need to|needs to|want to|wanna|will|i'?ll|should|plan(?:ning)? to|about to|tomorrow|later today|tonight i)\b/i
const DUR = String.raw`(?:(?:a\s+)?(?:few|couple(?:\s+of)?|several)|an?|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|forty-five|\d+(?:\.\d+)?)\s*(?:-|to|or)?\s*(?:\d+\s*)?(?:hours?|hrs?|h|minutes?|mins?|m)\b(?:\s+and\s+a\s+half)?`
const WHEN = /\b(this morning|this afternoon|this evening|last night|earlier(?: today)?|all day|all morning|all afternoon|all night|yesterday|already|so far|since (?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|lunch|breakfast))\b/i
const MOOD_WORDS =
  "tired|exhausted|sleepy|drained|wiped|happy|sad|down|anxious|nervous|stressed|calm|relaxed|proud|excited|overwhelmed|frustrated|annoyed|angry|bored|lonely|grateful|great|awful|good|bad|energized|productive|motivated|sick|hungover|focused|scattered|content|giddy|hopeful|depressed"
const MOOD = new RegExp(String.raw`\b(?:i'?m|im|i am|i was|i've been|ive been|been|feeling|feel|felt|so)\s+(?:so\s+|really\s+|kinda\s+|kind of\s+|a bit\s+|a little\s+|pretty\s+|very\s+|super\s+|extra\s+|hella\s+)*(${MOOD_WORDS})\b`, "i")
const NOT_A_NAME = new Set(["the", "a", "an", "it", "that", "this", "then", "now", "me", "him", "her", "them", "us", "you", "my", "some", "all", "what", "which", "whatever", "time", "ease", "music"])
const PRONOUN_SUBJ = /^(?:i|we|you|it|that|this|he|she|they|there|which|who|what)$/i

/** Minutes and hedge for a length: "a few hrs" is about 3 hours; "a couple hours" about 2; "45 min" exact. */
export function readLength(phrase: string): { minutes: number; approx: boolean } | null {
  const p = phrase.toLowerCase()
  const unitH = /\b(?:hours?|hrs?|h)\b/.test(p)
  const vague = /\b(?:few|several)\b/.test(p) ? 3 : /\bcouple\b/.test(p) ? 2 : 0
  if (vague) return { minutes: vague * (unitH ? 60 : 1), approx: true }
  const range = /(\d+)\s*(?:-|to|or)\s*(\d+)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/.exec(p)
  if (range) {
    const mid = (Number(range[1]) + Number(range[2])) / 2
    return { minutes: Math.round(mid * (/^h/.test(range[3]!) ? 60 : 1)), approx: true }
  }
  const ms = parseDuration(p.replace(/\bhrs?\b/g, "hours").replace(/\bmins?\b/g, "minutes"))
  return ms ? { minutes: Math.round(ms / 60_000), approx: false } : null
}

/** Clauses: a sentence, cut at "and then", "and now", ";" and brackets, so each part reads alone. */
function clauses(text: string): string[] {
  return sentences(text)
    .flatMap((s) => s.split(/\s*(?:;|\(|\)|\band then\b|\band now\b|\bthen\b|,\s*and\b|\.\s)\s*/i))
    .map((s) => s.trim())
    .filter((s) => /[a-z]/i.test(s))
}

function tidy(s: string): string {
  return s
    .replace(/\b(?:or whatever|or so|ish|already|this morning|this afternoon|this evening|last night|earlier(?: today)?|today|so far|it seems|i think|lol|idk)\b/gi, " ")
    .replace(/\b(?:my|the|some)\s+(?=$)/i, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?:;])/g, "$1")
    .replace(/[.,!?:;\s]+$/g, "")
    .trim()
}

function withPeople(clause: string): string[] {
  const out: string[] = []
  for (const m of clause.matchAll(/\bwith\s+(?:my\s+)?([A-Za-z][a-z'-]+(?:\s+(?:and|&)\s+[A-Za-z][a-z'-]+)*)/g)) {
    for (const n of m[1]!.split(/\s+(?:and|&)\s+/)) {
      if (!NOT_A_NAME.has(n.toLowerCase())) out.push(n[0]!.toUpperCase() + n.slice(1))
    }
  }
  return out
}

/** An activity said with how long, or with a past "spent". Plans are left out. */
function readActivity(clause: string, label: string | null): PassingNote | null {
  if (FUTURE.test(clause)) return null
  const durRe = new RegExp(DUR, "i")
  const dur = durRe.exec(clause)
  const len = dur ? readLength(dur[0]) : null
  const when = WHEN.exec(clause)?.[1]?.toLowerCase()
  let what: string | null = null

  // "i spent a few hrs building X", "spent the morning on X", "my playlist i spent a few hrs building".
  const spent = /\bspent\s+(.*?)\s+((?:[a-z]+ing)\b.*|on\s+.+)$/i.exec(clause)
  if (/\bspent\b/i.test(clause)) {
    const after = spent ? tidy(spent[2]!.replace(/^on\s+/i, "").split(/\s*[,;:]\s*/)[0]!) : ""
    const verb = /^([a-z]+ing)\b\s*(.*)$/i.exec(after)
    const before = /(?:^|\b(?:my|the|this|a|new|that)\s+)([a-z/'-]+(?:\s+[a-z/'-]+){0,2})\s+(?:that\s+|which\s+)?i\s+spent\b/i.exec(clause)
    if (verb && !verb[2] && before) what = `${verb[1]} ${before[1]!.split(/\s+/).pop()}`
    else if (after) what = after
    else if (before) what = before[1]!
  }
  // "ive been working on brain2 for a few hrs already", "was cleaning for 2 hours".
  if (!what && len) {
    const been = /(?:been|was|were)\s+([a-z]+ing\b.*?)\s+for\s+/i.exec(clause) ?? /(?:been|was|were)\s+([a-z]+ing\b.*?)(?:\s+(?:since|all|this)\b|$)/i.exec(clause)
    const past = /\b(?:i\s+|we\s+)?([a-z]{3,}ed\b(?:\s+(?!for\b)[a-z0-9/'-]+){0,4}?)\s+for\s+/i.exec(clause)
    const hit = been?.[1] ?? past?.[1]
    if (hit && !/^(?:need|want|plann|suppos|us)ed$/i.test(hit.split(/\s+/)[0]!)) what = tidy(hit)
  }
  if (!what) return null
  const name = label ?? what
  if (!name || name.length < 3) return null
  const people = withPeople(clause)
  return {
    kind: "activity",
    what: name,
    ...(len ? { minutes: len.minutes } : {}),
    ...(len && (len.approx || HEDGE.test(clause)) ? { approx: true } : {}),
    ...(when ? { when: when === "already" || when === "so far" ? "until now" : when } : {}),
    ...(people.length ? { with: people } : {}),
    source: clause,
  }
}

const EVENT_VERB = String.raw`(?:gets?|is getting|will get|comes?|is coming|will be|should be|arrives?|lands?|leaves?|wakes? up)\s*(?:home|back|here|in|over|up|out)?`
const CLOCK = String.raw`(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|noon|midnight)\s*(-?ish)?`
const EVENT_AT = new RegExp(String.raw`\b([A-Za-z][a-z'-]+)\s+(${EVENT_VERB})\s+(?:at\s+|around\s+|about\s+|by\s+|@\s*)?${CLOCK}(?![\d:])`, "i")

function eventLabel(subject: string, verb: string): string {
  const s = subject[0]!.toUpperCase() + subject.slice(1)
  const v = verb.toLowerCase().replace(/\s+/g, " ").trim()
  if (/land/.test(v)) return `${s} lands`
  if (/\b(?:home|back|here|in)\b|arriv/.test(v)) return `${s} gets home`
  if (/up|wake/.test(v)) return `${s} wakes up`
  if (/leave|out/.test(v)) return `${s} leaves`
  if (/over/.test(v)) return `${s} comes over`
  return `${s} ${v}`
}

function clockMin(said: string, now: Date): number | null {
  const bare = said.toLowerCase().replace(/-?ish$/, "").trim()
  // A bare hour 1–7 is the afternoon, as in the Before BIMBY ("before 2pmish when Elijah gets home").
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(bare)
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 7) return (Number(m[1]) + 12) * 60 + Number(m[2] ?? 0)
  const at = parseClock(bare, new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0))
  return at ? at.getHours() * 60 + at.getMinutes() : null
}

/** "Elijah gets home 2pm", "before 2pmish when Elijah gets home", "mom lands at 6:30". */
function readEvent(clause: string, now: Date): PassingNote | null {
  const direct = EVENT_AT.exec(clause)
  if (direct && !PRONOUN_SUBJ.test(direct[1]!) && !NOT_A_NAME.has(direct[1]!.toLowerCase())) {
    const at = clockMin(direct[3]!, now)
    if (at != null) return { kind: "event", what: eventLabel(direct[1]!, direct[2]!), atMin: at, ...(direct[4] || HEDGE.test(clause) ? { approx: true } : {}), source: clause }
  }
  const anchor = readAnchor(clause)
  if (anchor?.clock) {
    const at = clockMin(anchor.clock, now)
    if (at != null) return { kind: "event", what: anchor.anchor.label, atMin: at, ...(/ish/i.test(clause) || HEDGE.test(clause) ? { approx: true } : {}), source: clause }
  }
  return null
}

const PLACE_RE = /\b(?:i'?m|im|i am|i was|was|we were|been|went|got|stopped|ended up)\s+(?:at|to|by)\s+((?:the|a|an|my|[a-z]+'s)\s+)?([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){0,2})/i
const PLACE_STOP = /^(?:bed|sleep|work on|it|that|this|do|be|have|get|make|see|the point|home to)$/i

/** "was at the laundromat", "went to Marilyn's", "im at the gym". Not "going to". */
function readPlace(clause: string): PassingNote | null {
  if (FUTURE.test(clause)) return null
  const m = PLACE_RE.exec(clause)
  if (!m) return null
  const head = tidy(m[2]!.replace(/\s+(?:with|for|and|to|since|until|from|all|this|so)\b.*$/i, ""))
  if (!head || PLACE_STOP.test(head)) return null
  const what = `${m[1] ?? ""}${head}`.trim()
  const people = withPeople(clause)
  return { kind: "place", what, ...(people.length ? { with: people } : {}), source: clause }
}

/** "hung out with Marilyn", "Marilyn came over", "saw Marilyn". */
function readCompany(clause: string): PassingNote | null {
  if (FUTURE.test(clause)) return null
  const hung = /\b(?:hung out|hanging out|chilled|chilling|had (?:lunch|dinner|breakfast|coffee|drinks)|talked|caught up|watched [a-z ]+?)\s+with\s+/i.test(clause)
  const people = hung ? withPeople(clause) : []
  const came = /\b([A-Z][a-z'-]+)\s+(?:came|stopped|swung)\s+(?:over|by)\b/.exec(clause)
  const saw = /\b(?:saw|visited|met up with|met)\s+([A-Z][a-z'-]+)\b/.exec(clause)
  for (const m of [came, saw]) if (m && !NOT_A_NAME.has(m[1]!.toLowerCase())) people.push(m[1]!)
  if (!people.length) return null
  return { kind: "company", what: [...new Set(people)].join(", "), with: [...new Set(people)], source: clause }
}

function readMood(clause: string): PassingNote | null {
  const m = MOOD.exec(clause)
  if (!m || /\b(?:not|never|n't)\s+(?:\w+\s+)?$/i.test(clause.slice(0, m.index + m[0].length - m[1]!.length))) return null
  // "good" and "bad" alone are often about a thing, not the person: only after "feel".
  if (/^(?:good|bad|great)$/i.test(m[1]!) && !/\bfe(?:el|lt|eling)\b/i.test(m[0])) return null
  return { kind: "mood", what: m[1]!.toLowerCase(), source: clause }
}

/** A name said for "that time": "id label the activity of that time 'music discovery/making playlists'". */
function readLabel(text: string): { label: string; index: number } | null {
  const m = /\b(?:label|call|name|tag)\b[^'"‘“]{0,40}['"‘“]([^'"’”]{3,60})['"’”]/i.exec(text)
  return m ? { label: m[1]!.trim(), index: m.index } : null
}

/** Every note one message carries, in the order said, once each. */
export function readPassing(text: string, now: Date): PassingNote[] {
  const out: PassingNote[] = []
  const label = readLabel(text)
  const parts = clauses(text)
  let labelUsed = false
  for (const clause of parts) {
    if (label && clause.includes(label.label)) continue
    // The label names the activity said just before it ("… building this morning (… id label …)").
    const nextHasLabel = !!label && !labelUsed && text.indexOf(clause) < label.index && text.indexOf(clause) + clause.length + 160 > label.index
    const act = readActivity(clause, null)
    if (act) {
      if (nextHasLabel) {
        act.what = label!.label
        labelUsed = true
      }
      out.push(act)
    }
    for (const note of [readEvent(clause, now), act ? null : readPlace(clause), readCompany(clause), readMood(clause)]) {
      if (note) out.push(note)
    }
  }
  const seen = new Set<string>()
  return out.filter((n) => {
    const key = `${n.kind}:${n.what.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function clockText(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  const h12 = h % 12 || 12
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`
}

function lengthText(min: number): string {
  if (min < 60) return `${min} min`
  const h = min / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`
}

/** One line a person reads and a later reader parses: `activity: building playlists, about 3 h, this morning`. */
export function noteText(n: PassingNote): string {
  const bits = [n.what]
  if (n.minutes) bits.push(`${n.approx ? "about " : ""}${lengthText(n.minutes)}`)
  if (n.atMin != null) bits.push(`${n.approx ? "about " : ""}${clockText(n.atMin)}`)
  if (n.when) bits.push(n.when)
  if (n.with?.length && n.kind !== "company") bits.push(`with ${n.with.join(", ")}`)
  return `${n.kind}: ${bits.join(", ")}`
}
