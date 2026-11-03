/**
 * lib/lists-helper/apply.ts — Write an approved plan, and take it back (through a Port)
 *
 * Before anything is written the call is planned again against the data as it is now. If the effect is not the
 * exact one the person approved (`signature`), nothing is written and the helper says so. Edits go through
 * one bulk write (`Port.commitMany`) and each item still gets its History line, written by the Lists BIMBY. A merge uses the
 * same bulk replace as the Lists merge. One undo restores the old values, the pre-merge rows, and removes what
 * was added. Before and after the write `guard.ts` checks the plan and the result, and a journal survives a crash.
 */

import type { Task } from "@/lib/types"
import { refusal, verification, writeJournal } from "./guard"
import { mergedTasks, runTool } from "./tools"
import type { Plan, Port, ToolCall, Undo } from "./types"

export type ApplyOutcome = { ok: true; done: string; undo: Undo } | { ok: false; reason: string }

export function applyPlan(port: Port, call: ToolCall, approved: Plan): ApplyOutcome {
  const fresh = runTool(port.world(), call, { now: port.now(), isDismissed: port.isDismissed })
  if (fresh.kind !== "plan") return { ok: false, reason: "Things changed since I made that plan, and there is nothing left to do. I wrote nothing." }
  if (fresh.plan.signature !== approved.signature) {
    return { ok: false, reason: `Things changed since I made that plan (${fresh.plan.total} items now, not ${approved.total}). I wrote nothing. Ask again to see the new plan.` }
  }
  const plan = fresh.plan
  const refused = refusal(plan)
  if (refused) return { ok: false, reason: refused }
  const undo: Undo = { label: plan.title, patches: [], rows: [], created: [], tombstoned: [] }
  const countBefore = port.world().tasks.length
  // Journal first: if the window dies mid-write, the old values are still on hand to put back.
  writeJournal({ label: plan.title, at: port.now().toISOString(), patches: plan.changes.map((c) => ({ id: c.id, before: c.before })), created: (plan.creates ?? []).map((c) => c.id) })

  // A new list, folder, or item type goes in first so the changes have somewhere to land.
  if (plan.setup) {
    const { type, list, folder, fileInFolderId } = plan.setup
    undo.made = {}
    if (type) {
      port.addType(type)
      undo.made.typeId = String(type.id)
    }
    if (list) {
      port.addList(list)
      undo.made.listId = list.id
    }
    if (folder) {
      port.addFolder(folder)
      undo.made.folderId = folder.id
    } else if (list && fileInFolderId) {
      port.fileList(fileInFolderId, list.id)
    }
  }

  if (plan.merge) {
    const world = port.world()
    const touched = new Set([plan.merge.survivorId, ...plan.merge.discardedIds])
    const next = mergedTasks(world.tasks, plan)
    const nextById = new Map(next.map((t) => [t.id, t]))
    // Every row the merge replaced, dropped, or retargeted, as it was.
    undo.rows = world.tasks.filter((t) => touched.has(t.id) || nextById.get(t.id) !== t)
    undo.tombstoned = plan.merge.discardedIds
    port.replaceTasks(next, plan.merge.discardedIds)
  }
  for (const change of plan.changes) undo.patches.push({ id: change.id, before: change.before })
  // One write for the whole plan. Item by item re-saves the entire store each time and freezes on a thousand.
  port.commitMany(plan.changes.map((c) => ({ id: c.id, patch: c.patch })))
  // Items have moved off the folded lists, so they can go. Undo puts them back where they were filed.
  if (plan.dropLists?.length) {
    undo.removedLists = []
    for (const { list, folderId } of plan.dropLists) {
      port.removeList(list.id)
      undo.removedLists.push({ list, folderId })
    }
  }
  for (const item of plan.creates ?? []) {
    port.addItem(item)
    undo.created.push(item.id)
  }
  const after = port.world()
  const problem =
    verification(plan, after.tasks, countBefore) ??
    (plan.dropLists?.find((d) => after.lists.some((l) => l.id === d.list.id)) ? "a folded list is still there." : null) ??
    (plan.setup?.list && !after.lists.some((l) => l.id === plan.setup!.list!.id) ? `the new list "${plan.setup.list.name}" is missing.` : null)
  if (problem) {
    undoPlan(port, undo)
    writeJournal(null)
    return { ok: false, reason: `The write did not come out right (${problem}) so I put everything back. Nothing was lost.` }
  }
  writeJournal(null)
  return { ok: true, done: doneText(plan), undo }
}

function doneText(plan: Plan): string {
  if (plan.merge) return `Merged. ${plan.merge.discardedIds.length} folded into "${plan.title.split('"')[1] ?? "the survivor"}". Say "undo" to bring them back.`
  if (plan.tool === "merge-lists") return `Merged ${plan.dropLists?.length ?? 0} ${plan.dropLists?.length === 1 ? "list" : "lists"} into "${plan.title.split('"')[1] ?? "one list"}", ${plan.changes.length} ${plan.changes.length === 1 ? "item" : "items"} edited${plan.setup?.type ? `, item type "${plan.setup.type.name}" made` : ""}. Say "undo" to bring it all back.`
  if (plan.setup?.list) return `Made the list "${plan.setup.list.name}" and added ${plan.total} ${plan.total === 1 ? "item" : "items"} to it. Say "undo" to take it all back.`
  if (plan.tool === "collect-items") return `Added ${plan.total} ${plan.total === 1 ? "item" : "items"} to the list. Say "undo" to take them off again.`
  if (plan.tool === "retype-items" && plan.setup?.type) return `Made the item type "${plan.setup.type.name}" and applied it to ${plan.total} ${plan.total === 1 ? "item" : "items"}. Say "undo" to take it all back.`
  if (plan.creates) return `Added ${plan.creates.length}. Say "undo" to remove them.`
  return `Done: ${plan.total} ${plan.total === 1 ? "item" : "items"} changed. Say "undo" to put them back.`
}

/** Put back what `applyPlan` changed. Items edited since are restored to their old values for the fields it touched only. */
export function undoPlan(port: Port, undo: Undo): string {
  let restored = 0
  // Folded lists come back first, so the old list memberships have somewhere to point.
  for (const { list, folderId } of undo.removedLists ?? []) {
    if (!port.world().lists.some((l) => l.id === list.id)) port.addList(list)
    if (folderId && port.world().folders?.some((f) => f.id === folderId)) port.fileList(folderId, list.id)
  }
  if (undo.rows.length) {
    const byId = new Map(undo.rows.map((r) => [r.id, r]))
    port.untombstone(undo.tombstoned)
    const world = port.world()
    const seen = new Set<string>()
    const next: Task[] = world.tasks.map((t) => {
      seen.add(t.id)
      return byId.get(t.id) ?? t
    })
    for (const row of undo.rows) if (!seen.has(row.id)) next.push(row)
    port.replaceTasks(next, [])
    restored += undo.rows.length
  }
  const present = new Set(port.world().tasks.map((t) => t.id))
  const back = undo.patches.filter((p) => present.has(p.id))
  restored += port.commitMany(back.map((p) => ({ id: p.id, patch: p.before })))
  for (const id of undo.created) {
    if (!port.world().tasks.some((t) => t.id === id)) continue
    port.removeItem(id)
    restored++
  }
  const kept: string[] = []
  if (undo.made) {
    const { listId, folderId, typeId } = undo.made
    // A list someone has used since keeps its items, so it stays; an empty one made here goes.
    const used = listId ? port.world().tasks.some((t) => (t.lists ?? []).includes(listId)) : false
    if (listId && !used) port.removeList(listId)
    else if (listId) kept.push("the new list, because items are on it now")
    if (folderId && !used) port.removeFolder(folderId)
    else if (folderId) kept.push("the new folder")
    if (typeId && !used) port.removeType(typeId)
    else if (typeId) kept.push("the new item type")
  }
  const keptText = kept.length ? ` Kept ${kept.join(", ")}.` : ""
  return `Undone: ${restored} ${restored === 1 ? "item" : "items"} put back (${undo.label}).${keptText}`
}
