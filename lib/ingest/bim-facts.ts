/**
 * lib/ingest/bim-facts.ts — Things you tell BIM chat to remember, and when they stop being true (pure)
 *
 * Two shapes, read by code with no model:
 *   instant  "Claude limit resets at 2:00am" / "...resets in 2 hours"  → a moment, kept as a clock time
 *   note     "remember that the gate code is 4412"                      → a plain fact, kept with its age
 * A moment is resolved when it is told ("in 2 hours" becomes 2:00 am at the time of telling), so a question
 * later is arithmetic, not a guess. A moment that has passed is not assumed to repeat: past a short grace the
 * answer is "I don't know", and the fact is only an invitation to be told again. `bim-chat.ts` owns the
 * store and the reply lines; this file owns the reading and the arithmetic.
 */

export type FactKind = "instant" | "note"

export interface Fact {
  id: string
  kind: FactKind
  /** What it is about, as typed ("Claude limit resets"). Shown back to the person. */
  label: string
  /** Stemmed content words of `label`. A question matches on these. */
  tokens: string[]
  /** When it was told, ms. */
  toldAt: number
  /** instant only: the moment, ms. */
  at?: number
  /** note only: the sentence kept. */
  text?: string
}

/** How long after a moment passes BIM still says "that already happened". After this it says it does not know. */
export const INSTANT_GRACE_MS = 3 * 60 * 60 * 1000
/** Expired moments stay this long so a late question gets "I don't know" instead of a guess from the model. */
export const INSTANT_KEEP_MS = 7 * 24 * 60 * 60 * 1000

const STOP = new Set(
  (
    "a an the and or of to for in on at by is are was were be do does did will would can could should how long until till when " +
    "what whats time left much many again next my i me it its this that there any please tell minutes hours minute hour " +
    "remember note fyi keep mind about"
  ).split(" "),
)

const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w)

/** Content words, lowercased and lightly stemmed, in order, without repeats. */
export function factTokens(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.toLowerCase().replace(/['’]s\b/g, "").split(/[^a-z0-9]+/)) {
    if (!raw || STOP.has(raw)) continue
    const w = stem(raw)
    if (seen.has(w)) continue
    seen.add(w)
    out.push(w)
  }
  return out
}

// ---------------------------------------------------------------- time words

const NUM_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fortyfive: 45, sixty: 60,
}
const NUM = "(\\d+(?:\\.\\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|sixty)"
const UNIT = "(days?|d|hours?|hrs?|h|minutes?|mins?|m)"
const MS = { d: 86_400_000, h: 3_600_000, m: 60_000 }

function unitMs(u: string): number {
  return u.startsWith("d") ? MS.d : u.startsWith("h") ? MS.h : MS.m
}

/** "2 hours", "an hour and a half", "45 minutes", "1h 30m", "half an hour" → ms. Null when nothing reads. */
export function parseDuration(phrase: string): number | null {
  const p = phrase.toLowerCase().replace(/[.,!]+$/g, "").trim()
  if (/^half an? hour$/.test(p)) return 30 * MS.m
  let total = 0
  let found = false
  const re = new RegExp(`${NUM}\\s*${UNIT}\\b(\\s+and a half)?`, "g")
  for (const m of p.matchAll(re)) {
    const n = /^\d/.test(m[1]!) ? Number(m[1]) : (NUM_WORDS[m[1]!] ?? NaN)
    if (!Number.isFinite(n)) continue
    const unit = unitMs(m[2]!)
    total += n * unit + (m[3] ? unit / 2 : 0)
    found = true
  }
  return found && total > 0 ? Math.round(total) : null
}

/**
 * The next time the clock reads `phrase` after `now`: "2:00am", "2 am", "14:30", "noon", "midnight",
 * "tomorrow at 3pm". A bare hour with no am/pm takes whichever of am/pm comes first. Null when none reads.
 */
export function parseClock(phrase: string, now: Date): Date | null {
  const p = phrase.toLowerCase().replace(/[.,!]+$/g, "").trim()
  const dayWord = /\b(tomorrow|tonight|today)\b/.exec(p)?.[1]
  const body = p.replace(/\b(tomorrow|tonight|today|at|around|about|by)\b/g, " ").trim()
  let hours: number[] = []
  let minute = 0
  if (/^noon$/.test(body)) hours = [12]
  else if (/^midnight$/.test(body)) hours = [0]
  else {
    const m = /^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/.exec(body)
    if (!m) return null
    const h = Number(m[1])
    minute = m[2] ? Number(m[2]) : 0
    if (minute > 59 || h > 24) return null
    const mer = m[3]?.[0]
    if (mer) {
      if (h < 1 || h > 12) return null
      hours = [mer === "a" ? h % 12 : (h % 12) + 12]
    } else if (m[2] === undefined && m[1]!.length === 1 && h === 0) {
      return null
    } else if (h === 0 || h > 12) {
      hours = [h % 24]
    } else {
      hours = [h % 12, (h % 12) + 12]
    }
  }
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (dayWord === "tomorrow") base.setDate(base.getDate() + 1)
  const cands = hours.map((h) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, minute))
  // A named day is taken as said; otherwise the next time that clock reads.
  if (dayWord === "tomorrow" || dayWord === "tonight" || dayWord === "today") {
    const future = cands.filter((c) => c.getTime() > now.getTime())
    return (future.length ? future : cands).sort((a, b) => a.getTime() - b.getTime())[0] ?? null
  }
  const rolled = cands.map((c) => (c.getTime() > now.getTime() ? c : new Date(c.getFullYear(), c.getMonth(), c.getDate() + 1, c.getHours(), c.getMinutes())))
  return rolled.sort((a, b) => a.getTime() - b.getTime())[0] ?? null
}

/** "55 minutes", "1 hour 5 minutes", "2 hours", "3 days". */
export function formatSpan(ms: number): string {
  const mins = Math.round(Math.abs(ms) / MS.m)
  if (mins < 1) return "less than a minute"
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`
  if (mins < 48 * 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h} hour${h === 1 ? "" : "s"}${m ? ` ${m} minute${m === 1 ? "" : "s"}` : ""}`
  }
  const d = Math.round(mins / (24 * 60))
  return `${d} days`
}

/** "2:00 am", plus "tomorrow" or the weekday when it is not today. */
export function formatMoment(at: number, now: Date): string {
  const d = new Date(at)
  const h = d.getHours()
  const clock = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(d) - startOf(now)) / 86_400_000)
  if (days === 0) return clock
  if (days === 1) return `tomorrow ${clock}`
  if (days === -1) return `yesterday ${clock}`
  return `${d.toLocaleDateString("en-US", { weekday: "long" })} ${clock}`
}

// ---------------------------------------------------------------- statements

const VERBS =
  "resets?|ends?|expires?|renews?|starts?|begins?|opens?|closes?|unlocks?|refreshes|restarts?|resumes?|arrives?|finishes|is due|are due|is ready|are ready|comes back|lifts|runs out|ships|launches|is over"

const LEAD = /^(?:fyi|btw|heads up|note|just so you know)[,:]?\s+(?:that\s+)?/i

/** A moment, from "<thing> <verb> at|in|by <when>". Null when the line is not one. */
export function parseInstantStatement(text: string, now: Date): Omit<Fact, "id" | "toldAt"> | null {
  const t = text.trim().replace(LEAD, "")
  if (!t || /\?\s*$/.test(t) || t.length > 160) return null
  const m = new RegExp(`^(.+?)\\s+(${VERBS})\\s+(at|in|by|around)\\s+(.+?)[.!]*$`, "i").exec(t)
  if (!m) return null
  const subject = `${m[1]!.trim()} ${m[2]!.trim()}`
  const tokens = factTokens(subject)
  if (!tokens.length) return null
  const when = m[4]!
  let at: number | null = null
  if (m[3]!.toLowerCase() === "in") {
    const span = parseDuration(when)
    at = span ? now.getTime() + span : null
  } else {
    at = parseClock(`at ${when}`, now)?.getTime() ?? null
  }
  if (at === null) return null
  return { kind: "instant", label: subject.charAt(0).toUpperCase() + subject.slice(1), tokens, at }
}

/** The bare answer to "when?": "at 3am", "in 2 hours", "it resets at 3am". Null when it is not only a time. */
export function parseBareWhen(text: string, now: Date): number | null {
  const t = text.trim().replace(/^it\s+(?:\w+\s+)?(?=(?:at|in|by)\b)/i, "").replace(/[.!]+$/g, "")
  const m = /^(at|in|by|around)\s+(.+)$/i.exec(t) ?? /^(\d{1,2}(?::\d{2})?\s*(?:am|pm))$/i.exec(t)
  if (!m) return null
  if (m.length === 2) return parseClock(m[1]!, now)?.getTime() ?? null
  if (m[1]!.toLowerCase() === "in") {
    const span = parseDuration(m[2]!)
    return span ? now.getTime() + span : null
  }
  return parseClock(`at ${m[2]}`, now)?.getTime() ?? null
}

/** A plain fact to keep: "remember that the gate code is 4412". */
export function parseNoteStatement(text: string): Omit<Fact, "id" | "toldAt"> | null {
  const m = /^(?:please\s+)?(?:remember|keep in mind|make a note)(?:\s+that)?[:,]?\s+(.{3,240})$/i.exec(text.trim())
  if (!m) return null
  const body = m[1]!.trim().replace(/[.!]+$/g, "")
  const tokens = factTokens(body)
  if (!tokens.length) return null
  return { kind: "note", label: body, tokens, text: body }
}

// ---------------------------------------------------------------- questions

/** True when the line asks for something (wh-word or question mark). */
export function looksLikeFactQuestion(text: string): boolean {
  const t = text.trim()
  return /\?\s*$/.test(t) || /^(when|what|how|who|where|which|is|are|do|does|did|will|can)\b/i.test(t)
}

/** The told fact a question is about: every word of the fact in the question, best and newest first. */
export function matchFact(facts: Fact[], question: string): Fact | null {
  const q = new Set(factTokens(question))
  if (!q.size) return null
  let best: Fact | null = null
  let bestScore = 0
  for (const f of facts) {
    if (!f.tokens.length) continue
    const hit = f.tokens.filter((t) => q.has(t)).length
    // A moment is named by the whole question; a note holds the answer, so the question must be inside it.
    const base = f.kind === "note" ? Math.min(q.size, f.tokens.length) : f.tokens.length
    const score = hit / base
    const need = base === 1 ? 1 : 0.67
    if (hit < Math.min(2, base) || score < need) continue
    if (score > bestScore || (score === bestScore && best && f.toldAt > best.toldAt)) {
      best = f
      bestScore = score
    }
  }
  return best
}

export type FactAnswer =
  | { state: "upcoming" | "just-passed" | "note"; text: string }
  | { state: "unknown"; text: string }

const ASK_AGAIN = "If you check and let me know, I'll remember!"

/** What BIM says about a fact now. A passed moment is never assumed to come round again. */
export function answerFact(fact: Fact, now: Date): FactAnswer {
  const t = now.getTime()
  if (fact.kind === "note") {
    const age = t - fact.toldAt
    const when = age < 60_000 ? "just now" : age < 24 * 3_600_000 ? `${formatSpan(age)} ago` : `on ${new Date(fact.toldAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    return { state: "note", text: `You told me ${when}: ${fact.text}.` }
  }
  const at = fact.at ?? 0
  if (at > t) return { state: "upcoming", text: `In ${formatSpan(at - t)} (at ${formatMoment(at, now)}).` }
  if (t - at <= INSTANT_GRACE_MS) {
    return {
      state: "just-passed",
      text: `That was ${formatSpan(t - at)} ago (at ${formatMoment(at, now)}). I don't know when it happens next. ${ASK_AGAIN}`,
    }
  }
  return { state: "unknown", text: `I don't know. ${ASK_AGAIN}` }
}

/** Facts worth keeping: drop moments that passed more than a week ago. */
export function pruneFacts(facts: Fact[], now: Date): Fact[] {
  return facts.filter((f) => f.kind === "note" || (f.at ?? 0) + INSTANT_KEEP_MS > now.getTime())
}

/** Add `draft`, replacing any fact about the same thing. */
export function rememberFact(facts: Fact[], draft: Omit<Fact, "id">, id: string): Fact[] {
  const same = (f: Fact) => {
    if (f.kind !== draft.kind) return false
    const shared = f.tokens.filter((t) => draft.tokens.includes(t)).length
    return shared / Math.max(f.tokens.length, draft.tokens.length) >= 0.8
  }
  return [...facts.filter((f) => !same(f)), { ...draft, id }]
}

/** The line BIM says after storing a fact. */
export function rememberedText(f: Omit<Fact, "id">, now: Date): string {
  if (f.kind === "note") return `Okay, I'll remember that: ${f.text}.`
  const at = f.at ?? 0
  return `Okay. ${f.label} ${formatMoment(at, now)} (in ${formatSpan(at - now.getTime())}). I'll only trust it until then.`
}
