/**
 * lib/pen-levels.ts — Named level categories for a view's "counts as" ladder
 *
 * Counts-as already makes a tree (Ocean Beach → San Diego → California → USA),
 * but depth is just position: "level 2" means nothing, and an uneven tree puts
 * a city and a country at the same depth. A level category names a rung so the
 * tree can be read by meaning: Neighborhood, City, State, Country.
 *
 * - A view's levels are an ordered list, broadest first (`TrackScope.levels`).
 *   Missing means the built-in set for that view (`DEFAULT_SCOPE_LEVELS`);
 *   an empty list means the person cleared them. No persist bump.
 * - A pen names its own level (`TrackPen.levelId`). Optional. The seeded
 *   Company pens Alone and Together are built in at the broadest Company level.
 * - `pensAtLevel` rolls a painted pen up to the pen at that level on each of its
 *   counts-as chains. A chain with no pen at that level is honest about it:
 *   the minutes land in "No {level}", never on a broader or finer pen.
 *
 * Pure; no store import (structural types only).
 */
import { ancestorChains, type TreePen } from "@/lib/pen-tree"

export interface ScopeLevel {
  id: string
  name: string
}

type LevelPen = TreePen & { levelId?: string }
type LevelScope = { id: string; pens: LevelPen[]; levels?: ScopeLevel[] }

export const DEFAULT_SCOPE_LEVELS: Record<string, ScopeLevel[]> = {
  location: [
    { id: "lvl-country", name: "Country" },
    { id: "lvl-state", name: "State" },
    { id: "lvl-city", name: "City" },
    { id: "lvl-neighborhood", name: "Neighborhood" },
  ],
  company: [
    { id: "lvl-company-kind", name: "Alone or with anyone" },
    { id: "lvl-company-group", name: "Group" },
    { id: "lvl-company-person", name: "Person" },
  ],
  activity: [
    { id: "lvl-activity-category", name: "Category" },
    { id: "lvl-activity-activity", name: "Activity" },
  ],
}

/** Seeded pens whose level ships with the app. A pen's own `levelId` wins. */
export const BUILTIN_PEN_LEVELS: Record<string, string> = {
  "co-alone": "lvl-company-kind",
  "co-together": "lvl-company-kind",
}

/** Broadest first. */
export function scopeLevels(scope: { id: string; levels?: ScopeLevel[] } | undefined): ScopeLevel[] {
  if (!scope) return []
  return scope.levels ?? DEFAULT_SCOPE_LEVELS[scope.id] ?? []
}

export function penLevelId(scope: LevelScope | undefined, pen: LevelPen | undefined): string | undefined {
  if (!scope || !pen) return undefined
  const levels = scopeLevels(scope)
  const id = pen.levelId ?? BUILTIN_PEN_LEVELS[pen.id]
  return id && levels.some((level) => level.id === id) ? id : undefined
}

export function penLevel(scope: LevelScope | undefined, penId: string): ScopeLevel | undefined {
  const pen = scope?.pens.find((p) => p.id === penId)
  const id = penLevelId(scope, pen)
  return id ? scopeLevels(scope).find((level) => level.id === id) : undefined
}

/** True when at least one pen in the view sits on a named level. */
export function scopeUsesLevels(scope: LevelScope | undefined): boolean {
  if (!scope) return false
  return scope.pens.some((pen) => penLevelId(scope, pen) !== undefined)
}

/** Pens per level, plus how many pens have none. */
export function levelCounts(scope: LevelScope): { level: ScopeLevel; pens: LevelPen[] }[] {
  return scopeLevels(scope).map((level) => ({
    level,
    pens: scope.pens.filter((pen) => penLevelId(scope, pen) === level.id),
  }))
}

/**
 * The distinct pens at `levelId` across every counts-as chain of `penId`.
 * Empty when no chain has a pen at that level.
 */
export function pensAtLevel(scope: LevelScope, penId: string, levelId: string): LevelPen[] {
  const out: LevelPen[] = []
  for (const chain of ancestorChains(scope.pens, penId)) {
    const hit = [...chain].reverse().find((pen) => penLevelId(scope, scope.pens.find((p) => p.id === pen.id)) === levelId)
    if (!hit) continue
    const full = scope.pens.find((p) => p.id === hit.id)
    if (full && !out.some((p) => p.id === full.id)) out.push(full)
  }
  return out
}

export const NO_LEVEL_ID = "__no-level__"

export type LevelEntry = {
  scopeId: string
  penId: string
  secondaryPenIds?: string[]
  startMin: number
  endMin: number
  kind?: string
}

/**
 * Minutes per pen at one level for blocks in this view. A block counted under
 * two pens at that level (two chains) splits its minutes so shares never pass
 * the block. Minutes with no pen at the level go to `NO_LEVEL_ID`.
 */
export function levelTotals(
  entries: LevelEntry[],
  scope: LevelScope,
  levelId: string,
): { penId: string; minutes: number }[] {
  const totals = new Map<string, number>()
  const add = (id: string, minutes: number) => totals.set(id, (totals.get(id) ?? 0) + minutes)
  for (const entry of entries) {
    if (entry.scopeId !== scope.id || entry.kind === "instant") continue
    const minutes = Math.max(0, entry.endMin - entry.startMin)
    if (!minutes) continue
    const assigned = [entry.penId, ...(entry.secondaryPenIds ?? [])]
    const hits = new Map<string, true>()
    for (const id of assigned) for (const pen of pensAtLevel(scope, id, levelId)) hits.set(pen.id, true)
    if (hits.size === 0) {
      add(NO_LEVEL_ID, minutes)
      continue
    }
    for (const id of hits.keys()) add(id, minutes / hits.size)
  }
  return [...totals.entries()]
    .map(([penId, minutes]) => ({ penId, minutes: Math.round(minutes) }))
    .filter((row) => row.minutes > 0)
    .sort((a, b) => (a.penId === NO_LEVEL_ID ? 1 : b.penId === NO_LEVEL_ID ? -1 : b.minutes - a.minutes))
}

export function makeLevelId(): string {
  return `lvl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
