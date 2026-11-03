import type { Piece, PieceCategory } from "@/lib/wardrobe"

export type PieceChipId = "uncategorized" | PieceCategory

/**
 * Uncategorized means category `other` and no subtype.
 * A subtype, or any other category, stays on that category's chip.
 * A missing photo does not move a piece off its category.
 */
export function pieceChipId(piece: Pick<Piece, "category" | "subtype">): PieceChipId {
  const subtype = piece.subtype?.trim() ?? ""
  if (piece.category === "other" && !subtype) return "uncategorized"
  return piece.category
}
