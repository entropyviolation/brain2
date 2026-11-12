/**
 * lib/plan-bimby/day/update-apply.ts — Accept one `day` effect from an update card (`update.ts`)
 *
 * Reads the fields as they are at accept time. `add` puts a thing on the live plan, before or after the thing
 * it names, with its resistance and feeling; `done` marks a thing done at a minute or inside a window; `feel`
 * sets resistance and words before a thing; `first` moves a thing to the front. When the plan is already on
 * To Do, an added thing is filed too and a done thing is checked off there, through `fileDay` and
 * `finishDayItem`, so the ledger and To Do stay one story. Never throws.
 */
"use client"

import { fieldValue, type Effect } from "@/lib/report-bimby/types"
import { fileDay } from "./apply"
import { pastRuns } from "./history"
import { useDayPlanStore } from "./store"
import { finishDayItem } from "./track"
import { findItem, newItem } from "./tweak"
import { TIER_LABEL, type DayItem, type DayPlan, type DayTier } from "./types"
import { SCALE_OPTIONS } from "./update"

export interface DayApplied {
  ok: boolean
  message: string
}

const fail = (message: string): DayApplied => ({ ok: false, message })
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/

function tierOf(label: string): DayTier {
  return (Object.entries(TIER_LABEL).find(([, l]) => l === label.trim())?.[0] as DayTier | undefined) ?? "rest"
}

function scaleOf(value: string): number | undefined {
  const i = SCALE_OPTIONS.indexOf(value.trim())
  if (i > 0) return i - 1
  const n = Number(value.trim().slice(0, 1))
  return value.trim() && Number.isInteger(n) && n >= 0 && n <= 4 ? n : undefined
}

/** "19:36" on the plan's day. */
function at(plan: DayPlan, hhmm: string): Date | null {
  const m = HHMM.exec(hhmm.trim())
  if (!m) return null
  const d = new Date(plan.at)
  d.setHours(Number(m[1]), Number(m[2]), 0, 0)
  return d
}

/** "19:36", or "16:10-19:00" (done inside the window, minute unknown). */
function when(plan: DayPlan, value: string): { date: Date; window?: string } | null {
  const v = value.trim()
  const w = /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/.exec(v)
  if (w) {
    const end = at(plan, w[2]!)
    return end && at(plan, w[1]!) ? { date: end, window: `${w[1]}–${w[2]}` } : null
  }
  const date = at(plan, v)
  return date ? { date } : null
}

const latest = (id: string): DayPlan | undefined => useDayPlanStore.getState().plans[id]

/** Mark a plan item done: through To Do when the plan is filed, else on the plan only. */
function markDone(planId: string, item: DayItem, date: Date, window?: string): string {
  const plan = latest(planId)!
  const fresh = plan.items.find((i) => i.id === item.id) ?? item
  if (fresh.doneAt) return `"${fresh.title}" was already done.`
  const said = fresh.filedTaskId ? finishDayItem(plan, fresh, 0, date) : null
  if (!fresh.filedTaskId) useDayPlanStore.getState().patchItem(planId, fresh.id, { doneAt: date.toISOString() })
  if (window) useDayPlanStore.getState().patchItem(planId, fresh.id, { doneWindow: window })
  const time = window ? `sometime ${window}` : `at ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
  return `Done: "${fresh.title}" ${time}.${said && said !== "Marked done." ? ` ${said}` : ""}`
}

function applyAdd(plan: DayPlan, effect: Effect, now: Date): DayApplied {
  const title = fieldValue(effect, "title").trim()
  if (title.length < 2) return fail("The thing to do is empty.")
  if (findItem(plan, title)?.title.toLowerCase() === title.toLowerCase()) return fail(`"${title}" is already on the plan.`)
  const item: DayItem = { ...newItem(title, tierOf(fieldValue(effect, "tier")), pastRuns()), reasons: [`From your update: "${effect.evidence[0]?.replace(/^“|”$/g, "") ?? title}".`] }
  const resistance = scaleOf(fieldValue(effect, "resistance"))
  const feeling = fieldValue(effect, "feeling").trim()
  const note = fieldValue(effect, "note").trim()
  if (resistance !== undefined) item.resistance = resistance
  if (feeling) item.blocker = feeling
  if (note) item.note = note
  const beforeName = fieldValue(effect, "before").trim()
  const afterName = fieldValue(effect, "after").trim()
  const before = beforeName ? findItem(plan, beforeName) : null
  const after = afterName ? findItem(plan, afterName) : null
  let items = [...plan.items]
  if (before) {
    // It comes first: the later thing now waits on it (and it takes over whatever the later thing waited on).
    if (before.after) item.after = before.after
    items = items.map((i) => (i.id === before.id ? { ...i, after: item.id } : i))
    items.splice(items.findIndex((i) => i.id === before.id), 0, item)
  } else if (after) {
    item.after = after.id
    items.splice(items.findIndex((i) => i.id === after.id) + 1, 0, item)
  } else items.push(item)
  useDayPlanStore.getState().put({ ...plan, items, revisions: plan.revisions + 1 })
  const parts = [`Added "${title}" to today${before ? `, before "${before.title}"` : after ? `, after "${after.title}"` : ""}.`]
  if ((beforeName && !before) || (afterName && !after)) parts.push(`"${beforeName || afterName}" is not on the plan, so it has no order link.`)
  if (plan.filed) parts.push(fileDay(plan.id, now).message)
  const done = fieldValue(effect, "done").trim()
  if (done) {
    const w = when(plan, done)
    if (!w) parts.push(`"${done}" is not a time like 19:36, so it is not marked done.`)
    else parts.push(markDone(plan.id, latest(plan.id)!.items.find((i) => i.id === item.id)!, w.date, w.window))
  }
  return { ok: true, message: parts.join(" ") }
}

export function applyDayEffect(effect: Effect, now = new Date()): DayApplied {
  try {
    const plan = effect.ref ? latest(effect.ref) : undefined
    if (!plan) return fail("That day plan is no longer kept on this device.")
    if (effect.op === "add") return applyAdd(plan, effect, now)
    const name = fieldValue(effect, "item").trim()
    const item = findItem(plan, name)
    if (!item) return fail(`"${name}" is not on today's plan. Type its name as the plan shows it.`)
    switch (effect.op) {
      case "done": {
        const w = when(plan, fieldValue(effect, "when"))
        if (!w) return fail("When must look like 19:36, or 16:10-19:00 for a window.")
        return { ok: true, message: markDone(plan.id, item, w.date, w.window) }
      }
      case "feel": {
        const resistance = scaleOf(fieldValue(effect, "resistance"))
        const feeling = fieldValue(effect, "feeling").trim()
        const blocker = feeling && !item.blocker.toLowerCase().includes(feeling.toLowerCase()) ? [item.blocker, feeling].filter(Boolean).join("; ") : item.blocker
        useDayPlanStore.getState().patchItem(plan.id, item.id, { ...(resistance !== undefined ? { resistance } : {}), blocker })
        return { ok: true, message: `Before "${item.title}": ${[resistance !== undefined ? `resistance ${resistance}` : "", feeling].filter(Boolean).join(", ") || "nothing set"}.` }
      }
      case "first":
        useDayPlanStore.getState().put({ ...plan, revisions: plan.revisions + 1, items: [item, ...plan.items.filter((i) => i.id !== item.id)] })
        return { ok: true, message: `"${item.title}" is first.` }
    }
    return fail(`Unknown change "${effect.op ?? ""}".`)
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}
