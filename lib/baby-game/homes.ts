/**
 * lib/baby-game/homes.ts — Where every friend lives
 *
 * Each of the twenty-four has one home: a single solid tile in their own zone, a few steps from where they spend the
 * day, with its door on the tile below. Friends walk home in the hour before bed and sleep on their doorstep
 * (`sim.ts`); you can knock (`components/BabyGame/BabyGame.tsx`). The kind follows the animal: birds nest, diggers
 * burrow, the big hunters keep a den, climbers a tree hollow, swimmers a lodge, the ice friends an igloo.
 * `components/BabyGame/homeart.ts` paints each kind. Data only, so a generated cast can bring its own homes.
 */

export type HomeKind = "nest" | "burrow" | "den" | "hollow" | "lodge" | "hutch" | "stall" | "igloo" | "flat"

export type Home = {
  kind: HomeKind
  /** What the friend calls it. */
  name: string
  /** The home's own tile; its door is the tile below. */
  x: number
  y: number
  /** The block of flats this is a unit of (a key of `BLOCKS`); the friends of one block share one building. */
  block?: string
}

/** A building several friends share: stacked modules, one front door per friend along the ground floor, two tiles apart. */
export type Block = { name: string; x: number; y: number; tenants: string[] }

export const HOME_NOUN: Record<HomeKind, string> = {
  nest: "nest",
  burrow: "burrow",
  den: "den",
  hollow: "tree hollow",
  lodge: "lodge",
  hutch: "little house",
  stall: "stall",
  igloo: "igloo",
  flat: "flat",
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

/** Spread out for the bigger houses (about four tiles wide): in the friend's zone, off every node, prop and path. A friend listed in `BLOCKS` lives there instead. */
const PLACED: Record<string, [number, number, string?]> = {
  chick: [6, 6, "The Eggcup"],
  bunny: [13, 5, "Snooze Hole"],
  gosling: [13, 9, "The Guardhouse Nest"],
  fawn: [13, 10, "The Fern Hollow"],
  duckling: [35, 22, "Puddle Nest"],
  otter: [40, 22, "Skipstone Lodge"],
  capybara: [36, 23, "The Still Lodge"],
  penguin: [42, 5, "The Perfect Igloo"],
  blackduck: [43, 23, "The Dark Reed Nest"],
  seal: [45, 22, "The Round Igloo"],
  mouse: [4, 30, "Crumb Cellar"],
  hedgehog: [6, 30, "The Soft Burrow"],
  kitten: [8, 30, "The Purr Lab"],
  possum: [4, 36, "Eldest Hollow"],
  possum2: [6, 36, "Nightshift Hollow"],
  possum3: [8, 36, "Smallest Hollow"],
  fox: [14, 31, "The Kind Den"],
  puppy: [37, 36, "The Very Good House"],
  foal: [39, 36, "The Fast Stall"],
  cub: [41, 36, "The Gentle Den"],
  skunk: [19, 4, "The Perfumery"],
  crow: [29, 4, "The Shiny Nest"],
  owl: [28, 10, "The Song Archive"],
  wolf: [27, 9, "The Spark Den"],
}

/** Friends who share a building. Tenants stand two tiles apart on the block's row, left to right. */
export const BLOCKS: Record<string, Block> = {
  terrace: { name: "Orchard Terrace", x: 6, y: 7, tenants: ["chick", "bunny", "fawn"] },
  puddle: { name: "Puddle Flats", x: 41, y: 12, tenants: ["duckling", "otter", "seal"] },
  crumb: { name: "Crumb Court", x: 5, y: 30, tenants: ["mouse", "hedgehog", "kitten"] },
  possums: { name: "Possum Stack", x: 5, y: 36, tenants: ["possum", "possum2", "possum3"] },
  barn: { name: "Barn Flats", x: 39, y: 36, tenants: ["puppy", "foal", "cub"] },
  thistle: { name: "Thistle Terrace", x: 24, y: 5, tenants: ["skunk", "crow", "wolf"] },
}

export const HOMES: Record<string, Home> = {
  ...Object.fromEntries(
    Object.entries(PLACED).map(([id, [x, y, name]]) => [id, { kind: homeKindFor(id), name: name ?? `The ${HOME_NOUN[homeKindFor(id)]}`, x, y }]),
  ),
}
for (const [bid, blk] of Object.entries(BLOCKS)) {
  blk.tenants.forEach((id, i) => {
    const own = PLACED[id]
    HOMES[id] = { kind: "flat", name: own?.[2] ?? `${blk.name} ${i + 1}`, x: blk.x + (i - (blk.tenants.length - 1) / 2) * 2, y: blk.y, block: bid }
  })
}

export const homeOf = (id: string): Home | undefined => HOMES[id]

/** The tile a friend stands on when they are home. */
export const homeDoor = (h: Home): [number, number] => [h.x, h.y + 1]
