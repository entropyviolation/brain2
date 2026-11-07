/**
 * lib/doc-selection/detect-clock.ts — find a clock time inside highlighted text
 *
 * "10:30 walked outside" gives `{ time: "10:30", rest: "walked outside" }`.
 * Reads 24-hour (`14:05`), 12-hour (`2:05pm`, `3 pm`) and a leading `at`.
 * The first clock wins. No clock gives null and the caller keeps the whole text.
 */

export interface DetectedClock {
  /** Local clock HH:MM, 24-hour. */
  time: string
  /** The text with the clock (and a leading "at") taken out. */
  rest: string
}

const CLOCK = /(?:\bat\s+)?\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b|(?:\bat\s+)?\b([01]?\d|2[0-3]):([0-5]\d)\b/i

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

export function detectClock(text: string): DetectedClock | null {
  const match = CLOCK.exec(text)
  if (!match) return null
  let hour: number
  let minute: number
  if (match[3]) {
    hour = Number(match[1])
    minute = match[2] ? Number(match[2]) : 0
    if (hour < 1 || hour > 12 || minute > 59) return null
    const pm = match[3].toLowerCase() === "p"
    hour = (hour % 12) + (pm ? 12 : 0)
  } else {
    hour = Number(match[4])
    minute = Number(match[5])
  }
  const before = text.slice(0, match.index)
  const after = text.slice(match.index + match[0].length)
  const rest = `${before} ${after}`
    .replace(/^[\s\-–—:,.]+/, "")
    .replace(/[\s\-–—:,]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim()
  return { time: `${pad(hour)}:${pad(minute)}`, rest }
}
