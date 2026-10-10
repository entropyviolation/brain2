/**
 * lib/baby-animal-nudge.ts — Adapter: nest click → friend suggestion
 *
 * Picks from daily habits, today's To Do, and Next Actions using the worn
 * friend's personality. Click again skips the last id. Escape / close dismisses.
 * Flavor, missions, and rewards: `docs/FRIEND_COMPANION.md`.
 */
import { pickFriendSuggestion, type FriendSuggestion, type FriendSuggestionContext } from "@/lib/friend-suggestion"
import { taskServesFocusGoals } from "@/lib/goal-focus"
import { nightCarryForMorning } from "@/lib/ritual-carry"
import { useGoalsStore } from "@/lib/goals-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { pointsRuleValue } from "@/lib/points-rules-live"
import type { Folder, Task } from "@/lib/types"

function focusContext(tasks: Task[], now = new Date()): Pick<FriendSuggestionContext, "focusTaskIds" | "focusMultiplier"> {
  const carry = nightCarryForMorning(useReviewsStore.getState().reviews, now)
  const goals = useGoalsStore.getState().goals
  const ids = new Set<string>()
  for (const task of tasks) {
    if (taskServesFocusGoals(task, goals, carry.focusGoalIds)) ids.add(task.id)
  }
  return { focusTaskIds: ids, focusMultiplier: pointsRuleValue("goalFocus.multiplier") }
}

export type FriendNudge = FriendSuggestion

export { EMPTY_FRIEND_NUDGE } from "@/lib/friend-copy"
export { openFriendNextActions } from "@/lib/friend-suggestion"

export function pickFriendTodoNudge(
  tasks: Task[],
  folders: Folder[],
  lastTaskId: string | null = null,
  rng: () => number = Math.random,
  ctx: FriendSuggestionContext = {},
): FriendNudge {
  const focus = ctx.focusTaskIds ? {} : focusContext(tasks, ctx.now)
  return pickFriendSuggestion(tasks, folders, lastTaskId, rng, { ...focus, ...ctx })
}
