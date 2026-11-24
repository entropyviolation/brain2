/**
 * lib/geniuses/reply.ts — Check a model's answer, or say it from the script (pure)
 *
 * The model's JSON must pass every check, or the scripted ladder answers instead. The assignment's title is never in the
 * reply, so the model cannot change it. On the last exchange a genius must concede or reschedule.
 */

import { clip, LINE_MAX } from "./sanitize"
import { GENIUS_STANCES, type CouncilAsk, type CouncilReply, type GeniusReply, type GeniusStance } from "./types"

export const MAX_TURNS = 6

/** Shame, guilt, threats and fake urgency. A line with any of these is refused. */
const SHAME = /\b(ashamed|shame on|lazy|disappoint\w*|failure|failing you|guilt\w*|you always|you never|finally|last chance|or else|no excuses?|pathetic|useless|hurry|right now or)\b/i

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** At most two sentences, kept whole. */
export function twoSentences(text: string): string {
  const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g) ?? []
  return parts.slice(0, 2).join(" ").replace(/\s+/g, " ").trim()
}

export type Checked<T> = { ok: true; value: T } | { ok: false; why: string }

export function checkReply(raw: unknown, turn: number, maxTurns = MAX_TURNS): Checked<GeniusReply> {
  const o = obj(raw)
  if (typeof o.line !== "string" || !o.line.trim()) return { ok: false, why: "no line" }
  if (o.line.length > LINE_MAX) return { ok: false, why: `line over ${LINE_MAX} characters` }
  const line = twoSentences(o.line)
  if (SHAME.test(line)) return { ok: false, why: "shame or pressure words" }
  if (!GENIUS_STANCES.includes(o.stance as GeniusStance)) return { ok: false, why: `stance "${String(o.stance)}" is not one of ${GENIUS_STANCES.join(", ")}` }
  const stance = o.stance as GeniusStance
  if (turn >= maxTurns && stance !== "concede" && stance !== "reschedule") return { ok: false, why: "last exchange must concede or reschedule" }
  const reply: GeniusReply = { line, stance }
  if (stance === "split") {
    const smaller = clip(o.smaller, 140)
    if (!smaller) return { ok: false, why: "split with no smaller step" }
    reply.smaller = smaller
  }
  if (stance === "reschedule") {
    const when = clip(o.when, 60)
    if (when) reply.when = when
  }
  const keep = clip(obj(o.keep).said, 200)
  if (keep) reply.keep = { said: keep, about: null }
  return { ok: true, value: reply }
}

const LATER = /\b(tomorrow|tonight|later|this (?:evening|afternoon|weekend)|on (?:mon|tues|wednes|thurs|fri|satur|sun)day|next week|in the morning|after (?:work|lunch|dinner))\b/i
const CANT = /\b(can'?t|cannot|too tired|exhausted|sick|ill|no time|not today|overwhelmed|burn(?:ed|t) out)\b/i

/** The scripted ladder: soften, then split, then reschedule, then concede. Used when the model is off, down, or failed a check. */
export function scriptedReply(input: { turn: number; said: string; task: string; maxTurns?: number }): GeniusReply {
  const max = input.maxTurns ?? MAX_TURNS
  const later = LATER.exec(input.said)?.[0]
  if (later) return { line: `${later[0]!.toUpperCase()}${later.slice(1)} works. I will ask again then.`, stance: "reschedule", when: later }
  if (input.turn >= max || CANT.test(input.said)) return { line: "That is a real reason. Not today, then.", stance: "concede" }
  if (input.turn <= 1) return { line: `I hear you. It still matters to me that “${input.task}” moves.`, stance: "soften" }
  if (input.turn === 2) return { line: "What if it were only the first five minutes?", stance: "split", smaller: `Start ${input.task}, five minutes` }
  return { line: "Then pick a time that suits you, and I will hold you to it gently.", stance: "reschedule" }
}

export function checkAsk(raw: unknown, geniusId: string): Checked<CouncilAsk> {
  const o = obj(raw)
  const ask = typeof o.ask === "string" ? twoSentences(o.ask) : ""
  if (!ask) return { ok: false, why: "no ask" }
  if (ask.length > LINE_MAX) return { ok: false, why: "ask too long" }
  const why = typeof o.why === "string" ? twoSentences(o.why) : ""
  if (SHAME.test(ask) || SHAME.test(why)) return { ok: false, why: "shame or pressure words" }
  return { ok: true, value: { geniusId, ask, why: clip(why, LINE_MAX), by: "model" } }
}

/** `yieldsTo` is a genius's name in the model's answer; it is mapped to an id here. An unknown name holds. */
export function checkCouncilReply(raw: unknown, geniusId: string, nameToId: Record<string, string>): Checked<CouncilReply> {
  const o = obj(raw)
  const line = typeof o.line === "string" ? twoSentences(o.line) : ""
  if (!line) return { ok: false, why: "no line" }
  if (SHAME.test(line)) return { ok: false, why: "shame or pressure words" }
  const name = typeof o.yieldsTo === "string" ? o.yieldsTo.trim().toLowerCase() : ""
  const to = name ? nameToId[name] ?? null : null
  return { ok: true, value: { geniusId, line, yieldsTo: to && to !== geniusId ? to : null, by: "model" } }
}
