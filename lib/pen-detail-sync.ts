/**
 * lib/pen-detail-sync.ts — A detail of a pen is a pen that counts as it
 *
 * Walk counts as Exercise, so Exercise's detail list includes Walk.
 * Adding "Gym" under Exercise creates a Gym pen whose parent is Exercise.
 * One fact, two doors: the detail chips and the counts-as tree.
 *
 * Several details can still sit on the same minutes (Elijah and Rebecca).
 * Painting still writes the pen you painted. This module only keeps the
 * two lists agreed; it does not rewrite blocks.
 *
 * A same-name pen that already counts as something else is left alone —
 * merging would steal that chain. A dangling link (the pen was deleted,
 * or it moved under a different parent) drops the detail so the lists
 * cannot disagree.
 *
 * Pure: no store.
 */
import { assignParents, penParentIds, wouldCycle } from "@/lib/pen-tree"
import type { PenVariant, TrackPen } from "@/lib/time-tracking-store"

const normalize = (name: string) => name.trim().toLowerCase()

export type DetailMint = (kind: "pen" | "var") => string

export interface DetailSync {
  pens: TrackPen[]
  /** Variant ids removed because their pen left or was deleted. */
  droppedVariantIds: string[]
}

function clonePens(pens: TrackPen[]): TrackPen[] {
  return pens.map((pen) => ({
    ...pen,
    variants: pen.variants?.map((variant) => ({ ...variant })),
  }))
}

/**
 * Make details and direct children the same set.
 * Idempotent: a second pass adds nothing and drops nothing.
 */
export function syncScopeDetails(pens: TrackPen[], mint: DetailMint): DetailSync {
  const next = clonePens(pens)
  const dropped: string[] = []
  const byId = () => new Map(next.map((pen) => [pen.id, pen]))

  for (const parent of next) {
    const kept: PenVariant[] = []
    const claimed = new Set<string>()
    for (const variant of parent.variants ?? []) {
      const name = variant.name.trim()
      if (!name) {
        kept.push(variant)
        continue
      }

      if (variant.penId) {
        const child = byId().get(variant.penId)
        if (!child) {
          dropped.push(variant.id)
          continue
        }
        if (!penParentIds(child).length && !wouldCycle(next, child.id, parent.id)) {
          Object.assign(child, assignParents(child, [parent.id]))
        }
        if (!penParentIds(child).includes(parent.id)) {
          dropped.push(variant.id)
          continue
        }
        variant.name = child.name
        variant.color = child.color
        claimed.add(child.id)
        kept.push(variant)
        continue
      }

      const key = normalize(name)
      const candidate = next.find(
        (pen) =>
          pen.id !== parent.id &&
          !claimed.has(pen.id) &&
          normalize(pen.name) === key &&
          (!penParentIds(pen).length || penParentIds(pen).includes(parent.id)) &&
          !wouldCycle(next, pen.id, parent.id),
      )
      if (candidate) {
        if (!penParentIds(candidate).includes(parent.id)) {
          Object.assign(candidate, assignParents(candidate, [parent.id]))
        }
        variant.penId = candidate.id
        variant.name = candidate.name
        variant.color = candidate.color
        claimed.add(candidate.id)
        kept.push(variant)
        continue
      }

      const taken = next.some((pen) => pen.id !== parent.id && normalize(pen.name) === key)
      if (taken) {
        // Same name already counts as a different pen. Keep the label; do not fork a second pen.
        kept.push(variant)
        continue
      }

      const id = mint("pen")
      const color = variant.color || parent.color
      next.push(assignParents({ id, name, color }, [parent.id]))
      variant.penId = id
      variant.color = color
      claimed.add(id)
      kept.push(variant)
    }
    parent.variants = kept.length ? kept : undefined
  }

  for (const child of [...next]) {
    for (const parentId of penParentIds(child)) {
      const parent = next.find((pen) => pen.id === parentId)
      if (!parent || parent.id === child.id) continue
      const variants = parent.variants ?? []
      const linked = variants.find((variant) => variant.penId === child.id)
      const byName = variants.find((variant) => !variant.penId && normalize(variant.name) === normalize(child.name))
      const variant = linked ?? byName
      if (variant) {
        variant.penId = child.id
        variant.name = child.name
        variant.color = child.color
        parent.variants = variants
        continue
      }
      variants.push({
        id: mint("var"),
        name: child.name,
        color: child.color,
        penId: child.id,
      })
      parent.variants = variants
    }
  }

  return { pens: next, droppedVariantIds: dropped }
}
