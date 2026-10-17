/**
 * lib/assumed-time-math.ts — Start, duration, and finish move together
 *
 * Assumed times shows all three. Editing one recomputes another:
 * start or duration moves the finish (start + duration); a finish edit keeps
 * the start and changes the duration. Minutes are minutes of the day; a
 * finish before the start means the work ran past midnight.
 */
export type TimeField = "start" | "duration" | "finish"

export interface TimeTriple {
  /** Minutes after midnight. */
  start: number
  /** Minutes long, never negative. */
  duration: number
  /** Minutes after midnight (wraps past 24h). */
  finish: number
}

const DAY = 24 * 60

export function wrapDay(minutes: number): number {
  return ((Math.round(minutes) % DAY) + DAY) % DAY
}

/** Apply one edit and recompute the field it drives. */
export function linkTimes(current: TimeTriple, field: TimeField, value: number): TimeTriple {
  if (field === "finish") {
    const finish = wrapDay(value)
    return { start: current.start, finish, duration: wrapDay(finish - current.start) }
  }
  const next = { ...current, [field]: field === "duration" ? Math.max(0, Math.round(value)) : wrapDay(value) }
  return { ...next, finish: wrapDay(next.start + next.duration) }
}

export function toClock(minutes: number): string {
  const m = wrapDay(minutes)
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

export function fromClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  return h < 24 && m < 60 ? h * 60 + m : null
}
