/**
 * lib/bim-flow/blocks.ts — Turn activity signals into time blocks, in code
 *
 * The model only says what each message shows ("starting dishes" → dishes,
 * starting). This file decides the spans. A block opens at a start or a
 * "since" clock, and closes at a finish, at the next different activity, or
 * when its "minutes left" run out. Anything guessed is marked estimated.
 * A block never runs past `maxOpenMin` with no message keeping it alive.
 */

import type { Span } from "./day-context"
import type { ActivitySignal, TimeBlock } from "./types"

export interface BlockRules {
  /** A finish or "did earlier" with no start reaches back this far. */
  defaultMin: number
  /** An open block with no later message ends this long after its last message. */
  maxOpenMin: number
}

export const DEFAULT_BLOCK_RULES: BlockRules = { defaultMin: 30, maxOpenMin: 90 }

const MIN = 60_000

interface OpenBlock {
  activity: string
  start: Date
  last: Date
  estimated: boolean
  evidence: string[]
  why: string
}

/**
 * Place a bare clock from the message ("4:46") at the latest moment that is
 * not after the message: 4:46 sent at 17:09 is 16:46, sent at 05:10 it is 04:46.
 */
export function placeSinceClock(clock: string, sentAt: Date): Date | null {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(clock.trim())
  if (!m) return null
  let hour = Number(m[1])
  const minute = Number(m[2])
  if (hour > 23 || minute > 59) return null
  const ampm = m[3]?.toLowerCase()
  if (ampm === "pm" && hour < 12) hour += 12
  if (ampm === "am" && hour === 12) hour = 0
  const candidates = ampm || hour > 12 || hour === 0 ? [hour] : [hour, hour + 12]
  let best: Date | null = null
  for (const h of candidates) {
    for (const dayBack of [0, 1]) {
      const at = new Date(sentAt)
      at.setDate(at.getDate() - dayBack)
      at.setHours(h % 24, minute, 0, 0)
      if (at.getTime() <= sentAt.getTime() && (!best || at > best)) best = at
    }
  }
  return best
}

export function assembleBlocks(signals: ActivitySignal[], rules: BlockRules = DEFAULT_BLOCK_RULES): TimeBlock[] {
  const sorted = [...signals].sort((a, b) => a.at.localeCompare(b.at))
  const blocks: TimeBlock[] = []
  // A holder, so TypeScript sees `close()` clear it.
  const cur: { open: OpenBlock | null } = { open: null }

  const close = (end: Date, why: string, estimated = false) => {
    const open = cur.open
    if (!open) return
    const capped = new Date(Math.min(end.getTime(), open.last.getTime() + rules.maxOpenMin * MIN))
    const wasCapped = capped.getTime() < end.getTime()
    blocks.push({
      activity: open.activity,
      start: open.start.toISOString(),
      end: capped.toISOString(),
      estimated: open.estimated || estimated || wasCapped,
      why: wasCapped ? `${open.why}; no message for ${rules.maxOpenMin}m` : `${open.why}; ${why}`,
      evidence: open.evidence,
    })
    cur.open = null
  }

  for (const s of sorted) {
    const at = new Date(s.at)
    if (cur.open && cur.open.activity !== s.activity) close(at, `next was ${s.activity}`)
    const open = cur.open

    if (s.relation === "finished" || s.relation === "did_earlier") {
      if (open && open.activity === s.activity) {
        open.evidence.push(s.messageId)
        close(at, "finished")
      } else {
        // The assumed start reaches back, but never over a block already built: time has one thing in it.
        const floor = blocks.reduce((m, b) => Math.max(m, Date.parse(b.end)), 0)
        const start = Math.max(at.getTime() - rules.defaultMin * MIN, floor)
        if (at.getTime() - start < MIN) continue
        const cut = start > at.getTime() - rules.defaultMin * MIN
        blocks.push({
          activity: s.activity,
          start: new Date(start).toISOString(),
          end: at.toISOString(),
          estimated: true,
          why: `${s.relation === "finished" ? "finished" : "did earlier"} with no start; ${cut ? "started where the last block ended" : `${rules.defaultMin}m assumed`}`,
          evidence: [s.messageId],
        })
      }
      continue
    }

    // A model often echoes the send minute as "since"; that says nothing.
    const placed = s.since ? placeSinceClock(s.since, at) : null
    const since = placed && at.getTime() - placed.getTime() >= MIN ? placed : null
    let live = open
    if (!live) {
      live = cur.open = {
        activity: s.activity,
        start: since ?? at,
        last: at,
        estimated: false,
        evidence: [s.messageId],
        why: since ? `since ${s.since}` : s.relation === "starting" ? "started" : "doing",
      }
    } else {
      live.last = at
      live.evidence.push(s.messageId)
      if (since && since < live.start) live.start = since
    }
    if (s.minutesLeft && s.minutesLeft > 0) {
      const end = new Date(at.getTime() + s.minutesLeft * MIN)
      live.last = end
      close(end, `${s.minutesLeft}m left`, true)
    }
  }
  const left = cur.open
  if (left) close(new Date(left.last.getTime() + rules.defaultMin * MIN), "left open", true)
  return blocks
}

/**
 * Cut every block back to time the person has not confirmed. A block inside a
 * confirmed span is dropped; one that crosses it keeps the unknown pieces.
 */
export function fitToUnknown(blocks: TimeBlock[], confirmed: Span[]): TimeBlock[] {
  if (confirmed.length === 0) return blocks
  const taken = [...confirmed].sort((a, b) => a.start - b.start)
  const out: TimeBlock[] = []
  for (const b of blocks) {
    let pieces: [number, number][] = [[Date.parse(b.start), Date.parse(b.end)]]
    for (const c of taken) {
      pieces = pieces.flatMap(([s, e]) => {
        if (c.end <= s || c.start >= e) return [[s, e]] as [number, number][]
        const left: [number, number][] = c.start > s ? [[s, c.start]] : []
        const right: [number, number][] = c.end < e ? [[c.end, e]] : []
        return [...left, ...right]
      })
    }
    const whole = pieces.length === 1 && pieces[0][0] === Date.parse(b.start) && pieces[0][1] === Date.parse(b.end)
    for (const [s, e] of pieces) {
      if (e - s < MIN) continue
      out.push(whole ? b : { ...b, start: new Date(s).toISOString(), end: new Date(e).toISOString(), estimated: true, why: `${b.why}; trimmed around confirmed time` })
    }
  }
  return out
}
