/**
 * lib/baby-game/casa-pieces.ts — the sizes of the furniture that is painted in code, not snapped from a ComfyUI picture
 *
 * `furniture-sprites.ts` holds the pictured pieces. The ones here are drawn by `components/BabyGame/casa-made.ts` (a tree
 * of plaster for a column, a bay of books, stained-glass windows, a net hammock, rugs), so their size has to live where
 * the layout and the walking can read it without a canvas. `pieceSize` answers for both kinds. Pure.
 */

import { FURNITURE_SPRITES } from "./furniture-sprites"

export type PieceSize = { w: number; h: number }

export const MADE: Record<string, PieceSize> = {
  "column-tree": { w: 100, h: 200 },
  "bookcase-bay": { w: 132, h: 108 },
  "sofa-leather": { w: 74, h: 34 },
  "table-chrome": { w: 60, h: 38 },
  "stool-lime": { w: 18, h: 18 },
  "pendant-bubbles": { w: 48, h: 120 },
  "window-tulip": { w: 52, h: 92 },
  "window-oval": { w: 70, h: 100 },
  "dome-stars": { w: 132, h: 64 },
  "curtain-stained": { w: 48, h: 104 },
  "hammock-net": { w: 112, h: 78 },
  "plant-ivy": { w: 66, h: 118 },
  "nook-bed": { w: 112, h: 92 },
  "rug-persian": { w: 168, h: 54 },
  "rug-moss": { w: 120, h: 36 },
  "swan-candle": { w: 16, h: 20 },
  "vase-tall": { w: 18, h: 44 },
  "clock-orb": { w: 30, h: 30 },
  "stair-spiral": { w: 78, h: 134 },
}

/** Width and height of a piece, whichever way it is made; undefined when nothing by that name exists. */
export function pieceSize(id: string): PieceSize | undefined {
  return MADE[id] ?? FURNITURE_SPRITES[id]
}
