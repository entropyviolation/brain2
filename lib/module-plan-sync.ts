/**
 * lib/module-plan-sync.ts — Push finalized module items into the Plan
 *
 * A workspace module (e.g. the Itinerary Creator) can mark itself "plan-synced":
 * its dated, finalized items are written into the day Plan text (see
 * `lib/plan-text.ts`). This keeps a finalized trip in lockstep with the Scheduler
 * /Plan without duplicating the data model — the items stay the source of truth.
 */
import type { ModuleInstance } from "@/lib/modules-store"
import type { Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { getStoredPlanText, saveStoredPlanText } from "@/lib/plan-text"
import { formatDateKey, safeToDate } from "@/lib/date-utils"

export interface PlanSyncResult {
  days: number
  lines: number
}

/**
 * Common gating shape for "push dated items somewhere" syncs (Plan + Schedule).
 * A subset of `module.planSync` / `module.scheduleSync` — shared so both the
 * plan-text sync below and `lib/module-schedule-sync.ts` filter items the same
 * way (same source list, date attribute, and optional status gate).
 */
export interface DatedItemFilter {
  categoryId: string
  dateAttrId: string
  statusAttrId?: string
  statusValue?: string
  /** Optional boolean attribute requiring the item be "booked"/confirmed. */
  bookedAttrId?: string
}

/** Read a task's date attribute as a real Date (or null when absent/invalid). */
export function readDateAttr(task: Task, dateAttrId: string): Date | null {
  const raw = task.attributes?.[dateAttrId]
  return safeToDate(typeof raw === "string" || raw instanceof Date ? raw : undefined)
}

/**
 * Items from `filter.categoryId` that pass the status/booked gate **and** carry a
 * valid date. Pure — pass in the full task list. The single source of truth for
 * "which items are eligible to leave the module and land on a timeline".
 */
export function eligibleDatedItems(filter: DatedItemFilter, tasks: Task[]): Task[] {
  return tasks.filter((t) => {
    if (!t.lists?.includes(filter.categoryId)) return false
    if (filter.statusAttrId && filter.statusValue) {
      if (String(t.attributes?.[filter.statusAttrId] ?? "") !== filter.statusValue) return false
    }
    if (filter.bookedAttrId) {
      const v = t.attributes?.[filter.bookedAttrId]
      const booked = v === true || v === "true" || v === "yes" || v === 1
      if (!booked) return false
    }
    return readDateAttr(t, filter.dateAttrId) !== null
  })
}

/** Write a module's finalized, dated items into the matching day plans. */
export function syncModuleToPlan(module: ModuleInstance): PlanSyncResult {
  const sync = module.planSync
  if (!sync) return { days: 0, lines: 0 }
  const { tasks } = useTaskStore.getState()
  const items = eligibleDatedItems(sync, tasks)

  // Bucket eligible items by day key.
  const byDay = new Map<string, Task[]>()
  for (const t of items) {
    const d = readDateAttr(t, sync.dateAttrId)!
    const key = formatDateKey(d)
    const arr = byDay.get(key) ?? []
    arr.push(t)
    byDay.set(key, arr)
  }

  let lines = 0
  for (const [dayKey, dayItems] of byDay) {
    const existing = getStoredPlanText("day", dayKey) || ""
    const existingLines = new Set(existing.split("\n").map((l) => l.trim()))
    const additions = dayItems
      .map((t) => `• ${t.description} [${module.title}]`)
      .filter((line) => !existingLines.has(line.trim()))
    if (additions.length === 0) continue
    const next = existing ? `${existing.replace(/\s+$/, "")}\n${additions.join("\n")}` : additions.join("\n")
    saveStoredPlanText("day", dayKey, next)
    lines += additions.length
  }

  return { days: byDay.size, lines }
}
