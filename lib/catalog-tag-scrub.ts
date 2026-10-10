/**
 * lib/catalog-tag-scrub.ts — Drop a deleted catalog tag id from habit and
 * operation links. Kept apart from `catalog-tag.ts` so `removeTag` can call
 * it without a cycle through the time-tracking store.
 */
"use client"

import { useHabitsStore } from "@/lib/habits-store"
import { OPERATION_ATTR } from "@/lib/operation-types"
import { useTaskStore } from "@/lib/task-store"

/**
 * Drop a deleted catalog tag id from habit minute-links and operation
 * `trackingTagIds`. Leaves `taggedTaskTag` and item `Task.tags` alone so
 * done-count by name still works. Called from `removeTag` — one delete path.
 */
export function scrubDeletedCatalogTag(tagId: string): void {
  if (!tagId) return

  const habits = useHabitsStore.getState().tasks
  let habitsChanged = false
  const nextHabits = habits.map((habit) => {
    const ids = habit.trackingLink?.tagIds
    if (!ids?.includes(tagId)) return habit
    habitsChanged = true
    const tagIds = ids.filter((id) => id !== tagId)
    return { ...habit, trackingLink: { ...habit.trackingLink!, tagIds } }
  })
  if (habitsChanged) useHabitsStore.getState().setTasks(nextHabits)

  const items = useTaskStore.getState().tasks
  let itemsChanged = false
  const nextItems = items.map((item) => {
    const raw = item.attributes?.[OPERATION_ATTR.trackingTagIds]
    if (!Array.isArray(raw) || !raw.includes(tagId)) return item
    itemsChanged = true
    const ids = raw.filter((entry): entry is string => typeof entry === "string" && entry !== tagId)
    return {
      ...item,
      attributes: { ...item.attributes, [OPERATION_ATTR.trackingTagIds]: ids },
    }
  })
  if (itemsChanged) useTaskStore.getState().setTasks(nextItems)
}
