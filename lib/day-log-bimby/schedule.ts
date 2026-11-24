/**
 * lib/day-log-bimby/schedule.ts — Which days an automatic tick builds
 *
 * Today is refreshed with code only (the cached prose is kept). Yesterday is
 * finished with the model once it is over (04:00, so a late night still counts
 * as yesterday), or again when it was built before then or without prose. Up to
 * two of the last days with data and no log are built. Pure.
 */

import { formatLocalDateKey } from "@/lib/date-utils"

/** Yesterday counts as over at 04:00, so a late night is still in it. */
const DAY_OVER_HOUR = 4

function dayKey(now: Date, offset: number): string {
  return formatLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset))
}

/** The days an automatic tick builds, and whether each wants the model. Pure on its inputs. */
export function autoPlan(now: Date, records: { id: string; builtAt: string; narrated: boolean }[], hasData: (date: string) => boolean, llm: boolean): { date: string; llm: boolean }[] {
  const out: { date: string; llm: boolean }[] = []
  const byId = new Map(records.map((r) => [r.id, r]))
  const afterHours = now.getHours() >= DAY_OVER_HOUR
  // Before 04:00, "today" is still yesterday's night.
  const today = afterHours ? dayKey(now, 0) : dayKey(now, -1)
  const yesterday = afterHours ? dayKey(now, -1) : dayKey(now, -2)
  if (hasData(today)) out.push({ date: today, llm: false })
  const y = byId.get(yesterday)
  const [yy, ym, yd] = yesterday.split("-").map(Number)
  const over = new Date(yy!, ym! - 1, yd! + 1, DAY_OVER_HOUR)
  if (hasData(yesterday) && (!y || new Date(y.builtAt) < over || (llm && !y.narrated))) out.push({ date: yesterday, llm })
  let backfill = 0
  for (let k = afterHours ? 2 : 3; k <= 8 && backfill < 2; k++) {
    const d = dayKey(now, -k)
    if (!byId.has(d) && hasData(d)) {
      out.push({ date: d, llm })
      backfill++
    }
  }
  return out
}

