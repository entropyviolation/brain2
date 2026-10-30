/**
 * extensions/chrome-history/export-day.mjs — Local calendar days for the export.
 *
 * The service worker and the tests share this. A day is the machine's local
 * calendar day, midnight to the next midnight. The alarm fires at 00:05 so
 * the day that just ended is complete.
 */

export const CLOSE_MINUTE = 5

export function localDayKey(ms) {
  const d = new Date(ms)
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${month}-${day}`
}

export function addDays(dayKey, n) {
  const [year, month, day] = dayKey.split("-").map(Number)
  return localDayKey(new Date(year, month - 1, day + n).getTime())
}

/** Inclusive start, exclusive end, in local time. */
export function dayBounds(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number)
  const start = new Date(year, month - 1, day).getTime()
  const end = new Date(year, month - 1, day + 1).getTime()
  return { start, end }
}

export function yesterdayKey(now = Date.now()) {
  return addDays(localDayKey(now), -1)
}

/** Days from `startKey` through `endKey` inclusive. Empty when start is after end. */
export function daysThrough(startKey, endKey) {
  if (!startKey || !endKey || startKey > endKey) return []
  const out = []
  let day = startKey
  while (day <= endKey) {
    out.push(day)
    day = addDays(day, 1)
    if (out.length > 400) break
  }
  return out
}

export function nextClose(now = Date.now()) {
  const d = new Date(now)
  const close = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, CLOSE_MINUTE, 0, 0).getTime()
  return now < close ? close : new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, CLOSE_MINUTE, 0, 0).getTime()
}

export function safeProfile(name) {
  const cleaned = String(name || "")
    .replace(/[^\w .'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
  return cleaned || "Chrome"
}

export function exportFileName(profile, day) {
  return `Brain2 Chrome/${safeProfile(profile)} ${day}.json`
}
