/**
 * lib/graph/densify/co-time-rows.ts — Sittings two people share on Company blocks.
 *
 * Person items only, and only pens joined by a `company-pen` pipeline.
 * A sitting is one painted block both people are named on. Shared minutes
 * are that block's length. `minMinutes` is the shorter of the two people's
 * total Company minutes, so the shelf score is shared / min(totals).
 */
import { blockPeople } from "@/lib/company-headcount"
import { COMPANY } from "@/lib/people-sync"
import type { CoTime } from "@/lib/graph/densify/co-time"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

export interface CoTimeEntry {
  date: string
  scopeId: string
  penId: string
  secondaryPenIds?: string[]
  variantIds?: string[]
  startMin: number
  endMin: number
  kind?: string
}

export interface CoTimePen {
  id: string
  name: string
  color?: string
  parentId?: string
  parentIds?: string[]
  levelId?: string
  variants?: { id: string; penId?: string; scopeId?: string }[]
}

export interface CoTimeScope {
  id: string
  pens: CoTimePen[]
  levels?: { id: string; name?: string }[]
}

interface Personish {
  id: string
  type?: string
  personProfile?: unknown
  personPipelines?: readonly { kind: string; penId?: string }[]
}

function isPerson(item: Personish): boolean {
  return item.type === "person" || !!item.personProfile || (item.personPipelines?.length ?? 0) > 0
}

function sinceLabel(iso: string): string {
  const hit = /^(\d{4})-(\d{2})/.exec(iso)
  if (!hit) return iso
  const month = MONTHS[Number(hit[2]) - 1]
  return month ? `${month} ${hit[1]}` : iso
}

/** Rows for `coTimeSource`. Empty unless `item` is a person with a joined Company pen. */
export function coTimeRows(
  item: Personish,
  items: readonly Personish[],
  entries: readonly CoTimeEntry[],
  scopes: readonly CoTimeScope[],
): CoTime[] {
  if (!isPerson(item)) return []
  const scope = scopes.find((row) => row.id === COMPANY)
  if (!scope) return []
  const penToItem = new Map<string, string>()
  for (const row of items) {
    for (const pipeline of row.personPipelines ?? []) {
      if (pipeline.kind === "company-pen" && pipeline.penId && !penToItem.has(pipeline.penId)) penToItem.set(pipeline.penId, row.id)
    }
  }
  const myPens = (item.personPipelines ?? []).some((pipeline) => pipeline.kind === "company-pen" && pipeline.penId && penToItem.get(pipeline.penId) === item.id)
  if (!myPens) return []

  const totals = new Map<string, number>()
  const pairs = new Map<string, { sittings: number; shared: number; since?: string }>()
  for (const entry of entries) {
    if (entry.scopeId !== COMPANY || entry.kind === "instant" || entry.endMin <= entry.startMin) continue
    const said = blockPeople(scope as Parameters<typeof blockPeople>[0], entry)
    const ids = [...new Set([...said.people].map((penId) => penToItem.get(penId)).filter((id): id is string => !!id))]
    const minutes = entry.endMin - entry.startMin
    for (const id of ids) totals.set(id, (totals.get(id) ?? 0) + minutes)
    if (!ids.includes(item.id)) continue
    for (const other of ids) {
      if (other === item.id) continue
      const row = pairs.get(other) ?? { sittings: 0, shared: 0 }
      row.sittings += 1
      row.shared += minutes
      if (!row.since || entry.date < row.since) row.since = entry.date
      pairs.set(other, row)
    }
  }

  const mine = totals.get(item.id) ?? 0
  const out: CoTime[] = []
  for (const [otherId, row] of pairs) {
    const minMinutes = Math.min(mine, totals.get(otherId) ?? 0)
    if (minMinutes <= 0) continue
    out.push({
      otherId,
      sittings: row.sittings,
      sharedMinutes: row.shared,
      minMinutes,
      ...(row.since ? { since: sinceLabel(row.since) } : {}),
    })
  }
  return out
}
