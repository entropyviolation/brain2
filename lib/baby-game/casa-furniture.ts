/**
 * lib/baby-game/casa-furniture.ts — what stands in every room of the cottage, and where
 *
 * The furniture is drawn in ComfyUI from the "future home" board (`homedesignref/`) and snapped to small sprites
 * (`furniture-sprites.ts`, from `scripts/baby-furniture-queue.mjs` and `scripts/baby-furniture-snap.mts`). This is only the
 * layout, in pixels of the room (the floor starts at y = 128; `x` is the middle of a piece and `y` its foot line). `casa.ts`
 * turns the solid ones into blocked tiles and the ones with a `look` into spots to press E on; `casa-paint.ts` draws them.
 * Pure: no canvas.
 */

import { pieceSize } from "./casa-pieces"

export type Placement = {
  floor: 0 | 1 | 2 | 3 | 4 | 5
  /** A key of `FURNITURE_SPRITES` (pictured) or `MADE` in `casa-pieces.ts` (painted in code). */
  id: string
  x: number
  y: number
  /** Painted into the wall, behind everything, with `y` its bottom edge (curtains, pendants, mirrors); never solid. */
  wall?: boolean
  /** Laid flat on the floor under everything and every walker (a rug); never solid. */
  flat?: boolean
  /** Half the width, in px, that blocks walking; the piece's own width times 0.4 by default (a trunk is narrower than its boughs). */
  span?: number
  /** Raised off its foot line, for a lamp standing on a table. */
  lift?: number
  /** Blocks walking: its foot depth in px. Off by default for lamps on tables; on (depth 10) otherwise. */
  solid?: number | false
  /** A pool of light at night, its radius. */
  glow?: number
  /** Press E: what you see. */
  look?: string
  label?: string
  /** Press E to use it: switch a lamp, sit down, put the music on, rummage. */
  use?: Use
}

export type Use = "lamp" | "sit" | "music" | "rummage"

const P = (floor: Placement["floor"], id: string, x: number, y: number, extra: Partial<Placement> = {}): Placement => ({ floor, id, x, y, ...extra })

export const PLACEMENTS: Placement[] = [
  // ── the Hall
  P(0, "cabinet-lacquer", 150, 172, { label: "The black cabinet", look: "Lacquer as black as a pond at night, with peonies and birds set into it in mother-of-pearl. Something inside rustles, politely." , use: "rummage" }),
  P(0, "mirror-orchid", 150, 98, { wall: true }),
  P(0, "pendant-opal", 118, 52, { wall: true, glow: 34 , use: "lamp" }),
  P(0, "plant-kentia", 30, 214),
  P(0, "pouf-chrome", 192, 262, { use: "sit" }),
  P(0, "pouf-chrome", 322, 262, { use: "sit" }),
  P(0, "table-marble", 458, 246, { label: "The marble table", look: "A round table of marble that looks like a stormy sea. A black box sits on it, and a candle that has been waiting a long time for a match." }),
  P(0, "lamp-dome", 410, 288, { glow: 44 , use: "lamp" }),
  P(0, "column-tree", 178, 152, { span: 8, solid: 8, label: "The plaster tree", look: "A column that grew instead of being built: a trunk of white plaster that opens into boughs and holds up the ceiling the way a tree holds up a sky. Ivy has been climbing it for years and has not reached the top." }),
  P(0, "dome-stars", 132, 10, { wall: true }),
  P(0, "dome-stars", 394, 10, { wall: true }),
  P(0, "clock-orb", 120, 58, { wall: true, label: "The orb clock", look: "A round clock with a silver rim and two hands that have agreed to disagree. It is always exactly the right time for something." }),
  P(0, "vase-tall", 66, 258, { label: "The tall vase", look: "A celadon vase, green as the inside of a wave, and a branch of blossom that someone fusses over every morning." }),

  // ── the Noble Floor
  P(1, "sofa-cloud", 150, 208, { label: "The cloud sofa", look: "It is a sofa the way a cloud is a pillow. You sit for one minute and wake up with the whole afternoon gone, like a good nap." , use: "sit" }),
  P(1, "table-glass", 150, 246),
  P(1, "vase-lily", 150, 247, { lift: 20, solid: false }),
  P(1, "chair-chrome", 222, 250, { use: "sit" }),
  P(1, "lamp-spheres", 396, 204, { glow: 44 , use: "lamp" }),
  P(1, "sofa-sage", 330, 296, { use: "sit" }),
  P(1, "dresser-chrome", 354, 188, { use: "rummage" }),
  P(1, "record-player", 354, 189, { lift: 36, solid: false, label: "The record player", look: "A round turntable under a smoked glass lid. The record on it has no label and plays something between rain and a cello." , use: "music" }),
  P(1, "shelf-organic", 524, 196, { label: "The honey bookcase", look: "A bookcase that was carved, not built: ovals cut in it like the holes in cheese, and in every oval a book that is a little shy." , use: "rummage" }),
  P(1, "trolley", 262, 292, { use: "rummage" }),
  P(1, "lamp-tulip", 40, 226, { glow: 36 , use: "lamp" }),
  P(1, "rug-persian", 158, 292, { flat: true }),
  P(1, "window-oval", 434, 112, { wall: true, glow: 38 }),
  P(1, "window-tulip", 494, 118, { wall: true, glow: 34 }),
  P(1, "curtain-stained", 58, 108, { wall: true }),
  P(1, "sofa-leather", 548, 300, { label: "The leather sofa", look: "Three brown lumps that agreed to be a sofa. It smells of an old library and the inside of a good coat.", use: "sit" }),
  P(1, "table-chrome", 476, 272, { label: "The chrome table", look: "Smoked glass on rings of silver, like a coin stood on its edge. Nothing has ever been spilled here, and that is the table's whole personality." }),
  P(1, "stool-lime", 436, 278, { use: "sit" }),
  P(1, "stool-lime", 516, 278, { use: "sit" }),
  P(1, "lamp-mushroom", 392, 302, { glow: 40, use: "lamp" }),
  P(1, "vase-tall", 80, 252, { label: "The blossom vase", look: "Pink blossom in a pale green vase. It makes the whole corner smell of spring on purpose." }),

  // ── the Loft
  P(2, "curtain-plum", 210, 130, { wall: true }),
  P(2, "dice-tables", 176, 180, { label: "The dice tables", look: "Two white cubes with black dots, stacked as if someone rolled a one and a six and decided to live here." }),
  P(2, "lamp-saturn", 176, 181, { lift: 24, solid: false, glow: 30 , use: "lamp" }),
  P(2, "shelf-ladder", 238, 154, { use: "rummage" }),
  P(2, "chair-heart", 214, 250, { label: "The heart chair", look: "A red velvet chair with a heart for a back. It was made to sit exactly one person and one secret." , use: "sit" }),
  P(2, "chair-green", 336, 252, { use: "sit" }),
  P(2, "table-hand", 270, 270, { label: "The hand table", look: "A table shaped like a plaster hand holding up a sheet of glass. It does not drop things. It is very proud of that." }),
  P(2, "hammock-net", 450, 280),
  P(2, "lamp-tulip", 380, 190, { glow: 36 , use: "lamp" }),
  P(2, "nook-bed", 452, 128, { wall: true, glow: 44, label: "The nook bed", look: "A bed set into the wall like a loaf in an oven: terracotta glow, a plum quilt, and a round shelf of books for the nights that will not end." }),
  P(2, "vase-tall", 498, 262),

  // ── the Sunken Lounge
  P(3, "fireplace-egg", 150, 134, { wall: true, glow: 40 }),
  P(3, "pendant-opal", 192, 48, { wall: true, glow: 34 , use: "lamp" }),
  P(3, "pendant-opal", 320, 48, { wall: true, glow: 34 , use: "lamp" }),
  P(3, "plant-ivy", 392, 96, { wall: true }),
  P(3, "sofa-sage", 256, 208, { label: "The sage sofa", look: "A sofa that curves as if it were hugging the table. Moss green, soft, and warmer than it has any right to be." , use: "sit" }),
  P(3, "table-glass", 256, 248),
  P(3, "pouf-chrome", 182, 252, { use: "sit" }),
  P(3, "pouf-chrome", 332, 252, { use: "sit" }),
  P(3, "lamp-dome", 96, 214, { glow: 44 , use: "lamp" }),
  P(3, "shelf-organic", 380, 166, { use: "rummage" }),
  P(3, "dresser-chrome", 430, 184, { use: "rummage" }),
  P(3, "record-player", 430, 185, { lift: 36, solid: false , use: "music" }),
  P(3, "speakers-orb", 36, 184),
  P(3, "speakers-orb", 476, 184),
  P(3, "lamp-lava", 450, 276, { label: "The lava lamp", look: "White blobs rise and fall in the glass like slow thoughts. Nobody knows what they are thinking about. Probably dinner." , use: "lamp" }),
  P(3, "table-marble", 450, 280),
  P(3, "plant-kentia", 40, 270),
  P(3, "column-tree", 206, 152, { span: 8, solid: 8 }),
  P(3, "column-tree", 318, 152, { span: 8, solid: 8 }),
  P(3, "rug-moss", 96, 292, { flat: true }),

  // ── the Glasshouse
  P(4, "chandelier-green", 256, 52, { wall: true, glow: 70 , use: "lamp" }),
  P(4, "curtain-beads", 150, 104, { wall: true }),
  P(4, "curtain-beads", 362, 104, { wall: true }),
  P(4, "cabinet-lacquer", 66, 176, { use: "rummage" }),
  P(4, "lamp-nouveau", 66, 177, { lift: 64, solid: false, glow: 40, label: "The shell lamp", look: "A bronze lady holds up a shell the size of a plum and the shell glows pearl-pink. She has held it since before there was a house." , use: "lamp" }),
  P(4, "screen-silver", 446, 178),
  P(4, "table-dining", 256, 250, { label: "The dining table", look: "A round table of smoke-grey glass with six curved chairs pulled out an inch. A dinner is about to happen. It will be wonderful and will go on until dawn." }),
  P(4, "candles-carved", 256, 251, { lift: 22, solid: false, glow: 36 , use: "lamp" }),
  P(4, "plant-kentia", 110, 280),
  P(4, "plant-kentia", 404, 280),
  P(4, "statue-angel", 484, 286, { glow: 36 , use: "lamp" }),
  P(4, "chair-heart", 150, 244, { use: "sit" }),
  P(4, "stair-spiral", 352, 152, { span: 12, solid: 8, label: "The spiral stair", look: "Treads of white stone wind round a pole of iron and go up to a hatch in the glass. The hatch has been painted shut. The stair does not mind; it is for looking at." }),
  P(4, "plant-ivy", 30, 100, { wall: true }),
  P(4, "plant-ivy", 484, 100, { wall: true }),
  P(4, "vase-tall", 456, 252),

  // ── the Boudoir
  P(5, "vanity-round", 98, 180, { label: "The round vanity", look: "A cream vanity with a mirror like a full moon and a pink stool. The mirror shows you slightly happier than you were a minute ago." , use: "rummage" }),
  P(5, "vanity-swirl", 196, 180, { use: "rummage" }),
  P(5, "mirror-orchid", 300, 90, { wall: true }),
  P(5, "sink-checker", 340, 164),
  P(5, "bath-tub", 400, 168, { label: "The sculpted bath", look: "A bath that was poured out of plaster in one go, curved like the inside of a spoon. The tap is silver, and the water is exactly bath-warm." }),
  P(5, "curtain-capiz", 468, 128, { wall: true }),
  P(5, "candles-carved", 448, 169, { solid: false, glow: 34 , use: "lamp" }),
  P(5, "daybed-red", 110, 268, { label: "The red daybed", look: "A velvet daybed with a canopy of sheer curtain. People have been told to rest here and have dreamed whole books." , use: "sit" }),
  P(5, "chest-iron", 210, 212, { use: "rummage" }),
  P(5, "lamp-fringe", 210, 213, { lift: 24, solid: false, glow: 34 , use: "lamp" }),
  P(5, "screen-mirror", 304, 260),
  P(5, "bed-canopy", 430, 280, { label: "The gauze bed", look: "A bed inside a pink cloud of gauze. It is the kind of bed you cross a country to sleep in." , use: "sit" }),
  P(5, "dome-stars", 256, 6, { wall: true }),
  P(5, "swan-candle", 372, 172, { lift: 0, solid: false, glow: 28, use: "lamp", label: "The swan candle" }),
]

/** The bounds of a piece in pixels (x0, y0, x1, y1), for solids and for the lab to draw. */
export function pieceBox(p: Placement): [number, number, number, number] | null {
  const s = pieceSize(p.id)
  if (!s) return null
  return [p.x - s.w / 2, p.y - (p.lift ?? 0) - s.h, p.x + s.w / 2, p.y - (p.lift ?? 0)]
}

/** Solid rectangles in tiles (inclusive) for the pieces on a floor, in the room's own rows. */
export function furnitureSolids(floor: Placement["floor"], tile = 16): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = []
  for (const p of PLACEMENTS) {
    const s = pieceSize(p.id)
    if (p.floor !== floor || p.wall || p.flat || p.solid === false || !s) continue
    const depth = p.solid || 10
    const half = p.span ?? Math.max(5, s.w * 0.4)
    out.push([Math.floor((p.x - half) / tile), Math.floor((p.y - depth) / tile), Math.floor((p.x + half - 1) / tile), Math.floor((p.y - 1) / tile)])
  }
  return out
}
