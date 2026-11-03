/**
 * components/Inventory/phone/closet-phone-slots.ts — Phone look placement
 *
 * Tapping pieces fills a new composition. The desk board is the one that drags.
 * These coordinates stay inside 0..1 so `addComposition` can store them.
 */
import type { CompositionSlot } from "@/lib/wardrobe"

/** Even places, up to three across. Order is the order the pieces were tapped. */
export function phoneCompositionSlots(pieceIds: readonly string[]): CompositionSlot[] {
  const ids = pieceIds.map((id) => id.trim()).filter(Boolean)
  if (ids.length === 0) return []
  const cols = Math.min(3, ids.length)
  const rows = Math.ceil(ids.length / cols)
  return ids.map((pieceId, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    return {
      pieceId,
      x: (col + 0.5) / cols,
      y: (row + 0.5) / rows,
    }
  })
}
