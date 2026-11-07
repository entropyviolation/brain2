/**
 * lib/wire-bimby/apply.ts — Write one accepted wiring step
 *
 * Re-runs the checks on the live habits first, so a field edited after the plan was drawn is
 * judged as it stands. Then one write through the habits store as one undo step, and a read-back:
 * the habit must now take a sample report, or the step is marked failed and the old habit is
 * restored. The only things written are `moduleFeeds` and `detailView` on one habit.
 */
"use client"

import { runAsAction } from "@/lib/action-history"
import { useHabitsStore } from "@/lib/habits-store"
import { ensureActivityPen } from "@/lib/ingest/apply-activity-span"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { checkStep, habitAfter, stepPasses } from "./checks"
import type { WireDeps } from "./plan"
import { wireField, type WireStep } from "./types"

export function liveDeps(): WireDeps {
  return {
    habits: useHabitsStore.getState().tasks,
    types: useItemTypeStore.getState().types.map((t) => ({ id: t.id, name: t.name, pluralName: t.pluralName })),
    pens: (useTimeTrackingStore.getState().scopes.find((s) => s.id === "activity")?.pens ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      parentIds: p.parentIds ?? (p.parentId ? [p.parentId] : []),
      feedModule: p.moduleFeed?.moduleId,
    })),
  }
}

/** Make the pen, make its parent, nest it, and mark it as following the module. One undo step; read back. */
function applyTrack(step: WireStep): { ok: boolean; message: string } {
  const moduleId = wireField(step, "module")
  const penName = wireField(step, "pen").trim()
  const parentName = wireField(step, "parentPen").trim()
  runAsAction("BIM: track module sessions", () => {
    const penId = ensureActivityPen(penName)
    const parentId = parentName ? ensureActivityPen(parentName) : ""
    const store = useTimeTrackingStore.getState()
    const pen = store.scopes.find((s) => s.id === "activity")!.pens.find((p) => p.id === penId)!
    store.updatePen("activity", { ...pen, moduleFeed: { moduleId } })
    if (parentId) {
      const have = pen.parentIds ?? (pen.parentId ? [pen.parentId] : [])
      if (!have.includes(parentId)) useTimeTrackingStore.getState().setPenParents("activity", penId, [...have, parentId])
    }
  })
  const saved = useTimeTrackingStore.getState().scopes.find((s) => s.id === "activity")?.pens.find((p) => p.name.toLowerCase() === penName.toLowerCase())
  const parent = parentName ? useTimeTrackingStore.getState().scopes.find((s) => s.id === "activity")?.pens.find((p) => p.name.toLowerCase() === parentName.toLowerCase()) : undefined
  const nested = !parentName || (!!parent && !!saved && (saved.parentIds ?? (saved.parentId ? [saved.parentId] : [])).includes(parent.id))
  if (saved?.moduleFeed?.moduleId !== moduleId || !nested) return { ok: false, message: `“${penName}” did not keep the change.` }
  return { ok: true, message: `Pen “${penName}” follows the module${parentName ? ` and counts as “${parentName}”` : ""}.` }
}

export function applyStep(step: WireStep): { ok: boolean; message: string } {
  const deps = liveDeps()
  const checks = checkStep(step, deps)
  if (!stepPasses(checks)) return { ok: false, message: checks.filter((c) => !c.ok).map((c) => c.text).join(" ") }
  if (step.kind === "track") return applyTrack(step)
  const habit = deps.habits.find((h) => h.id === wireField(step, "habit"))!
  const after = habitAfter(step, habit)
  runAsAction("BIM: wire habit", () => useHabitsStore.getState().updateTask(after))
  const saved = useHabitsStore.getState().tasks.find((h) => h.id === habit.id)
  const stored = step.kind === "feed" ? saved?.moduleFeeds : saved?.detailView?.panels
  if (!saved || !stored || JSON.stringify(stored) !== JSON.stringify(step.kind === "feed" ? after.moduleFeeds : after.detailView?.panels)) {
    useHabitsStore.getState().updateTask(habit)
    return { ok: false, message: `“${habit.name}” did not keep the change, so I put it back.` }
  }
  return { ok: true, message: `Saved on “${habit.name}”.` }
}
