/**
 * Minute words, countdown words, and a typed session length.
 * Reads 90, 1:30, 1h30, 1h 30m, 1.5h, and 45m.
 */

export function fmtMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

export function fmtClock(seconds: number): string {
  const over = seconds < 0
  const abs = Math.abs(Math.round(seconds))
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  const body = h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`
  return over ? `+${body}` : body
}

/** "90", "1:30", "1h30", "1h 30m", "1.5h", "45m" → minutes. Null when it does not read as a time. */
export function parseLength(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, "")
  if (!t) return null
  const clock = t.match(/^(\d+):(\d{1,2})$/)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])
  const hm = t.match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+)m?)?$/)
  if (hm && (hm[1] || hm[2])) {
    const hours = hm[1] ? Number(hm[1]) : 0
    const mins = hm[2] ? Number(hm[2]) : 0
    // A bare number is minutes; after an "h" it is the minutes part.
    return Math.round(hours * 60 + mins)
  }
  return null
}
