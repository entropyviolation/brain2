/**
 * lib/baby-game/upscale.ts — a sprite grid at twice the size
 *
 * Scale2x (the EPX rule, as in `components/BabyGame/hires.ts`) on letter grids: every cell becomes 2×2, and a corner is
 * rounded off only where two neighbours agree. Curves and diagonals come out smooth, outlines stay one cell of the new
 * grid, and a lone pixel (a glint, a fleck) stays a 2×2 block. Walk and idle frames are made at 32 and upscaled after, so
 * their rules stay tuned to the small grid. Pure.
 */

export function upscaleGrid(grid: readonly string[]): string[] {
  const h = grid.length
  const w = grid[0]?.length ?? 0
  const at = (x: number, y: number) => grid[Math.min(h - 1, Math.max(0, y))]![Math.min(w - 1, Math.max(0, x))]!
  const out: string[] = []
  for (let y = 0; y < h; y++) {
    let top = ""
    let bottom = ""
    for (let x = 0; x < w; x++) {
      const P = at(x, y)
      const A = at(x, y - 1)
      const B = at(x + 1, y)
      const C = at(x - 1, y)
      const D = at(x, y + 1)
      top += C === A && C !== D && A !== B ? A : P
      top += A === B && A !== C && B !== D ? B : P
      bottom += D === C && D !== B && C !== A ? C : P
      bottom += B === D && B !== A && D !== C ? D : P
    }
    out.push(top, bottom)
  }
  return out
}
