/**
 * lib/graph/link-path.ts — Shortest relation path between two items
 * (LINKS_REDESIGN §13, L6.2). Undirected BFS over the link index, depth 6.
 * Steps read their relation from the walking side, so aliases resolve
 * through the registry at label time.
 */
import type { LinkIndex, LinkStep } from "@/lib/graph/link-index"

export const PATH_DEPTH = 6

export function linkPath(fromId: string, toId: string, links: LinkIndex, depth = PATH_DEPTH): LinkStep[] | null {
  if (fromId === toId) return []
  const prev = new Map<string, LinkStep>()
  const seen = new Set([fromId])
  let frontier = [fromId]
  for (let d = 0; d < depth && frontier.length; d++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const s of links.steps(id)) {
        if (seen.has(s.to)) continue
        seen.add(s.to)
        prev.set(s.to, s)
        if (s.to === toId) {
          const path: LinkStep[] = []
          for (let at = toId; at !== fromId; at = prev.get(at)!.from) path.unshift(prev.get(at)!)
          return path
        }
        next.push(s.to)
      }
    }
    frontier = next
  }
  return null
}
