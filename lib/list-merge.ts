/**
 * lib/list-merge.ts — Combine multiple lists into one surviving list
 */
import type { AttributeDefinition, Folder, List, Task } from "@/lib/types"
import { sanitizeEnabledDisplays } from "@/lib/types"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"

export interface ListMergePlan {
  survivorId: string
  discardedIds: string[]
  name: string
  color: string
  description?: string
  icon?: string
  scheduleable: boolean
  itemTypeId?: string
  itemLabel?: string
  folderIds: string[]
  keepAllItems: boolean
  preserveAttributes: boolean
  preserveRules: boolean
}

export function uniqueNonEmpty(values: (string | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const s = (v ?? "").trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

export function unionById<T extends { id: string }>(items: T[]): T[] {
  const byId = new Map<string, T>()
  for (const item of items) {
    if (!byId.has(item.id)) byId.set(item.id, item)
  }
  return Array.from(byId.values())
}

export function defaultMergeFolderIds(folders: Folder[], listIds: string[]): string[] {
  const wanted = new Set(listIds)
  return folders
    .filter((f) => !isScheduledFolderId(f.id) && f.listIds.some((id) => wanted.has(id) && !isFolderAllItemsCategoryId(id)))
    .map((f) => f.id)
}

export function buildMergedList(lists: List[], plan: ListMergePlan): List | null {
  const sources = lists.filter((l) => l.id === plan.survivorId || plan.discardedIds.includes(l.id))
  const survivor = sources.find((l) => l.id === plan.survivorId)
  if (!survivor) return null
  const itemAttributes: AttributeDefinition[] | undefined = plan.preserveAttributes
    ? unionById(sources.flatMap((l) => l.itemAttributes ?? []))
    : survivor.itemAttributes
  const defaultAttributeValues = plan.preserveAttributes
    ? Object.assign({}, ...sources.map((l) => l.defaultAttributeValues ?? {}))
    : survivor.defaultAttributeValues
  const displayedAttributes = plan.preserveAttributes
    ? [...new Set(sources.flatMap((l) => l.displayedAttributes ?? []))]
    : survivor.displayedAttributes
  const enabledDisplays = sanitizeEnabledDisplays([...new Set(sources.flatMap((l) => l.enabledDisplays ?? []))])
  const detailPanels = [...new Set(sources.flatMap((l) => l.detailPanels ?? []))]
  const rules = plan.preserveRules ? sources.flatMap((l) => l.rules ?? []) : survivor.rules
  return {
    ...survivor,
    name: plan.name,
    color: plan.color,
    description: plan.description,
    icon: plan.icon,
    scheduleable: plan.scheduleable,
    itemTypeId: plan.itemTypeId,
    itemLabel: plan.itemLabel,
    itemAttributes: itemAttributes?.length ? itemAttributes : survivor.itemAttributes,
    defaultAttributeValues,
    displayedAttributes: displayedAttributes?.length ? displayedAttributes : survivor.displayedAttributes,
    enabledDisplays: enabledDisplays ?? sanitizeEnabledDisplays(survivor.enabledDisplays),
    detailPanels: detailPanels.length ? detailPanels : survivor.detailPanels,
    rules: rules?.length ? rules : survivor.rules,
  }
}

export function retargetTasksForMerge(tasks: Task[], plan: ListMergePlan): Task[] {
  const discarded = new Set(plan.discardedIds)
  return tasks.map((t) => {
    const cats = t.lists ?? []
    const inDiscarded = cats.some((id) => discarded.has(id))
    const inSurvivor = cats.includes(plan.survivorId)
    if (!inDiscarded && !inSurvivor) return t
    let next = cats.filter((id) => !discarded.has(id))
    if (plan.keepAllItems && (inDiscarded || inSurvivor) && !next.includes(plan.survivorId)) {
      next = [...next, plan.survivorId]
    }
    if (next === cats || (next.length === cats.length && next.every((id, i) => id === cats[i]))) return t
    return { ...t, lists: next }
  })
}

export function applyListMerge(
  state: { lists: List[]; folders: Folder[]; tasks: Task[] },
  plan: ListMergePlan,
): { lists: List[]; folders: Folder[]; tasks: Task[] } {
  const merged = buildMergedList(state.lists, plan)
  if (!merged) return state
  const discarded = new Set(plan.discardedIds)
  const lists = state.lists.filter((l) => !discarded.has(l.id)).map((l) => (l.id === plan.survivorId ? merged : l))
  const chosen = new Set(plan.folderIds)
  const folders = state.folders.map((f) => {
    let ids = f.listIds.filter((id) => !discarded.has(id))
    const has = ids.includes(plan.survivorId)
    const want = chosen.has(f.id)
    if (want && !has) ids = [...ids, plan.survivorId]
    if (!want && has) ids = ids.filter((id) => id !== plan.survivorId)
    return ids === f.listIds ? f : { ...f, listIds: ids }
  })
  const tasks = retargetTasksForMerge(state.tasks, plan)
  return { lists, folders, tasks }
}

export function defaultMergePlan(lists: List[], folders: Folder[]): ListMergePlan | null {
  if (lists.length < 2) return null
  const survivor = lists[0]
  return {
    survivorId: survivor.id,
    discardedIds: lists.slice(1).map((l) => l.id),
    name: survivor.name,
    color: survivor.color,
    description: survivor.description,
    icon: survivor.icon,
    scheduleable: lists.some((l) => l.scheduleable !== false),
    itemTypeId: survivor.itemTypeId,
    itemLabel: survivor.itemLabel,
    folderIds: defaultMergeFolderIds(folders, lists.map((l) => l.id)),
    keepAllItems: true,
    preserveAttributes: true,
    preserveRules: true,
  }
}
