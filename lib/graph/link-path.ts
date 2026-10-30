/**
 * lib/graph/link-path.ts — Shortest relation path between two items
 * (LINKS_REDESIGN §13, L6.2). Undirected BFS over the link index, depth 6.
 * Steps read their relation from the walking side, so aliases resolve
 * through the registry at label time. `along` keeps a step only when its
 * relation is the asked one or a child of it.
 */
import type { LinkIndex, LinkStep } from "@/lib/graph/link-index"

export const PATH_DEPTH = 6

export interface PathAlong {
  relation: string
  isSubrelation: (stepRelation: string, asked: string) => boolean
}

export function stepAlong(step: LinkStep, along?: PathAlong): boolean {
  if (!along) return true
  if (along.isSubrelation(step.relation, along.relation)) return true
  return !!step.stored && along.isSubrelation(step.stored, along.relation)
}

function walk(fromId: string, links: LinkIndex, depth: number, along: PathAlong | undefined, stopAt?: string): Map<string, LinkStep> | null {
  const prev = new Map<string, LinkStep>()
  const seen = new Set([fromId])
  let frontier = [fromId]
  for (let d = 0; d < depth && frontier.length; d++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const step of links.steps(id)) {
        if (!stepAlong(step, along) || seen.has(step.to)) continue
        seen.add(step.to)
        prev.set(step.to, step)
        if (stopAt && step.to === stopAt) return prev
        next.push(step.to)
      }
    }
    frontier = next
  }
  return stopAt ? null : prev
}

function stepsTo(fromId: string, toId: string, prev: Map<string, LinkStep>): LinkStep[] {
  const path: LinkStep[] = []
  for (let at = toId; at !== fromId; at = prev.get(at)!.from) path.unshift(prev.get(at)!)
  return path
}

export function linkPath(fromId: string, toId: string, links: LinkIndex, depth = PATH_DEPTH, along?: PathAlong): LinkStep[] | null {
  if (fromId === toId) return []
  const prev = walk(fromId, links, depth, along, toId)
  if (!prev) return null
  return stepsTo(fromId, toId, prev)
}

/** Everyone reachable from `fromId` along `along`, nearest first, capped. */
export function pathsAlong(fromId: string, links: LinkIndex, along: PathAlong, depth = PATH_DEPTH, limit = 12): { id: string; steps: LinkStep[] }[] {
  const prev = walk(fromId, links, depth, along)
  if (!prev) return []
  const out: { id: string; steps: LinkStep[] }[] = []
  for (const id of prev.keys()) {
    out.push({ id, steps: stepsTo(fromId, id, prev) })
    if (out.length >= limit) break
  }
  return out
}

/** A path-box query: `family-of Ada` walks children of that relation. `related` is not a filter. */
export function pathQuery(raw: string, defs: readonly { id: string; label: string; inverseLabel?: string }[]): { along?: string; name: string } {
  const q = raw.trim()
  const lower = q.toLowerCase()
  let best: { id: string; cut: number; rank: number } | null = null
  for (const def of defs) {
    if (!def.id || def.id === "related") continue
    const tokens = [
      { token: def.id, rank: 3 },
      { token: def.label, rank: 2 },
      ...(def.inverseLabel ? [{ token: def.inverseLabel, rank: 1 }] : []),
    ]
    for (const { token, rank } of tokens) {
      if (!token) continue
      const t = token.toLowerCase()
      if (lower !== t && !lower.startsWith(`${t} `)) continue
      if (!best || t.length > best.cut || (t.length === best.cut && rank > best.rank)) best = { id: def.id, cut: token.length, rank }
    }
  }
  if (!best) return { name: q }
  return { along: best.id, name: q.slice(best.cut).trim() }
}
