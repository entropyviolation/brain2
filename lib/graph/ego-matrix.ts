/**
 * lib/graph/ego-matrix.ts — The item and its neighbours as an adjacency
 * matrix (LINKS_REDESIGN §13, L6.1). Rows ordered by family, then degree.
 * An empty off-diagonal cell between two neighbours is an open triad.
 */
import { relationFamily } from "@/lib/link-graph"
import type { LinkIndex } from "@/lib/graph/link-index"
import type { RelationFamily } from "@/lib/links"

export interface MatrixCell {
  relation?: string
  family?: RelationFamily
  /** Both neighbours of the center, unlinked. */
  open?: boolean
}

export interface EgoMatrix {
  ids: string[]
  cells: MatrixCell[][]
}

export function egoMatrix(itemId: string, links: LinkIndex, limit = 24): EgoMatrix {
  const first = new Map<string, string>()
  for (const s of links.steps(itemId)) if (!first.has(s.to)) first.set(s.to, s.relation)
  const order: RelationFamily[] = ["family", "romance", "friend", "work", "group", "place", "task", "evidence", "other"]
  const ns = [...first.keys()]
    .sort((a, b) => {
      const fa = order.indexOf(relationFamily(first.get(a)!))
      const fb = order.indexOf(relationFamily(first.get(b)!))
      return fa - fb || links.neighbours(b).size - links.neighbours(a).size || (a < b ? -1 : 1)
    })
    .slice(0, limit)
  const ids = [itemId, ...ns]
  const cells = ids.map((r, i) =>
    ids.map((c, j): MatrixCell => {
      if (i === j) return {}
      const step = links.steps(r).find((s) => s.to === c)
      if (step) return { relation: step.relation, family: relationFamily(step.relation) }
      return i > 0 && j > 0 ? { open: true } : {}
    }),
  )
  return { ids, cells }
}
