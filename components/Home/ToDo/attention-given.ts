/**
 * components/Home/ToDo/attention-given.ts — The Done well's second line (Phase 15 B, UI-4)
 *
 * "3 sittings · 2h10 of attention given": time, not output. Reads the Done
 * tasks' `timeLogs` and their Tracking blocks (`trackedTimeForItems`, the same
 * dedupe as Phase 6 spent), kept to dates inside the period. A sitting is one
 * counted block, or one log that names no counted block.
 */
import { trackedTimeForItems } from "@/lib/tracked-time"
import type { TimeEntry } from "@/lib/time-entries"
import type { Task } from "@/lib/types"
import { parseLocalDate } from "@/lib/date-utils"
import { todoPeriodValue, type TodoPeriod } from "./todo-utils"

export interface AttentionGiven {
  sittings: number
  minutes: number
}

export function attentionGiven(
  tasks: readonly Task[],
  entries: readonly TimeEntry[],
  period: TodoPeriod,
  refDate: Date,
): AttentionGiven {
  const key = todoPeriodValue(period, refDate)
  const inPeriod = (dateKey: string | undefined) => {
    const d = dateKey ? parseLocalDate(dateKey) : null
    return !!d && todoPeriodValue(period, d) === key
  }
  const scoped = tasks.map((t) => ({ ...t, timeLogs: (t.timeLogs ?? []).filter((log) => inPeriod(log.date)) }))
  const time = trackedTimeForItems(scoped, entries.filter((e) => inPeriod(e.date)))
  const counted = new Set(time.entries.map((e) => e.id))
  const looseLogs = scoped
    .flatMap((t) => t.timeLogs)
    .filter((log) => log.durationMinutes > 0 && !(log.entryIds ?? []).some((id) => counted.has(id))).length
  return { sittings: counted.size + looseLogs, minutes: time.total }
}

function hm(minutes: number): string {
  const total = Math.round(minutes)
  if (total < 60) return `${total}m`
  const m = total % 60
  return m === 0 ? `${Math.floor(total / 60)}h` : `${Math.floor(total / 60)}h${String(m).padStart(2, "0")}`
}

/** "3 sittings · 2h10 of attention given", or null when nothing was logged. */
export function attentionGivenLabel({ sittings, minutes }: AttentionGiven): string | null {
  if (sittings <= 0 && minutes <= 0) return null
  return `${sittings} sitting${sittings === 1 ? "" : "s"} · ${hm(minutes)} of attention given`
}
