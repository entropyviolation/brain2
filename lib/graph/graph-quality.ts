/**
 * lib/graph/graph-quality.ts — Five counts for the weekly graph review.
 *
 * No single quality score. Each list is something the person can open:
 * beliefs with no evidence link, sources with no links, functional
 * collisions, open same-as proposals, and suggestion sources dismissed
 * often enough to mute.
 */
import { coMemberSource } from "@/lib/graph/densify/co-member"
import { coTimeSource, type CoTime } from "@/lib/graph/densify/co-time"
import { reciprocalSource } from "@/lib/graph/densify/reciprocal"
import { triadSource } from "@/lib/graph/densify/triad"
import { linkIndexOf } from "@/lib/graph/link-index"
import { buildLattice } from "@/lib/graph/relation-lattice"
import { egoChecks } from "@/lib/graph/relation-checks"
import { isEvidenceRelation, relationLabel } from "@/lib/links"
import { allRelations, getRelationDef } from "@/lib/relation-registry"
import { BELIEF_TYPE_ID, SOURCE_TYPE_ID } from "@/lib/second-brain-types"
import type { ItemRecord } from "@/lib/types"

/** Dismissals of one source before the strip names it. */
export const NOISY_SOURCE_FLOOR = 5

export interface QualityRow {
  id: string
  line: string
}

export interface GraphQuality {
  unsupportedBeliefs: QualityRow[]
  unlinkedSources: QualityRow[]
  functionalCollisions: QualityRow[]
  openIdentity: QualityRow[]
  noisySources: QualityRow[]
}

export function graphQuality(input: {
  tasks: readonly ItemRecord[]
  title: (id: string) => string
  proposals?: readonly { id: string; status?: string; relation?: string; origin?: string; reason?: string; sourceId?: string; targetId?: string }[]
  muted?: readonly string[]
  /** Company sittings for one person. Omitted skips co-time in the noisy count. */
  coTimeFor?: (item: ItemRecord) => readonly CoTime[]
}): GraphQuality {
  const links = linkIndexOf(input.tasks)
  const lattice = buildLattice(allRelations())
  const title = input.title
  const muted = new Set(input.muted ?? [])
  const unsupportedBeliefs: QualityRow[] = []
  const unlinkedSources: QualityRow[] = []
  const functionalCollisions: QualityRow[] = []
  const seenLine = new Set<string>()
  const noisy = new Map<string, number>()

  for (const item of input.tasks) {
    const name = title(item.id)
    if (item.type === BELIEF_TYPE_ID) {
      const evidence = links.steps(item.id).some((step) => isEvidenceRelation(step.relation) || (step.stored ? isEvidenceRelation(step.stored) : false))
      if (!evidence) unsupportedBeliefs.push({ id: item.id, line: name })
    }
    if (item.type === SOURCE_TYPE_ID && links.neighbours(item.id).size === 0) {
      unlinkedSources.push({ id: item.id, line: name })
    }
    if (links.neighbours(item.id).size) {
      for (const check of egoChecks(item.id, { links, getDef: getRelationDef, lattice, title, label: relationLabel, outLinks: item.links ?? [] })) {
        if (check.kind !== "functional" && check.kind !== "inverse-functional") continue
        if (seenLine.has(check.line)) continue
        seenLine.add(check.line)
        functionalCollisions.push({ id: `${item.id}:${check.kind}`, line: check.line })
      }
    }
    if (!item.dismissedLinkSuggestions?.length) continue
    const ctx = { all: input.tasks, links, title }
    const coTime = input.coTimeFor ? coTimeSource(item, ctx, input.coTimeFor(item), item.type === "person") : []
    const dismissed = new Set(item.dismissedLinkSuggestions)
    for (const row of [...reciprocalSource(item, ctx), ...triadSource(item, ctx), ...coMemberSource(item, ctx), ...coTime]) {
      if (!dismissed.has(row.key) || muted.has(row.source)) continue
      noisy.set(row.source, (noisy.get(row.source) ?? 0) + 1)
    }
  }

  const openIdentity: QualityRow[] = []
  for (const proposal of input.proposals ?? []) {
    if (proposal.status !== "open") continue
    const identity = proposal.relation === "same-as" || proposal.origin?.startsWith("densify:identity")
    if (!identity) continue
    const line = proposal.reason?.trim() || `${title(proposal.sourceId ?? "")} same-as ${title(proposal.targetId ?? "")}`
    openIdentity.push({ id: proposal.id, line })
  }

  const noisySources: QualityRow[] = [...noisy.entries()]
    .filter(([, n]) => n >= NOISY_SOURCE_FLOOR)
    .map(([source, n]) => ({ id: source, line: `${source} was dismissed ${n} times. Mute it on the Links tab.` }))

  return { unsupportedBeliefs, unlinkedSources, functionalCollisions, openIdentity, noisySources }
}
