/**
 * lib/stream-bimby/parse.ts — A stream of thought, minute by minute, read into filings to propose
 *
 * One message can run through a day: "8:17 hit dab pen", "9:27- 10:05 scrolling", "add to inbox: …",
 * a pasted link, a plan in future tense, a feeling. This file reads it with rules only (no model)
 * into one proposed filing per piece. A filing is one line in a command the BIM executor already
 * runs (`inbox:`, `shopping:`, `track:`, `intake food:`, `intake drink:`, `log:`, `note:`,
 * `to do today:`), so an accepted line lands in the same stores as if it were typed.
 *
 * Nothing is written here. The result is a `ReportPlan` (the Report BIMBY's shape), so the same
 * card draws it and Accept goes through `lib/stream-bimby/apply.ts`.
 */
import type { Effect, EffectField, ReportPlan } from "@/lib/report-bimby/types"

export const ROUTES = ["inbox", "shopping", "link", "todo", "count", "food", "drink", "activity", "plan", "mood", "note"] as const
export type Route = (typeof ROUTES)[number]

export const ROUTE_LABEL: Record<Route, string> = {
  inbox: "Inbox",
  shopping: "Shopping list",
  link: "Links",
  todo: "To Do today",
  count: "Tracking counts",
  food: "Tracking food",
  drink: "Tracking drinks",
  activity: "Tracking activity",
  plan: "Notes plan",
  mood: "Notes mood",
  note: "Notes",
}

export interface Filing {
  route: Route
  /** The executor line. Editable on the card. */
  line: string
  /** Why this filing, in one sentence. */
  reasoning: string
  /** The piece of the stream it came from. */
  source: string
}

export interface Clock {
  hhmm: string
  end?: string
  est: boolean
}

// ── Times ──────────────────────────────────────────────────────────────

const WINDOW = /\b(\d{1,2}):(\d{2})\s*(am|pm)?\s*(?:-|–|—|to|until)\s*(\d{1,2}):(\d{2})\s*(am|pm)?\b/i
const CLOCK = /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i
/** "since 817" with no colon: only after one of these words, so a stray number is never a time. */
const SINCE = /\b(?:since|at|around|from)\s+(\d{3,4})\b/i
const EST = /\b(est|estimated|around|about)\b|~/i

/** 24-hour HH:MM. "1:57 pm" is 13:57; a bare 1–6 is afternoon; 7–12 stays as written. */
function hhmm(h: number, m: number, ampm?: string): string {
  let hour = h
  if (ampm) hour = (h % 12) + (ampm.toLowerCase().startsWith("p") ? 12 : 0)
  else if (h >= 1 && h <= 6) hour = h + 12
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function readClock(s: string): Clock | null {
  const est = EST.test(s)
  const w = WINDOW.exec(s)
  if (w) return { hhmm: hhmm(+w[1]!, +w[2]!, w[3]), end: hhmm(+w[4]!, +w[5]!, w[6] ?? w[3]), est }
  const c = CLOCK.exec(s)
  if (c) return { hhmm: hhmm(+c[1]!, +c[2]!, c[3]), est }
  const since = SINCE.exec(s)
  if (since) {
    const digits = since[1]!
    const h = digits.length === 3 ? +digits[0]! : +digits.slice(0, 2)
    const m = +digits.slice(-2)
    if (h >= 1 && h <= 12 && m < 60) return { hhmm: hhmm(h, m), est }
  }
  return null
}

const pad = (n: number) => String(n).padStart(2, "0")

// ── Text helpers ───────────────────────────────────────────────────────

/** Strip clock words and trailing filler, so a payload reads as its thing. */
export function cleanPayload(s: string): string {
  let out = s
    .replace(new RegExp(WINDOW.source, "gi"), " ")
    .replace(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/gi, " ")
    .replace(/[~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  for (let i = 0; i < 3; i++) out = out.replace(/\b(?:at|around|about|from|since|est|estimated)\s*$/i, "").trim()
  out = out.replace(/^(?:at|around|about|from|since|est|estimated)\s+/i, "")
  return out.replace(/^[\s,.;:–—-]+|[\s,.;:–—-]+$/g, "").trim()
}

const URL_RE = /https?:\/\/\S+|\bwww\.\S+/i
const PREFIX_DEST = /^\s*add to\s+([^:\-–—]+?)\s*[:\-–—]\s*([\s\S]+)$/i
const SUFFIX_DEST = /\s+add to\s+([a-z][a-z ]{1,30}?)\s*[.!]?\s*$/i
const DRINK = /\b(coffee|tea|water|soda|juice|milk|beer|wine|smoothie|espresso|latte|matcha)\b/i
const FOOD = /\b(samosa|samosas|tikka|food|meal|lunch|dinner|breakfast|snack|eggs?|toast|rice|chicken|pizza|sandwich|fries|soup|salad)\b/i
const ATE = /\b(?:ate|eat)\s+(?:\d+\s+|an?\s+|the\s+|some\s+)?([a-z][a-z]*)/i
const PAST = /\b(ate|drank|had|made)\b/i
const FUTURE = /\b(gonna|going to|about to|plan|planning|maybe|then|will|want to|need to|have to|i'll|i'm going)\b/i
const MOOD = /\b(proud|positive|positively|happy|sad|anxious|tired|stressed|calm|grateful|glad|excited|confident|overwhelmed|frustrated|bored|feel|feeling|mood|good feeling)\b/i
const ACTIVITY = /\b(scroll\w*|youtube|watch\w*|stretch\w*|walk\w*|clean\w*|washing|tidy\w*|working|reading|dishes)\b/i
const ACTION_START = /^\s*(call|remind me|buy|email|text|pay|book|schedule)\b/i

function isShouting(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, "")
  if (letters.length < 8) return false
  const upper = letters.replace(/[^A-Z]/g, "").length
  return upper / letters.length >= 0.8
}

/** Where a named place in "add to …" goes. */
export function destRoute(name: string): Route | null {
  const n = name.toLowerCase()
  if (/inbox/.test(n)) return "inbox"
  if (/shop|grocer|groc/.test(n)) return "shopping"
  if (/link|url|bookmark/.test(n)) return "link"
  if (/to ?do|todo|task/.test(n)) return "todo"
  if (/count/.test(n)) return "count"
  if (/food/.test(n)) return "food"
  if (/drink|coffee|water/.test(n)) return "drink"
  if (/mood|feeling/.test(n)) return "mood"
  if (/writ|journal|note|thought/.test(n)) return "note"
  return null
}

/** The line the executor reads for a route. */
export function lineFor(route: Route, payload: string, t: Clock | null, extra = ""): string {
  const at = t ? ` at ${t.hhmm}${t.est ? " est" : ""}` : ""
  switch (route) {
    case "inbox":
      return `inbox: ${payload}`
    case "shopping":
      return `shopping: ${payload}`
    case "link":
      return payload
    case "todo":
      return `to do today: ${payload}`
    case "count":
      return `log: ${payload}${at}`
    case "food":
      return `intake food: ${payload}${at}`
    case "drink":
      return `intake drink: ${payload}${at}`
    case "activity":
      return `track: ${payload} ${t?.hhmm ?? ""}${t?.end ? `-${t.end}` : ""}`.trim()
    case "plan":
      return `note: planned: ${payload}${at}`
    case "mood":
      return `note: mood: ${payload}${at}`
    case "note":
      return `note: ${extra}${payload}${at}`
  }
}

function activityName(body: string): string {
  let s = cleanPayload(body)
  for (let i = 0; i < 3; i++) s = s.replace(/^(?:doing|went for a|went for|went|for a|i was|i'm|i am|a)\s+/i, "")
  if (/walk/i.test(s)) return "walk"
  if (/scroll/i.test(s)) return "scrolling"
  if (/stretch/i.test(s)) return "stretching"
  return s.slice(0, 60) || "activity"
}

function foodName(payload: string): string {
  const food = FOOD.exec(payload) ?? DRINK.exec(payload)
  if (food) return food[1]!.toLowerCase()
  const ate = ATE.exec(payload)
  if (ate) return ate[1]!.toLowerCase()
  return payload.replace(/^(?:ate|drank|had|made)\s+(?:\d+\s+|an?\s+|the\s+|some\s+)?/i, "").slice(0, 60) || "food"
}

// ── Reading ────────────────────────────────────────────────────────────

/** Lines, then sentences: each piece is read on its own, in order. */
export function segments(text: string): string[] {
  return text
    .split(/\r?\n/)
    .flatMap((l) => l.split(/(?<=[.!?])\s+(?=\S)/))
    .map((s) => s.trim())
    .filter((s) => /[A-Za-z0-9]/.test(s))
}

/** Whether a message is a stream rather than one chat line: an "add to …" directive, or several timed lines. */
export function looksLikeStream(text: string): boolean {
  if (/\badd to\b/i.test(text) && text.trim().length >= 20) return true
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const clocks = (text.match(/\b\d{1,2}:\d{2}\b/g) ?? []).length
  return lines.length >= 3 && clocks >= 2
}

/** Read one piece. `t` is its time: its own, or the one above it, or the send time. */
export function classify(seg: string, t: Clock, own: Clock | null): Filing {
  const source = seg.length > 160 ? `${seg.slice(0, 157)}…` : seg
  const clockWord = own ? "" : " No time in this piece, so the time above it is used."
  const at = (reason: string): string => reason + clockWord

  // 1. A named place: "add to inbox: …", "add to links - …".
  const pre = PREFIX_DEST.exec(seg)
  if (pre) {
    const route = destRoute(pre[1]!)
    if (route) {
      const payload = cleanPayload(pre[2]!)
      if (route === "link") {
        const url = URL_RE.exec(payload)
        if (url) return { route, line: url[0], reasoning: `Said "add to ${pre[1]!.trim()}".`, source }
      }
      if (route === "inbox" || route === "shopping" || route === "todo") return { route, line: lineFor(route, payload, t), reasoning: `Said "add to ${pre[1]!.trim()}".`, source }
      return { route, line: lineFor(route, route === "food" || route === "drink" ? foodName(payload) : payload, t), reasoning: at(`Said "add to ${pre[1]!.trim()}".`), source }
    }
  }
  // 1b. A place at the end: "coffee at around 9:15 add to drinks tracking".
  const suf = SUFFIX_DEST.exec(seg)
  if (suf) {
    const route = destRoute(suf[1]!)
    if (route) {
      const payload = cleanPayload(seg.slice(0, suf.index))
      const named = route === "food" || route === "drink" ? foodName(payload) : payload
      return { route, line: lineFor(route, named, t), reasoning: at(`Said "add to ${suf[1]!.trim()}".`), source }
    }
  }
  // 2. A link on its own.
  const url = URL_RE.exec(seg)
  if (url) return { route: "link", line: url[0], reasoning: "A link in the stream. Filed to Links.", source }
  // 3. A start and an end: a block of activity.
  if (own?.end) {
    const name = activityName(seg)
    return { route: "activity", line: lineFor("activity", name, { ...own, hhmm: own.hhmm, end: own.end }), reasoning: "A start and an end time: a block of activity.", source }
  }
  // 4. The dab pen (or any pen) tapped: a count.
  if (/\bdab pen\b|\bpen\b/i.test(seg) && /\b(hit|hits|tap|tapped|once|again|dab)\b/i.test(seg)) {
    const pen = /\bdab pen\b/i.test(seg) ? "dab pen" : "pen"
    return { route: "count", line: lineFor("count", pen, t), reasoning: at(`A tap on the ${pen}. Filed as a count at its time.`), source }
  }
  // 5. Food or drink taken in the past: intake, at its time.
  const drink = DRINK.exec(seg)
  const food = FOOD.exec(seg) ?? ATE.exec(seg)
  if (PAST.test(seg) && (drink || food)) {
    const drinkFirst = !!drink && (!food || drink.index < (food.index ?? 0))
    const route: Route = drinkFirst ? "drink" : "food"
    const name = drinkFirst ? drink![1]!.toLowerCase() : foodName(seg)
    return { route, line: lineFor(route, name, t), reasoning: at(`Food or drink said in the past tense: ${name}.`), source }
  }
  // 6. A thing to do, said loudly or as a request.
  if (isShouting(seg) || ACTION_START.test(seg)) {
    return { route: "todo", line: lineFor("todo", cleanPayload(seg), t), reasoning: "Said as a thing to do. Filed to To Do today.", source }
  }
  // 7. Future tense: a plan, kept with the time it was made so it can be compared later.
  if (FUTURE.test(seg)) {
    return { route: "plan", line: lineFor("plan", cleanPayload(seg), t), reasoning: at("Future tense: a plan. Kept with the time it was made, so the outcome can be compared later."), source }
  }
  // 8. A feeling.
  if (MOOD.test(seg)) {
    return { route: "mood", line: lineFor("mood", cleanPayload(seg), t), reasoning: at("A feeling in the words. Filed as a mood note."), source }
  }
  // 9. An activity with no end: a note, so it is not guessed into a block.
  if (ACTIVITY.test(seg)) {
    return { route: "note", line: lineFor("note", cleanPayload(seg), t), reasoning: at("What you were doing, with no end time. Kept as a note; give an end time to make a block."), source }
  }
  // 10. Nothing matched: a note, so nothing is lost.
  return { route: "note", line: lineFor("note", cleanPayload(seg), t), reasoning: at("No rule matched. Kept as a note so nothing is lost."), source }
}

/** One piece of the stream, with the time it is filed at. */
export interface Piece {
  index: number
  text: string
  own: Clock | null
  /** Its own time, or the one above it, or the send time. */
  t: Clock
  /** No time was said at or above this piece. */
  noTime: boolean
}

export function pieces(text: string, now: Date): { pieces: Piece[]; timed: number } {
  const fallback: Clock = { hhmm: `${pad(now.getHours())}:${pad(now.getMinutes())}`, est: true }
  const out: Piece[] = []
  let current: Clock | null = null
  let timed = 0
  for (const [index, seg] of segments(text).entries()) {
    const own = readClock(seg)
    if (own) {
      timed++
      current = own.end ? { hhmm: own.end, est: own.est } : own
    }
    out.push({ index, text: seg, own, t: own ?? current ?? fallback, noTime: !own && !current })
  }
  return { pieces: out, timed }
}

/** Rules only: one filing per piece, in order, with the piece it came from. */
export function ruleFilings(ps: Piece[]): { piece: Piece; filing: Filing }[] {
  return ps.map((piece) => {
    const filing = classify(piece.text, piece.t, piece.own)
    if (piece.noTime) filing.reasoning += " No time said yet, so the send time is used."
    return { piece, filing }
  })
}

/** The plan: repeats proposed once, every filing an Effect. */
export function planFrom(text: string, now: Date, filings: Filing[], trace: string[]): ReportPlan {
  const id = `stream_${now.getTime().toString(36)}`
  const seen = new Set<string>()
  const kept: Filing[] = []
  for (const f of filings) {
    const key = f.line.toLowerCase()
    if (seen.has(key)) {
      trace.push(`"${f.source}" repeats a line already proposed.`)
      continue
    }
    seen.add(key)
    kept.push(f)
  }
  const effects: Effect[] = kept.map((f, i) => {
    const fields: EffectField[] = [{ key: "line", label: "Line BIM files", type: "text", value: f.line }]
    return {
      id: `${id}-${i}`,
      kind: "line",
      title: `${ROUTE_LABEL[f.route]}: ${f.source.length > 70 ? `${f.source.slice(0, 67)}…` : f.source}`,
      reasoning: [f.reasoning],
      evidence: [`“${f.source}”`],
      fields,
      status: "pending",
    }
  })
  return { id, text, at: now.toISOString(), trace, effects }
}

/** The whole stream as a plan, by rules alone. */
export function buildStreamPlan(text: string, now: Date): ReportPlan {
  const { pieces: ps, timed } = pieces(text, now)
  const trace = [`Read ${ps.length} piece${ps.length === 1 ? "" : "s"} of the stream; ${timed} had a time.`]
  return planFrom(text, now, ruleFilings(ps).map((r) => r.filing), trace)
}
