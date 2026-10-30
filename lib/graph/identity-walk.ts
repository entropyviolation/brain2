/**
 * lib/graph/identity-walk.ts — Collapse recorded `same-as` components.
 *
 * Pure. `different-from` is not a join. Live walks should opt in later;
 * calling this from ego, densify, or link-graph would change those results.
 */

export interface IdentityWalkItem {
  id: string
  links?: readonly { relation?: string; targetId?: string }[] | null
}

/** Recorded `same-as` links as unordered endpoints. `different-from` stays out. */
export function sameAsPairs(items: readonly IdentityWalkItem[]): [string, string][] {
  const out: [string, string][] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (!item?.id) continue
    for (const link of item.links ?? []) {
      if (link?.relation !== "same-as") continue
      const targetId = link.targetId?.trim()
      if (!targetId || targetId === item.id) continue
      const key = `${item.id}\0${targetId}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push([item.id, targetId])
    }
  }
  return out
}

/**
 * The lexicographically smallest id in the `same-as` component of `id`.
 * An id with no pair is returned as itself.
 */
export function collapseId(id: string, pairs: readonly (readonly [string, string])[]): string {
  const parent = new Map<string, string>()
  const find = (node: string): string => {
    let root = node
    while (parent.get(root) !== root) root = parent.get(root)!
    let cursor = node
    while (cursor !== root) {
      const next = parent.get(cursor)!
      parent.set(cursor, root)
      cursor = next
    }
    return root
  }
  const touch = (node: string) => {
    if (!parent.has(node)) parent.set(node, node)
  }
  const unite = (a: string, b: string) => {
    touch(a)
    touch(b)
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    if (ra < rb) parent.set(rb, ra)
    else parent.set(ra, rb)
  }
  for (const [a, b] of pairs) {
    if (!a || !b || a === b) continue
    unite(a, b)
  }
  if (!parent.has(id)) return id
  return find(id)
}
