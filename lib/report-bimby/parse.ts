/**
 * lib/report-bimby/parse.ts — Read a status report with rules, no model
 *
 * Splits a message into clauses and picks out the five things a person says in passing:
 * a period starting, a dose taken, how many are left, a caffeine drink, and what they have been
 * doing (newest first, "before that" going further back). Pure and strict: a phrase it does not
 * recognise is left alone, never guessed. The quoted phrase of each find is kept so the card can
 * show what it came from.
 */

/** "at the very beginning of working on baby animal game": the thing is tied to the start of that activity. */
export interface Anchor {
  label: string
}

export interface Dose {
  name: string
  count: number
  phrase: string
  anchor?: Anchor
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
  anchor?: Anchor
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
  /** "4 hours ago stopped ...": it ended this many minutes before the message, not at the message. */
  endedAgoMin?: number
  /** "... since I woke up": it began when the person woke. */
  sinceWake?: boolean
}

/** A clock time said in words. `minute` is minutes past midnight; `ampm` false means the person did not say which. */
export interface Clock {
  minute: number
  ampm: boolean
  phrase: string
}

export interface Parsed {
  period?: { dayOffset: number; phrase: string }
  doses: Dose[]
  supply: Supply[]
  drinks: Drink[]
  segments: Segment[]
  /** "woke up at 1:30 am". `sure` when the message says "definitely". */
  wake?: Clock & { sure: boolean }
  /** "fell asleep at around 8 yesterday". `earlierDay` is set when the clause says yesterday or last night. */
  bed?: Clock & { earlierDay: boolean }
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

const COUNT_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, "a couple of": 2, "a few": 3, "half an": 0.5, half: 0.5 }

/** "4 hours", "a couple of hours", "30 min" → minutes. */
export function agoMinutes(count: string, unit: string): number | null {
  const c = count.toLowerCase()
  const n = /^\d+(\.\d+)?$/.test(c) ? Number(c) : COUNT_WORDS[c]
  if (n === undefined) return null
  return Math.round(n * (/^h/i.test(unit) ? 60 : 1))
}

/** "1:30 am", "8", "11pm" → a clock. Without am/pm the hour is kept as said (`ampm` false). */
export function clockFrom(hour: string, min: string | undefined, ampm: string | undefined, phrase: string): Clock | null {
  const h = Number(hour)
  const m = min ? Number(min) : 0
  if (!Number.isFinite(h) || h < 0 || h > 24 || m > 59) return null
  const ap = ampm?.toLowerCase().replace(/\./g, "")
  if (ap === "am") return { minute: (h % 12) * 60 + m, ampm: true, phrase }
  if (ap === "pm") return { minute: ((h % 12) + 12) * 60 + m, ampm: true, phrase }
  return { minute: (h % 24) * 60 + m, ampm: false, phrase }
}

const WAKE_RE = /\b(?:woke|wake|waking|got up|get up)(?:\s+up)?\s+(?:at|around|about)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
const BED_RE = /\b(?:fell asleep|falling asleep|went to (?:sleep|bed)|going to (?:sleep|bed)|got to sleep|passed out)\s+(?:at\s+)?(?:around\s+|about\s+|like\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
const FILLER = "(?:(?:pretty much|mostly|basically|just|only|really|literally|mainly)\\s+)*"

/** Words that name the same kind of activity, so "watching youtube videos and scrolling" and "scrolling and watching youtube" are one. */
function topicsOf(label: string): Set<string> {
  const l = label.toLowerCase()
  const out = new Set<string>()
  if (/youtube|video|watch|netflix|twitch/.test(l)) out.add("video")
  if (/scroll|social|insta|reddit|tiktok|twitter/.test(l)) out.add("scroll")
  if (!out.size) for (const w of l.split(/\W+/)) if (w.length > 3) out.add(w)
  return out
}

const sameThing = (a: string, b: string) => [...topicsOf(a)].some((t) => topicsOf(b).has(t))

/** "(both at the very beginning of working on baby animal game)" → the activity the dose or drink is tied to. */
export function anchorOf(clause: string): { anchor: Anchor; both: boolean } | null {
  const m = /\b(both\s+)?(?:at|around|right at)\s+the\s+(?:very\s+)?(?:beginning|start)\s+of\s+(?:me\s+)?(?:working on\s+|the\s+)?([^)]+?)\s*\)?\s*$/i.exec(clause) ?? /\b(both\s+)?when\s+i\s+(?:started|began)\s+(?:working on\s+)?([^)]+?)\s*\)?\s*$/i.exec(clause)
  if (!m) return null
  const label = m[2]!.trim().replace(/\s+/g, " ")
  return label ? { anchor: { label }, both: !!m[1] } : null
}

/** Clauses in the order they were said. A clause starts at "also", "only", "had", "took", "been", "before that". */
export function clauses(text: string): string[] {
  const out: string[] = []
  for (const sentence of text.replace(/\b([ap])\.m\./gi, "$1m").split(/[.;!\n]+/)) {
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
  for (const original of clauses(text)) {
    let clause = original
    // Wake and bed times can ride inside any clause ("scrolling ... since I woke up at 1:30 am after falling asleep at around 8 yesterday").
    const wake = WAKE_RE.exec(clause)
    if (wake && !out.wake) {
      const c = clockFrom(wake[1]!, wake[2], wake[3], original)
      if (c) out.wake = { ...c, sure: /\b(definitely|for sure|certain|exactly)\b/i.test(text) }
    }
    const bed = BED_RE.exec(clause)
    if (bed && !out.bed) {
      const c = clockFrom(bed[1]!, bed[2], bed[3], original)
      if (c) out.bed = { ...c, earlierDay: /\b(yesterday|last night|the night before)\b/i.test(clause) }
    }
    const sinceWake = /\bsince\s+(?:i\s+)?(?:woke|wake|waking|got up)\b/i.test(clause)
    if (wake || bed) clause = clause.replace(/\s+since\s+.*$/i, "").replace(/\s*\(.*$/, "").trim()
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
        const tied = anchorOf(clause)
        out.doses.push({ name, count, phrase: clause, ...(tied ? { anchor: tied.anchor } : {}) })
        // "both": the drink said just before shares the time.
        const prev = out.drinks[out.drinks.length - 1]
        if (tied?.both && prev && !prev.anchor) prev.anchor = tied.anchor
        continue
      }
    }

    const drink = new RegExp(`\\b(?:had|drank|having|drinking)\\s+(?:a|an|one|another|my|some|\\d+)?\\s*(${DRINKS})\\b`).exec(lower)
    if (drink) {
      const tied = anchorOf(clause)
      out.drinks.push({ name: drink[1]!, earlier: /\b(earlier|before|this morning|a while ago)\b/.test(lower), phrase: clause, ...(tied ? { anchor: tied.anchor } : {}) })
      continue
    }

    // "4 hours ago stopped working on X after working on it for a while" and "stopped working on X 4 hours ago".
    const unit = "(hours?|hrs?|minutes?|mins?)"
    const count = "(\\d+(?:\\.\\d+)?|a couple of|a few|half an|an|a|one|two|three|four|five|six)"
    const ago =
      new RegExp(`^(?:about\\s+|around\\s+)?${count}\\s+${unit}\\s+ago,?\\s+(?:i\\s+)?(?:stopped|finished|quit|ended|wrapped up)\\s+(?:(${ACTIVITY_VERBS})\\s+)?(.+)$`, "i").exec(clause.trim()) ??
      null
    const agoAfter = new RegExp(`^(?:i\\s+)?(?:stopped|finished|quit|ended|wrapped up)\\s+(?:(${ACTIVITY_VERBS})\\s+)?(.+?)\\s+(?:about\\s+|around\\s+)?${count}\\s+${unit}\\s+ago(.*)$`, "i").exec(clause.trim())
    if (ago || agoAfter) {
      const verb = ((ago ? ago[3] : agoAfter![1]) ?? "working on").toLowerCase()
      const rest = (ago ? ago[4] : agoAfter![2])!
      const minutesAgo = ago ? agoMinutes(ago[1]!, ago[2]!) : agoMinutes(agoAfter![3]!, agoAfter![4]!)
      const tail = ago ? "" : agoAfter![5] ?? ""
      const [objectPart, ...afterPart] = (ago ? rest : rest + tail).split(/\s+after\s+/i)
      const object = objectPart!.trim()
      if (object && minutesAgo !== null) {
        const duration = parseDuration(afterPart.join(" after ")) 
        out.segments.push({ label: labelFrom(verb, object), ...duration, vague: duration.minutes === undefined, before: false, phrase: original, endedAgoMin: minutesAgo })
        continue
      }
    }

    const act = new RegExp(`^(?:(before that),?\\s*)?(?:i\\s+)?(was\\s+|have been\\s+|i've been\\s+|been\\s+|am\\s+)?${FILLER}(${ACTIVITY_VERBS})\\s+(.+)$`, "i").exec(clause.trim())
    if (act) {
      const duration = parseDuration(act[4]!)
      const object = act[4]!.replace(/\s+for\s+.+$/i, "")
      // A bare "reading a book" is a log line for the ladder. A report says "been ...", "was ...", "before that ...", or for how long.
      const marked = !!act[1] || !!act[2] || duration.vague || duration.minutes !== undefined || sinceWake
      if (object.trim() && marked) {
        const label = labelFrom(act[3]!.toLowerCase(), object)
        const twin = sinceWake ? out.segments.find((s) => sameThing(s.label, label)) : undefined
        // The same activity said twice ("before that watching youtube", then "scrolling and watching youtube since I woke") is one block that starts at the wake.
        if (twin) twin.sinceWake = true
        else out.segments.push({ label, ...duration, before: !!act[1] || (sinceWake && out.segments.length > 0), phrase: original, ...(sinceWake ? { sinceWake: true } : {}) })
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
  return !!p.period || p.doses.length > 0 || p.supply.length > 0 || p.segments.length > 0 || p.drinks.length > 1 || !!p.wake || !!p.bed
}
