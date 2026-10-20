/**
 * lib/graph/graph-review.ts — The vault-wide graph pass for the weekly
 * review (LINKS_REDESIGN L9.1, L9.2). The only vault pass outside the
 * library; cached by tasks array identity.
 *
 * Describe first: link edits per week (from the activity ledger),
 * linkability per type, mean clustering. Infer second: the five best
 * vault-wide suggestions and the newest checks. Mentions are left out here
 * (title × notes is vault-squared); they stay on the tab.
 */
import { mergeSuggestions, type DensifyContext, type Suggestion } from "@/lib/graph/densify"
import { coMemberSource } from "@/lib/graph/densify/co-member"
import { reciprocalSource } from "@/lib/graph/densify/reciprocal"
import { triadSource } from "@/lib/graph/densify/triad"
import { egoDensity } from "@/lib/graph/ego-density"
import { linkIndexOf } from "@/lib/graph/link-index"
import { buildLattice } from "@/lib/graph/relation-lattice"
import { egoChecks, type RelationCheck } from "@/lib/graph/relation-checks"
import { relationLabel } from "@/lib/links"
import { allRelations, getRelationDef } from "@/lib/relation-registry"
import type { ItemActivityEntry } from "@/lib/item-activity"
import type { ItemRecord } from "@/lib/types"

export interface GraphReview {
  suggestions: (Suggestion & { fromId: string })[]
  checks: (RelationCheck & { itemId: string })[]
  linkability: { type: string; linked: number; total: number }[]
  meanClustering: number | null
}

let cacheTasks: readonly ItemRecord[] | null = null
let cacheMuted = ""
let cached: GraphReview | null = null

export function graphReview(tasks: readonly ItemRecord[], title: (id: string) => string, muted: readonly string[] = [], limit = 5): GraphReview {
  const mutedKey = muted.join(",")
  if (cached && cacheTasks === tasks && cacheMuted === mutedKey) return cached
  const links = linkIndexOf(tasks)
  const lattice = buildLattice(allRelations())
  const ctx: DensifyContext = { all: tasks, links, title }
  const pool: (Suggestion & { fromId: string })[] = []
  const seenPair = new Set<string>()
  const checks: GraphReview["checks"] = []
  const byType = new Map<string, { linked: number; total: number }>()
  let cSum = 0
  let cN = 0
  for (const item of tasks) {
    const type = (item.type as string) || "item"
    const row = byType.get(type) ?? { linked: 0, total: 0 }
    row.total++
    const degree = links.neighbours(item.id).size
    if (degree) row.linked++
    byType.set(type, row)
    if (!degree) continue
    const d = egoDensity(item.id, links, 400)
    if (d.clustering !== null) {
      cSum += d.clustering
      cN++
    }
    for (const s of mergeSuggestions(item, [reciprocalSource(item, ctx), triadSource(item, ctx), coMemberSource(item, ctx)], { links, muted, limit: 2 })) {
      const pair = [item.id, s.otherId].sort().join("|")
      if (seenPair.has(pair)) continue
      seenPair.add(pair)
      pool.push({ ...s, fromId: item.id })
    }
    if (item.links?.length) {
      for (const c of egoChecks(item.id, { links, getDef: getRelationDef, lattice, title, label: relationLabel, outLinks: item.links })) checks.push({ ...c, itemId: item.id })
    }
  }
  pool.sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : 1))
  const seenLine = new Set<string>()
  cached = {
    suggestions: pool.slice(0, limit),
    checks: checks.filter((c) => (seenLine.has(c.line) ? false : (seenLine.add(c.line), true))).slice(0, limit),
    linkability: [...byType.entries()].map(([type, r]) => ({ type, ...r })).sort((a, b) => b.total - a.total),
    meanClustering: cN ? cSum / cN : null,
  }
  cacheTasks = tasks
  cacheMuted = mutedKey
  return cached
}

/** Monday-start week key `YYYY-MM-DD`. */
function weekKey(d: Date): string {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
}

/** Ledger lines that changed links, per week, oldest first (L9.2). */
export function linkEditsByWeek(ledger: Record<string, ItemActivityEntry[]>, now = new Date(), weeks = 8): { week: string; edits: number }[] {
  const keys: string[] = []
  for (let i = weeks - 1; i >= 0; i--) keys.push(weekKey(new Date(now.getTime() - i * 7 * 86_400_000)))
  const counts = new Map(keys.map((k) => [k, 0]))
  for (const rows of Object.values(ledger)) {
    for (const e of rows ?? []) {
      if (!e?.changes?.some((c) => c.field === "links")) continue
      const k = weekKey(new Date(e.at))
      if (counts.has(k)) counts.set(k, counts.get(k)! + 1)
    }
  }
  return keys.map((week) => ({ week, edits: counts.get(week)! }))
}
