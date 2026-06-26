/**
 * lib/module-schedule-sync.ts — Map confirmed module items onto the timeline
 *
 * A workspace module (Itinerary Creator) holds dated items — flights with a
 * departure datetime, finalized activities with a day + time. This module pushes
 * those confirmed items onto the **global** timeline so they show up in the
 * Scheduler/Plan exactly like any other scheduled task: it writes
 * `Task.scheduledDate` / `Task.scheduledTime` and (optionally) mirrors each item
 * into a `CalendarEvent`.
 *
 * It is the schedule-level sibling of `lib/module-plan-sync.ts` (which writes
 * day *plan text*) and reuses that module's `eligibleDatedItems` gate so both
 * paths agree on *which* items are eligible (same source list, date attribute,
 * and optional status / booked gate).
 *
 * The core (`planScheduleSync`) is pure and unit-testable; `syncModuleToSchedule`
 * is the thin store-committing wrapper.
 */
import type { CalendarEvent, Task } from "@/lib/types"
import type { ModuleInstance } from "@/lib/modules-store"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { type DatedItemFilter, eligibleDatedItems, readDateAttr } from "@/lib/module-plan-sync"

/** Gating + mapping config for a schedule sync (a superset of `DatedItemFilter`). */
export interface ScheduleSyncConfig extends DatedItemFilter {
  /** Optional time-of-day attribute (datetime/time) → `Task.scheduledTime`. */
  timeAttrId?: string
  /** Also produce a CalendarEvent per item (default true). */
  toEvents?: boolean
}

/** A single computed schedule write for one item. */
export interface ScheduledItemUpdate {
  id: string
  scheduledDate: Date
  /** "HH:mm" time-of-day, when a time attribute resolved one. */
  scheduledTime?: string
}

export interface ScheduleSyncPlan {
  updates: ScheduledItemUpdate[]
  events: CalendarEvent[]
}

export interface ScheduleSyncResult {
  /** Items that received a scheduledDate/time. */
  items: number
  /** Calendar events created or updated. */
  events: number
}

/** Two-digit pad helper for "HH:mm" formatting. */
function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/**
 * Read a task's time attribute as an "HH:mm" string, or undefined. Accepts a
 * bare time string ("14:30"), a Date, or an ISO datetime string (whose
 * time-of-day is extracted).
 */
export function readTimeAttr(task: Task, timeAttrId?: string): string | undefined {
  if (!timeAttrId) return undefined
  const raw = task.attributes?.[timeAttrId]
  if (raw == null || raw === "") return undefined
  if (raw instanceof Date) return `${pad2(raw.getHours())}:${pad2(raw.getMinutes())}`
  if (typeof raw === "string") {
    // Bare "HH:mm" (optionally with seconds).
    const bare = raw.match(/^(\d{1,2}):(\d{2})/)
    if (bare && !raw.includes("T")) return `${pad2(Number(bare[1]))}:${bare[2]}`
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  }
  return undefined
}

/** Add `minutes` to an "HH:mm" string, clamped to the same day (max 23:59). */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number)
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes)
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
}

/** Stable CalendarEvent id for a synced item (idempotent re-sync). */
export function scheduleEventId(taskId: string): string {
  return `mod-sched-${taskId}`
}

/**
 * Pure: compute the schedule writes + calendar events for a set of tasks under
 * `config`. Does not touch any store. Items without a valid date are skipped by
 * `eligibleDatedItems`.
 */
export function planScheduleSync(config: ScheduleSyncConfig, tasks: Task[]): ScheduleSyncPlan {
  const items = eligibleDatedItems(config, tasks)
  const updates: ScheduledItemUpdate[] = []
  const events: CalendarEvent[] = []
  const toEvents = config.toEvents !== false

  for (const t of items) {
    const date = readDateAttr(t, config.dateAttrId)!
    const time = readTimeAttr(t, config.timeAttrId)
    updates.push({ id: t.id, scheduledDate: date, scheduledTime: time })

    if (toEvents) {
      const startTime = time ?? "09:00"
      events.push({
        id: scheduleEventId(t.id),
        title: t.description,
        startTime,
        endTime: addMinutes(startTime, 60),
        date,
        type: "task",
        taskId: t.id,
        isScheduled: true,
        isAllDay: !time,
      })
    }
  }

  return { updates, events }
}

/** Resolve a module's schedule-sync config, falling back to its plan-sync gate. */
export function resolveScheduleSyncConfig(module: ModuleInstance): ScheduleSyncConfig | undefined {
  if (module.scheduleSync) return module.scheduleSync
  // Fall back to plan-sync gating (no time attr / events default on).
  if (module.planSync) return { ...module.planSync }
  return undefined
}

/**
 * Commit a module's confirmed dated items onto the global timeline: set each
 * item's `scheduledDate`/`scheduledTime` and (optionally) upsert a CalendarEvent.
 * Idempotent — re-running updates the same items/events rather than duplicating.
 */
export function syncModuleToSchedule(module: ModuleInstance): ScheduleSyncResult {
  const config = resolveScheduleSyncConfig(module)
  if (!config) return { items: 0, events: 0 }

  const taskStore = useTaskStore.getState()
  const eventStore = useEventStore.getState()
  const plan = planScheduleSync(config, taskStore.tasks)

  const byId = new Map(taskStore.tasks.map((t) => [t.id, t]))
  for (const u of plan.updates) {
    const task = byId.get(u.id)
    if (!task) continue
    taskStore.updateTask({
      ...task,
      scheduledDate: u.scheduledDate,
      scheduledTime: u.scheduledTime ?? task.scheduledTime,
    })
  }

  const existingEventIds = new Set(eventStore.events.map((e) => e.id))
  for (const ev of plan.events) {
    if (existingEventIds.has(ev.id)) eventStore.updateEvent(ev)
    else eventStore.addEvent(ev)
  }

  return { items: plan.updates.length, events: plan.events.length }
}
