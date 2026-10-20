/**
 * components/Home/dash/dash-sizes.ts — Footprints each kind can draw on Dash
 *
 * Cells are about 88 × 60 px. The first size is the default for a new copy.
 * `lib/widgets/kinds.ts` holds the live copy of this table; keep the two in
 * step when a face learns a new size.
 */

export type DashSize = "1x1" | "2x1" | "1x2" | "2x2" | "3x1" | "3x2" | "1x3"

export const DASH_SIZES: Record<string, DashSize[]> = {
  progress: ["2x1", "1x1", "2x2", "3x1"],
  review: ["1x1", "2x1"],
  points: ["2x1", "1x1", "2x2", "3x1"],
  award: ["1x1", "2x1"],
  pet: ["1x1", "2x1", "1x2"],
  moon: ["1x2", "1x1", "2x1", "1x3"],
  daysuntil: ["1x1", "2x1"],
  vocab: ["2x1", "1x1", "2x2"],
  affirmation: ["2x1", "3x1", "2x2"],
  weather: ["2x1", "1x1", "2x2"],
  next: ["2x1", "1x1", "3x1"],
  daylamp: ["1x1", "2x1"],
  harvest: ["1x1", "2x1"],
  inbox: ["1x1", "2x1"],
  night: ["1x1", "2x1"],
  flow: ["2x1", "1x1", "2x2"],
  paint: ["2x1", "1x1", "2x2"],
  tracking: ["2x1", "1x1"],
  solar: ["1x1", "2x1"],
}

export function dashCols(size: DashSize): number {
  return Number(size[0])
}

export function dashRows(size: DashSize): number {
  return Number(size[2])
}
