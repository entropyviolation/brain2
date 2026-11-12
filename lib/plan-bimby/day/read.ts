/**
 * lib/plan-bimby/day/read.ts — One message about the day → items with tiers (pure, rules only)
 *
 * The first sentence is the list. A later sentence that weighs things ("MUST be done is …", "… is important
 * as well") sets tiers on the items it names; it adds nothing. "X (and thus Y)" puts Y before X and gives Y
 * X's tier. Brackets after an item are its steps ("pack (my stuff and elijahs)") or an aside. The person's
 * words are kept as the titles. Nothing here reads a store.
 */

import type { DayTier } from "./types"

export interface ReadItem {
  title: string
  said: string
  tier: DayTier
  urgent: boolean
  subtasks: string[]
  note?: string
  /** Minutes said in the words ("for 20 min"). */
  minutes?: number
  /** Index of the item this one waits on. */
  after?: number
  reasons: string[]
}

export interface DayRead {
  items: ReadItem[]
  remarks: string[]
  trace: string[]
}

const SCOPE = /\b(rest of (?:the|my|to)?\s*day|today|tonight|this (?:morning|afternoon|evening)|before bed|by tonight|end of (?:the )?day)\b/i
const LEAD_VERB = /\b(have to|need to|needs to|gotta|got to|want to|wanna|must|should|going to|gonna|to[- ]?do|things to do|get done|plan(?:s|ning)? (?:is|for|to))\b/i
const ASK_PLAN = /\b(?:help me (?:plan|figure out|organi[sz]e)|plan (?:out )?(?:the rest of )?(?:my|the) day|what should i do (?:today|tonight|now|for the rest of the day))\b/i

const VERBS = new Set(
  "order buy get grab pick call text email reply respond read write plan pack dye bleach shave finish clean wash do make book send pay cook shower fold tidy start work fix update check review return schedule cancel print mail ship charge water feed walk run study practice edit record post upload download install renew sign fill submit drop bring take put organize sort wrap prep prepare go figure decide message answer trim paint cut vacuum mop iron hang unpack repack measure draft outline research look find apply file".split(" "),
)

const STOP = new Set(
  "a an the my our your some more any anything else other stuff things thing for to of on in at with and or then up out from by is are be been as well also i it that this do done get got must important very really just so too".split(" "),
)

/** One word, plural and tense removed, so "planning" meets "plan" and "legs" meets "leg". */
export function stem(word: string): string {
  let w = word
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2)
  else if (w.length > 4 && /(?:x|ch|sh|ss)es$/.test(w)) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1)
  if (w.length > 3 && /([b-df-hj-np-tv-z])\1$/.test(w) && !/(?:ll|ss|ff)$/.test(w)) w = w.slice(0, -1)
  return w
}

/** Every word, stemmed, filler kept. For "is this word in that sentence". */
export function allWords(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).map(stem)
}

/** The words that name the thing. */
export function contentWords(text: string): string[] {
  return text.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 2 && !STOP.has(w)).map(stem)
}

/**
 * Does `phrase` name this item? At least half the item's words are in the phrase, and a single hit
 * on a two-word item must not be its verb alone ("plan" in "planning ny" is not "plan outfits").
 */
export function nameScore(title: string, phrase: string): number {
  const words = contentWords(title)
  if (!words.length) return 0
  const have = new Set(allWords(phrase))
  const hits = words.filter((w) => have.has(w))
  if (!hits.length) return 0
  const ratio = hits.length / words.length
  if (ratio < 0.5) return 0
  if (hits.length === 1 && words.length > 1 && hits[0] === words[0] && VERBS.has(words[0]!)) return 0
  return ratio + hits.length * 0.01
}

/** The index of the item a phrase names best, or -1. A tie is no answer. */
export function bestItem(titles: string[], phrase: string): number {
  let best = -1
  let top = 0
  let tied = false
  titles.forEach((t, i) => {
    const s = nameScore(t, phrase)
    if (s > top) {
      top = s
      best = i
      tied = false
    } else if (s && s === top) tied = true
  })
  return tied ? -1 : best
}

/** Split on a separator, never inside brackets. */
function splitOutside(text: string, sep: RegExp): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ""
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    if (ch === "(") depth++
    if (ch === ")") depth = Math.max(0, depth - 1)
    if (depth === 0) {
      const m = sep.exec(text.slice(i))
      if (m && m.index === 0 && m[0].length) {
        out.push(cur)
        cur = ""
        i += m[0].length
        continue
      }
    }
    cur += ch
    i++
  }
  out.push(cur)
  return out.map((p) => p.trim()).filter(Boolean)
}

const firstWord = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/^(?:and|then|also|plus|to)\s+/i, "").trim().split(/\s+/)[0] ?? ""
const wordCount = (s: string) => s.replace(/\([^)]*\)/g, " ").trim().split(/\s+/).filter(Boolean).length

/** True when the words open with a doing word ("call mom"), so they can be a task. */
export const startsWithVerb = (s: string): boolean => VERBS.has(stem(firstWord(s)))

/** "pack (…) and plan outfits" is two things; "read shelby text and reply" is one. A new thing starts with a verb and has an object. */
function splitAnd(part: string): string[] {
  const pieces = splitOutside(part, /^\s+and\s+/i)
  const out: string[] = []
  for (const p of pieces) {
    if (out.length && !(VERBS.has(stem(firstWord(p))) && wordCount(p) >= 2)) out[out.length - 1] += ` and ${p}`
    else out.push(p)
  }
  return out
}

const URGENT = /\b(asap|a\.s\.a\.p\.?|right away|right now|immediately|now{2,}|urgent(?:ly)?|first thing)\b/gi
const ASIDE = /\b(comes?|maybe|think|probably|is|are|was|mind|idk|not sure)\b/i

function minutesIn(text: string): number | undefined {
  const m = /\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|hrs?|hours?)\b/i.exec(text)
  if (!m) return undefined
  const n = Number(m[1])
  return Math.max(1, Math.round(/^h/i.test(m[2]!) ? n * 60 : n))
}

function toItem(raw: string): ReadItem | null {
  const brackets = [...raw.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]!.trim()).filter(Boolean)
  const urgent = new RegExp(URGENT.source, "i").test(raw)
  const minutes = minutesIn(raw.replace(/\([^)]*\)/g, " "))
  const title = raw
    .replace(/\([^)]*\)/g, " ")
    .replace(URGENT, " ")
    .replace(/\b(?:for\s+)?\d+(?:\.\d+)?\s*(?:min(?:ute)?s?|hrs?|hours?)\b/gi, " ")
    .replace(/^(?:(?:and|then|also|plus|oh)\s+)+/i, "")
    .replace(/^(?:i\s+)?(?:have to|need to|gotta|got to|want to|wanna|must|should)\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/[\s.!?,;:-]+$/g, "")
    .trim()
  if (title.length < 3 || !/[a-z]{2,}/i.test(title)) return null
  const subtasks: string[] = []
  const notes: string[] = []
  for (const b of brackets) {
    const parts = b.split(/,|\band\b/i).map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2 && parts.every((p) => p.split(/\s+/).length <= 3 && !ASIDE.test(p))) subtasks.push(...parts)
    else notes.push(b)
  }
  return {
    title,
    said: raw.trim(),
    tier: "rest",
    urgent,
    subtasks,
    ...(notes.length ? { note: notes.join("; ") } : {}),
    ...(minutes ? { minutes } : {}),
    reasons: urgent ? ["You said it is urgent, so it goes first."] : [],
  }
}

function listItems(body: string): ReadItem[] {
  const out: ReadItem[] = []
  for (const part of splitOutside(body, /^(?:[,;]|\s+then\s+|\s+and then\s+)/i)) {
    for (const piece of splitAnd(part)) {
      const item = toItem(piece)
      if (item) out.push(item)
    }
  }
  return out
}

/** The list sentence with its opening removed ("what I have to do for the rest of the day:"). */
function stripLead(sentence: string): string {
  const colon = sentence.indexOf(":")
  if (colon > 0 && colon < 90) {
    const lead = sentence.slice(0, colon)
    if (SCOPE.test(lead) || LEAD_VERB.test(lead) || /\bplan\b/i.test(lead)) return sentence.slice(colon + 1)
  }
  const m = /^.{0,60}?\b(?:have to|need to|gotta|got to|want to|wanna|must|should|going to|gonna)\b(?:\s+(?:do|get done|finish))?/i.exec(sentence)
  const rest = m ? sentence.slice(m[0].length) : sentence
  return rest.replace(/\b(?:for |by |before |during )?(?:the )?(?:rest of (?:the|my) day|today|tonight|this (?:morning|afternoon|evening)|end of (?:the )?day)\b[:,]?/gi, " ")
}

const MUST = /\bmust\b|non[- ]?negotiable|ha(?:s|ve) to (?:be|get) done|no matter what|absolutely|top priorit|needs? to (?:be|get) done/i
const IMPORTANT = /\bimportant\b|\bpriorit|\bmatters?\b|\bshould really\b/i
const OPTIONAL = /\bif (?:i have |there'?s |i get )?time\b|\boptional\b|\bnice to have\b|\bcan wait\b|\bnot urgent\b|\bbonus\b/i
const FEELING = /\b(happy|love|glad|proud|excited|grateful|stressed|tired|anxious|overwhelmed|nervous|ugh+|feel(?:ing)?)\b/i
const THUS = /([^,.()]{2,48})\(\s*(?:and\s+)?(?:thus|so|therefore|hence|which means|meaning|so first|first)\s+([^)]{2,60})\)/gi

const quote = (s: string) => (s.length > 70 ? `${s.slice(0, 67)}…` : s)
const RANK: Record<DayTier, number> = { must: 0, important: 1, rest: 2 }

/** The whole message → items, tiers, order links. Rules only. */
export function readDay(text: string): DayRead {
  const flat = text
    .replace(/\r/g, "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")
    .replace(/:\s*\n+/g, ": ")
    .replace(/([^.!?:\n])\n+/g, "$1, ")
    .replace(/\n+/g, " ")
    .trim()
  const sentences = splitOutside(flat, /^[.!?]+\s+/).map((s) => s.replace(/[.!?]+$/, "").trim()).filter(Boolean)
  const remarks: string[] = []
  const trace: string[] = []
  if (!sentences.length) return { items: [], remarks, trace }

  const items = listItems(stripLead(sentences[0]!))
  trace.push(`Found ${items.length} thing${items.length === 1 ? "" : "s"} in your list.`)

  for (const s of sentences.slice(1)) {
    const tier: DayTier | null = MUST.test(s) ? "must" : IMPORTANT.test(s) ? "important" : OPTIONAL.test(s) ? "rest" : null
    if (tier) {
      const named = items.filter((it) => nameScore(it.title, s) > 0)
      if (named.length) {
        for (const it of named) {
          if (tier === "rest" || RANK[tier] < RANK[it.tier]) {
            it.tier = tier
            it.reasons.push(tier === "must" ? `You said it must be done: "${quote(s)}".` : tier === "important" ? `You said it is important: "${quote(s)}".` : `You said it can wait: "${quote(s)}".`)
          }
        }
        trace.push(`${tier === "must" ? "Must" : tier === "important" ? "Important" : "If time"}, from "${quote(s)}": ${named.map((n) => n.title).join(", ")}.`)
        continue
      }
      // A weighing sentence that names nothing on the list brings its own things.
      const more = listItems(stripLead(s.replace(MUST, " ").replace(IMPORTANT, " ").replace(/\b(?:be done|is|are|also|as well)\b/gi, " ")))
      for (const it of more) {
        it.tier = tier
        it.reasons.push(`From "${quote(s)}".`)
      }
      if (more.length) {
        items.push(...more)
        continue
      }
    }
    if (FEELING.test(s) && !VERBS.has(stem(firstWord(s)))) {
      remarks.push(s)
      continue
    }
    const more = listItems(stripLead(s))
    if (more.length && more.some((m) => VERBS.has(stem(firstWord(m.title))))) items.push(...more)
    else remarks.push(s)
  }

  // "dye hair (and thus order hairdye)": the bracket comes first and carries the same weight.
  const titles = items.map((i) => i.title)
  for (const m of flat.matchAll(THUS)) {
    const later = bestItem(titles, m[1]!)
    const first = bestItem(titles, m[2]!)
    if (later < 0 || first < 0 || later === first) continue
    items[later]!.after = first
    items[later]!.reasons.push(`Waits on "${items[first]!.title}".`)
    if (RANK[items[later]!.tier] < RANK[items[first]!.tier]) items[first]!.tier = items[later]!.tier
    items[first]!.reasons.push(`Needed for "${items[later]!.title}", so it carries the same weight and comes first.`)
    trace.push(`"${items[first]!.title}" comes before "${items[later]!.title}", from "${quote(m[0]!.trim())}".`)
  }
  return { items, remarks, trace }
}

/** A message that lists the day: a day word, a "have to" word, and at least three things. Not a command. */
export function looksLikeDayPlan(text: string): boolean {
  const t = text.trim()
  if (t.length < 24 || /^(?:to ?do(?: today)?|log|note|inbox|shopping|track|do|groc\w*)\s*[:-]/i.test(t)) return false
  if (!SCOPE.test(t) || !(LEAD_VERB.test(t) || /\bplan\b/i.test(t))) return false
  const items = readDay(t).items
  // "buy milk, eggs and bread" is one errand, not a day: most of the things must be things to do.
  return items.length >= 3 && items.filter((i) => startsWithVerb(i.title)).length >= Math.ceil(items.length / 2)
}

/** "help me plan the rest of my day" with no list in it: BIM asks for the list. */
export function wantsDayPlan(text: string): boolean {
  return ASK_PLAN.test(text) && readDay(text).items.length < 3
}
