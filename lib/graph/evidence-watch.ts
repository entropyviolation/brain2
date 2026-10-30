/**
 * lib/graph/evidence-watch.ts — Evidence that left the day spine (E3, KG-L6 slice)
 *
 * A belief (the formulation type is not in the catalog; GS-5 is still planned)
 * may point `supported-by` / `refuted-by` at an observation address. Strength
 * recomputes in `lib/belief-strength.ts`. This list is what the next review
 * raises. The graph does not rewrite the belief.
 */
import { isEvidenceRelation } from "@/lib/links"
import { isObservationAddress } from "@/lib/graph/vault-graph"

export interface EvidenceItem {
  id: string
  title?: string
  links?: readonly { relation: string; targetId: string }[]
}

export interface StaleEvidence {
  itemId: string
  title: string
  missing: string[]
}

function isAddressSet(live: ReadonlySet<string> | readonly { s: string; o: string }[]): live is ReadonlySet<string> {
  return live instanceof Set
}

export function evidenceMissingFromSpine(
  items: readonly EvidenceItem[],
  live: ReadonlySet<string> | readonly { s: string; o: string }[],
): StaleEvidence[] {
  const addresses = isAddressSet(live) ? live : new Set(live.flatMap((triple) => [triple.s, triple.o]))
  const out: StaleEvidence[] = []
  for (const item of items) {
    const missing = (item.links ?? [])
      .filter((link) => isEvidenceRelation(link.relation) && isObservationAddress(link.targetId) && !addresses.has(link.targetId))
      .map((link) => link.targetId)
    if (!missing.length) continue
    out.push({ itemId: item.id, title: item.title?.trim() || item.id, missing: [...new Set(missing)].sort() })
  }
  out.sort((a, b) => a.itemId.localeCompare(b.itemId))
  return out
}
