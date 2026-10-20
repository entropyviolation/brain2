/**
 * Densify source: shared painted time. The caller passes sittings per other
 * item (KG law 7: nothing under `OBSERVATORY_FLOOR` = 7 sittings).
 */
import { getRelationDef } from "@/lib/relation-registry"
import { suggestion, type DensifyContext, type Suggestion } from "@/lib/graph/densify"
import type { ItemRecord } from "@/lib/types"

export const CO_TIME_FLOOR = 7

export interface CoTime {
  otherId: string
  sittings: number
  sharedMinutes: number
  minMinutes: number
  since?: string
}

export function coTimeSource(item: ItemRecord, ctx: DensifyContext, rows: readonly CoTime[], person = false): Suggestion[] {
  return rows
    .filter((r) => r.otherId !== item.id && r.sittings >= CO_TIME_FLOOR && r.minMinutes > 0)
    .map((r) =>
      suggestion(
        r.otherId,
        person && getRelationDef("spends-time-with") ? "spends-time-with" : "related",
        "co-time",
        `Together ${r.sittings} times${r.since ? ` since ${r.since}` : ""}: ${ctx.title(r.otherId)}`,
        r.sharedMinutes / r.minMinutes,
      ),
    )
}
