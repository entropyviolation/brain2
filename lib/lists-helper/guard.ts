/**
 * lib/lists-helper/guard.ts — What a BIMBY write may never do (pure)
 *
 * A bulk change from a BIMBY is checked three times: before the write (is this plan one of the shapes the tool is
 * allowed to make), after the write (did exactly that happen, and is every item still there), and by a journal
 * kept across the write (if the window dies mid-way, the old values are on hand to put back). Only a merge may
 * remove items, and only a few. Anything else that removes, blanks, or retargets an item is refused, however the
 * request was worded. Plan: `components/Lab/ListsHelper/README.md`.
 */

import type { Task } from "@/lib/types"
import type { Plan, ToolName } from "./types"

/** The only item fields each tool may write. A patch with any other key is refused. */
export const WRITABLE: Record<ToolName, readonly string[]> = {
  "find-items": [],
  "find-duplicates": [],
  "lookup-id": [],
  "merge-items": [],
  "exclusive-type": ["type", "lists", "listMembershipExclusions"],
  "copy-attributes": ["itemAttributeDefinitions"],
  "retype-items": ["type"],
  "add-items": [],
  "collect-items": ["lists", "listMembershipExclusions"],
  "shopping-list": ["lists", "listMembershipExclusions"],
  "merge-lists": ["lists", "listMembershipExclusions", "type"],
}

export const LIMITS = {
  /** Items one plan may edit. Past this the person is told to narrow it (by list or by type). */
  edits: 5000,
  creates: 500,
  /** Items one merge may fold away. */
  discards: 25,
  /** Lists one merge may fold away. */
  lists: 10,
} as const

/** Why this plan must not be written, or null. */
export function refusal(plan: Plan): string | null {
  const allowed = new Set(WRITABLE[plan.tool])
  if (plan.changes.length > LIMITS.edits) return `That would edit ${plan.changes.length} items at once. I stop at ${LIMITS.edits}. Narrow it to one list or one type and ask again.`
  if ((plan.creates?.length ?? 0) > LIMITS.creates) return `That would add ${plan.creates!.length} items at once. I stop at ${LIMITS.creates}.`
  if ((plan.merge?.discardedIds.length ?? 0) > LIMITS.discards) return `That merge would remove ${plan.merge!.discardedIds.length} items. I stop at ${LIMITS.discards}.`
  if (plan.merge && plan.tool !== "merge-items") return "Only a merge may remove items."
  if (plan.dropLists?.length && plan.tool !== "merge-lists") return "Only merging lists may take a list away."
  if (plan.dropLists && plan.dropLists.length > LIMITS.lists) return `That merge would remove ${plan.dropLists.length} lists. I stop at ${LIMITS.lists}.`
  if (plan.setup && plan.tool === "shopping-list" && (plan.setup.folder || plan.setup.type)) return "A shopping list may make its list, never a folder or an item type."
  if (plan.setup && plan.tool !== "collect-items" && plan.tool !== "shopping-list" && !((plan.tool === "retype-items" || plan.tool === "merge-lists") && !plan.setup.list && !plan.setup.folder)) return "Only collecting items may make a list or folder, and only collecting or changing a type may make an item type."
  for (const c of plan.changes) {
    if (plan.tool === "collect-items" || plan.tool === "shopping-list") {
      const was = (c.before.lists as string[] | undefined) ?? []
      const now = (c.patch.lists as string[] | undefined) ?? []
      if (!was.every((id) => now.includes(id))) return `This plan would take "${c.title}" off a list. Collecting only adds. I wrote nothing.`
    }
    const bad = Object.keys(c.patch).find((k) => !allowed.has(k))
    if (bad) return `This plan tried to change "${bad}", which "${plan.tool}" is not allowed to touch. I wrote nothing.`
    if ("lists" in c.patch && Array.isArray(c.patch.lists) && c.patch.lists.length === 0) return `This plan would take "${c.title}" off every list. I wrote nothing.`
    if ("type" in c.patch && !c.patch.type) return `This plan would blank the type of "${c.title}". I wrote nothing.`
  }
  return null
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** After the write: what is wrong with the store, or null. `countBefore` is the item count before the write. */
export function verification(plan: Plan, tasks: Task[], countBefore: number): string | null {
  const expected = countBefore + (plan.creates?.length ?? 0) - (plan.merge?.discardedIds.length ?? 0)
  if (tasks.length !== expected) return `The item count is ${tasks.length}, not ${expected}.`
  if (!plan.changes.length) return null
  const byId = new Map(tasks.map((t) => [t.id, t as unknown as Record<string, unknown>]))
  for (const c of plan.changes) {
    const row = byId.get(c.id)
    if (!row) return `"${c.title}" is gone.`
    for (const [k, v] of Object.entries(c.patch)) if (!same(row[k], v)) return `"${c.title}" did not take the change to ${k}.`
  }
  return null
}

export const JOURNAL_KEY = "listshelper-journal"

export interface Journal {
  label: string
  at: string
  patches: { id: string; before: Record<string, unknown> }[]
  created: string[]
}

/** Written before a bulk write, cleared after it is verified. One left behind means the write was cut short. */
export function writeJournal(j: Journal | null, storage: Pick<Storage, "setItem" | "removeItem"> | undefined = safe()): void {
  try {
    if (!storage) return
    if (j) storage.setItem(JOURNAL_KEY, JSON.stringify(j))
    else storage.removeItem(JOURNAL_KEY)
  } catch {
    // Quota: the write still runs; it is verified and rolled back in memory.
  }
}

export function readJournal(storage: Pick<Storage, "getItem"> | undefined = safe()): Journal | null {
  try {
    const raw = storage?.getItem(JOURNAL_KEY)
    return raw ? (JSON.parse(raw) as Journal) : null
  } catch {
    return null
  }
}

function safe(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage
  } catch {
    return undefined
  }
}
