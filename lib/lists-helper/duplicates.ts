/**
 * lib/lists-helper/duplicates.ts — Items that look like the same thing (pure, code only)
 *
 * Two items are alike when their names match after case, punctuation, and "the/a" are removed, or differ by one
 * typo in a name of eight letters or more. They must also be compatible: the same primary type, or one of them
 * generic. Steps, logged actions, and items with no name are never offered. Nothing is merged here.
 */

import { itemTitle } from "@/lib/item-utils"
import type { Task } from "@/lib/types"
import type { DupGroup } from "./types"

export const MAX_GROUPS = 200

export function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function oneEdit(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1)
  const [s, l] = a.length < b.length ? [a, b] : [b, a]
  return s.slice(i) === l.slice(i + 1)
}

const GENERIC = new Set(["item", ""])
const compatible = (a: Task, b: Task) => {
  const ta = String(a.type ?? "item")
  const tb = String(b.type ?? "item")
  return ta === tb || GENERIC.has(ta) || GENERIC.has(tb)
}

/** Items eligible to be offered as duplicates. */
export function candidates(tasks: Task[]): Task[] {
  return tasks.filter((t) => {
    if (!normalizeTitle(itemTitle(t) ?? "")) return false
    if (t.stepOf) return false
    const type = String(t.type ?? "")
    return type !== "action" && type !== "step"
  })
}

export function findDuplicateGroups(tasks: Task[], isDismissed: (key: string) => boolean = () => false): DupGroup[] {
  const rows = candidates(tasks).map((t) => ({ t, key: normalizeTitle(itemTitle(t) ?? "") }))
  const parent = new Map<string, string>(rows.map((r) => [r.t.id, r.t.id]))
  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    parent.set(x, r)
    return r
  }
  const union = (a: string, b: string) => parent.set(find(a), find(b))
  const why = new Map<string, string>()

  const byKey = new Map<string, Task[]>()
  for (const r of rows) byKey.set(r.key, [...(byKey.get(r.key) ?? []), r.t])
  for (const group of byKey.values()) {
    for (let i = 1; i < group.length; i++) {
      if (compatible(group[0]!, group[i]!)) {
        union(group[0]!.id, group[i]!.id)
        why.set(group[0]!.id, "same name")
      }
    }
  }

  // One-typo matches: compare only names that share their first two letters and are within one letter of length.
  const keys = [...byKey.keys()].filter((k) => k.length >= 8).sort()
  const buckets = new Map<string, string[]>()
  for (const k of keys) buckets.set(k.slice(0, 2), [...(buckets.get(k.slice(0, 2)) ?? []), k])
  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i]!
        const b = bucket[j]!
        if (!oneEdit(a, b)) continue
        const ta = byKey.get(a)![0]!
        const tb = byKey.get(b)![0]!
        if (!compatible(ta, tb)) continue
        union(ta.id, tb.id)
        why.set(ta.id, "one letter apart")
      }
    }
  }

  const groups = new Map<string, Task[]>()
  for (const r of rows) groups.set(find(r.t.id), [...(groups.get(find(r.t.id)) ?? []), r.t])
  const out: DupGroup[] = []
  for (const members of groups.values()) {
    if (members.length < 2) continue
    const ids = members.map((m) => m.id).sort()
    const key = ids.join("|")
    if (isDismissed(key)) continue
    out.push({ key, ids, why: members.map((m) => why.get(m.id)).find(Boolean) ?? "same name" })
  }
  return out.sort((a, b) => b.ids.length - a.ids.length || a.key.localeCompare(b.key)).slice(0, MAX_GROUPS)
}
