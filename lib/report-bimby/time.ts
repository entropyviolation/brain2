/**
 * lib/report-bimby/time.ts — Small local-time formatting for the Report BIMBY
 */

const pad = (n: number) => String(n).padStart(2, "0")

/** "14:05" in local time. */
export function fmtClock(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "2026-11-07 14:05", or with `input` the `YYYY-MM-DDTHH:mm` an `<input type="datetime-local">` holds. */
export function fmtDateTime(ms: number, input = false): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}${input ? "T" : " "}${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Epoch ms of a `YYYY-MM-DDTHH:mm` local value, or NaN. */
export function parseDateTime(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(value.trim())
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).getTime() : NaN
}
