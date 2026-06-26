/**
 * lib/critical-path.ts — Critical Path Method (CPM) + PERT solver (pure)
 *
 * A dependency-free, fully unit-tested implementation of the Critical Path
 * Method over a task network (Brain2 ideas #14/#15/#19 — Gantt + critical path).
 * Given tasks carrying `dependencies[]` and a duration, it runs a forward pass
 * (earliest start/finish), a backward pass (latest start/finish), derives slack,
 * and identifies the critical path (zero-slack chain).
 *
 * Duration source: a task's PERT three-point estimate `(o + 4l + p) / 6` when
 * `pertEstimate` is present, otherwise `estimatedDuration` (minutes), else 0.
 *
 * The result is shaped so the UI can set `GraphNode.isOnCriticalPath` (per node)
 * and `GraphEdge.isOnCriticalPath` (via `isCriticalEdge`). Pure: no React, no
 * store access, no `Date` math — durations are plain numbers.
 */

/** PERT three-point estimate (any consistent unit; minutes in COGS). */
export interface PertEstimate {
  optimistic: number
  likely: number
  pessimistic: number
}

/** Minimal task shape the solver needs (a `Task` satisfies this structurally). */
export interface CpmTask {
  id: string
  dependencies?: string[]
  estimatedDuration?: number
  pertEstimate?: PertEstimate
}

/** Per-task CPM schedule numbers. Times are offsets from project start (t=0). */
export interface CpmNode {
  id: string
  duration: number
  earliestStart: number
  earliestFinish: number
  latestStart: number
  latestFinish: number
  /** Total float: how long the task can slip without delaying the project. */
  slack: number
  /** True when slack is ~0 (the task lies on a critical path). */
  isOnCriticalPath: boolean
}

export interface CpmResult {
  /** Per-task schedule keyed by task id. */
  nodes: Record<string, CpmNode>
  /** Topological processing order (best-effort if a cycle is present). */
  order: string[]
  /** Total project length (max earliest finish). */
  projectDuration: number
  /** Ordered ids forming the (a) longest zero-slack chain. */
  criticalPath: string[]
  /** True when the dependency graph contains a cycle (results are best-effort). */
  hasCycle: boolean
}

const EPS = 1e-9

/** PERT expected time: weighted mean (o + 4·likely + p) / 6. */
export function pertExpected(e: PertEstimate): number {
  return (e.optimistic + 4 * e.likely + e.pessimistic) / 6
}

/** PERT variance: ((pessimistic − optimistic) / 6)². */
export function pertVariance(e: PertEstimate): number {
  const sd = (e.pessimistic - e.optimistic) / 6
  return sd * sd
}

/** PERT standard deviation: (pessimistic − optimistic) / 6. */
export function pertStdDev(e: PertEstimate): number {
  return Math.abs(e.pessimistic - e.optimistic) / 6
}

/** Effective duration used by the solver: PERT expected when available, else estimate. */
export function taskDuration(task: CpmTask): number {
  if (task.pertEstimate) return pertExpected(task.pertEstimate)
  const d = task.estimatedDuration
  return typeof d === "number" && Number.isFinite(d) && d > 0 ? d : 0
}

/**
 * Run CPM over `tasks`. Dependencies pointing at unknown ids (or self) are
 * ignored. A cycle is detected and flagged; the acyclic portion is still solved
 * and cyclic nodes are appended in input order (best-effort) so the UI never
 * crashes on malformed data.
 */
export function computeCriticalPath(tasks: CpmTask[]): CpmResult {
  const ids = tasks.map((t) => t.id)
  const idSet = new Set(ids)
  const byId = new Map(tasks.map((t) => [t.id, t]))

  const preds = new Map<string, string[]>()
  const succs = new Map<string, string[]>()
  ids.forEach((id) => {
    preds.set(id, [])
    succs.set(id, [])
  })

  for (const t of tasks) {
    const deps = [...new Set((t.dependencies ?? []).filter((d) => idSet.has(d) && d !== t.id))]
    preds.set(t.id, deps)
    for (const d of deps) succs.get(d)!.push(t.id)
  }

  // Kahn topological sort (predecessor in-degree).
  const indeg = new Map<string, number>()
  ids.forEach((id) => indeg.set(id, preds.get(id)!.length))
  const queue = ids.filter((id) => indeg.get(id) === 0)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const s of succs.get(id)!) {
      indeg.set(s, indeg.get(s)! - 1)
      if (indeg.get(s) === 0) queue.push(s)
    }
  }

  const hasCycle = order.length < ids.length
  if (hasCycle) {
    const inOrder = new Set(order)
    for (const id of ids) if (!inOrder.has(id)) order.push(id)
  }

  const duration = new Map<string, number>()
  ids.forEach((id) => duration.set(id, taskDuration(byId.get(id)!)))

  // Forward pass: earliest start / finish.
  const ES = new Map<string, number>()
  const EF = new Map<string, number>()
  for (const id of order) {
    const ps = preds.get(id)!
    const es = ps.length ? Math.max(...ps.map((p) => EF.get(p) ?? 0)) : 0
    ES.set(id, es)
    EF.set(id, es + duration.get(id)!)
  }

  const projectDuration = ids.length ? Math.max(...ids.map((id) => EF.get(id) ?? 0)) : 0

  // Backward pass: latest finish / start.
  const LF = new Map<string, number>()
  const LS = new Map<string, number>()
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]
    const ss = succs.get(id)!
    const lf = ss.length ? Math.min(...ss.map((s) => LS.get(s) ?? projectDuration)) : projectDuration
    LF.set(id, lf)
    LS.set(id, lf - duration.get(id)!)
  }

  const nodes: Record<string, CpmNode> = {}
  for (const id of ids) {
    const slack = LS.get(id)! - ES.get(id)!
    nodes[id] = {
      id,
      duration: duration.get(id)!,
      earliestStart: ES.get(id)!,
      earliestFinish: EF.get(id)!,
      latestStart: LS.get(id)!,
      latestFinish: LF.get(id)!,
      slack,
      // A zero-duration project would mark everything critical; require a
      // positive project length so the flag stays meaningful.
      isOnCriticalPath: !hasCycle && projectDuration > EPS && Math.abs(slack) < EPS,
    }
  }

  const criticalPath = reconstructCriticalPath(ids, preds, nodes)

  return { nodes, order, projectDuration, criticalPath, hasCycle }
}

/** Walk the longest zero-slack chain backwards from the latest-finishing node. */
function reconstructCriticalPath(
  ids: string[],
  preds: Map<string, string[]>,
  nodes: Record<string, CpmNode>,
): string[] {
  const critical = ids.filter((id) => nodes[id].isOnCriticalPath)
  if (!critical.length) return []

  let end = critical[0]
  for (const id of critical) {
    if (nodes[id].earliestFinish > nodes[end].earliestFinish) end = id
  }

  const path = [end]
  let cur = end
  // Guard against pathological loops with a bounded iteration count.
  for (let guard = 0; guard < ids.length; guard++) {
    const tight = preds
      .get(cur)!
      .filter((p) => nodes[p].isOnCriticalPath && Math.abs(nodes[p].earliestFinish - nodes[cur].earliestStart) < EPS)
    if (!tight.length) break
    let best = tight[0]
    for (const p of tight) if (nodes[p].earliestFinish > nodes[best].earliestFinish) best = p
    path.push(best)
    cur = best
  }

  return path.reverse()
}

/**
 * Whether the precedence edge `source → target` (source is a dependency of
 * target) lies on the critical path: both endpoints critical and the link is
 * "tight" (source finishes exactly when target can start).
 */
export function isCriticalEdge(result: CpmResult, sourceId: string, targetId: string): boolean {
  const s = result.nodes[sourceId]
  const t = result.nodes[targetId]
  if (!s || !t) return false
  return s.isOnCriticalPath && t.isOnCriticalPath && Math.abs(s.earliestFinish - t.earliestStart) < EPS
}

/** Convenience: the set of `"source->target"` keys for every critical edge. */
export function criticalEdgeKeys(result: CpmResult, tasks: CpmTask[]): Set<string> {
  const keys = new Set<string>()
  const idSet = new Set(tasks.map((t) => t.id))
  for (const t of tasks) {
    for (const dep of t.dependencies ?? []) {
      if (idSet.has(dep) && isCriticalEdge(result, dep, t.id)) keys.add(`${dep}->${t.id}`)
    }
  }
  return keys
}
