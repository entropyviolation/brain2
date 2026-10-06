/**
 * components/Home/Tracking/grid-stroke.ts — What a cell shows while the pointer is down
 *
 * A stroke is one block, committed on release. Until then the grid only
 * previews. Minutes that already wear this pen keep the fill they had, so
 * dragging through them does not punch a hole and then heal it. Empty minutes,
 * and minutes of another pen, take the incoming surface. Erase is a wash on
 * the minutes inside the stroke and nowhere else.
 */

export interface CellFill {
  background?: string
  backgroundImage?: string
  backgroundSize?: string
  backgroundPosition?: string
}

/** The wash laid over minutes an erase stroke will clear. */
export const ERASE_WASH = "#fca5a5"

export function strokeCellStyle(opts: {
  inStroke: boolean
  erasing: boolean
  /** This minute is already the pen the stroke will write. */
  samePen: boolean
  existing: CellFill
  incoming: CellFill
}): CellFill {
  if (!opts.inStroke) return opts.existing
  if (opts.erasing) return { background: ERASE_WASH }
  if (opts.samePen) return opts.existing
  return opts.incoming
}
