/**
 * lib/follow-through/read.ts — Read stream pieces into the four records, by rules
 *
 * Pure. A piece arrives with its route (from the Stream BIMBY's filing) and its time. A plan or a
 * to-do becomes an intention split into ordered steps, each with its hedge. An activity, count,
 * food or drink becomes an action at its minute. A feeling is read on its scale from the words
 * alone ("I NEED TO I NEED TO" is high resistance and high importance with no number typed).
 * "Didn't; ended up scrolling" is kept as a displacement mark for the linker.
 * A model's reading (`ModelHint`) replaces the rules' where it passes the checks.
 */
import { asScale, hashId, type Action, type ActionKind, type Feeling, type Hedge, type Intention, type RecordSource, type Scale, type Step } from "./types"

export interface ReadPiece {
  text: string
  /** The Stream BIMBY's route for the piece: plan, todo, mood, activity, count, food, drink, note … */
  route: string
  /** 24-hour HH:MM the piece is filed at. */
  hhmm: string
  end?: string
  /** The filing's payload, when the route has one ("dishes", "samosa"). */
  payload?: string
  hint?: ModelHint
}

/** What the model said about one piece. Every field is checked before it is used. */
export interface ModelHint {
  steps?: { what?: unknown; hedge?: unknown }[]
  excitement?: unknown
  resistance?: unknown
  importance?: unknown
  satisfaction?: unknown
  about?: unknown
}

export interface Displacement {
  /** What was done instead. */
  by: string
  /** What was not done, when the piece names it. */
  missed?: string
  at: string
  said: string
}

export interface Reading {
  intentions: Intention[]
  actions: Action[]
  feelings: Feeling[]
  displacements: Displacement[]
}

const pad = (n: number) => String(n).padStart(2, "0")
export const dayKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** ISO for HH:MM on the day of `now`. */
export function isoAt(now: Date, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0).toISOString()
}

// ── Words ──────────────────────────────────────────────────────────────

const STOP = new Set(
  "a an the and or to of on in at for with my your our some little bit stuff thing things get got done do did doing go going gonna will then maybe try i im it its that this is was be been am are just really very so up out off about a lot more work works worked working little".split(" "),
)
const SAME: Record<string, string> = {
  ate: "eat", eaten: "eat", eating: "eat", drank: "drink", drinking: "drink", called: "call", calling: "call", phoned: "call", phone: "call",
  video: "watch", videos: "watch", youtube: "watch", watched: "watch", watching: "watch", tidying: "tidy", tidied: "tidy", cleaning: "tidy", cleaned: "tidy", clean: "tidy",
  dishes: "tidy", walked: "walk", walking: "walk", scrolled: "scroll", scrolling: "scroll", stretched: "stretch", stretching: "stretch", woke: "wake", waking: "wake",
  samosas: "samosa", emailed: "email", texted: "text", read: "read", reading: "read", showered: "shower", cooked: "cook", cooking: "cook",
}

/** The words that carry a step's or an action's meaning, lowered and folded ("ate" and "eat" are one word). */
export function contentWords(s: string): string[] {
  const out: string[] = []
  for (const raw of s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
    if (!raw || /^\d+$/.test(raw)) continue
    const w = SAME[raw] ?? raw
    if (STOP.has(w) || STOP.has(raw)) continue
    if (!out.includes(w)) out.push(w)
  }
  return out
}

/** Share of `a`'s content words that `b` also has. 0 when `a` has none. */
export function overlap(a: string, b: string): number {
  const wa = contentWords(a)
  if (!wa.length) return 0
  const wb = new Set(contentWords(b))
  return wa.filter((w) => wb.has(w)).length / wa.length
}

// ── Intentions ─────────────────────────────────────────────────────────

const LEAD = /^(?:and\s+|then\s+|so\s+|i\s+guess\s+|i(?:'m| am)\s+|i\s+)*(?:gonna|going to|about to|planning to|plan to|i'll|will|want to|wanna|need to|have to|gotta|must|should|maybe|might|probably|try to|trying to|hopefully)\s+/i

export function hedgeOf(s: string): Hedge {
  if (/\b(maybe|might|probably|try to|trying to|hopefully|if i|possibly|i guess)\b/i.test(s)) return "maybe"
  if (/\b(need to|have to|gotta|must|should)\b/i.test(s)) return "must"
  return "will"
}

/** "Gonna eat the samosa, maybe watch a video and then work on BRAIN2" → three ordered steps, each with its hedge. */
export function splitSteps(sentence: string): { what: string; hedge: Hedge }[] {
  const parts = sentence
    .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/gi, " ")
    .split(/,|;|\band then\b|\bthen\b|\bafter that\b|\bafterwards\b/i)
    .map((p) => p.trim())
    .filter(Boolean)
  const out: { what: string; hedge: Hedge }[] = []
  for (const part of parts) {
    const hedge = hedgeOf(part)
    let what = part
    for (let i = 0; i < 4; i++) what = what.replace(LEAD, "")
    what = what.replace(/^(?:and|then|to)\s+/i, "").replace(/[.!?\s]+$/g, "").trim()
    if (contentWords(what).length === 0 && !/[a-z]{3,}/i.test(what)) continue
    if (what.length < 3) continue
    out.push({ what: what.slice(0, 120), hedge })
  }
  return out
}

/** A shouted to-do says itself several times ("CALL SHELBY I NEED TO I NEED TO …"): keep the thing, drop the pleading. */
export function todoWhat(s: string): string {
  const cut = s.replace(/\b(i\s+need\s+to|i\s+have\s+to|i\s+guess|i\s+should|i\s+must|today\s+is\s+the\s+best\s+day.*$)\b.*$/i, "").trim()
  const what = (cut.length >= 3 ? cut : s).replace(/[.!?\s]+$/g, "").trim()
  const letters = what.replace(/[^A-Za-z]/g, "")
  const shouted = letters.length >= 4 && letters.replace(/[^A-Z]/g, "").length / letters.length >= 0.8
  return (shouted ? what.toLowerCase() : what).slice(0, 120)
}

// ── Feelings ───────────────────────────────────────────────────────────

const RESIST: [RegExp, Scale][] = [
  [/\b(dread\w*|can'?t make myself|can'?t bring myself|terrified|hate (?:doing|having)|avoiding|been avoiding|putting (?:it )?off)\b/i, 4],
  [/\b(don'?t want to|do not want to|ugh+|scared to|nervous about|anxious about|not looking forward|procrastinat\w*)\b/i, 3],
  [/\b(i guess|should probably|i suppose|kind of don'?t|meh)\b/i, 2],
]
const EXCITE: [RegExp, Scale][] = [
  [/\b(can'?t wait|so excited|really excited|pumped|stoked|thrilled)\b/i, 4],
  [/\b(excited|looking forward|love to|eager|psyched)\b/i, 3],
  [/\b(want to|wanna|would like to|keen|fun)\b/i, 2],
]
const AFTER: [RegExp, Scale][] = [
  [/\b(so proud|really proud|very proud|amazing|great|fantastic|loved it|thrilled|proud)\b/i, 4],
  [/\b(positive|positively|happy|glad|good|nice|satisfied|grateful|calm|relieved|worth it|confident)\b/i, 3],
  [/\b(fine|ok|okay|alright|not bad|neutral)\b/i, 2],
  [/\b(meh|bored|tired|drained|disappointed|frustrated|annoyed|stressed|overwhelmed|anxious|sad)\b/i, 1],
  [/\b(awful|terrible|hate|hated|regret\w*|guilty|ashamed|wasted|worst)\b/i, 0],
]

const first = (table: [RegExp, Scale][], s: string): Scale | undefined => table.find(([re]) => re.test(s))?.[1]

/** How loudly it was said: mostly capitals. */
function shouting(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, "")
  return letters.length >= 8 && letters.replace(/[^A-Z]/g, "").length / letters.length >= 0.8
}

/** Pull, push and importance before a step, from the words alone. Empty when the words carry none. */
export function beforeFeeling(s: string): { excitement?: Scale; resistance?: Scale; importance?: Scale } {
  const out: { excitement?: Scale; resistance?: Scale; importance?: Scale } = {}
  const needs = (s.match(/\b(need to|have to|must|gotta)\b/gi) ?? []).length
  let resistance = first(RESIST, s)
  // Saying "I need to" over and over, or shouting it, is someone pushing against their own push-back.
  if (needs >= 2 || (needs >= 1 && shouting(s))) resistance = Math.max(resistance ?? 0, 3) as Scale
  if (resistance !== undefined) out.resistance = resistance
  const excitement = first(EXCITE, s)
  if (excitement !== undefined) out.excitement = excitement
  if (needs >= 2 || shouting(s) || /\b(important|urgent|really need|asap|best day to)\b/i.test(s)) out.importance = needs >= 2 || shouting(s) ? 4 : 3
  return out
}

/** Satisfaction after, and what it is about ("proud of myself because I woke up early" → 4, "I woke up early"). */
export function afterFeeling(s: string): { satisfaction?: Scale; about?: string } {
  const satisfaction = first(AFTER, s)
  const about = /\b(?:because|since|after|for|that)\s+(i\s+[^.!?]{3,80}|[a-z][^.!?]{3,80})/i.exec(s)?.[1]?.replace(/[.!?\s]+$/g, "").trim()
  return { ...(satisfaction !== undefined ? { satisfaction } : {}), ...(about ? { about } : {}) }
}

const DISPLACED = /\b(didn'?t|did not|never got to|skipped|instead of)\b[\s\S]{0,60}?\b(?:ended up|instead|just)\s+([a-z][^.!?;,]{2,50})/i
const DISPLACED_ALT = /\bended up\s+([a-z][^.!?;,]{2,50})\s+instead(?:\s+of\s+([a-z][^.!?;,]{2,50}))?/i

/** "Didn't; ended up scrolling" / "ended up scrolling instead of tidying". */
export function displacementIn(s: string): { by: string; missed?: string } | null {
  const alt = DISPLACED_ALT.exec(s)
  if (alt) return { by: alt[1]!.trim(), ...(alt[2] ? { missed: alt[2].trim() } : {}) }
  const m = DISPLACED.exec(s)
  if (!m) return null
  const missed = /\binstead of\s+([a-z][^.!?;,]{2,50})/i.exec(s)?.[1]?.trim()
  return { by: m[2]!.replace(/\binstead\b.*$/i, "").trim(), ...(missed ? { missed } : {}) }
}

// ── Reading ────────────────────────────────────────────────────────────

const ACTION_ROUTES: Record<string, ActionKind> = { activity: "activity", count: "count", food: "food", drink: "drink" }
const DID = /\b(woke up|got up|showered|stretched|walked|went for|cleaned|tidied|cooked|called|emailed|finished|started|worked on|did the|washed)\b/i
const FUTURE = /\b(gonna|going to|about to|plan to|planning to|i'll|will|want to|need to|have to|gotta|maybe i|then i)\b/i
const FEEL = /\b(proud|positive|happy|sad|anxious|tired|stressed|calm|grateful|glad|excited|confident|overwhelmed|frustrated|bored|feel|feeling|dread\w*|regret\w*|guilty)\b/i

/** The route a plain chat line would have, for lines the Stream BIMBY never saw. */
export function routeOf(text: string): string {
  if (displacementIn(text)) return "note"
  if (FUTURE.test(text)) return "plan"
  if (FEEL.test(text)) return "mood"
  return "note"
}

function hintSteps(hint: ModelHint | undefined, text: string): { what: string; hedge: Hedge }[] | null {
  if (!hint?.steps || !Array.isArray(hint.steps)) return null
  const out: { what: string; hedge: Hedge }[] = []
  for (const s of hint.steps) {
    const what = typeof s.what === "string" ? s.what.replace(/\s+/g, " ").trim() : ""
    // A step the text does not carry is the model's invention.
    if (!what || what.length > 120 || overlap(what, text) < 0.5) return null
    out.push({ what, hedge: s.hedge === "must" || s.hedge === "maybe" || s.hedge === "will" ? s.hedge : hedgeOf(what) })
  }
  return out.length ? out : null
}

function newStep(intentionId: string, order: number, what: string, hedge: Hedge): Step {
  return { id: `${intentionId}_${order}`, intentionId, order, what, hedge, verdict: "open", standing: "proposed", repeats: [], asked: [] }
}

/** Read pieces, in order, into records. `now` gives the day; each piece gives its minute. */
export function readPieces(pieces: ReadPiece[], now: Date, source: RecordSource): Reading {
  const day = dayKey(now)
  const out: Reading = { intentions: [], actions: [], feelings: [], displacements: [] }
  for (const p of pieces) {
    const at = isoAt(now, p.hhmm)
    const moved = displacementIn(p.text)
    if (moved) out.displacements.push({ ...moved, at, said: p.text })

    if (p.route === "plan" || p.route === "todo") {
      const id = hashId("in", day, p.text)
      const fromModel = hintSteps(p.hint, p.text)
      const parts = fromModel ?? (p.route === "todo" ? [{ what: todoWhat(p.payload ?? p.text), hedge: "must" as Hedge }] : splitSteps(p.text))
      if (!parts.length) continue
      const steps = parts.map((s, i) => newStep(id, i, s.what, s.hedge))
      out.intentions.push({ id, at, day, said: p.text, steps, source })
      const rules = beforeFeeling(p.text)
      const felt = {
        excitement: asScale(p.hint?.excitement) ?? rules.excitement,
        resistance: asScale(p.hint?.resistance) ?? rules.resistance,
        importance: asScale(p.hint?.importance) ?? rules.importance,
      }
      // A stated feeling belongs to a one-step plan. Over several steps the words do not say which, so it is asked.
      if (steps.length === 1 && (felt.excitement !== undefined || felt.resistance !== undefined || felt.importance !== undefined)) {
        const byModel = asScale(p.hint?.excitement) !== undefined || asScale(p.hint?.resistance) !== undefined
        out.feelings.push({ id: hashId("fb", steps[0]!.id), at, day, phase: "before", stepId: steps[0]!.id, ...clean(felt), words: p.text, by: byModel ? "model" : "said", standing: "proposed" })
      }
      continue
    }

    const kind = ACTION_ROUTES[p.route] ?? (p.route === "note" && !moved && DID.test(p.text) && !FUTURE.test(p.text) ? "other" : null)
    if (kind) {
      const what = (p.payload ?? p.text).replace(/\s+/g, " ").trim().slice(0, 80)
      const id = hashId("ac", day, p.hhmm, what.toLowerCase())
      const wake = /\b(woke up|got up)\b/i.test(p.text)
      out.actions.push({ id, day, at, ...(p.end ? { end: isoAt(now, p.end) } : {}), what, kind: wake ? "wake" : kind, said: p.text, source, asked: [] })
    }

    if (p.route === "mood" || (FEEL.test(p.text) && p.route === "note")) {
      const rules = afterFeeling(p.text)
      const satisfaction = asScale(p.hint?.satisfaction) ?? rules.satisfaction
      const about = typeof p.hint?.about === "string" && p.hint.about.trim() && overlap(p.hint.about, p.text) >= 0.5 ? p.hint.about.trim() : rules.about
      if (satisfaction === undefined) continue
      out.feelings.push({
        id: hashId("fa", day, p.text),
        at,
        day,
        phase: "after",
        ...(about ? { aboutWords: about } : {}),
        satisfaction,
        words: p.text,
        by: asScale(p.hint?.satisfaction) !== undefined ? "model" : "said",
        standing: "proposed",
      })
    }
  }
  return out
}

function clean<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
