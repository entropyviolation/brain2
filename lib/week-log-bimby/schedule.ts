/**
 * lib/week-log-bimby/schedule.ts — Which weeks an automatic tick builds
 *
 * This week is refreshed with code only (its last prose is kept). Last week is
 * finished with the model once it is over (Monday 04:00, so a late Sunday night
 * still counts), or again when it was built before then or without prose. One
 * older week (up to five back) with data and no log is built. Pure.
 */

import { formatLocalDateKey } from "@/lib/date-utils"
import { addDays, weekStartKey } from "./week"

/** A week counts as over on the Monday after it, at 04:00. */
const WEEK_OVER_HOUR = 4

export function autoWeekPlan(now: Date, records: { id: string; builtAt: string; narrated: boolean }[], hasData: (start: string) => boolean, llm: boolean): { start: string; llm: boolean }[] {
  const out: { start: string; llm: boolean }[] = []
  const byId = new Map(records.map((r) => [r.id, r]))
  // Before 04:00 the night still belongs to the day before (and on a Monday, to last week).
  const shifted = new Date(now.getTime() - WEEK_OVER_HOUR * 3_600_000)
  const current = weekStartKey(formatLocalDateKey(shifted))
  const last = addDays(current, -7)
  if (hasData(current)) out.push({ start: current, llm: false })
  const r = byId.get(last)
  const [y, m, d] = current.split("-").map(Number)
  const over = new Date(y!, m! - 1, d!, WEEK_OVER_HOUR)
  if (hasData(last) && (!r || new Date(r.builtAt) < over || (llm && !r.narrated))) out.push({ start: last, llm })
  for (let k = 2; k <= 5; k++) {
    const s = addDays(current, -7 * k)
    if (!byId.has(s) && hasData(s)) {
      out.push({ start: s, llm })
      break
    }
  }
  return out
}
