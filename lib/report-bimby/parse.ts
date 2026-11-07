/**
 * lib/report-bimby/parse.ts — Read a status report with rules, no model
 *
 * Splits a message into clauses and picks out the five things a person says in passing:
 * a period starting, a dose taken, how many are left, a caffeine drink, and what they have been
 * doing (newest first, "before that" going further back). Pure and strict: a phrase it does not
 * recognise is left alone, never guessed. The quoted phrase of each find is kept so the card can
 * show what it came from.
 */

export interface Dose {
  name: string
  count: number
  phrase: string
}

export interface Supply {
  /** The med the count belongs to, when the clause names one; else the nearest dose before it. */
  name?: string
  remaining: number
  phrase: string
}

export interface Drink {
  name: string
  /** "earlier": the time is unknown, so the plan guesses and says so. */
  earlier: boolean
  phrase: string
}

export interface Segment {
  /** Label for an Activity block, e.g. "Baby animal game". */
  label: string
  /** Minutes the person stated, when they did. */
  minutes?: number
  /** "for a while" and the like: a duration with no number. */
  vague: boolean
  /** Said as "before that": it ends where the segment before it begins. */
  before: boolean
  phrase: string
}

export interface Parsed {
  period?: { dayOffset: number; phrase: string }
  doses: Dose[]
  supply: Supply[]
  drinks: Drink[]
  segments: Segment[]
}

const NUMBER_WORDS: Record<string, number> = { no: 0, none: 0, zero: 0, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5 }
const NOT_MEDS = new Set(["out", "off", "a", "an", "the", "my", "nap", "shower", "bath", "walk", "break", "look", "picture", "photo", "trip", "long", "while", "minute", "second", "moment", "few", "some", "care", "time", "turn", "step", "seat"])
const DRINKS = "coffee|espresso|latte|cappuccino|cold brew|tea|matcha|chai|energy drink|red bull|monster|coke|soda|pepsi"
const ACTIVITY_VERBS = "working on|watching|playing|reading|scrolling|coding|making|building|drawing|cooking|cleaning|studying|writing|designing|painting|gaming"

const num = (word: string): number | null => {
  const w = word.toLowerCase()
  if (/^\d+(\.\d+)?$/.test(w)) return Number(w)
  return w in NUMBER_WORDS ? NUMBER_WORDS[w]! : null
}

/** Clauses in the order they were said. A clause starts at "also", "only", "had", "took", "been", "before that". */
export function clauses(text: string): string[] {
  const out: string[] = []
  for (const sentence of text.split(/[.;!\n]+/)) {
    const parts = sentence.split(/\s*(?:,\s*(?:and\s+)?|\band\s+also\s+|\band\s+)(?=(?:also\s+|only\s+|had\s+|took\s+|have been\s+|i've been\s+|been\s+|before that\b))/i)
    for (const part of parts) {
      const t = part.trim().replace(/^(and|also)\s+/i, "")
      if (t) out.push(t)
    }
  }
  return out
}

/** "for a while" / "for 3 hours" / "for a couple of hours" → minutes, or vague. */
export function parseDuration(text: string): { minutes?: number; vague: boolean } {
  const m = /\bfor\s+(.+?)\s*$/i.exec(text)
  if (!m) return { vague: false }
  const d = m[1]!.toLowerCase()
  if (/^(a while|a good while|a long while|some time|ages|a bit)$/.test(d)) return { vague: true }
  if (/^all day$/.test(d)) return { minutes: 600, vague: false }
  if (/^(an|1) hour$/.test(d)) return { minutes: 60, vague: false }
  if (/^half an hour$/.test(d)) return { minutes: 30, vague: false }
  if (/^a couple( of)? hours$/.test(d)) return { minutes: 120, vague: false }
  if (/^a few hours$/.test(d)) return { minutes: 180, vague: false }
  const n = /^(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/.exec(d)
  if (n) return { minutes: Math.round(Number(n[1]) * (/^h/.test(n[2]!) ? 60 : 1)), vague: false }
  return { vague: true }
}

/** "baby animal game" → "Baby animal game"; "youtube" is always "YouTube". */
export function labelFrom(verb: string, object: string): string {
  const obj = object.trim().replace(/\s+/g, " ").replace(/\byoutube\b/gi, "YouTube")
  const text = /^working on$/i.test(verb) ? obj : `${verb} ${obj}`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function parseReport(text: string): Parsed {
  const out: Parsed = { doses: [], supply: [], drinks: [], segments: [] }
  for (const clause of clauses(text)) {
    const lower = clause.toLowerCase()

    if (/\bperiod\b/.test(lower) && /\b(start(ed)?|got|began|begin|came|arrived|here|on)\b/.test(lower) && !out.period) {
      out.period = { dayOffset: /\byesterday\b/.test(lower) ? -1 : 0, phrase: clause }
      continue
    }

    const left = /\b(\d+|no|none|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\w+\s+)?left\b/.exec(lower)
    if (left) {
      const remaining = num(left[1]!)
      if (remaining !== null) {
        const named = /\b(?:of\s+(?:my\s+)?)?([a-z][\w-]*)\s+left\b/.exec(lower.replace(left[0], ""))
        out.supply.push({ remaining, phrase: clause, ...(named && !NOT_MEDS.has(named[1]!) ? { name: named[1]! } : {}) })
        continue
      }
    }

    const dose = /\btook\s+(\d+(?:\.\d+)?|a|an|one|two|three|half)\s+(?:of\s+)?(?:my\s+)?([a-z][\w-]*)/.exec(lower)
    if (dose) {
      const count = num(dose[1]!)
      const name = dose[2]!
      if (count !== null && !NOT_MEDS.has(name)) {
        out.doses.push({ name, count, phrase: clause })
        continue
      }
    }

    const drink = new RegExp(`\\b(?:had|drank|having|drinking)\\s+(?:a|an|one|another|my|some|\\d+)?\\s*(${DRINKS})\\b`).exec(lower)
    if (drink) {
      out.drinks.push({ name: drink[1]!, earlier: /\b(earlier|before|this morning|a while ago)\b/.test(lower), phrase: clause })
      continue
    }

    const act = new RegExp(`^(?:(before that),?\\s*)?(?:i\\s+)?(was\\s+|have been\\s+|i've been\\s+|been\\s+|am\\s+)?(?:mostly\\s+)?(${ACTIVITY_VERBS})\\s+(.+)$`, "i").exec(clause.trim())
    if (act) {
      const duration = parseDuration(act[4]!)
      const object = act[4]!.replace(/\s+for\s+.+$/i, "")
      // A bare "reading a book" is a log line for the ladder. A report says "been ...", "was ...", "before that ...", or for how long.
      const marked = !!act[1] || !!act[2] || duration.vague || duration.minutes !== undefined
      if (object.trim() && marked) {
        out.segments.push({ label: labelFrom(act[3]!.toLowerCase(), object), ...duration, before: !!act[1], phrase: clause })
      }
    }
  }
  // A count with no med of its own belongs to the dose just before it.
  for (const s of out.supply) if (!s.name && out.doses.length) s.name = out.doses[out.doses.length - 1]!.name
  return out
}

/** True when the message reads as a report worth a plan: a period, a dose or count, or something done with a duration. */
export function looksLikeReport(text: string): boolean {
  if (text.length > 600) return false
  const p = parseReport(text)
  return !!p.period || p.doses.length > 0 || p.supply.length > 0 || p.segments.length > 0 || p.drinks.length > 1
}
