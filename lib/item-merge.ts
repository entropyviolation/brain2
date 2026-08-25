/**
 * lib/item-merge.ts — Combine multiple items into one surviving item
 */
import type { ItemLink, List, Subtask, Task } from "@/lib/types"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { uniqueNonEmpty, unionById } from "@/lib/list-merge"
import { isNaSmartCategoryId } from "@/lib/scheduled-lists-sync"

export interface ItemMergePlan {
  survivorId: string
  discardedIds: string[]
  description: string
  notes?: string
  why?: string
  icon?: string
  listIds: string[]
  keepAllDetails: boolean
  preserveAttributes: boolean
  preserveTags: boolean
  preserveLinks: boolean
}

export function itemMergeLabel(item: Task): string {
  const text = (item.description || item.title || "").trim()
  return text || "Untitled"
}

export function defaultMergeListIds(items: Task[], lists: List[]): string[] {
  const wanted = new Set(items.flatMap((item) => item.lists ?? []))
  return lists
    .filter((l) => wanted.has(l.id) && !isFolderAllItemsCategoryId(l.id) && !isNaSmartCategoryId(l.id))
    .map((l) => l.id)
}

export function defaultItemMergePlan(items: Task[], lists: List[]): ItemMergePlan | null {
  if (items.length < 2) return null
  const survivor = items[0]
  return {
    survivorId: survivor.id,
    discardedIds: items.slice(1).map((item) => item.id),
    description: itemMergeLabel(survivor),
    notes: survivor.notes,
    why: survivor.why,
    icon: survivor.icon,
    listIds: defaultMergeListIds(items, lists),
    keepAllDetails: true,
    preserveAttributes: true,
    preserveTags: true,
    preserveLinks: true,
  }
}

function retargetId(id: string, discarded: Set<string>, survivorId: string): string {
  return discarded.has(id) ? survivorId : id
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function retargetLinks(
  links: ItemLink[] | undefined,
  discarded: Set<string>,
  survivorId: string,
  selfId: string = survivorId,
): ItemLink[] {
  const out: ItemLink[] = []
  const seen = new Set<string>()
  for (const link of links ?? []) {
    const targetId = retargetId(link.targetId, discarded, survivorId)
    if (!targetId || targetId === selfId) continue
    const key = `${link.relation}:${targetId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(targetId === link.targetId ? link : { ...link, targetId })
  }
  return out
}

export function buildMergedItem(items: Task[], plan: ItemMergePlan): Task | null {
  const sources = items.filter((item) => item.id === plan.survivorId || plan.discardedIds.includes(item.id))
  const survivor = sources.find((item) => item.id === plan.survivorId)
  if (!survivor) return null
  const discarded = new Set(plan.discardedIds)
  const others = sources.filter((item) => item.id !== plan.survivorId)

  const attributes = plan.preserveAttributes
    ? Object.assign({}, ...others.map((item) => item.attributes ?? {}), survivor.attributes ?? {})
    : survivor.attributes
  const itemAttributeDefinitions = plan.preserveAttributes
    ? unionById(sources.flatMap((item) => item.itemAttributeDefinitions ?? []))
    : survivor.itemAttributeDefinitions
  const tags = plan.preserveTags ? uniqueNonEmpty(sources.flatMap((item) => item.tags ?? [])) : survivor.tags
  const links = plan.preserveLinks
    ? retargetLinks(sources.flatMap((item) => item.links ?? []), discarded, plan.survivorId)
    : retargetLinks(survivor.links, discarded, plan.survivorId)
  const subtasks: Subtask[] | undefined = plan.keepAllDetails
    ? unionById(sources.flatMap((item) => item.subtasks ?? []))
    : survivor.subtasks
  const dependencies = uniqueIds(
    (plan.keepAllDetails ? sources.flatMap((item) => item.dependencies ?? []) : survivor.dependencies ?? [])
      .map((id) => retargetId(id, discarded, plan.survivorId))
      .filter((id) => id !== plan.survivorId),
  )

  return {
    ...survivor,
    description: plan.description,
    title: plan.description,
    notes: plan.notes,
    why: plan.why,
    icon: plan.icon,
    lists: plan.listIds,
    attributes: Object.keys(attributes ?? {}).length ? attributes : survivor.attributes,
    itemAttributeDefinitions: itemAttributeDefinitions?.length ? itemAttributeDefinitions : survivor.itemAttributeDefinitions,
    tags: tags?.length ? tags : survivor.tags,
    links: links.length ? links : survivor.links,
    subtasks: subtasks?.length ? subtasks : survivor.subtasks,
    dependencies: dependencies.length ? dependencies : survivor.dependencies,
    contributesToObjectiveIds: plan.keepAllDetails
      ? uniqueIds(sources.flatMap((item) => item.contributesToObjectiveIds ?? []))
      : survivor.contributesToObjectiveIds,
    contributesToGoalIds: plan.keepAllDetails
      ? uniqueIds(sources.flatMap((item) => item.contributesToGoalIds ?? []))
      : survivor.contributesToGoalIds,
  }
}

export function retargetTasksForItemMerge(tasks: Task[], plan: ItemMergePlan): Task[] {
  const discarded = new Set(plan.discardedIds)
  return tasks.map((task) => {
    if (discarded.has(task.id) || task.id === plan.survivorId) return task
    const dependencies = uniqueIds(
      (task.dependencies ?? []).map((id) => retargetId(id, discarded, plan.survivorId)).filter((id) => id !== task.id),
    )
    const parentRaw = task.parentTaskId ? retargetId(task.parentTaskId, discarded, plan.survivorId) : task.parentTaskId
    const parentTaskId = parentRaw === task.id ? undefined : parentRaw
    const links = retargetLinks(task.links, discarded, plan.survivorId, task.id)
    const depsUnchanged =
      dependencies.length === (task.dependencies ?? []).length &&
      dependencies.every((id, i) => id === (task.dependencies ?? [])[i])
    const linksUnchanged =
      links.length === (task.links ?? []).length &&
      links.every((link, i) => link === (task.links ?? [])[i])
    if (depsUnchanged && parentTaskId === task.parentTaskId && linksUnchanged) return task
    return {
      ...task,
      dependencies: depsUnchanged ? task.dependencies : dependencies,
      parentTaskId,
      links: linksUnchanged ? task.links : links,
    }
  })
}

export function applyItemMerge(tasks: Task[], plan: ItemMergePlan): Task[] {
  const merged = buildMergedItem(tasks, plan)
  if (!merged) return tasks
  const discarded = new Set(plan.discardedIds)
  return retargetTasksForItemMerge(tasks, plan)
    .filter((task) => !discarded.has(task.id))
    .map((task) => (task.id === plan.survivorId ? merged : task))
}
