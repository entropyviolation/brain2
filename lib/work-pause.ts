/**
 * lib/work-pause.ts — Reasons for pausing a Working-on-now sitting
 *
 * A pause on the pen clock or the Operations clock asks what the gap is for.
 * The answer is a span (`pausedAt`, `reason`, `resumedAt` or `stoppedAt`),
 * kept on the live session and copied onto the time log and the painted
 * block. The same spans become the sitting's timeline note. Pause time stays
 * out of worked minutes; that math is still `sessionElapsedMs`.
 */
import { format } from "date-fns"

/** One gap in a Working-on-now sitting. Times are ISO. */
export interface WorkPauseSpan {
  pausedAt: string
  /** What the user is going to do in the gap. Trimmed, never empty. */
  reason: string
  /** Set when work starts again. */
  resumedAt?: string
  /** Set when Stop closes a pause that never resumed. */
  stoppedAt?: string
}

/** A Pause click with no reason does not pause. `{ hold: true }` freezes without a gap. */
export type PauseRequest = string | { hold: true }

let queuedPauseReason: string | undefined

/** Hand a reason to the pen clock when a linked session plan is about to pause. */
export function queuePauseReason(reason: string): void {
  const text = reason.trim()
  queuedPauseReason = text || undefined
}

/** Read and clear the queued reason. Empty when the pause was not a named gap. */
export function takeQueuedPauseReason(): string | undefined {
  const reason = queuedPauseReason
  queuedPauseReason = undefined
  return reason
}

/** House clock already used on painted time notes (`h:mm a`). */
export function pauseClockLabel(at: Date | string): string {
  const date = at instanceof Date ? at : new Date(at)
  if (Number.isNaN(date.getTime())) return ""
  return format(date, "h:mm a")
}

function lastOpenIndex(spans: readonly WorkPauseSpan[]): number {
  for (let i = spans.length - 1; i >= 0; i--) {
    if (!spans[i].resumedAt && !spans[i].stoppedAt) return i
  }
  return -1
}

/** Append a gap. An empty reason returns null and the caller must not pause. */
export function appendPause(
  spans: readonly WorkPauseSpan[] | undefined,
  at: Date,
  reason: string,
): WorkPauseSpan[] | null {
  const text = reason.trim()
  if (!text) return null
  return [...(spans ?? []), { pausedAt: at.toISOString(), reason: text }]
}

/** Stamp restarted-at on the open gap. */
export function resumeOpenPause(
  spans: readonly WorkPauseSpan[] | undefined,
  at: Date,
): WorkPauseSpan[] | undefined {
  if (!spans?.length) return spans ? [...spans] : undefined
  const index = lastOpenIndex(spans)
  if (index < 0) return [...spans]
  const resumedAt = at.toISOString()
  return spans.map((span, i) => (i === index ? { ...span, resumedAt } : span))
}

/** Stop closed an open gap. Resume is a different stamp. */
export function closeOpenPause(
  spans: readonly WorkPauseSpan[] | undefined,
  at: Date,
): WorkPauseSpan[] | undefined {
  if (!spans?.length) return spans ? [...spans] : undefined
  const index = lastOpenIndex(spans)
  if (index < 0) return [...spans]
  const stoppedAt = at.toISOString()
  return spans.map((span, i) => (i === index ? { ...span, stoppedAt } : span))
}

/**
 * Readable sitting timeline. Events are separate lines.
 * `Work session 7:36 PM–8:02 PM`, then each gap, then `Stopped session` when the sitting ended.
 */
export function pauseTimeline(input: {
  startedAt: Date | string
  endedAt?: Date | string
  spans: readonly WorkPauseSpan[]
  stopped?: boolean
}): string {
  const lines: string[] = []
  const start = pauseClockLabel(input.startedAt)
  const end = input.endedAt ? pauseClockLabel(input.endedAt) : ""
  if (start && end) lines.push(`Work session ${start}–${end}`)
  else if (start) lines.push(`Work session ${start}`)
  for (const span of input.spans) {
    const at = pauseClockLabel(span.pausedAt)
    if (at) lines.push(`Paused at ${at} for ${span.reason}`)
    if (span.resumedAt) {
      const back = pauseClockLabel(span.resumedAt)
      if (back) lines.push(`Restarted at ${back}`)
    }
  }
  if (input.stopped && end) lines.push(`Stopped session at ${end}`)
  return lines.join("\n")
}

const TIMELINE_LINE = /^(Work session |Paused at |Restarted at |Stopped session at )/

/** Drop a previous timeline so a refresh does not stack copies. */
export function stripPauseTimeline(text: string): string {
  return text
    .split("\n")
    .filter((line) => !TIMELINE_LINE.test(line))
    .join("\n")
    .trim()
}

/** Keep `source` and put the timeline under it. */
export function notesForSitting(source: string, timeline: string): string {
  const head = stripPauseTimeline(source).trim()
  const body = timeline.trim()
  if (!body) return head
  if (!head) return body
  return `${head}\n${body}`
}

/**
 * The note to write for this sitting.
 * Without a gap, an owned clock note is replaced by `base` only when `replaceOwned` is set.
 * A hand-written note is left as it is until a gap is appended under it.
 */
export function mergeSittingNote(input: {
  existing: string | undefined
  base: string
  owned: boolean
  replaceOwned?: boolean
  startedAt: string | Date
  endedAt?: string | Date
  spans?: readonly WorkPauseSpan[]
  stopped?: boolean
}): string | undefined {
  const timeline = input.spans?.length
    ? pauseTimeline({
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        spans: input.spans,
        stopped: input.stopped,
      })
    : ""
  if (!timeline) return input.replaceOwned && input.owned ? input.base : undefined
  const source = input.owned || !input.existing ? input.base : input.existing
  return notesForSitting(source, timeline)
}

export function isHoldPause(request: PauseRequest | undefined): boolean {
  return typeof request === "object" && request.hold === true
}

export function pauseReasonText(request: PauseRequest | undefined): string {
  return typeof request === "string" ? request.trim() : ""
}
