/**
 * lib/graph/dependency-combine.ts — Dependency algebra (KG-DEP2–DEP5)
 *
 * One optional attribute on the parent, `Task.dependencyCombine`. Absent,
 * every open dependency still blocks; this module is not asked.
 * Scheduler edges stay on `Task.dependencies`. They are not copied to
 * `Task.links`. `ItemLink.weight` is a child's share only in additive mode.
 * Stance is untouched.
 *
 * A child is met when it is cleared from work (done or missed), the same
 * rule as `lib/available-tasks.ts`. A missing id is not a child.
 */
import { isClearedFromWork } from "@/lib/completion-status"
import { dateKeyOf } from "@/lib/date-utils"
import { itemTitle } from "@/lib/item-utils"
import type { DependencyCombine, ItemLink, Task } from "@/lib/types"

/** Shares within this of 1 pass the additive check. Stored weights are not rescaled. */
export const SHARE_TOLERANCE = 0.02

export type CombineParent = {
  id?: string
  title?: string
  description?: string
  dependencies?: readonly string[]
  links?: readonly ItemLink[]
  dependencyCombine?: DependencyCombine
}

export type CombineChild = {
  id: string
  title?: string
  description?: string
  completed?: boolean
  status?: Task["status"]
  links?: readonly ItemLink[]
  deadline?: Date | string | null
  scheduledDate?: Date | string | null
}

type ShareRow = { child: CombineChild; share: number; explicit: boolean }

function modeOf(parent: CombineParent): DependencyCombine["mode"] | undefined {
  const mode = parent.dependencyCombine?.mode
  if (mode === "additive" || mode === "redundant" || mode === "threshold") return mode
  return undefined
}

function isMet(child: CombineChild): boolean {
  return isClearedFromWork({ completed: child.completed === true, status: child.status })
}

/** Children listed on the parent, in that order, skipping ids that are not here. */
function listedChildren(parent: CombineParent, childTasks: readonly CombineChild[]): CombineChild[] {
  const byId = new Map<string, CombineChild>()
  for (const child of childTasks) {
    if (!byId.has(child.id)) byId.set(child.id, child)
  }
  const seen = new Set<string>()
  const out: CombineChild[] = []
  for (const id of parent.dependencies ?? []) {
    if (seen.has(id)) continue
    seen.add(id)
    const child = byId.get(id)
    if (child) out.push(child)
  }
  return out
}

function firstWeight(links: readonly ItemLink[] | undefined, targetId: string): number | undefined {
  if (!links) return undefined
  for (const link of links) {
    if (link.targetId !== targetId) continue
    if (typeof link.weight === "number" && Number.isFinite(link.weight)) return link.weight
  }
  return undefined
}

/**
 * The child's stored share. The parent's link to the child wins; otherwise
 * the child's link to the parent. No connecting weight means unset.
 */
function explicitWeight(parent: CombineParent, child: CombineChild): number | undefined {
  const fromParent = firstWeight(parent.links, child.id)
  if (fromParent !== undefined) return fromParent
  if (!parent.id) return undefined
  return firstWeight(child.links, parent.id)
}

/**
 * Effective shares. An unset weight takes an equal slice of
 * `1 - sum(explicit)` inside this function only. Nothing is written back.
 */
function shareRows(parent: CombineParent, children: readonly CombineChild[]): ShareRow[] {
  const raw = children.map((child) => ({ child, weight: explicitWeight(parent, child) }))
  const explicitSum = raw.reduce((sum, row) => sum + (row.weight ?? 0), 0)
  const unset = raw.filter((row) => row.weight === undefined).length
  const fill = unset > 0 ? (1 - explicitSum) / unset : 0
  return raw.map((row) => ({
    child: row.child,
    share: row.weight ?? fill,
    explicit: row.weight !== undefined,
  }))
}

function metShare(rows: readonly ShareRow[]): number {
  return rows.reduce((sum, row) => sum + (isMet(row.child) ? row.share : 0), 0)
}

function openShare(rows: readonly ShareRow[]): number {
  return rows.reduce((sum, row) => sum + (isMet(row.child) ? 0 : row.share), 0)
}

function childName(child: CombineChild): string {
  return itemTitle(child) || child.id
}

function routeWhen(child: CombineChild): { key: string; kind: "deadline" | "scheduled" } | null {
  const deadline = dateKeyOf(child.deadline ?? null)
  if (deadline) return { key: deadline, kind: "deadline" }
  const scheduled = dateKeyOf(child.scheduledDate ?? null)
  if (scheduled) return { key: scheduled, kind: "scheduled" }
  return null
}

function formatShare(n: number): string {
  return n.toFixed(2)
}

function formatCount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** True when the parent's combine rule is met. No mode: every listed child is met. */
export function combineSatisfied(parent: CombineParent, childTasks: readonly CombineChild[]): boolean {
  const children = listedChildren(parent, childTasks)
  const mode = modeOf(parent)
  if (mode === "redundant") return children.some(isMet)
  if (mode === "threshold") {
    const need = parent.dependencyCombine?.need
    if (typeof need !== "number" || !Number.isFinite(need)) return false
    return children.filter(isMet).length >= need
  }
  if (mode === "additive") {
    return metShare(shareRows(parent, children)) >= 1 - SHARE_TOLERANCE
  }
  return children.every(isMet)
}

/**
 * Dated impact sentence. Names the mode when one is set.
 * No mode keeps the unmet-dependency sentence: who the parent is still waiting on.
 */
export function combineImpactSentence(
  parent: CombineParent,
  childTasks: readonly CombineChild[],
  todayKey: string,
): string {
  const children = listedChildren(parent, childTasks)
  const mode = modeOf(parent)
  if (mode === "additive") {
    const open = openShare(shareRows(parent, children))
    return `As of ${todayKey}, additive: ${formatShare(open)} of the share is still open.`
  }
  if (mode === "redundant") return redundantSentence(children, todayKey)
  if (mode === "threshold") return thresholdSentence(parent, children, todayKey)
  const waiting = children.filter((child) => !isMet(child)).map(childName)
  if (!waiting.length) return `As of ${todayKey}, waiting on nothing.`
  return `As of ${todayKey}, waiting on ${waiting.join(", ")}.`
}

function dateClause(child: CombineChild): string {
  const when = routeWhen(child)
  if (!when) return ""
  return ` (${when.kind} ${when.key})`
}

function backupRoute(open: readonly CombineChild[]): CombineChild {
  const dated = open
    .map((child) => ({ child, when: routeWhen(child) }))
    .filter((row): row is { child: CombineChild; when: { key: string; kind: "deadline" | "scheduled" } } => row.when !== null)
    .sort(
      (a, b) =>
        a.when.key.localeCompare(b.when.key) ||
        childName(a.child).localeCompare(childName(b.child)) ||
        a.child.id.localeCompare(b.child.id),
    )
  return dated[0]?.child ?? open[0]
}

function redundantSentence(children: readonly CombineChild[], todayKey: string): string {
  const open = children.filter((child) => !isMet(child))
  if (open.length > 0 && children.length >= 2) {
    const route = backupRoute(open)
    return `As of ${todayKey}, redundant: the goal loses nothing while ${childName(route)} is open${dateClause(route)}.`
  }
  if (open.length === 1) {
    return `As of ${todayKey}, redundant: ${childName(open[0])} is the only route${dateClause(open[0])}.`
  }
  return `As of ${todayKey}, redundant: no other route is open.`
}

function thresholdSentence(parent: CombineParent, children: readonly CombineChild[], todayKey: string): string {
  const need = parent.dependencyCombine?.need
  if (typeof need !== "number" || !Number.isFinite(need)) {
    return `As of ${todayKey}, threshold: no count is set.`
  }
  const met = children.filter(isMet).length
  const remain = Math.max(0, need - met)
  const word = remain === 1 ? "route remains" : "routes remain"
  return `As of ${todayKey}, threshold: ${formatCount(remain)} ${word} against a count of ${formatCount(need)}.`
}

/**
 * Additive only. A sentence when the shares that will be added do not sum to 1.
 * Unset weights are filled from the remainder here, so a mix that still
 * completes to 1 is quiet. Fully written shares are checked as stored.
 * Other modes, and a parent with no mode, return null and do not read weight.
 */
export function shareCheck(parent: CombineParent, childTasks: readonly CombineChild[]): string | null {
  if (modeOf(parent) !== "additive") return null
  const children = listedChildren(parent, childTasks)
  if (!children.length) return null
  const rows = shareRows(parent, children)
  const explicit = rows.filter((row) => row.explicit)
  const explicitSum = explicit.reduce((sum, row) => sum + row.share, 0)
  const unset = rows.length - explicit.length
  if (unset > 0) {
    if (explicitSum - 1 > SHARE_TOLERANCE) return `Shares sum to ${formatShare(explicitSum)}, not 1.`
    return null
  }
  if (Math.abs(explicitSum - 1) <= SHARE_TOLERANCE) return null
  return `Shares sum to ${formatShare(explicitSum)}, not 1.`
}
