/**
 * lib/pen-tree.ts — Parent/child rollup for Tracking pens
 *
 * A pen can *count as* another pen in the same view: "taking out the trash"
 * is a kind of Cleaning, "Balboa Park" is a kind of "at the park" which is a
 * kind of Out which is a kind of Mexico. Painting always writes the specific
 * pen. Display depth decides which ancestor's color and name you see — the
 * Time Grid, Activity Log, Day Log and Analytics Tracking tab all ask the
 * same question so they cannot disagree.
 *
 * Depth 0 is the root (country / category). Higher depths walk toward the
 * painted leaf. `null` means "exact" — show the pen that was actually painted,
 * which is the default so an un-categorized vault looks the way it always did.
 *
 * Pure: no store.
 */
export interface TreePen {
  id: string
  name: string
  color: string
  /**
   * Display parent — the chain **Show as** follows. Kept in sync with
   * `parentIds[0]` so a vault that only stored this field still paints.
   */
  parentId?: string
  /**
   * Every pen this one counts as, display parent first. Omitted on older
   * records; `penParentIds` then reads `parentId` as a one-element list.
   */
  parentIds?: string[]
}

/**
 * Parents of a pen, display parent first.
 *
 * A record that only has `parentId` is a one-parent chain. A record that
 * lists `parentIds` uses that list. If both exist and `parentId` was left
 * off the list, it stays first so an old write is not dropped.
 */
export function penParentIds(pen: { id?: string; parentId?: string; parentIds?: string[] } | undefined): string[] {
  if (!pen) return []
  const listed = [...new Set((pen.parentIds ?? []).filter((id) => Boolean(id) && id !== pen.id))]
  if (listed.length) {
    if (pen.parentId && pen.parentId !== pen.id && !listed.includes(pen.parentId)) return [pen.parentId, ...listed]
    return listed
  }
  return pen.parentId && pen.parentId !== pen.id ? [pen.parentId] : []
}

/** Write a parent list. The first id is the display parent (`parentId`). */
export function assignParents<T extends { parentId?: string; parentIds?: string[] }>(pen: T, ids: string[]): T {
  const parentIds = [...new Set(ids.filter(Boolean))]
  const next = { ...pen }
  if (!parentIds.length) {
    delete next.parentId
    delete next.parentIds
    return next
  }
  next.parentId = parentIds[0]
  next.parentIds = parentIds
  return next
}

/** `null` = show the painted pen (finest). `0` = collapse to the root. */
export type DisplayDepth = number | null

export function penById(pens: TreePen[], id: string): TreePen | undefined {
  return pens.find((p) => p.id === id)
}

/**
 * Every root → … → this pen path. The first path follows the display parent
 * (`parentIds[0]` / `parentId`), which is what **Show as** colors. Further
 * paths are the other counts-as chains. A missing or cyclic parent ends that
 * path — a corrupt vault should still paint.
 */
export function ancestorChains(pens: TreePen[], penId: string): TreePen[][] {
  const byId = new Map(pens.map((p) => [p.id, p]))
  const start = byId.get(penId)
  if (!start) return []
  const chains: TreePen[][] = []
  const walk = (node: TreePen, stack: TreePen[], seen: Set<string>) => {
    const parents = penParentIds(node)
      .map((id) => byId.get(id))
      .filter((parent): parent is TreePen => Boolean(parent) && !seen.has(parent.id))
    if (!parents.length) {
      chains.push([...stack].reverse())
      return
    }
    for (const parent of parents) {
      seen.add(parent.id)
      stack.push(parent)
      walk(parent, stack, seen)
      stack.pop()
      seen.delete(parent.id)
    }
  }
  walk(start, [start], new Set([start.id]))
  return chains
}

/**
 * Display chain: root → … → this pen, along the first parent only.
 * A missing or cyclic parent is treated as "this pen is a root".
 */
export function ancestorChain(pens: TreePen[], penId: string): TreePen[] {
  return ancestorChains(pens, penId)[0] ?? []
}

export function rootPen(pens: TreePen[], penId: string): TreePen | undefined {
  return ancestorChain(pens, penId)[0] ?? penById(pens, penId)
}

export function depthOf(pens: TreePen[], penId: string): number {
  const chain = ancestorChain(pens, penId)
  return Math.max(0, chain.length - 1)
}

export function maxTreeDepth(pens: TreePen[]): number {
  if (pens.length === 0) return 0
  return Math.max(0, ...pens.map((p) => depthOf(pens, p.id)))
}

/**
 * The pen to color/label at `depth`. `null` depth is the painted pen itself.
 * A pen shallower than the requested depth stays itself — Mexico painted as
 * Mexico is still Mexico when you zoom into neighborhoods.
 */
export function penAtDepth(pens: TreePen[], penId: string, depth: DisplayDepth): TreePen | undefined {
  const painted = penById(pens, penId)
  if (!painted) return undefined
  if (depth === null || depth === undefined) return painted
  const chain = ancestorChain(pens, penId)
  if (chain.length === 0) return painted
  const index = Math.min(Math.max(0, depth), chain.length - 1)
  return chain[index]
}

/**
 * Distinct pens at `depth` across every counts-as chain. Exact (`null`) is
 * the painted pen alone. Two chains that meet at the same ancestor return
 * that ancestor once — the summary splits minutes across this list so the
 * shares of one pen cannot sum past the block.
 */
export function pensAtDepth(pens: TreePen[], penId: string, depth: DisplayDepth): TreePen[] {
  const painted = penById(pens, penId)
  if (!painted) return []
  if (depth === null || depth === undefined) return [painted]
  const seen = new Set<string>()
  const out: TreePen[] = []
  for (const chain of ancestorChains(pens, penId)) {
    if (!chain.length) continue
    const index = Math.min(Math.max(0, depth), chain.length - 1)
    const pen = chain[index]
    if (!pen || seen.has(pen.id)) continue
    seen.add(pen.id)
    out.push(pen)
  }
  return out.length ? out : [painted]
}

export function childrenOf(pens: TreePen[], parentId: string): TreePen[] {
  return pens.filter((p) => penParentIds(p).includes(parentId))
}

/** True when `maybeChildId` can reach `ancestorId` along any parent link. */
export function isDescendant(pens: TreePen[], ancestorId: string, maybeChildId: string): boolean {
  if (!ancestorId || ancestorId === maybeChildId) return false
  const byId = new Map(pens.map((p) => [p.id, p]))
  const seen = new Set<string>()
  const stack = [maybeChildId]
  while (stack.length) {
    const id = stack.pop()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const pen = byId.get(id)
    if (!pen) continue
    for (const parentId of penParentIds(pen)) {
      if (parentId === ancestorId) return true
      if (!seen.has(parentId)) stack.push(parentId)
    }
  }
  return false
}

/** True if making `penId`'s parent `parentId` would loop. */
export function wouldCycle(pens: TreePen[], penId: string, parentId: string | null): boolean {
  if (!parentId) return false
  if (parentId === penId) return true
  return isDescendant(pens, penId, parentId)
}

/** Pens this one may sit under — same view, not itself, not its descendants. */
export function validParents(pens: TreePen[], penId: string): TreePen[] {
  return pens.filter((p) => p.id !== penId && !wouldCycle(pens, penId, p.id))
}

export function roots(pens: TreePen[]): TreePen[] {
  const ids = new Set(pens.map((p) => p.id))
  return pens.filter((p) => !penParentIds(p).some((id) => ids.has(id)))
}

/**
 * Labels for the depth buttons. Scope-supplied names win; the last name is
 * always Exact (`null`). Extra numbered levels appear only if the tree is
 * deeper than the named rungs. Callers hide the control when `maxTreeDepth`
 * is 0 — a flat palette has nothing to zoom.
 */
export function depthOptions(
  pens: TreePen[],
  labels?: string[],
): { depth: DisplayDepth; label: string }[] {
  const max = maxTreeDepth(pens)
  const named = (labels ?? []).map((s) => s.trim()).filter(Boolean)
  const numberedLabels = named.length > 1 ? named.slice(0, -1) : named
  const exactLabel = named.length > 1 ? named[named.length - 1] : "Exact"
  const options: { depth: DisplayDepth; label: string }[] = []
  for (let d = 0; d <= max; d++) {
    options.push({
      depth: d,
      label: numberedLabels[d] ?? (d === 0 ? "Broad" : `Level ${d}`),
    })
  }
  options.push({ depth: null, label: exactLabel })
  return options
}

export const DEFAULT_DEPTH_LABELS: Record<string, string[]> = {
  activity: ["Category", "Activity", "Exact"],
  location: ["Country", "Area", "Place", "Exact"],
  company: ["Kind", "Who", "Exact"],
  mood: ["Mood"],
  screentime: ["Category", "App", "Exact"],
  "iphone-screentime": ["Category", "App", "Exact"],
  "iphone-calls": ["Who", "Exact"],
  "iphone-texts": ["Who", "Exact"],
}
