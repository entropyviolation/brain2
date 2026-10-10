/**
 * lib/catalog-tag.ts — One Tracking tag, edited from either habit row
 *
 * Done-count keeps a single normalized name (`taggedTaskTag`). Minute
 * auto-fill keeps tag ids (`trackingLink.tagIds`). Both rows paint the same
 * `TrackTag` catalog. Creating a tag, renaming it, or recoloring it here is
 * the catalog write. A new name follows the count (habits and item tags that
 * used the old name). Ids stay put, so pens and painted minutes stay on that
 * tag. Two catalog tags folded onto one name keep the color already on the
 * tag that remains, and every id moves over. Deleting a tag (`removeTag`)
 * strips the id from pens, entries, habit minute-links, and operation
 * `trackingTagIds` (`scrubDeletedCatalogTag`); count names stay. No persist bump.
 */
"use client"

import { runAsAction, attachLatestUndoHooks } from "@/lib/action-history"
import { useHabitsStore } from "@/lib/habits-store"
import { normalizeTag } from "@/lib/links"
import { OPERATION_ATTR } from "@/lib/operation-types"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore, type TrackTag } from "@/lib/time-tracking-store"
import type { WeeklyTask } from "@/lib/types"

export { scrubDeletedCatalogTag } from "@/lib/catalog-tag-scrub"

export interface CatalogTagEdit {
  /** The tag that remains (the edited one, or the one it folded into). */
  tag: TrackTag
  /** Normalized name before the edit. */
  fromName: string
  /** Normalized name after the edit. */
  toName: string
  /** Set when this id was removed because another tag already had the name. */
  replacedId?: string
}

interface HabitTagSnap {
  id: string
  taggedTaskTag?: string
  tagIds?: string[]
}

/** Display name: trim and collapse inner spaces. Case stays as typed. */
export function catalogDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, " ")
}

/** Another catalog tag already using this normalized name. */
export function catalogTagByName(
  tags: readonly Pick<TrackTag, "id" | "name">[],
  name: string,
  exceptId?: string,
): Pick<TrackTag, "id" | "name"> | undefined {
  const want = normalizeTag(name)
  if (!want) return undefined
  return tags.find((tag) => tag.id !== exceptId && normalizeTag(tag.name) === want)
}

/**
 * Point a done-count name at `to` when it was `from`.
 * A name that does not match is returned as stored.
 */
export function retargetTaggedTaskTag(value: string | undefined, from: string, to: string): string | undefined {
  const fromName = normalizeTag(from)
  const toName = normalizeTag(to)
  if (value == null || !fromName || !toName || fromName === toName) return value
  return normalizeTag(value) === fromName ? toName : value
}

/** Same name move for an item's tag list. Order stays. A duplicate of `to` is dropped. */
export function retargetTagNameList(tags: string[] | undefined, from: string, to: string): string[] | undefined {
  const fromName = normalizeTag(from)
  const toName = normalizeTag(to)
  if (!tags || !fromName || !toName || fromName === toName) return tags
  let changed = false
  const next: string[] = []
  const seen = new Set<string>()
  for (const tag of tags) {
    const mapped = normalizeTag(tag) === fromName ? toName : tag
    const key = normalizeTag(mapped)
    if (!key || seen.has(key)) {
      changed = true
      continue
    }
    seen.add(key)
    if (mapped !== tag) changed = true
    next.push(mapped)
  }
  return changed ? next : tags
}

/**
 * Point id lists at `toId` when they mentioned `fromId`.
 * The same array comes back when `fromId` is absent.
 */
export function retargetTagIds(ids: readonly string[] | undefined, fromId: string, toId: string): string[] | undefined {
  if (!ids) return undefined
  if (!fromId || fromId === toId || !ids.includes(fromId)) return ids as string[]
  const next: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    const mapped = id === fromId ? toId : id
    if (!mapped || seen.has(mapped)) continue
    seen.add(mapped)
    next.push(mapped)
  }
  return next
}

function snapHabits(tasks: readonly WeeklyTask[]): HabitTagSnap[] {
  return tasks.map((task) => ({
    id: task.id,
    taggedTaskTag: task.taggedTaskTag,
    tagIds: task.trackingLink?.tagIds ? [...task.trackingLink.tagIds] : undefined,
  }))
}

function habitsFromSnap(tasks: WeeklyTask[], rows: readonly HabitTagSnap[]): WeeklyTask[] | null {
  const byId = new Map(rows.map((row) => [row.id, row]))
  let changed = false
  const next = tasks.map((task) => {
    const row = byId.get(task.id)
    if (!row) return task
    let habit = task
    if (task.taggedTaskTag !== row.taggedTaskTag) {
      habit = { ...habit, taggedTaskTag: row.taggedTaskTag }
      changed = true
    }
    if (row.tagIds && habit.trackingLink && habit.trackingLink.tagIds !== row.tagIds) {
      const same =
        habit.trackingLink.tagIds.length === row.tagIds.length &&
        habit.trackingLink.tagIds.every((id, index) => id === row.tagIds?.[index])
      if (!same) {
        habit = { ...habit, trackingLink: { ...habit.trackingLink, tagIds: [...row.tagIds] } }
        changed = true
      }
    }
    return habit
  })
  return changed ? next : null
}

function writeHabitSnap(rows: readonly HabitTagSnap[]): void {
  const current = useHabitsStore.getState().tasks
  const next = habitsFromSnap(current, rows)
  if (next) useHabitsStore.getState().setTasks(next)
}

function mapHabits(
  tasks: readonly WeeklyTask[],
  fromName: string,
  toName: string,
  fromId?: string,
  toId?: string,
): WeeklyTask[] | null {
  let changed = false
  const next = tasks.map((task) => {
    let habit = task
    const tagged = retargetTaggedTaskTag(task.taggedTaskTag, fromName, toName)
    if (tagged !== task.taggedTaskTag) {
      habit = { ...habit, taggedTaskTag: tagged }
      changed = true
    }
    if (fromId && toId && habit.trackingLink?.tagIds) {
      const tagIds = retargetTagIds(habit.trackingLink.tagIds, fromId, toId)
      if (tagIds && tagIds !== habit.trackingLink.tagIds) {
        habit = { ...habit, trackingLink: { ...habit.trackingLink, tagIds } }
        changed = true
      }
    }
    return habit
  })
  return changed ? next : null
}

function retargetTrackingIds(fromId: string, toId: string): void {
  useTimeTrackingStore.setState((state) => {
    let scopesChanged = false
    const scopes = state.scopes.map((scope) => {
      let pensChanged = false
      const pens = scope.pens.map((pen) => {
        const tags = retargetTagIds(pen.tags, fromId, toId)
        if (!tags || tags === pen.tags) return pen
        pensChanged = true
        return { ...pen, tags }
      })
      if (!pensChanged) return scope
      scopesChanged = true
      return { ...scope, pens }
    })
    let entriesChanged = false
    const entries = state.entries.map((entry) => {
      const tagIds = retargetTagIds(entry.tagIds, fromId, toId)
      if (!tagIds || tagIds === entry.tagIds) return entry
      entriesChanged = true
      return { ...entry, tagIds }
    })
    if (!scopesChanged && !entriesChanged) return state
    return {
      ...(scopesChanged ? { scopes } : {}),
      ...(entriesChanged ? { entries } : {}),
    }
  })
}

function retargetItems(fromName: string, toName: string, fromId?: string, toId?: string): void {
  const tasks = useTaskStore.getState().tasks
  let changed = false
  const next = tasks.map((task) => {
    let item = task
    const tags = retargetTagNameList(task.tags, fromName, toName)
    if (tags !== task.tags) {
      item = { ...item, tags }
      changed = true
    }
    if (fromId && toId && Array.isArray(item.attributes?.[OPERATION_ATTR.trackingTagIds])) {
      const raw = item.attributes[OPERATION_ATTR.trackingTagIds] as unknown[]
      const ids = retargetTagIds(
        raw.filter((entry): entry is string => typeof entry === "string"),
        fromId,
        toId,
      )
      const same = Array.isArray(ids) && ids.length === raw.length && ids.every((id, index) => id === raw[index])
      if (ids && !same) {
        item = {
          ...item,
          attributes: { ...item.attributes, [OPERATION_ATTR.trackingTagIds]: ids },
        }
        changed = true
      }
    }
    return item
  })
  if (changed) useTaskStore.getState().setTasks(next)
}

/**
 * Write a catalog tag's name and color.
 * Empty names are ignored. A name that already belongs to another tag folds
 * this id into that one and keeps the color already stored there.
 */
export function commitCatalogTagEdit(
  current: TrackTag,
  patch: { name: string; color: string },
): CatalogTagEdit | null {
  const name = catalogDisplayName(patch.name)
  if (!name) return null
  const tracking = useTimeTrackingStore.getState()
  const live = tracking.tags.find((tag) => tag.id === current.id)
  if (!live) return null
  const fromName = normalizeTag(live.name)
  const toName = normalizeTag(name)
  const color = patch.color || live.color
  if (name === live.name && color === live.color) {
    return { tag: live, fromName, toName }
  }

  const before = snapHabits(useHabitsStore.getState().tasks)
  let result: CatalogTagEdit = { tag: { ...live, name, color }, fromName, toName }

  runAsAction("update tag", () => {
    const collision = catalogTagByName(useTimeTrackingStore.getState().tags, name, live.id)
    if (collision) {
      const survivor = useTimeTrackingStore.getState().tags.find((tag) => tag.id === collision.id) ?? {
        id: collision.id,
        name: collision.name,
        color: live.color,
      }
      const survivorName = normalizeTag(survivor.name)
      retargetTrackingIds(live.id, survivor.id)
      const habits = mapHabits(useHabitsStore.getState().tasks, fromName, survivorName, live.id, survivor.id)
      if (habits) useHabitsStore.getState().setTasks(habits)
      retargetItems(fromName, survivorName, live.id, survivor.id)
      useTimeTrackingStore.getState().removeTag(live.id)
      result = {
        tag: survivor,
        fromName,
        toName: survivorName,
        replacedId: live.id,
      }
    } else {
      const next = { ...live, name, color }
      useTimeTrackingStore.getState().updateTag(next)
      const habits = mapHabits(useHabitsStore.getState().tasks, fromName, toName)
      if (habits) useHabitsStore.getState().setTasks(habits)
      retargetItems(fromName, toName)
      result = { tag: next, fromName, toName }
    }
    const after = snapHabits(useHabitsStore.getState().tasks)
    attachLatestUndoHooks({
      onUndo: () => writeHabitSnap(before),
      onRedo: () => writeHabitSnap(after),
    })
  })

  return result
}
