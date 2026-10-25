/**
 * lib/working-now-banner.ts — Who sees the "working on now" strip
 *
 * The pen clock names one task, and sometimes one step inside it. The open
 * item shows the strip when it is that item, or a parent of it. A sibling
 * and an unrelated item stay quiet. A child of the clock task stays quiet
 * too: the strip climbs to ancestors, and stops at the item on the clock.
 */
import type { Subtask, Task } from "@/lib/types"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { stepPath } from "@/lib/next-step"
import { findStepItem } from "@/lib/step-items"

export interface WorkingNowBannerInfo {
  /** This open item is the one the clock is on. */
  live: boolean
  /** Name of the item the clock is on. */
  liveTitle: string
}

type BannerTask = Pick<Task, "id" | "title" | "description" | "stepOf" | "parentTaskId" | "subtasks">

type ClockSession = { taskId?: string; stepId?: string } | null | undefined

function liveItem(tasks: readonly BannerTask[], session: ClockSession): BannerTask | undefined {
  if (!session?.taskId) return undefined
  const task = tasks.find((row) => row.id === session.taskId)
  if (!task) return undefined
  if (session.stepId) {
    const stepItem = findStepItem(tasks as Task[], task.id, session.stepId)
    if (stepItem) return stepItem
  }
  return task
}

function addAncestors(tasks: readonly BannerTask[], item: BannerTask, show: Set<string>, seen: Set<string>): void {
  if (seen.has(item.id)) return
  seen.add(item.id)

  const parentIds = new Set<string>()
  if (item.parentTaskId) parentIds.add(item.parentTaskId)
  if (item.stepOf) {
    parentIds.add(item.stepOf.taskId)
    const owner = tasks.find((row) => row.id === item.stepOf!.taskId)
    const path: Subtask[] = owner ? (stepPath(owner.subtasks, item.stepOf.stepId) ?? []) : []
    for (const step of path) {
      const stepItem = findStepItem(tasks as Task[], item.stepOf.taskId, step.id)
      if (!stepItem || show.has(stepItem.id)) continue
      show.add(stepItem.id)
      addAncestors(tasks, stepItem, show, seen)
    }
  }

  for (const id of parentIds) {
    show.add(id)
    const parent = tasks.find((row) => row.id === id)
    if (parent) addAncestors(tasks, parent, show, seen)
  }
}

/** The strip for this open item, or null when the clock is elsewhere. */
export function workingNowBannerFor(
  openId: string,
  tasks: readonly BannerTask[],
  session: ClockSession,
): WorkingNowBannerInfo | null {
  const live = liveItem(tasks, session)
  if (!live) return null
  const show = new Set<string>([live.id])
  addAncestors(tasks, live, show, new Set())
  if (!show.has(openId)) return null
  return { live: openId === live.id, liveTitle: itemTitleOrUntitled(live) }
}
