/**
 * lib/before-bimby/parse.ts — "Before Elijah gets home": the event, the things to do before it, and the asks (pure)
 *
 * A deadline is often an event, not a clock: "what I absolutely need to do before Elijah gets back: clean the
 * house amap, shower and get ready (45 minutes)". The event is an `Anchor` ("Elijah gets home", key
 * `elijah:home`). `readFiling` reads a line that lists things to do before one; `readAnchorClock` reads the
 * clock said for it ("before 2pmish when Elijah gets home"); `readBeforeAsk` reads "what do I have to do before
 * Elijah gets home" and "how many minutes until Elijah gets back", with or without a "?". Nothing here reads a store.
 */

import { parseClock, parseDuration } from "@/lib/ingest/bim-facts"
import { sentences } from "@/lib/thought-patterns/patterns"

export interface Anchor {
  /** `elijah:home`: the subject and what it does, for matching across wordings ("gets back", "comes home"). */
  key: string
  /** "Elijah gets home", for replies and task notes. */
  label: string
}

export interface BeforeItem {
  /** Sentence case, as it reads on a To Do. */
  title: string
  /** Minutes said with it: "(45 minutes)". */
  minutes?: number
  /** False for "best case", "if time", "maybe". */
  required: boolean
  /** "amap", "asap", "!!!". */
  urgent: boolean
  /** The sentence it came from, when read out of a longer message (`readMentions`). */
  source?: string
}

export interface BeforeFiling {
  anchor: Anchor
  items: BeforeItem[]
  /** The anchor's clock when the same words name it, ms. */
  by?: number
}

export interface BeforeAsk {
  anchor: Anchor
  /** "what do I have to do before …", "what's left before …". */
  list: boolean
  /** "how many minutes until …", "how long until …", "when does … get home". */
  time: boolean
}

/** Verbs of the event, folded to what it means. */
const EVENT = String.raw`(?:gets?|getting|comes?|coming|is|'s|will be|will get|arrives?|wakes?|leaves?|goes?)\s*(?:home|back|here|in|over|up|out|off)?\b|(?:arrives?|wakes up|leaves|lands)\b`
const SUBJ = String.raw`(?!(?:the|a|an|it|that|this|then|now|today|tonight|tomorrow|i|we|you)\b)[a-z][a-z'.-]*(?:\s(?!(?:gets?|getting|comes?|coming|is|will|arrives?|wakes?|leaves?|goes?|lands)\b)[a-z][a-z'.-]*)?`
const CLOCK = String.raw`\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|noon`
const ANCHOR_RE = new RegExp(String.raw`\b(?:before|until|till|til|'?til|by the time|for when)\s+(?:(${CLOCK})\s*(?:ish|-?ish)?\s*(?:,\s*)?(?:when|which is when|that's when)\s+)?(${SUBJ})\s+(${EVENT})`, "i")

function foldEvent(verb: string): string {
  const v = verb.toLowerCase()
  if (/\b(?:home|back|here|in|arriv|land)/.test(v)) return "home"
  if (/\bup\b|wake/.test(v)) return "up"
  if (/\bleave|\bout\b|\boff\b|goes|go\b/.test(v)) return "leaves"
  if (/\bover\b/.test(v)) return "over"
  return "home"
}

const LABEL_VERB: Record<string, string> = { home: "gets home", up: "wakes up", leaves: "leaves", over: "comes over" }

const titleWord = (w: string) => w.replace(/\b[a-z]/g, (c) => c.toUpperCase())

/** The first event a line names after "before" / "until", and the clock beside it when one is said. */
export function readAnchor(text: string): { anchor: Anchor; clock?: string; index: number; end: number } | null {
  const m = ANCHOR_RE.exec(text)
  if (!m) return null
  const subject = m[2]!.trim().toLowerCase().replace(/['’]s$/, "")
  const kind = foldEvent(m[3]!)
  return {
    anchor: { key: `${subject}:${kind}`, label: `${titleWord(subject)} ${LABEL_VERB[kind]}` },
    ...(m[1] ? { clock: m[1].trim() } : {}),
    index: m.index,
    end: m.index + m[0].length,
  }
}

/**
 * The clock a line gives the event `key`, as ms today: "before 2pmish when Elijah gets home",
 * "Elijah gets home at 2", "elijah will be back around 1:30pm". Null when the line gives none.
 */
export function readAnchorClock(text: string, key: string, now: Date): number | null {
  const [subject, kind] = key.split(":")
  const t = text.toLowerCase()
  const hit = readAnchor(t)
  if (hit?.anchor.key === key && hit.clock) return clockMs(hit.clock, now)
  const esc = subject!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const said = new RegExp(String.raw`\b${esc}\s+(?:${EVENT})\s*(?:today\s+)?(?:at|around|by|about|~)\s*(${CLOCK})\s*(?:ish)?`, "i").exec(t)
  if (said && foldEvent(said[0].slice(subject!.length)) === kind) return clockMs(said[1]!, now)
  return null
}

function clockMs(clock: string, now: Date): number | null {
  const c = clock.replace(/\./g, "").trim()
  // A bare hour from someone coming home in the day: "2" is 2pm, not 2am.
  const bare = /^(\d{1,2})(?::(\d{2}))?$/.exec(c)
  if (bare) {
    const h = Number(bare[1])
    if (h >= 1 && h <= 11) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h < 7 ? h + 12 : h, Number(bare[2] ?? 0))
      return d.getTime()
    }
  }
  const at = parseClock(`today at ${c}`, now)
  return at ? at.getTime() : null
}

const LIST_LEAD = /^(?:(?:so|ok(?:ay)?|and|but|also|anyway)[,\s]+)*(?:what|things|stuff|everything|all|the stuff|the things|list of (?:things|stuff))?\s*(?:that\s+)?(?:i|we)?\s*(?:(?:absolutely|really|still|def(?:initely)?|super|seriously|for sure|literally|have)\s+)*(?:need(?:s)?|have|has|gotta|got|must|to)\s*(?:to\s+)?(?:do|get done|finish|accomplish)?\s*$/i
const STEP_LEAD = /^(?:(?:so|ok(?:ay)?|and|but|also|anyway|now)[,\s]+)*(?:i'?m\s+)?(?:i\s+)?(?:(?:absolutely|really|still|def(?:initely)?|super|seriously|literally)\s+)*(?:going to have to|gonna have to|gonna need to|have to|has to|need to|needa|gotta|got to|must)\s+(.+)$/i
const MINIMUM = /^(?:the\s+)?(?:bare\s+)?(?:minimum|at (?:the )?(?:very )?least|must(?:\s+do)?s?|required|priorit(?:y|ies)|non[-\s]?negotiables?)\s*(?:is|are|would be)?\s*[:\-–—]\s*(.+)$/i
const OPTIONAL = /^(?:(?:the\s+)?best case|if (?:i have |there'?s )?time|ideally|would be nice|bonus|extra|nice to have|maybe)\b[\s,:\-–—]*(?:(?:is|would be|maybe|i|just|could|can|will)\s+)*(.+)$/i
const URGENT = /\b(?:amap|asap|a\.s\.a\.p|right away|immediately|first)\b|!{2,}/i
const HEDGE = /\b(?:maybe|if (?:i have )?time|best case|ideally|if possible)\b/i
const FILLER = /\b(?:and other stuff|other stuff|and stuff|stuff like that|etc\.?|idk|lol|or whatever|whatever)\b/gi
const QUESTION_START = /^(?:(?:so|and|ok(?:ay)?)[,\s]+)?(?:what(?:'s|s| is| are)?|how|when|which|do i|did i|is there|are there|anything)\b/i
const ASKING = /^(?:(?:so|and|ok(?:ay)?)[,\s]+)?(?:what(?:'s|s| is| are)?\s+(?:do|does|else|left|still|remaining|on)|what\s+(?:do|did|should|must|have)\s+i|how|when|which|do i|did i|is there|are there|anything)\b/i

const sentenceCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** "clean the house amap", "shower and get ready (45 minutes)" → items, in order. */
export function readItems(list: string, required = true): BeforeItem[] {
  const out: BeforeItem[] = []
  for (const raw of list.split(/\s*[,;]\s*|\s+(?:and then|then|also|plus)\s+|\s*\/\s*(?=[a-z])|\.\s+/i)) {
    let part = raw.trim()
    if (!part) continue
    let minutes: number | undefined
    const paren = /\(([^)]*)\)/.exec(part)
    if (paren) {
      const ms = parseDuration(paren[1]!)
      if (ms) minutes = Math.round(ms / 60_000)
      part = part.replace(paren[0], " ")
    } else {
      const tail = /\s+(?:for|takes?|~)?\s*(\d+\s*(?:min(?:ute)?s?|hours?|hrs?|h|m))\s*$/i.exec(part)
      const ms = tail ? parseDuration(tail[1]!) : null
      if (tail && ms) {
        minutes = Math.round(ms / 60_000)
        part = part.slice(0, tail.index)
      }
    }
    const urgent = URGENT.test(part)
    const hedged = HEDGE.test(part)
    part = part
      .replace(URGENT, " ")
      .replace(FILLER, " ")
      .replace(/^(?:(?:and|or|but|so|then|to|maybe|just|i|i'?ll|probably|def(?:initely)?)\s+)+/i, "")
      .replace(/[!.\s]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
    if (part.length < 3 || part.split(" ").length > 12) continue
    if (/^(?:and|or|it|that|this|everything|all)$/i.test(part)) continue
    out.push({ title: sentenceCase(part), ...(minutes ? { minutes } : {}), required: required && !hedged, urgent })
  }
  return out
}

/** A question about the event, or null. Works with no "?". */
export function readBeforeAsk(text: string): BeforeAsk | null {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length > 300) return null
  const hit = readAnchor(t)
  if (!hit) return null
  const head = t.slice(0, hit.index)
  const time = /\bhow (?:many|much)\s+(?:minutes|mins|hours|hrs|time)\b|\bhow long\b|\bwhen (?:does|is|will)\b|\bwhat time\b/i.test(t)
  const list =
    /\bwhat(?:'s|s| is)?\s+(?:do|does|else|left|still|remaining|on my (?:list|plate))\b|\bwhat\s+(?:do|should|must)\s+(?:i|we)\b|\bwhat\s+(?:i|we)\s+(?:still\s+)?(?:have|need|gotta)\s+to\s+do\s*\??$|\b(?:to ?do|todo|need to do|have to do|left to do|get done)\b.*\?$|\bwhat do i have to do in\b|\bwhat (?:do i )?(?:have|need) to do\b/i.test(t) &&
    (ASKING.test(t) || /\?\s*$/.test(t) || /\band what\b/i.test(t))
  // A line that lists the things after the event is a filing, not a question.
  const after = t.slice(hit.end)
  if (/^\s*(?:is|are)?\s*[:\-–—]\s*\S/.test(after) && !/\?\s*$/.test(t)) return null
  if (!time && !list) return null
  if (!QUESTION_START.test(t) && !/\?/.test(t) && !/\band what\b/i.test(head + after)) return null
  return { anchor: hit.anchor, list: list || !time ? true : list, time }
}

/**
 * A line that says what has to be done before the event, or null.
 * - "what I absolutely need to do before Elijah gets back: clean the house amap, shower and get ready (45 minutes)"
 * - "before elijah gets home I need to change the sheets and put clothes away"
 * - "need to clean the house before elijah gets home"
 */
export function readFiling(text: string, now: Date): BeforeFiling | null {
  const t = text.replace(/\s+/g, " ").trim()
  if (!t || t.length > 400) return null
  const hit = readAnchor(t)
  if (!hit) return null
  const by = hit.clock ? clockMs(hit.clock, now) ?? undefined : undefined
  const head = t.slice(0, hit.index).trim()
  const after = t.slice(hit.end).replace(/^\s*(?:today|tonight|at\s+\S+|around\s+\S+)?\s*/i, "").trim()
  const make = (items: BeforeItem[]): BeforeFiling | null => (items.length ? { anchor: hit.anchor, items, ...(by ? { by } : {}) } : null)
  // "what I need to do before X: a, b, c"
  const colon = /^(?:is|are)?\s*[:\-–—]\s*(.+)$/.exec(after)
  if (colon && (LIST_LEAD.test(head) || /\b(?:need|have|gotta|must|to do)\b/i.test(head))) {
    if (ASKING.test(head) && !/^(?:what|things|stuff)\s+(?:i|we)\b/i.test(head)) return null
    return make(readItems(colon[1]!))
  }
  // "before X, I need to a and b"
  if (!head || /^(?:and|so|but|ok(?:ay)?|also)?$/i.test(head)) {
    const step = STEP_LEAD.exec(after.replace(/^[,\s]+/, ""))
    if (step) return make(readItems(step[1]!.replace(/\s+and\s+(?=[a-z]+\b)/gi, ", ")))
    return null
  }
  // "need to a and b before X"
  if (QUESTION_START.test(head) && !/^what\s+(?:i|we)\b/i.test(head)) return null
  const step = STEP_LEAD.exec(head)
  if (step && !after.replace(/[.!\s]+$/, "")) return make(readItems(step[1]!))
  return null
}

/**
 * Every line of a longer message about the event `key`: the sentence that names it ("now im going to have to clean
 * house before 2pmish when Elijah gets home"), and the list sentences right after it ("Bare minimum - change sheets,
 * open all window …", "Best case maybe i just hit the laundromat …"). For lines already logged or filed elsewhere.
 */
export function readMentions(text: string, key: string, now: Date): BeforeItem[] {
  const out: BeforeItem[] = []
  const whole = readFiling(text, now)
  if (whole && whole.anchor.key === key) return whole.items
  const ss = sentences(text)
  for (let i = 0; i < ss.length; i++) {
    const hit = readAnchor(ss[i]!)
    if (!hit || hit.anchor.key !== key) continue
    const from = (items: BeforeItem[], sentence: string) => out.push(...items.map((it) => ({ ...it, source: sentence })))
    const one = readFiling(ss[i]!, now)
    if (one) from(one.items, ss[i]!)
    else {
      // The step said before the event in a longer sentence: "… and now im going to have to clean house before X".
      const head = ss[i]!.slice(0, hit.index)
      const clauses = head.split(/\s+(?:and now|now|and then|so|but)\s+|[,;]\s*/i)
      const step = STEP_LEAD.exec(clauses[clauses.length - 1]!.trim())
      if (step) from(readItems(step[1]!), ss[i]!)
    }
    // The list sentences that follow, until one is neither a list nor a minimum or a best case.
    for (let j = i + 1; j < ss.length; j++) {
      const s = ss[j]!.replace(/^(?:and|so|but|ok(?:ay)?)[,\s]+/i, "")
      const min = MINIMUM.exec(s)
      if (min) {
        from(readItems(min[1]!), ss[j]!)
        continue
      }
      const opt = OPTIONAL.exec(s)
      if (opt) {
        from(readItems(opt[1]!.replace(/\s+and\s+/gi, ", "), false), ss[j]!)
        continue
      }
      break
    }
  }
  return out
}

/** "45 minutes", "3 hours 39 minutes". */
export function spanWords(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (!h) return `${m} minute${m === 1 ? "" : "s"}`
  return `${h} hour${h === 1 ? "" : "s"}${m ? ` ${m} minute${m === 1 ? "" : "s"}` : ""}`
}
