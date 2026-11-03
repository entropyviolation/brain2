/**
 * lib/critic-bimby/diff.ts — What the person changed between the first read and the confirmed plan (pure)
 *
 * The confirm screen already lets the person edit, so this is ground truth with no extra tap. A task link going from
 * unconfirmed to confirmed is the person's yes, not an edit.
 */

import type { PlanItem, PlanLink } from "@/lib/plan-bimby/types"
import type { PlanEdit } from "./types"

const linkKey = (l: PlanLink | undefined) => (!l ? "none" : l.kind === "task" ? `task:${l.taskId}` : l.kind === "intake" ? `intake:${l.label}` : "flight")

export function diffPlan(first: readonly PlanItem[], confirmed: readonly PlanItem[]): PlanEdit[] {
  const before = new Map(first.map((i) => [i.id, i]))
  const after = new Map(confirmed.filter((i) => i.title.trim()).map((i) => [i.id, i]))
  const out: PlanEdit[] = []
  for (const [id, row] of after) {
    const was = before.get(id)
    if (!was) out.push({ kind: "added", rowId: id })
    else {
      if (was.title.trim() !== row.title.trim()) out.push({ kind: "retitled", rowId: id })
      if (linkKey(was.link) !== linkKey(row.link)) out.push({ kind: "relinked", rowId: id })
    }
  }
  for (const id of before.keys()) if (!after.has(id)) out.push({ kind: "removed", rowId: id })
  return out
}
