/**
 * lib/pen-sort.ts — How Tracking pens are listed
 *
 * A vault with thirty Activity pens is unreadable in creation order. Recently
 * painted pens float to the top; A–Z is the backup; Tree keeps the parent
 * nest when you are assigning categories. Pure — the store only stamps
 * `lastUsedAt` when a pen is painted or created.
 */
import { childrenOf, roots, type TreePen } from "@/lib/pen-tree"

export const PEN_SORT_MODES = ["recent", "name", "tree"] as const
export type PenSortMode = (typeof PEN_SORT_MODES)[number]

export const PEN_SORT_LABELS: Record<PenSortMode, string> = {
  recent: "Recent",
  name: "A–Z",
  tree: "Tree",
}

export interface SortablePen extends TreePen {
  lastUsedAt?: number
}

function byRecent<T extends SortablePen>(a: T, b: T): number {
  const used = (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)
  if (used !== 0) return used
  return a.name.localeCompare(b.name)
}

function byName<T extends SortablePen>(a: T, b: T): number {
  return a.name.localeCompare(b.name)
}

/** Flat list: recently used first, or A–Z. Tree mode still flattens for search. */
export function orderPens<T extends SortablePen>(pens: T[], mode: PenSortMode): T[] {
  const copy = [...pens]
  if (mode === "name") return copy.sort(byName)
  return copy.sort(byRecent)
}

/** Children of one parent, or roots when `parentId` is null. */
export function orderedChildren<T extends SortablePen>(
  pens: T[],
  parentId: string | null,
  mode: PenSortMode,
): T[] {
  const kids = (parentId === null ? roots(pens) : childrenOf(pens, parentId)) as T[]
  if (mode === "tree") return kids
  return orderPens(kids, mode)
}

/**
 * Stamp `lastUsedAt` from painted intervals so an existing vault is sorted
 * the first time Recent is on, without waiting for the next stroke.
 */
export function lastUsedFromEntries(
  entries: { penId: string; date: string; startMin: number }[],
): Record<string, number> {
  const latest: Record<string, number> = {}
  for (const entry of entries) {
    const stamp = Date.parse(`${entry.date}T00:00:00`) + entry.startMin * 60_000
    if (!Number.isFinite(stamp)) continue
    if ((latest[entry.penId] ?? 0) < stamp) latest[entry.penId] = stamp
  }
  return latest
}
