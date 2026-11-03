/**
 * lib/baby-game/rhizome.ts — Rhizome, the market town, drawn as a plan
 *
 * One string per row, one character per tile, laid over the zone by `world.ts` after the ground is carved.
 * `.` keeps the ground, `=` path, `W` wall, `R` roof, `D` door, `s` sand, `~` water, `B` bridge.
 * Buildings are three tiles tall (roof, wall, wall with the door in the middle) like the hayloft.
 * Left to right, top to bottom: the bakery and post office north of Long Street, the plaza in the middle, the mill and
 * workshop south of it, an alley, a spine that runs down to the sand, and a pier into the water where the ferry will dock.
 * Pure data. Nodes and props for the town are appended to the lists in `world.ts`.
 */

export const RHIZOME_ORIGIN = { x: 84, y: 36 }

export const RHIZOME_PLAN: readonly string[] = [
  "..RRRRR...........RRRRR..", // y36
  "..WWWWW..=======..WWWWW..",
  "..WWDWW..=======..WWDWW..",
  "=========================", // y39 sidewalk
  "=========================", // Long Street
  "=========================",
  ".........=======.........", // y42
  ".RRRRR...=======..RRRRR..",
  ".WWWWW...=======..WWWWW..",
  ".WWDWW...=======..WWDWW..",
  "=========================", // y46 alley
  "...........==............",
  "...........==............",
  "...........==............",
  "...........==............",
  "sssssssssss==ssssssssssss", // y51
  "~~~~~~~~~~~BB~~~~~~~~~~~~",
  "~~~~~~~~~~~BB~~~~~~~~~~~~",
  "~~~~~~~~~~~BB~~~~~~~~~~~~",
  "~~~~~~~~~~~BB~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~", // y58
]
