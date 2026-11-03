/**
 * lib/baby-game/homes.ts — Where every friend lives
 *
 * Each of the twenty-four has one home: a single solid tile in their own zone, a few steps from where they spend the
 * day, with its door on the tile below. Friends walk home in the hour before bed and sleep on their doorstep
 * (`sim.ts`); you can knock (`components/BabyGame/BabyGame.tsx`). The kind follows the animal: birds nest, diggers
 * burrow, the big hunters keep a den, climbers a tree hollow, swimmers a lodge, the ice friends an igloo.
 * `components/BabyGame/homeart.ts` paints each kind. Data only, so a generated cast can bring its own homes.
 */

export type HomeKind = "nest" | "burrow" | "den" | "hollow" | "lodge" | "hutch" | "stall" | "igloo"

export type Home = {
  kind: HomeKind
  /** What the friend calls it. */
  name: string
  /** The home's own tile; its door is the tile below. */
  x: number
  y: number
}

export const HOME_NOUN: Record<HomeKind, string> = {
  nest: "nest",
  burrow: "burrow",
  den: "den",
  hollow: "tree hollow",
  lodge: "lodge",
  hutch: "little house",
  stall: "stall",
  igloo: "igloo",
}

/** The kind of home each species keeps. A species not listed gets a hutch. */
export const SPECIES_HOME: Record<string, HomeKind> = {
  chick: "nest", gosling: "nest", duckling: "nest", blackduck: "nest", crow: "nest",
  bunny: "burrow", mouse: "burrow", hedgehog: "burrow", skunk: "burrow",
  fox: "den", wolf: "den", cub: "den",
  owl: "hollow", fawn: "hollow", possum: "hollow", possum2: "hollow", possum3: "hollow",
  otter: "lodge", capybara: "lodge",
  puppy: "hutch", kitten: "hutch",
  foal: "stall",
  penguin: "igloo", seal: "igloo",
}

/** Homes are drawn this many times bigger than their tile: building size, three tiles wide. */
export const HOME_SCALE = 3

export const homeKindFor = (species: string): HomeKind => SPECIES_HOME[species] ?? "hutch"

/** Hand-placed for Valdivia (checked by `homes.test.ts`): in the friend's zone, off every node, prop and path. */
const PLACED: Record<string, [number, number, string?]> = {
  chick: [7, 6, "The Eggcup"],
  bunny: [11, 5, "Snooze Hole"],
  gosling: [14, 11, "The Guardhouse Nest"],
  fawn: [11, 7, "The Fern Hollow"],
  duckling: [39, 22, "Puddle Nest"],
  otter: [41, 22, "Skipstone Lodge"],
  capybara: [38, 12, "The Still Lodge"],
  penguin: [42, 5, "The Perfect Igloo"],
  blackduck: [44, 12, "The Dark Reed Nest"],
  seal: [44, 23, "The Round Igloo"],
  mouse: [9, 28, "Crumb Cellar"],
  hedgehog: [12, 27, "The Soft Burrow"],
  kitten: [8, 31, "The Purr Lab"],
  possum: [4, 29, "Eldest Hollow"],
  possum2: [11, 29, "Nightshift Hollow"],
  possum3: [14, 27, "Smallest Hollow"],
  fox: [11, 36, "The Kind Den"],
  puppy: [35, 29, "The Very Good House"],
  foal: [37, 34, "The Fast Stall"],
  cub: [39, 34, "The Gentle Den"],
  skunk: [18, 4, "The Perfumery"],
  crow: [28, 4, "The Shiny Nest"],
  owl: [22, 6, "The Song Archive"],
  wolf: [26, 8, "The Spark Den"],
}

export const HOMES: Record<string, Home> = Object.fromEntries(
  Object.entries(PLACED).map(([id, [x, y, name]]) => [id, { kind: homeKindFor(id), name: name ?? `The ${HOME_NOUN[homeKindFor(id)]}`, x, y }]),
)

export const homeOf = (id: string): Home | undefined => HOMES[id]

/** The tile a friend stands on when they are home. */
export const homeDoor = (h: Home): [number, number] => [h.x, h.y + 1]
