/**
 * components/Analytics/time/wardrobe-stats.ts — Wear counts for the closet
 *
 * One outfit is one wear. Days worn are distinct day keys. Category totals
 * count distinct outfits first, and piece-links second.
 */
import { calendarDaysBetween } from "./shower-stats"
import type { Outfit, Piece, PieceCategory } from "@/lib/wardrobe"
import { PIECE_CATEGORIES } from "@/lib/wardrobe"

export type WearRow = {
  pieceId: string
  name: string
  category: PieceCategory
  subtype?: string
  timesWorn: number
  daysWorn: number
  lastWorn: string | null
  daysSince: number | null
  dayKeys: string[]
}

export type CategoryWear = {
  category: PieceCategory
  label: string
  outfits: number
  links: number
}

export type SubtypeWear = {
  subtype: string
  outfits: number
  links: number
}

function inWindow(outfit: Outfit, range: ReadonlySet<string>): boolean {
  return range.has(outfit.dayKey)
}

export function wearByPiece(
  pieces: readonly Piece[],
  outfits: readonly Outfit[],
  range: readonly string[],
  today: string,
): WearRow[] {
  const keys = new Set(range)
  const rows = pieces.map((piece) => {
    const worn = outfits.filter((outfit) => inWindow(outfit, keys) && outfit.pieceIds.includes(piece.id))
    const dayKeys = [...new Set(worn.map((outfit) => outfit.dayKey))].sort()
    const lastWorn = dayKeys[dayKeys.length - 1] ?? null
    return {
      pieceId: piece.id,
      name: piece.name,
      category: piece.category,
      ...(piece.subtype ? { subtype: piece.subtype } : {}),
      timesWorn: worn.length,
      daysWorn: dayKeys.length,
      lastWorn,
      daysSince: lastWorn ? calendarDaysBetween(lastWorn, today) : null,
      dayKeys,
    }
  })
  return rows.sort((a, b) => {
    const az = a.timesWorn === 0 ? 1 : 0
    const bz = b.timesWorn === 0 ? 1 : 0
    if (az !== bz) return az - bz
    return b.timesWorn - a.timesWorn || a.name.localeCompare(b.name)
  })
}

export function wearByCategory(
  pieces: readonly Piece[],
  outfits: readonly Outfit[],
  range: readonly string[],
): CategoryWear[] {
  const keys = new Set(range)
  const byId = new Map(pieces.map((piece) => [piece.id, piece]))
  return PIECE_CATEGORIES.map((category) => {
    const matching = outfits.filter(
      (outfit) => inWindow(outfit, keys) && outfit.pieceIds.some((id) => byId.get(id)?.category === category),
    )
    const links = matching.reduce(
      (sum, outfit) => sum + outfit.pieceIds.filter((id) => byId.get(id)?.category === category).length,
      0,
    )
    return { category, label: category, outfits: matching.length, links }
  }).filter((row) => pieces.some((piece) => piece.category === row.category) || row.outfits > 0)
}

export function wearBySubtype(
  pieces: readonly Piece[],
  outfits: readonly Outfit[],
  range: readonly string[],
): SubtypeWear[] {
  const keys = new Set(range)
  const labels = [...new Set(pieces.map((piece) => piece.subtype).filter((label): label is string => Boolean(label)))]
  return labels
    .map((subtype) => {
      const ids = new Set(pieces.filter((piece) => piece.subtype === subtype).map((piece) => piece.id))
      const matching = outfits.filter((outfit) => inWindow(outfit, keys) && outfit.pieceIds.some((id) => ids.has(id)))
      const links = matching.reduce((sum, outfit) => sum + outfit.pieceIds.filter((id) => ids.has(id)).length, 0)
      return { subtype, outfits: matching.length, links }
    })
    .sort((a, b) => b.outfits - a.outfits || a.subtype.localeCompare(b.subtype))
}
