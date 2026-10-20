/**
 * lib/graph/ego-density.ts — Degree, local clustering, open triads
 * (LINKS_REDESIGN §5, L4.4). Pure, ego-scoped.
 *
 * C = 2T / (k(k−1)), T = links among the neighbours. An open triad is a
 * neighbour pair with no link between them.
 */
import type { LinkIndex } from "@/lib/graph/link-index"

export interface EgoDensity {
  degree: number
  /** Null under two neighbours. */
  clustering: number | null
  openTriads: [string, string][]
  closed: number
}

export function egoDensity(itemId: string, links: LinkIndex, maxPairs = 2000): EgoDensity {
  const ns = [...links.neighbours(itemId)].sort()
  const k = ns.length
  const open: [string, string][] = []
  let closed = 0
  let pairs = 0
  for (let i = 0; i < k && pairs < maxPairs; i++) {
    const ni = links.neighbours(ns[i])
    for (let j = i + 1; j < k && pairs < maxPairs; j++, pairs++) {
      if (ni.has(ns[j])) closed++
      else open.push([ns[i], ns[j]])
    }
  }
  return { degree: k, clustering: k < 2 ? null : (2 * closed) / (k * (k - 1)), openTriads: open, closed }
}
