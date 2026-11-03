/**
 * Baby rock hyrax (dassie pup): the companion that follows the player.
 * Tiny hand-authored sprites on the shared 32x32 canvas (`.` clear, `k` plum outline, feet on row 29), drawn as short
 * rows and centred by `place`. About a third of a capybara pup: a round seated loaf, blunt dark nose, small ears, dark
 * back fading to a cream chest. `side` faces RIGHT. `front` is seated and head-on. `back` is the front with its face
 * turned to coat. Light comes from the top left. No yellow.
 */
const SIZE = 32

/** Centre short rows on the canvas, bottom outline on row 30, so the pup stands on the same line as every animal. */
function place(rows: string[], left: number): string[] {
  const top = 31 - rows.length
  return Array.from({ length: SIZE }, (_, y) => {
    const row = rows[y - top]
    return row ? ".".repeat(left) + row + ".".repeat(SIZE - left - row.length) : ".".repeat(SIZE)
  })
}

const HYRAX_FRONT_AND_SIDE = {
  side: place([
    ".......kjk....",
    ".......kjtkkk.",
    "..kkkkkkttffkk",
    ".kooooooFFyFFk",
    ".kooooooFFFFzk",
    ".kfoooooFFFeek",
    ".kofffffffeek.",
    ".kffffffeeeek.",
    ".kfFfffffeeek.",
    ".kjjjkffkjjjk.",
    ".kkkkkkkkkkkk.",
  ], 9),
  front: place([
    ".kk.....kk.",
    "kjtkkkkktjk",
    "kfffffffffk",
    "kfyfffffyfk",
    "kffffzffffk",
    "kffeeeeeffk",
    "kfeeeeeeefk",
    "kfoeeeeeofk",
    "kFfeeeeefFk",
    "kjjkeeekjjk",
    ".kkkkkkkkk.",
  ], 10),
}

/** From behind the pup is the front with its face gone: eyes and nose turn to coat, the cream chest to rump fur. */
const FACE_TO_COAT: Record<string, string> = { y: "t", z: "t", e: "f" }
const back = HYRAX_FRONT_AND_SIDE.front.map((row) => row.replace(/[yze]/g, (ch) => FACE_TO_COAT[ch]!))

export const HYRAX_GRIDS: { side: string[]; front: string[]; back: string[] } = { ...HYRAX_FRONT_AND_SIDE, back }
