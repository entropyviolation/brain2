/**
 * lib/list-links.ts — Connected-list membership (not nesting)
 *
 * Directed A→B links copy membership onto the target list. Canonical write is
 * `List.linkedTargetListIds` on the source. Manual removals persist on
 * `Task.listMembershipExclusions` so a later sync cannot put the item back.
 *
 * See components/Lists/LIST_LINKS.md.
 */
import type { List, Task } from "@/lib/types"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { isNaSmartCategoryId } from "@/lib/scheduled-lists-sync"

export interface ListMembershipLink {
  sourceListId: string
  targetListId: string
}

export type ListLinkRole = "push" | "receive"

export interface ListLinkView extends ListMembershipLink {
  /** `push` = this list is the source; `receive` = this list is the target. */
  role: ListLinkRole
}

export function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** Folder All Items and Next Actions smart lists cannot be linked. */
export function isLinkableListId(id: string): boolean {
  if (!id) return false
  if (isFolderAllItemsCategoryId(id)) return false
  if (isNaSmartCategoryId(id)) return false
  return true
}

export function canLinkLists(sourceListId: string, targetListId: string): boolean {
  return sourceListId !== targetListId && isLinkableListId(sourceListId) && isLinkableListId(targetListId)
}

export function linkedTargetIds(list: List | undefined | null): string[] {
  if (!list?.linkedTargetListIds?.length) return []
  return uniqueIds(list.linkedTargetListIds.filter((id) => id && id !== list.id && isLinkableListId(id)))
}

export function allListLinks(lists: List[]): ListMembershipLink[] {
  const known = new Set(lists.map((l) => l.id))
  const out: ListMembershipLink[] = []
  const seen = new Set<string>()
  for (const list of lists) {
    if (!isLinkableListId(list.id)) continue
    for (const targetListId of linkedTargetIds(list)) {
      if (!known.has(targetListId) || !isLinkableListId(targetListId)) continue
      const key = `${list.id}\0${targetListId}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ sourceListId: list.id, targetListId })
    }
  }
  return out
}

/** Connections visible from one list's settings (outbound + inbound). */
export function linksForList(lists: List[], listId: string): ListLinkView[] {
  if (!isLinkableListId(listId)) return []
  const out: ListLinkView[] = []
  const seen = new Set<string>()
  for (const link of allListLinks(lists)) {
    let role: ListLinkRole | null = null
    if (link.sourceListId === listId) role = "push"
    else if (link.targetListId === listId) role = "receive"
    if (!role) continue
    const key = `${link.sourceListId}\0${link.targetListId}\0${role}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...link, role })
  }
  return out
}

export function hasListLink(lists: List[], sourceListId: string, targetListId: string): boolean {
  return allListLinks(lists).some((l) => l.sourceListId === sourceListId && l.targetListId === targetListId)
}

export function addListLinkToLists(lists: List[], sourceListId: string, targetListId: string): List[] {
  if (!canLinkLists(sourceListId, targetListId)) return lists
  const source = lists.find((l) => l.id === sourceListId)
  const target = lists.find((l) => l.id === targetListId)
  if (!source || !target) return lists
  const current = linkedTargetIds(source)
  if (current.includes(targetListId)) return lists
  return lists.map((list) =>
    list.id === sourceListId ? { ...list, linkedTargetListIds: [...current, targetListId] } : list,
  )
}

export function removeListLinkFromLists(lists: List[], sourceListId: string, targetListId: string): List[] {
  let changed = false
  const next = lists.map((list) => {
    if (list.id !== sourceListId) return list
    const current = list.linkedTargetListIds
    if (!current?.includes(targetListId)) return list
    const linkedTargetListIds = uniqueIds(current.filter((id) => id !== targetListId))
    changed = true
    if (linkedTargetListIds.length === 0) {
      const { linkedTargetListIds: _dropped, ...rest } = list
      return rest
    }
    return { ...list, linkedTargetListIds }
  })
  return changed ? next : lists
}

/** Drop a deleted list from every outbound link array. */
export function stripListLinksForDeletedList(lists: List[], deletedId: string): List[] {
  let changed = false
  const next = lists.map((list) => {
    const current = list.linkedTargetListIds
    if (!current?.length) return list
    const linkedTargetListIds = uniqueIds(current.filter((id) => id !== deletedId))
    if (linkedTargetListIds.length === current.length && !current.includes(deletedId)) return list
    changed = true
    if (linkedTargetListIds.length === 0) {
      const { linkedTargetListIds: _dropped, ...rest } = list
      return rest
    }
    return { ...list, linkedTargetListIds }
  })
  return changed ? next : lists
}

export function expandListMembership(
  listIds: string[],
  lists: List[],
  exclusions: Iterable<string> = [],
): string[] {
  const links = allListLinks(lists)
  if (links.length === 0) return uniqueIds(listIds)
  const excluded = new Set(exclusions)
  const original = uniqueIds(listIds)
  const membership = new Set(original)
  let changed = true
  while (changed) {
    changed = false
    for (const { sourceListId, targetListId } of links) {
      if (!membership.has(sourceListId)) continue
      if (membership.has(targetListId)) continue
      if (excluded.has(targetListId)) continue
      membership.add(targetListId)
      changed = true
    }
  }
  const extra = [...membership].filter((id) => !original.includes(id))
  return extra.length === 0 ? original : [...original, ...extra]
}

function sameIdList(a: string[] | undefined, b: string[]): boolean {
  const left = a ?? []
  if (left.length !== b.length) return false
  return left.every((id, i) => id === b[i])
}

/**
 * Honor manual add/remove, then expand through links.
 * Pass `previous === task` (or the same membership) to expand without treating
 * missing target ids as a user opt-out — used when a link is first created.
 */
export function applyListLinksToTask(task: Task, previous: Task | undefined, lists: List[]): Task {
  let exclusions = uniqueIds(task.listMembershipExclusions ?? previous?.listMembershipExclusions ?? [])
  if (previous && previous !== task) {
    const prevIds = new Set(previous.lists ?? [])
    const nextIds = new Set(task.lists ?? [])
    const removed = [...prevIds].filter((id) => !nextIds.has(id))
    const added = [...nextIds].filter((id) => !prevIds.has(id))
    if (removed.length || added.length) {
      const drop = new Set(added)
      exclusions = uniqueIds([...exclusions, ...removed].filter((id) => !drop.has(id)))
    }
  }
  const expanded = expandListMembership(task.lists ?? [], lists, exclusions)
  const listsSame = sameIdList(task.lists, expanded)
  const exclSame = sameIdList(task.listMembershipExclusions, exclusions)
  if (listsSame && exclSame) return task
  const next: Task = { ...task, lists: expanded }
  if (exclusions.length) next.listMembershipExclusions = exclusions
  else delete next.listMembershipExclusions
  return next
}

/** Expand every item through current links without recording new exclusions. */
export function applyListLinksToTasks(tasks: Task[], lists: List[]): Task[] {
  let changed = false
  const next = tasks.map((task) => {
    const applied = applyListLinksToTask(task, task, lists)
    if (applied === task) return task
    changed = true
    return applied
  })
  return changed ? next : tasks
}

/** Keep `linkedTargetListIds` from `previous` so a settings save cannot clobber links. */
export function preserveLinkedTargetIds(incoming: List, previous: List | undefined): List {
  if (!previous) return incoming
  const kept = previous.linkedTargetListIds
  if (!kept?.length) {
    if (!incoming.linkedTargetListIds?.length) return incoming
    const { linkedTargetListIds: _dropped, ...rest } = incoming
    return rest
  }
  if (sameIdList(incoming.linkedTargetListIds, kept)) return incoming
  return { ...incoming, linkedTargetListIds: [...kept] }
}
