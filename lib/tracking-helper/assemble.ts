/**
 * lib/tracking-helper/assemble.ts — Turn the model's wiring into blocks, in code
 *
 * The model said which tag is each block's start and end. Everything else is decided here:
 * - **Clocks** are placed by continuity (`clock.ts`), days by the day words (`resolveDay`).
 * - **Certainty** comes from the words near each clock (`tokens.ts`). The model may call an edge
 *   vague ("at least", "potentially longer") and make it estimated; it can never make one firmer.
 *   A range joined by a dash ("6:30 - 7:19 ish") is as sure as its worse end.
 * - **Chaining**: a block with no start begins where the block before it ended, and one with no
 *   end finishes where the next begins, taking that edge's certainty. "by 6:22 the trash was
 *   done" and "dishes until 6:19" give the trash its start for free.
 * - **Overnight**: an end that reads earlier than its start ends the next day (endMin past 1440), up to 16 hours.
 * - **Stand-ins**: a start with no end gets `DEFAULT_OPEN_MIN` minutes, estimated and flagged
 *   `openEnd`, so the card asks for the real end instead of hiding the gap.
 * - **Places** are said, learned from the person's own history, or assumed for a chore (`places.ts`).
 */

import { dateKey, placeClocks, resolveDay, clockText } from "./clock"
import { resolvePlace } from "./places"
import type { Cert, HelperContext, ProposedBlock, Token, WiredSegment, Wiring } from "./types"

export const DEFAULT_OPEN_MIN = 30
/** The longest block an end earlier than its start may be read as running into the next day. */
export const MAX_OVERNIGHT_MIN = 16 * 60

export interface Assembled {
  blocks: ProposedBlock[]
  /** Segments the text gave no time for, in the person's words, so the chat can say so. */
  unplaced: string[]
}

export function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const worse = (a: Cert, b: Cert): Cert => (a === "estimated" || b === "estimated" ? "estimated" : "exact")

/** How firmly a clock was said. A strong cue stays firm, a hedge is final, otherwise the model's `vague` may soften it. */
function certOf(t: Token | undefined, vague: boolean): Cert {
  if (!t) return "estimated"
  if (t.cue === "strong") return "exact"
  return t.cue === "hedge" || vague ? "estimated" : "exact"
}

/** Two tags written as a range ("6:30 - 7:19") are read together. */
function joined(text: string, a: Token, b: Token): boolean {
  return /^\s*(?:-|–|—|to|until|til|till|through)\s*$/i.test(text.slice(a.at + a.raw.length, b.at))
}

/** The sentence holding `at`, trimmed, for the card's "from your words" line. */
function sentenceAround(text: string, at: number): string {
  let a = at
  while (a > 0 && !/[.!?\n]/.test(text[a - 1]!)) a--
  let b = at
  while (b < text.length && !/[.!?\n]/.test(text[b]!)) b++
  return text.slice(a, b).trim().slice(0, 160)
}

interface Draft {
  seg: Wiring["segments"][number]
  day: string | null
  start: number | null
  end: number | null
  startCert: Cert
  endCert: Cert
  startChained?: boolean
  endChained?: boolean
  len: number | null
}

/**
 * Clocks the model left unused, handed to the entry they sit beside. "…then I took out the trash … by 6:22
 * the trash stuff was done" often comes back with the trash and no clock. An unused clock that falls
 * between the clocks of the entries before and after (in the text) completes an entry that lacks a start or
 * an end: after the start it is the end, before the end it is the start, and with neither it is the end when
 * the entry before it ended (the start is then chained) and the start otherwise.
 */
export function adoptOrphans(segments: WiredSegment[], tokens: Token[]): WiredSegment[] {
  const byId = new Map(tokens.map((t) => [t.id, t]))
  const clock = (id: string) => (byId.get(id)?.kind === "clock" ? byId.get(id) : undefined)
  const refs = (s: WiredSegment) => [s.start, s.end, s.maybeEnd].map(clock).filter((t): t is Token => !!t)
  const used = new Set(segments.flatMap((s) => refs(s).map((t) => t.id)))
  const taken = new Set<string>()
  const orphans = tokens.filter((t) => t.kind === "clock" && !used.has(t.id))
  if (!orphans.length) return segments
  return segments.map((seg, i) => {
    const hasStart = !!clock(seg.start)
    const hasEnd = !!clock(seg.end)
    if (hasStart && hasEnd) return seg
    const lo = Math.max(-1, ...segments.slice(0, i).flatMap((s) => refs(s).map((t) => t.at)))
    const hi = Math.min(Infinity, ...segments.slice(i + 1).flatMap((s) => refs(s).map((t) => t.at)))
    const startAt = clock(seg.start)?.at ?? lo
    const endAt = clock(seg.end)?.at ?? hi
    const mine = orphans.filter((o) => !taken.has(o.id) && o.at > startAt && o.at < endAt)
    if (!mine.length) return seg
    const out = { ...seg }
    if (hasStart) out.end = mine[0]!.id
    else if (hasEnd) out.start = mine[mine.length - 1]!.id
    else if (mine.length >= 2) {
      out.start = mine[0]!.id
      out.end = mine[mine.length - 1]!.id
    } else if (i > 0 && (clock(segments[i - 1]!.end) || segments[i - 1]!.end)) out.end = mine[0]!.id
    else out.start = mine[0]!.id
    for (const id of [out.start, out.end]) taken.add(id)
    return out
  })
}

export function assemble(raw: Wiring, tokens: Token[], text: string, ctx: HelperContext, openMin = DEFAULT_OPEN_MIN, fixed?: Map<string, number>): Assembled {
  const wiring: Wiring = { segments: adoptOrphans(raw.segments.filter((s) => s.activity.trim()), tokens) }
  // A "maybe until" tag that is another entry's start or end is a mix-up, not a possible end.
  const edgeIds = new Set(wiring.segments.flatMap((s) => [s.start, s.end]).filter(Boolean))
  wiring.segments = wiring.segments.map((s) => (edgeIds.has(s.maybeEnd) ? { ...s, maybeEnd: "" } : s))
  const byId = new Map(tokens.map((t) => [t.id, t]))
  const minutes = placeClocks(tokens, fixed)
  const clockOf = (id: string) => (byId.get(id)?.kind === "clock" ? minutes.get(id) ?? null : null)
  const tokenOf = (id: string) => (byId.get(id)?.kind === "clock" ? byId.get(id) : undefined)

  // The day each token sits under: the latest day word before it.
  const sectionDay = (tok: Token | undefined): string | null => {
    if (!tok) return null
    let day: string | null = null
    for (const t of tokens) {
      if (t.at > tok.at) break
      if (t.kind === "day") day = resolveDay(t.raw, ctx.now) ?? day
    }
    return day
  }

  const nowMin = ctx.now.getHours() * 60 + ctx.now.getMinutes()
  const today = dateKey(ctx.now)
  const yesterday = dateKey(new Date(ctx.now.getFullYear(), ctx.now.getMonth(), ctx.now.getDate() - 1, 12))
  let lastDay: string | null = null

  const drafts: Draft[] = []
  const unplaced: string[] = []
  for (const seg of wiring.segments) {
    const activity = seg.activity.trim()
    if (!activity) continue
    const startTok = tokenOf(seg.start)
    const endTok = tokenOf(seg.end)
    const len = byId.get(seg.length)?.kind === "dur" ? byId.get(seg.length)!.minutes ?? null : null
    let start = startTok ? clockOf(seg.start) : null
    let end = endTok ? clockOf(seg.end) : null
    let startCert = certOf(startTok, seg.startVague)
    let endCert = certOf(endTok, seg.endVague)
    if (startTok && endTok && joined(text, startTok, endTok)) {
      const both = worse(startCert, endCert)
      if (startTok.cue !== "strong") startCert = both
      if (endTok.cue !== "strong") endCert = both
    }
    if (start !== null && end === null && len) {
      end = start + len
      endCert = "estimated"
    }
    if (end !== null && start === null && len) {
      start = end - len
      startCert = "estimated"
    }
    const dayTok = byId.get(seg.day)?.kind === "day" ? byId.get(seg.day) : undefined
    let day: string | null = (dayTok && resolveDay(dayTok.raw, ctx.now)) || sectionDay(startTok ?? endTok) || lastDay
    // No day word anywhere: the latest day this time has already happened.
    if (!day) day = Math.max(start ?? 0, end ?? 0) > nowMin ? yesterday : today
    lastDay = day
    drafts.push({ seg, day, start, end, startCert, endCert, len })
  }

  // Chain neighbours on the same day, in the order told.
  drafts.forEach((d, i) => {
    const prev = drafts[i - 1]
    const next = drafts[i + 1]
    if (d.start === null && prev?.day === d.day && prev.end !== null) {
      d.start = prev.end
      d.startCert = prev.endCert
      d.startChained = true
    }
    if (d.end === null && next?.day === d.day && next.start !== null) {
      d.end = next.start
      d.endCert = next.startCert
      d.endChained = true
    }
    // "walked for 5 hours" told before a 3pm appointment: the length hangs off whichever edge a neighbour gave.
    if (d.len && d.start === null && d.end !== null) {
      d.start = d.end - d.len
      d.startCert = "estimated"
    } else if (d.len && d.end === null && d.start !== null) {
      d.end = d.start + d.len
      d.endCert = "estimated"
    }
    // A thing told with no time of its own ("then I got ice cream") only follows the one before: its edges are guesses.
    if (!d.seg.start && !d.seg.end) {
      d.startCert = "estimated"
      d.endCert = "estimated"
    }
  })

  const blocks: ProposedBlock[] = []
  drafts.forEach((d, i) => {
    const activity = d.seg.activity.trim()
    if (d.start === null && d.end === null) {
      unplaced.push(activity)
      return
    }
    let { start, end } = d
    let openEnd = false
    let openStart = false
    // An end that reads earlier than its start ran past midnight ("from 9 until about 6am"), when that is a day or less.
    if (start !== null && end !== null && end <= start) end = end + 1440 - start <= MAX_OVERNIGHT_MIN ? end + 1440 : null
    if (start !== null && end === null) {
      end = Math.min(start + openMin, 1440)
      openEnd = true
    }
    if (start === null && end !== null) {
      start = Math.max(end - openMin, 0)
      openStart = true
    }
    const maybe = tokenOf(d.seg.maybeEnd)
    const notes = [d.seg.notes.trim(), maybe && clockOf(d.seg.maybeEnd) !== null ? `may have run until ${clockText(clockOf(d.seg.maybeEnd)!)}` : ""].filter(Boolean).join("; ")
    const place = resolvePlace(d.seg.place, activity, ctx.locationPens, ctx.history)
    blocks.push({
      id: `th-${hash(`${d.day}|${activity}|${start}|${i}`)}`,
      day: d.day!,
      activity,
      ...(place ? { place } : {}),
      startMin: start,
      endMin: end,
      startCert: openStart ? "estimated" : d.startCert,
      endCert: openEnd ? "estimated" : d.endCert,
      ...(d.startChained ? { startChained: true } : {}),
      ...(d.endChained ? { endChained: true } : {}),
      ...(openEnd ? { openEnd } : {}),
      ...(openStart ? { openStart } : {}),
      notes,
      ...(d.seg.with?.trim() ? { with: d.seg.with.trim() } : {}),
      ...(d.seg.mood?.trim() ? { mood: d.seg.mood.trim() } : {}),
      from: sentenceAround(text, tokenOf(d.seg.start)?.at ?? tokenOf(d.seg.end)?.at ?? 0) || activity,
    })
  })
  blocks.sort((a, b) => a.day.localeCompare(b.day) || (a.startMin ?? 0) - (b.startMin ?? 0))
  return { blocks, unplaced }
}
