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
  parentId?: string
}

/** `null` = show the painted pen (finest). `0` = collapse to the root. */
export type DisplayDepth = number | null

export function penById(pens: TreePen[], id: string): TreePen | undefined {
  return pens.find((p) => p.id === id)
}

/**
 * Root → … → this pen. A missing or cyclic parent is treated as "this pen
 * is a root" rather than throwing — a corrupt vault should still paint.
 */
export function ancestorChain(pens: TreePen[], penId: string): TreePen[] {
  const byId = new Map(pens.map((p) => [p.id, p]))
  const chain: TreePen[] = []
  const seen = new Set<string>()
  let current = byId.get(penId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.push(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return chain.reverse()
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

export function childrenOf(pens: TreePen[], parentId: string): TreePen[] {
  return pens.filter((p) => p.parentId === parentId)
}

export function isDescendant(pens: TreePen[], ancestorId: string, maybeChildId: string): boolean {
  return ancestorChain(pens, maybeChildId).some((p) => p.id === ancestorId && p.id !== maybeChildId)
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
  return pens.filter((p) => !p.parentId || !ids.has(p.parentId))
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
