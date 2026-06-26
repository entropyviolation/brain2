/**
 * lib/list-tree.ts — Nested list (sublist) helpers
 *
 * Pure, store-agnostic helpers for the nested-lists / sublists feature. Lists
 * form a forest via the optional `List.parentListId` field (lib/types.ts). These
 * helpers compute ancestors/descendants, build a render tree, and guard
 * `moveList` against cycles and dangling parents. All functions are
 * side-effect-free and tolerate malformed data (missing parents, accidental
 * cycles) without throwing.
 *
 * Spec: §6.2 (lists nest like folders). Used by lib/task-store.ts,
 * components/Lists/navigation/* and lib/folder-all-items.ts.
 */
import type { List } from "@/lib/types"

/** A node in the nested list render tree (root → leaves). */
export interface ListTreeNode {
  list: List
  depth: number
  children: ListTreeNode[]
}

/** Index lists by id for O(1) lookups. */
function indexById(lists: List[]): Map<string, List> {
  const map = new Map<string, List>()
  for (const c of lists) map.set(c.id, c)
  return map
}

export function getListById(lists: List[], id: string): List | undefined {
  return lists.find((c) => c.id === id)
}

/** The immediate parent of `id`, or undefined for roots / dangling parents. */
export function getParent(lists: List[], id: string): List | undefined {
  const self = getListById(lists, id)
  if (!self?.parentListId) return undefined
  return getListById(lists, self.parentListId)
}

/**
 * Ancestors of `id` ordered nearest-parent → root. Stops on a dangling parent
 * and is cycle-safe (a corrupt parent chain terminates at the first repeat).
 */
export function getAncestors(lists: List[], id: string): List[] {
  const byId = indexById(lists)
  const out: List[] = []
  const seen = new Set<string>([id])
  let current = byId.get(id)?.parentListId
  while (current && byId.has(current) && !seen.has(current)) {
    seen.add(current)
    const parent = byId.get(current)!
    out.push(parent)
    current = parent.parentListId
  }
  return out
}

export function getAncestorIds(lists: List[], id: string): string[] {
  return getAncestors(lists, id).map((c) => c.id)
}

/** Direct children of `id`, preserving the input order. */
export function getChildren(lists: List[], id: string): List[] {
  return lists.filter((c) => c.parentListId === id)
}

/**
 * All transitive descendants of `id` (children, grandchildren, …) in
 * breadth-first order. Cycle-safe via a visited set.
 */
export function getDescendants(lists: List[], id: string): List[] {
  const childrenByParent = new Map<string, List[]>()
  for (const c of lists) {
    if (!c.parentListId) continue
    const kids = childrenByParent.get(c.parentListId)
    if (kids) kids.push(c)
    else childrenByParent.set(c.parentListId, [c])
  }
  const out: List[] = []
  const seen = new Set<string>([id])
  const queue = [...(childrenByParent.get(id) ?? [])]
  while (queue.length) {
    const node = queue.shift()!
    if (seen.has(node.id)) continue
    seen.add(node.id)
    out.push(node)
    const kids = childrenByParent.get(node.id)
    if (kids) queue.push(...kids)
  }
  return out
}

export function getDescendantIds(lists: List[], id: string): string[] {
  return getDescendants(lists, id).map((c) => c.id)
}

/** True when `id` is a descendant of `ancestorId`. */
export function isDescendantOf(lists: List[], id: string, ancestorId: string): boolean {
  if (id === ancestorId) return false
  return getAncestorIds(lists, id).includes(ancestorId)
}

/** Lists with no (resolvable) parent — the roots of the forest. */
export function getRootLists(lists: List[]): List[] {
  const byId = indexById(lists)
  return lists.filter((c) => !c.parentListId || !byId.has(c.parentListId))
}

/** Nesting depth of `id` (0 for a root). Cycle-safe. */
export function getDepth(lists: List[], id: string): number {
  return getAncestors(lists, id).length
}

/**
 * Path from the root down to `id` (inclusive), suitable for breadcrumbs.
 * Returns `[]` when `id` is unknown.
 */
export function getListPath(lists: List[], id: string): List[] {
  const self = getListById(lists, id)
  if (!self) return []
  return [...getAncestors(lists, id).reverse(), self]
}

/**
 * Whether `id` can be re-parented under `newParentId` (or to root when null).
 * Rejects: unknown source, unknown parent, self-parenting, and any move that
 * would create a cycle (parent is the node itself or one of its descendants).
 */
export function canMoveList(
  lists: List[],
  id: string,
  newParentId: string | null | undefined,
): boolean {
  if (!getListById(lists, id)) return false
  if (newParentId == null) return true // detach to root
  if (newParentId === id) return false
  if (!getListById(lists, newParentId)) return false
  // Moving under one of our own descendants would orphan/cycle the subtree.
  if (getDescendantIds(lists, id).includes(newParentId)) return false
  return true
}

/**
 * Pure re-parent: returns a new lists array with `id`'s `parentListId` set to
 * `newParentId` (null/undefined detaches to root). Returns the input array
 * unchanged when the move is invalid (see `canMoveList`).
 */
export function moveList(
  lists: List[],
  id: string,
  newParentId: string | null | undefined,
): List[] {
  if (!canMoveList(lists, id, newParentId)) return lists
  return lists.map((c) => {
    if (c.id !== id) return c
    const next = { ...c }
    if (newParentId == null) delete next.parentListId
    else next.parentListId = newParentId
    return next
  })
}

/**
 * Build the nested render forest. Roots preserve input order; children are
 * ordered by `order` (when present) then input order. Cycle-safe.
 */
export function buildListTree(lists: List[]): ListTreeNode[] {
  const byId = indexById(lists)
  const sortChildren = (a: List, b: List) => (a.order ?? 0) - (b.order ?? 0)

  const build = (list: List, depth: number, seen: Set<string>): ListTreeNode => {
    seen.add(list.id)
    const children = lists
      .filter((c) => c.parentListId === list.id && !seen.has(c.id))
      .sort(sortChildren)
      .map((child) => build(child, depth + 1, seen))
    return { list, depth, children }
  }

  const seen = new Set<string>()
  const roots = lists.filter((c) => !c.parentListId || !byId.has(c.parentListId))
  return roots.map((root) => build(root, 0, seen))
}

/** Flatten a list tree to a depth-annotated list (pre-order). */
export function flattenListTree(nodes: ListTreeNode[]): ListTreeNode[] {
  const out: ListTreeNode[] = []
  const walk = (node: ListTreeNode) => {
    out.push(node)
    node.children.forEach(walk)
  }
  nodes.forEach(walk)
  return out
}
