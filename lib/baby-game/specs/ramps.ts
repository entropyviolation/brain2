/**
 * lib/baby-game/specs/ramps.ts — The named color ramps a spec may use
 *
 * A spec never names a color, only a ramp and a step on it (0 is the lightest). The ramps are the game's own colors:
 * every letter of `sprites.ts` `SPRITE_PALETTE` (which extends `PIXEL_PALETTE`) sits on one of them, plus the wood, stone
 * and cobalt steps `propart.ts` paints props with. Yellow is its own ramp, for subjects that are yellow; there is no gold.
 * Hex strings, not letters, so the table reads the same outside TypeScript.
 */

export const RAMPS = {
  paper: ["#ffffff", "#f3eef6"],
  silver: ["#f3eef6", "#d6dde2", "#cdd6dd", "#9aa6b0", "#6c7782", "#4a5560"],
  cream: ["#fbf1e6", "#e3cdb6"],
  ash: ["#c9c1cc", "#8a8294", "#4b4456", "#2e2933"],
  apricot: ["#f6c9a0", "#e8915a", "#b5603a"],
  fawn: ["#d9a066", "#a8683c", "#5f3f31"],
  wood: ["#c48e74", "#8a5a44", "#6b4630", "#5a3628", "#4e3224"],
  pink: ["#ffb3d1", "#f0609a", "#b8326e"],
  red: ["#ff9a8a", "#e04848"],
  leaf: ["#b6f0a4", "#4fbf5a", "#2a7a3e"],
  sky: ["#b4e2ff", "#4e9ce8", "#2a5aa8"],
  cobalt: ["#6a8ff0", "#2f5fe0", "#1f3fa0"],
  lilac: ["#e2ceff", "#9a72e0", "#5c3a9e"],
  teal: ["#a8f4e6", "#30b8a8", "#1a7068"],
  /** Duckling down (`sprites.ts` i, I, J). Only where the subject is yellow; never for metal, which is silver. */
  yellow: ["#fcefa8", "#f2cf5b", "#d39a3a"],
  plum: ["#2b1d2e"],
} as const satisfies Record<string, readonly string[]>

export type RampName = keyof typeof RAMPS
export const RAMP_NAMES = Object.keys(RAMPS) as RampName[]
