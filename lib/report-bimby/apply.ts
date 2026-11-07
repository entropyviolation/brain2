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

import { runAsAction } from "@/lib/action-history"
import { withItemWriteSource } from "@/lib/item-write-source"
import { setCycleFlag, isCycleDayKey, isCycleFlag } from "@/lib/cycle-marks"
import { INVENTORY_QTY_ATTR, ensureInventoryList } from "@/lib/ingest/apply-inventory"
import { applyIntake } from "@/lib/ingest/apply-discrete-event"
import { resolveName } from "@/lib/ingest/name-resolve"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { acceptSuggestion } from "@/lib/bim-flow/accept"
import type { Suggestion } from "@/lib/bim-flow/suggestions"
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
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}
