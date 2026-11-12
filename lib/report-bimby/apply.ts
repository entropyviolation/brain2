/**
 * lib/report-bimby/apply.ts — Write one accepted effect through the app's own paths
 *
 * Each effect reads its fields as they are at accept time, so an edit is honored. Each write is one
 * undo step (`runAsAction`; BIM's `undo` reverses it). Time blocks go through `acceptSuggestion`, so
 * they get the same overlap refusal, merge, and "autodetected" notes as an accepted LLM suggestion.
 * Inventory counts are set, not bumped, and do not write a kitchen pantry lot: a medication is not
 * groceries.
 */
"use client"

import { runAsAction, withoutUndo } from "@/lib/action-history"
import { withItemWriteSource } from "@/lib/item-write-source"
import { setCycleFlag, isCycleDayKey, isCycleFlag } from "@/lib/cycle-marks"
import { INVENTORY_QTY_ATTR, ensureInventoryList } from "@/lib/ingest/apply-inventory"
import { applyIntake } from "@/lib/ingest/apply-discrete-event"
import { resolveName } from "@/lib/ingest/name-resolve"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useSleepStore } from "@/lib/sleep-store"
import { syncSleepNight } from "@/lib/sleep-sync"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { acceptSuggestion } from "@/lib/bim-flow/accept"
import type { Suggestion } from "@/lib/bim-flow/suggestions"
import { applyStreamLine } from "@/lib/stream-bimby/apply"
import { applyFollowEffect } from "@/lib/follow-through/run"
import { fmtClock, parseDateTime } from "./time"
import { fieldValue, type Effect } from "./types"

export interface Applied {
  ok: boolean
  message: string
}

const fail = (message: string): Applied => ({ ok: false, message })

function applyInventory(effect: Effect, now: Date): Applied {
  const name = fieldValue(effect, "name").trim()
  const qty = Number(fieldValue(effect, "qty"))
  if (!name) return fail("Item name is empty.")
  if (!Number.isFinite(qty) || qty < 0) return fail("Count must be 0 or more.")
  const list = ensureInventoryList()
  const store = useTaskStore.getState()
  const items = store.tasks.filter((t) => t.lists?.includes(list.id))
  const hit = resolveName(name, items.map((i) => ({ id: i.id, name: itemTitleOrUntitled(i) })))
  if (hit.status === "ambiguous") return fail(`"${name}" fits several Inventory items. Type the exact name.`)
  return runAsAction(`Report: ${name} → ${qty}`, () => withItemWriteSource({ surface: "llm-suggestion" }, () => {
    if (hit.status === "match") {
      const item = items.find((i) => i.id === hit.candidate.id)!
      store.updateTask({ ...item, completed: false, attributes: { ...(item.attributes ?? {}), [INVENTORY_QTY_ATTR]: qty, inventoryUpdatedAt: now.toISOString() } })
      return { ok: true, message: `${itemTitleOrUntitled(item)} set to ${qty}.` }
    }
    const task: Task = {
      id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      description: name,
      stage: "list",
      createdAt: now,
      completed: false,
      lists: [list.id],
      attributes: { [INVENTORY_QTY_ATTR]: qty, inventoryUpdatedAt: now.toISOString() },
      links: [],
      tags: ["inventory"],
    }
    store.addTask(task)
    return { ok: true, message: `Added ${name} to Inventory at ${qty}.` }
  }))
}

function applyCycleEffect(effect: Effect): Applied {
  const date = fieldValue(effect, "date").trim()
  const flag = fieldValue(effect, "flag")
  if (!isCycleDayKey(date)) return fail("Day must look like 2026-11-07.")
  if (!isCycleFlag(flag)) return fail("Pick bleeding, spotting, or ovulation.")
  runAsAction(`Report: cycle ${flag} ${date}`, () => setCycleFlag(date, flag, true))
  return { ok: true, message: `Marked ${flag} on ${date}.` }
}

function applyIntakeEffect(effect: Effect): Applied {
  const what = fieldValue(effect, "what").trim()
  const at = parseDateTime(fieldValue(effect, "at"))
  const cls = fieldValue(effect, "class")
  if (!what) return fail("What is empty.")
  if (Number.isNaN(at)) return fail("Time must look like 2026-11-07T14:05.")
  if (cls !== "drug" && cls !== "drink" && cls !== "food") return fail("Pick drug, drink, or food.")
  const result = runAsAction(`Report: intake ${what}`, () => applyIntake(what, new Date(at), cls))
  return { ok: result.status === "ok", message: result.reply ?? result.status }
}

function applyTimeblock(effect: Effect): Applied {
  const label = fieldValue(effect, "label").trim()
  const start = parseDateTime(fieldValue(effect, "start"))
  const end = parseDateTime(fieldValue(effect, "end"))
  if (!label) return fail("Activity is empty.")
  if (Number.isNaN(start) || Number.isNaN(end)) return fail("Times must look like 2026-11-07T14:05.")
  if (end <= start) return fail("The end must be after the start.")
  const suggestion: Suggestion = {
    id: effect.id,
    kind: "timeblock",
    title: label,
    detail: `${fmtClock(start)}–${fmtClock(end)}`,
    at: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    estimated: true,
    source: "bim",
    why: effect.reasoning[0] ?? "From a BIM chat report.",
    evidence: effect.evidence,
  }
  const done = acceptSuggestion(suggestion)
  return { ok: done.ok, message: done.message }
}

/** The pieces of a sleep save, so a caller can let the screen answer between them. */
function sleepSteps(effect: Effect, now: Date): { error: string } | { steps: (() => void)[]; check: () => Applied } {
  const bed = parseDateTime(fieldValue(effect, "bed"))
  const wake = parseDateTime(fieldValue(effect, "wake"))
  const sure = fieldValue(effect, "wakeSure") === "definite" ? "definite" : "estimated"
  if (Number.isNaN(bed) || Number.isNaN(wake)) return { error: "Times must look like 2026-11-07T01:30." }
  if (wake <= bed) return { error: "The wake must be after the bedtime." }
  if (wake - bed > 20 * 3_600_000) return { error: "A night over 20 hours is not sleep. Check the times." }
  // A night is keyed by the morning it ends in, and both ends are signed minutes from that morning's midnight.
  const morning = new Date(wake)
  const date = formatLocalDateKey(morning)
  const midnight = new Date(morning.getFullYear(), morning.getMonth(), morning.getDate()).getTime()
  const sleptMin = Math.round((bed - midnight) / 60_000)
  const wokeMin = Math.round((wake - midnight) / 60_000)
  if (wokeMin < 0 || wokeMin > 1439) return { error: "The wake must fall on the morning it names." }
  const store = () => useSleepStore.getState()
  return {
    // The first step takes the undo snapshot; the rest ride on it so one undo reverses the whole night.
    steps: [
      () => runAsAction(`Report: sleep ${date}`, () => store().setBedtime(date, sleptMin, "estimated")),
      () => withoutUndo(() => store().setWakeTime(date, wokeMin, sure)),
      () => withoutUndo(() => syncSleepNight(date, now)),
    ],
    check: () => {
      const saved = store().nights[date]
      if (saved?.sleptMin !== sleptMin || saved?.wokeMin !== wokeMin) return fail("The sleep log did not keep those times.")
      return { ok: true, message: `Sleep saved for the night ending ${date}: ${fmtClock(bed)}–${fmtClock(wake)}.` }
    },
  }
}

function applySleep(effect: Effect, now: Date): Applied {
  const plan = sleepSteps(effect, now)
  if ("error" in plan) return fail(plan.error)
  for (const step of plan.steps) step()
  return plan.check()
}

/**
 * Apply one effect, letting `pause` run between the pieces of a heavy one. Only a night of sleep has
 * pieces (log the bedtime, log the wake, paint the blocks); the rest are one write. Never throws.
 */
export async function applyEffectPaced(effect: Effect, pause: () => Promise<void>, now = new Date()): Promise<Applied> {
  if (effect.kind === "line") return applyStreamLine(effect, now)
  if (effect.kind !== "sleep") return applyEffect(effect, now)
  try {
    const plan = sleepSteps(effect, now)
    if ("error" in plan) return fail(plan.error)
    for (const step of plan.steps) {
      step()
      await pause()
    }
    return plan.check()
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}

/** Apply one effect with its current fields. Never throws. */
export function applyEffect(effect: Effect, now = new Date()): Applied {
  try {
    switch (effect.kind) {
      case "inventory":
        return applyInventory(effect, now)
      case "cycle":
        return applyCycleEffect(effect)
      case "intake":
        return applyIntakeEffect(effect)
      case "timeblock":
        return applyTimeblock(effect)
      case "sleep":
        return applySleep(effect, now)
      case "line":
        return fail("A line is filed through the chat, not here.")
      case "verdict":
      case "feeling":
        return applyFollowEffect(effect)
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}
