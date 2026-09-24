/**
 * lib/implied-actions.ts — Execute type/list implied-action side effects
 *
 * After an item update, matched `logAction` / `incrementHabit` rules (collected
 * by `applyRules`) create Done-day activity rows and increment habits. Pure
 * template interpolation lives here so tests don't need stores; `executeImpliedEffects`
 * talks to the task repo, points store, and habits store.
 *
 * Logged actions skip re-entry: they carry `loggedAction: true` and `type: "action"`.
 */
import type { ItemLink, Task } from "@/lib/types"
import type { ImpliedRuleEffect, ItemLike } from "@/lib/item-types"
import { getFieldValue } from "@/lib/item-types"
import { LOGGED_ACTION_TYPE_ID } from "@/lib/item-types"
import { taskRepository } from "@/lib/data/task-repository"
import { usePointsStore } from "@/lib/points-store"
import { useHabitsStore } from "@/lib/habits-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { completionWithGoalFlag } from "@/lib/habit-utils"
import { emitTaskCompleted } from "@/lib/completion-events"
import { itemTitle, type TitledRecord } from "@/lib/item-utils"

const GOAL_RELATIONS = new Set(["action-of", "objective-of", "goal-of"])

export function interpolateActionTitle(
  template: string,
  item: ItemLike,
  delta: number,
): string {
  const title = itemTitle(item as TitledRecord)
  const attrs = (item.attributes ?? {}) as Record<string, unknown>
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    if (key === "title") return title
    if (key === "delta") return String(delta)
    if (key === "value") {
      return String(getFieldValue(item, "value") ?? "")
    }
    if (key in attrs) return String(attrs[key] ?? "")
    const top = item[key]
    if (top !== undefined && top !== null) return String(top)
    return ""
  })
}

function copyGoalLinks(source: Task): ItemLink[] {
  return (source.links ?? [])
    .filter((l) => GOAL_RELATIONS.has(l.relation))
    .map((l) => ({
      ...l,
      id: `link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    }))
}

export function buildLoggedActionItem(
  source: Task,
  title: string,
  awardPoints: boolean,
  now = new Date(),
): Task {
  return {
    id: `action-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    description: title,
    title,
    type: LOGGED_ACTION_TYPE_ID,
    loggedAction: true,
    stage: "completed",
    createdAt: now,
    completed: true,
    completedDate: now,
    lists: [],
    tags: [],
    links: copyGoalLinks(source),
    contributesToObjectiveIds: source.contributesToObjectiveIds,
    contributesToGoalIds: source.contributesToGoalIds,
    rewardValue: awardPoints ? (source.rewardValue ?? 1) : 0,
    attributes: {},
  }
}

export function incrementHabitProgress(habitId: string, amount: number, date = new Date()): void {
  if (!habitId || !Number.isFinite(amount) || amount === 0) return
  const store = useHabitsStore.getState()
  const habit = store.tasks.find((t) => t.id === habitId)
  if (!habit) return
  const dateKey = formatLocalDateKey(date)
  const previous = store.weeklyData[dateKey]?.[habitId]
  const nextValue = (previous?.value ?? 0) + amount
  store.updateCompletion(
    habitId,
    date,
    completionWithGoalFlag(habit, { ...previous, value: nextValue }),
  )
}

export function executeImpliedEffects(
  effects: ImpliedRuleEffect[],
  source: Task,
  opts?: { now?: Date },
): Task[] {
  const now = opts?.now ?? new Date()
  const created: Task[] = []
  for (const effect of effects) {
    if (effect.kind === "incrementHabit") {
      incrementHabitProgress(effect.habitId, effect.amount, now)
      continue
    }
    if (effect.kind === "logAction") {
      const title = interpolateActionTitle(
        effect.titleTemplate,
        source as unknown as ItemLike,
        effect.delta,
      ).trim()
      if (!title) continue
      const award = effect.awardPoints !== false
      const logged = buildLoggedActionItem(source, title, award, now)
      taskRepository.add(logged)
      created.push(logged)
      if (award) {
        const points = logged.rewardValue ?? 1
        if (points > 0) {
          usePointsStore.getState().addPoints(logged.id, points, logged.description, now)
        }
        emitTaskCompleted({ taskId: logged.id, basePoints: points, at: now })
      }
    }
  }
  return created
}
