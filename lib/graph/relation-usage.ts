/**
 * lib/graph/relation-usage.ts — Links per relation id, vault-wide.
 * Cached by tasks array identity (invariant 11: library only).
 */
import type { ItemRecord } from "@/lib/types"

let source: readonly ItemRecord[] | null = null
let counts = new Map<string, number>()

export function relationUsage(tasks: readonly ItemRecord[]): Map<string, number> {
  if (source === tasks) return counts
  source = tasks
  counts = new Map()
  for (const item of tasks) for (const link of item.links ?? []) counts.set(link.relation, (counts.get(link.relation) ?? 0) + 1)
  return counts
}
