/**
 * components/Scheduler/project-network.ts — Build a CPM network from tasks
 *
 * Shared (pure) glue between the task store and the Critical Path Method solver,
 * used by both the Gantt and dependency-graph sub-views. It selects the
 * "project" tasks (anything participating in a dependency relation, or a
 * scheduleable task that carries a duration), derives the precedence edges, and
 * runs the solver so the views can render bars/nodes with critical-path data.
 */
import type { Task } from "@/lib/types"
import { computeCriticalPath, taskDuration, type CpmResult } from "@/lib/critical-path"
import type { LayoutEdge } from "@/lib/graph-layout"

export interface ProjectEdge {
  /** Dependency (predecessor) task id. */
  source: string
  /** Dependent (successor) task id. */
  target: string
}

export interface ProjectNetwork {
  tasks: Task[]
  edges: ProjectEdge[]
  cpm: CpmResult
  /** Convenience map id → Task. */
  byId: Record<string, Task>
}

/**
 * Select the tasks worth visualizing as a project and run CPM over them.
 * Completed tasks are excluded. A task is included when it has dependencies, is
 * a dependency of another task, or has a positive duration estimate.
 */
export function buildProjectNetwork(allTasks: Task[]): ProjectNetwork {
  const active = allTasks.filter((t) => !t.completed)
  const activeIds = new Set(active.map((t) => t.id))

  // Ids that are referenced as a dependency by some active task.
  const referenced = new Set<string>()
  for (const t of active) {
    for (const dep of t.dependencies ?? []) {
      if (activeIds.has(dep)) referenced.add(dep)
    }
  }

  const tasks = active.filter((t) => {
    const hasDeps = (t.dependencies ?? []).some((d) => activeIds.has(d))
    const isReferenced = referenced.has(t.id)
    const hasDuration = taskDuration(t) > 0
    return hasDeps || isReferenced || hasDuration
  })

  const includedIds = new Set(tasks.map((t) => t.id))
  const edges: ProjectEdge[] = []
  for (const t of tasks) {
    for (const dep of t.dependencies ?? []) {
      if (includedIds.has(dep)) edges.push({ source: dep, target: t.id })
    }
  }

  const cpm = computeCriticalPath(
    tasks.map((t) => ({
      id: t.id,
      dependencies: (t.dependencies ?? []).filter((d) => includedIds.has(d)),
      estimatedDuration: t.estimatedDuration,
      pertEstimate: t.pertEstimate,
    })),
  )

  const byId: Record<string, Task> = {}
  for (const t of tasks) byId[t.id] = t

  return { tasks, edges, cpm, byId }
}

/** The project edges as plain layout edges (same shape) for graph-layout helpers. */
export function toLayoutEdges(edges: ProjectEdge[]): LayoutEdge[] {
  return edges.map((e) => ({ source: e.source, target: e.target }))
}
