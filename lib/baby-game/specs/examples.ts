/**
 * lib/baby-game/specs/examples.ts — Hand-made Valdivia props, residents, blocks and tools, written as specs
 *
 * Proof the grammar carries the real world, and the few-shot examples a Prop or Cast BIMBY prompt will show. Parts
 * follow the painters in `components/BabyGame/art.ts` and `propart.ts` closely but not pixel for pixel; uses follow
 * `props.ts` `USES`; residents follow `cast.ts` and the `sprites.ts` builder knobs. Plain data, so `packs/valdivia/`
 * can take it over as JSON. The tests check every example against the live game data. Blocks follow `world.ts` `T.*`
 * and `NodeKind` with the yields in `engine.gather`. The game has no tools yet, so `HAND_TOOLS` are the first ones: the
 * few-shot examples a Tool BIMBY will show, and the shape a real tool will take.
 */

import type { BlockSpec } from "./block"
import type { CastSpec } from "./cast"
import type { PropSpec } from "./prop"
import type { ToolSpec } from "./tool"

export const VALDIVIA_PROPS: PropSpec[] = [
  {
    id: "mailbox", name: "Mailbox", size: { w: 1, h: 1 }, solid: true, shadow: true,
    parts: [
      { shape: "rect", at: [7, 7, 2, 8], ramp: "wood", step: 1 },
      { shape: "rect", at: [7, 7, 1, 8], ramp: "wood", step: 0 },
      { shape: "rect", at: [3, 2, 10, 6], ramp: "sky", step: 1 },
      { shape: "rect", at: [3, 1, 10, 2], ramp: "cobalt", step: 0 },
      { shape: "rect", at: [3, 7, 10, 1], ramp: "sky", step: 2 },
      { shape: "rect", at: [6, 4, 2, 2], ramp: "pink", step: 0 },
      { shape: "rect", at: [4, 0, 3, 2], ramp: "red", step: 1, anim: "swing" },
    ],
    use: { verb: "give", label: "Check the mail", minutes: 5, buttons: 2, extra: { item: "postcard", chance: 0.35 } },
  },
  {
    id: "well", name: "Well", size: { w: 1, h: 2 }, solid: true, shadow: true,
    parts: [
      { shape: "tri", at: [8, 6, 2, 11, 14, 11], ramp: "apricot", step: 1 },
      { shape: "rect", at: [1, 11, 14, 1], ramp: "apricot", step: 2 },
      { shape: "rect", at: [2, 12, 2, 12], ramp: "wood", step: 1 },
      { shape: "rect", at: [12, 12, 2, 12], ramp: "wood", step: 1 },
      { shape: "line", at: [8, 14, 8, 19], ramp: "cream", step: 1 },
      { shape: "rect", at: [7, 20, 3, 3], ramp: "wood", step: 1, anim: "bob" },
      { shape: "rect", at: [2, 24, 12, 6], ramp: "silver", step: 3 },
      { shape: "rect", at: [1, 22, 14, 2], ramp: "silver", step: 2 },
      { shape: "rect", at: [3, 23, 10, 1], ramp: "sky", step: 2 },
      { shape: "rect", at: [12, 28, 2, 2], ramp: "leaf", step: 1 },
    ],
    use: { verb: "heal", label: "Drink cold water", minutes: 5, amount: 12, extra: { item: "dewgem", chance: 0.1 } },
  },
  {
    id: "signpost", name: "Signpost", size: { w: 1, h: 1 }, solid: true, shadow: true,
    parts: [
      { shape: "rect", at: [7, 1, 2, 14], ramp: "wood", step: 2 },
      { shape: "rect", at: [2, 2, 11, 4], ramp: "wood", step: 0 },
      { shape: "tri", at: [13, 2, 13, 5, 15, 3], ramp: "wood", step: 0 },
      { shape: "rect", at: [3, 8, 10, 4], ramp: "wood", step: 0 },
      { shape: "tri", at: [3, 8, 3, 11, 1, 9], ramp: "wood", step: 0 },
      { shape: "line", at: [4, 3, 9, 3], ramp: "wood", step: 2 },
      { shape: "line", at: [6, 9, 10, 9], ramp: "wood", step: 2 },
      { shape: "rect", at: [5, 14, 6, 1], ramp: "leaf", step: 1 },
    ],
    use: { verb: "reveal", label: "Read the signpost", every: "any", minutes: 0, shows: ["weather", "crops", "festival"] },
  },
  {
    id: "prism", name: "Prism", size: { w: 1, h: 1 }, solid: true, shadow: true,
    parts: [
      { shape: "rect", at: [4, 11, 8, 3], ramp: "silver", step: 3 },
      { shape: "rect", at: [4, 11, 8, 1], ramp: "silver", step: 2 },
      { shape: "tri", at: [8, 2, 3, 10, 13, 10], ramp: "sky", step: 0 },
      { shape: "line", at: [0, 7, 4, 7], ramp: "paper", step: 0 },
      { shape: "rect", at: [10, 6, 6, 1], ramp: "pink", step: 0 },
      { shape: "rect", at: [10, 7, 6, 1], ramp: "lilac", step: 0 },
      { shape: "rect", at: [10, 8, 6, 1], ramp: "cobalt", step: 0 },
      { shape: "rect", at: [10, 9, 6, 1], ramp: "teal", step: 0 },
      { shape: "rect", at: [10, 10, 6, 1], ramp: "leaf", step: 0 },
      { shape: "dots", at: [13, 7], ramp: "paper", step: 0, anim: "twinkle" },
    ],
    use: { verb: "give", label: "Hold the prism to the light", minutes: 10, needs: "daylight", item: "rainbit" },
  },
  {
    id: "library", name: "Little library", size: { w: 1, h: 1 }, solid: true, shadow: true,
    parts: [
      { shape: "rect", at: [7, 11, 2, 4], ramp: "wood", step: 1 },
      { shape: "rect", at: [3, 4, 10, 8], ramp: "cobalt", step: 1 },
      { shape: "rect", at: [2, 2, 12, 2], ramp: "wood", step: 1 },
      { shape: "rect", at: [1, 3, 14, 1], ramp: "wood", step: 0 },
      { shape: "rect", at: [5, 5, 6, 5], ramp: "sky", step: 0 },
      { shape: "rect", at: [5, 6, 1, 4], ramp: "red", step: 1 },
      { shape: "rect", at: [6, 7, 1, 3], ramp: "leaf", step: 1 },
      { shape: "rect", at: [7, 6, 1, 4], ramp: "lilac", step: 0 },
      { shape: "rect", at: [8, 7, 1, 3], ramp: "paper", step: 0 },
      { shape: "rect", at: [5, 10, 6, 1], ramp: "cobalt", step: 2 },
    ],
    use: { verb: "teach", label: "Read in the little library", minutes: 30, skill: "weakest", amount: 2 },
  },
  {
    id: "thrift", name: "Thrift rack", size: { w: 1, h: 1 }, solid: true, shadow: false,
    parts: [
      { shape: "rect", at: [1, 2, 1, 12], ramp: "silver", step: 3 },
      { shape: "rect", at: [14, 2, 1, 12], ramp: "silver", step: 3 },
      { shape: "rect", at: [1, 2, 14, 1], ramp: "silver", step: 2 },
      { shape: "rect", at: [2, 4, 3, 9], ramp: "pink", step: 2 },
      { shape: "rect", at: [5, 4, 3, 8], ramp: "lilac", step: 0 },
      { shape: "rect", at: [8, 4, 3, 9], ramp: "teal", step: 0 },
      { shape: "rect", at: [11, 4, 1, 8], ramp: "cobalt", step: 0 },
      { shape: "rect", at: [12, 4, 2, 9], ramp: "pink", step: 0 },
    ],
    use: { verb: "trade", label: "Browse the thrift rack (6 gems)", every: "any", minutes: 15, cost: { buttons: 6 }, pool: "trinket" },
  },
  {
    id: "fireworks", name: "Fireworks crate", size: { w: 1, h: 1 }, solid: true, shadow: true,
    parts: [
      { shape: "rect", at: [2, 8, 12, 6], ramp: "wood", step: 1 },
      { shape: "rect", at: [2, 8, 12, 1], ramp: "wood", step: 0 },
      { shape: "rect", at: [2, 11, 12, 1], ramp: "wood", step: 4 },
      { shape: "rect", at: [4, 3, 2, 6], ramp: "red", step: 1 },
      { shape: "rect", at: [7, 1, 2, 6], ramp: "cobalt", step: 1 },
      { shape: "rect", at: [10, 4, 2, 6], ramp: "lilac", step: 0 },
      { shape: "dots", at: [4, 1, 7, 0, 10, 2], ramp: "paper", step: 0, anim: "twinkle", when: "night" },
    ],
    use: { verb: "cheer", label: "Light a firework (4 gems)", minutes: 15, needs: "night", cost: { buttons: 4 }, amount: 2 },
  },
  {
    id: "clock", name: "Clock", size: { w: 1, h: 1 }, solid: true, shadow: true,
    parts: [
      { shape: "rect", at: [7, 9, 2, 7], ramp: "silver", step: 5 },
      { shape: "rect", at: [2, 0, 12, 12], ramp: "cobalt", step: 1 },
      { shape: "ellipse", at: [3, 1, 10, 9], ramp: "cream", step: 0 },
      { shape: "rect", at: [2, 10, 12, 2], ramp: "cobalt", step: 2 },
      { shape: "dots", at: [7, 2, 7, 9, 3, 5, 12, 5], ramp: "wood", step: 4 },
      { shape: "line", at: [8, 6, 8, 2], ramp: "wood", step: 4, anim: "spin" },
      { shape: "line", at: [8, 6, 10, 6], ramp: "red", step: 1, anim: "spin" },
    ],
    use: { verb: "rewind", label: "Set the clock back an hour", every: "week", minutes: 0, amount: 60 },
  },
  {
    id: "sprinkler", name: "Sprinkler", size: { w: 1, h: 1 }, solid: false, shadow: false,
    parts: [
      { shape: "ellipse", at: [1, 11, 14, 4], ramp: "sky", step: 0 },
      { shape: "rect", at: [7, 11, 2, 3], ramp: "silver", step: 5 },
      { shape: "rect", at: [6, 10, 4, 2], ramp: "cobalt", step: 1 },
      { shape: "dots", at: [4, 6, 6, 4, 8, 3, 10, 4, 12, 6], ramp: "sky", step: 0, anim: "swing" },
    ],
    use: { verb: "grow", label: "Run through the sprinkler", minutes: 15, effect: "water" },
  },
  {
    id: "beehive", name: "Beehive", size: { w: 1, h: 1 }, solid: true, shadow: true,
    parts: [
      { shape: "rect", at: [7, 10, 2, 5], ramp: "wood", step: 2 },
      { shape: "ellipse", at: [3, 2, 10, 9], ramp: "apricot", step: 0 },
      { shape: "line", at: [4, 5, 11, 5], ramp: "apricot", step: 1 },
      { shape: "line", at: [4, 8, 11, 8], ramp: "apricot", step: 1 },
      { shape: "rect", at: [7, 8, 2, 2], ramp: "plum", step: 0 },
      { shape: "dots", at: [2, 2, 13, 4, 14, 1], ramp: "ash", step: 3, anim: "bob" },
    ],
    use: { verb: "give", label: "Take some honey", minutes: 10, item: "honey", qty: 1, cost: { item: "kindling" }, risk: { energy: 4, chance: 0.3 } },
  },
  {
    id: "blanket", name: "Picnic blanket", size: { w: 1, h: 1 }, solid: false, shadow: false,
    parts: [
      { shape: "rect", at: [1, 6, 14, 8], ramp: "red", step: 0 },
      { shape: "rect", at: [1, 6, 2, 2], ramp: "paper", step: 0 },
      { shape: "rect", at: [5, 6, 2, 2], ramp: "paper", step: 0 },
      { shape: "rect", at: [9, 6, 2, 2], ramp: "paper", step: 0 },
      { shape: "rect", at: [3, 10, 2, 2], ramp: "paper", step: 0 },
      { shape: "rect", at: [7, 10, 2, 2], ramp: "paper", step: 0 },
      { shape: "rect", at: [11, 4, 3, 3], ramp: "wood", step: 0 },
    ],
    use: { verb: "feast", label: "Have a picnic", every: "day", minutes: 30, factor: 1.5 },
  },
  {
    id: "collage", name: "Collage desk", size: { w: 1, h: 1 }, solid: true, shadow: true,
    parts: [
      { shape: "rect", at: [1, 9, 14, 3], ramp: "wood", step: 1 },
      { shape: "rect", at: [2, 12, 2, 3], ramp: "wood", step: 2 },
      { shape: "rect", at: [12, 12, 2, 3], ramp: "wood", step: 2 },
      { shape: "rect", at: [2, 5, 5, 5], ramp: "pink", step: 0 },
      { shape: "rect", at: [6, 3, 4, 6], ramp: "cobalt", step: 0 },
      { shape: "rect", at: [9, 6, 5, 4], ramp: "teal", step: 0 },
      { shape: "rect", at: [7, 5, 2, 2], ramp: "paper", step: 0 },
    ],
    use: { verb: "open", label: "Make a collage", screen: "bench" },
  },
]

export const VALDIVIA_CAST: CastSpec[] = [
  {
    id: "chick", name: "Ada", title: "Hatchling of the orchard",
    body: { template: "fowl", size: 0.7, ears: "none", tail: "short", snout: "none", legs: "short", mark: "none" },
    palette: { fur: "apricot", belly: "apricot", accent: "apricot" },
    accessory: { kind: "eggshell", ramp: "cream" },
    tone: "playful", cadence: "chatty",
    want: { items: ["jam"], gives: "hatchling-bell", hearts: 3, condition: "morning" },
    likes: ["sweet", "soft"], hates: ["fishy"],
    habits: { social: true },
  },
  {
    id: "bunny", name: "Pilgrim", title: "Oversleeper of the burrows",
    body: { template: "quad", size: 0.95, ears: "long", tail: "short", snout: "none", legs: "mid", mark: "none" },
    palette: { fur: "cream", belly: "cream", accent: "pink" },
    accessory: { kind: "none" },
    tone: "playful", cadence: "eager",
    want: { items: ["hatchling-bell", "crown"], gives: "dewdrop-locket", hearts: 3, condition: "played" },
    likes: ["green", "sweet"], hates: ["fishy"],
    habits: { social: true },
  },
  {
    id: "fawn", name: "Daria", title: "Keeper of quiet things",
    body: { template: "quad", size: 1.12, ears: "leaf", tail: "short", snout: "long", legs: "long", mark: "spots" },
    palette: { fur: "fawn", belly: "cream", accent: "pink" },
    accessory: { kind: "ribbon", ramp: "wood" },
    tone: "gentle", cadence: "quiet",
    want: { items: ["tin-key", "crown"], gives: "lamp-wick", hearts: 5, condition: "sneak" },
    likes: ["soft", "cozy"], hates: ["crunchy"],
    habits: { social: false },
  },
  {
    id: "duckling", name: "Mathilda", title: "Puddle enthusiast",
    body: { template: "fowl", size: 0.82, ears: "none", tail: "short", snout: "none", legs: "short", mark: "none" },
    palette: { fur: "cream", belly: "cream", accent: "apricot" },
    accessory: { kind: "scarf", ramp: "teal" },
    tone: "gentle", cadence: "occasional",
    want: { items: ["chime"], gives: "puddle-charm", hearts: 3, condition: "rain" },
    likes: ["watery", "musical"], hates: ["crunchy"],
    habits: { social: true, rainLover: true },
  },
  {
    id: "skunk", name: "Mugler", title: "Misunderstood perfumer",
    body: { template: "quad", size: 1, ears: "round", tail: "bush", snout: "short", legs: "mid", mark: "stripe" },
    palette: { fur: "ash", belly: "ash", accent: "paper" },
    accessory: { kind: "none" },
    tone: "direct", cadence: "occasional",
    want: { items: ["brooch", "stack"], gives: "moss-perfume", hearts: 5, condition: "alone" },
    likes: ["green", "cozy"], hates: ["sweet"],
    habits: { social: false },
  },
  {
    id: "crow", name: "Gaultier", title: "Collector of the shiny",
    body: { template: "fowl", size: 0.98, ears: "none", tail: "thin", snout: "long", legs: "short", mark: "none" },
    palette: { fur: "ash", belly: "ash", accent: "silver" },
    accessory: { kind: "none" },
    tone: "direct", cadence: "occasional",
    want: { items: ["moss-perfume", "brooch"], gives: "black-pearl", hearts: 6, condition: "fed" },
    likes: ["shiny", "musical"], hates: ["soft"],
    habits: { social: false },
  },
  {
    id: "wolf", name: "Vonnegut", title: "Keeper of the last spark",
    body: { template: "quad", size: 1.1, ears: "point", tail: "bush", snout: "long", legs: "long", mark: "bib" },
    palette: { fur: "ash", belly: "cream", accent: "pink" },
    accessory: { kind: "none" },
    tone: "coach", cadence: "occasional",
    want: { items: ["song-page", "lamp"], gives: "lamp-spark", hearts: 8, condition: "alone" },
    likes: ["earthy", "cozy"], hates: ["shiny"],
    habits: { social: false, sleeps: [6, 14] },
  },
]

export const VALDIVIA_BLOCKS: BlockSpec[] = [
  {
    id: "grass", name: "Grass", layer: "ground", material: "grass", walkable: true, hardness: 0,
    look: { base: { ramp: "leaf", step: 1 }, pattern: "tuft", accent: { ramp: "leaf", step: 0 }, density: 0.2 },
    drops: [], regrow: "never", sound: "rustle",
  },
  {
    id: "soil", name: "Tilled soil", layer: "ground", material: "soil", walkable: true, hardness: 0,
    look: { base: { ramp: "wood", step: 2 }, pattern: "stripe", accent: { ramp: "wood", step: 3 }, density: 0.3 },
    drops: [], regrow: "never", sound: "soft",
  },
  {
    id: "sand", name: "Sand", layer: "ground", material: "sand", walkable: true, hardness: 0,
    look: { base: { ramp: "cream", step: 1 }, pattern: "speck", accent: { ramp: "fawn", step: 0 }, density: 0.1 },
    drops: [], regrow: "never", sound: "crunch",
  },
  {
    id: "water", name: "Still water", layer: "ground", material: "water", walkable: false, hardness: 0,
    look: { base: { ramp: "sky", step: 1 }, pattern: "wave", accent: { ramp: "sky", step: 0 }, density: 0.15 },
    drops: [], regrow: "never", sound: "splash",
  },
  {
    id: "rock", name: "Boulder", layer: "ground", material: "stone", walkable: false, hardness: 3,
    look: { base: { ramp: "silver", step: 3 }, pattern: "cell", accent: { ramp: "silver", step: 4 }, density: 0.25 },
    drops: [{ item: "pebble", min: 2, max: 4 }], regrow: "never", becomes: "grass", sound: "clink",
  },
  {
    id: "berry", name: "Berry bush", layer: "node", material: "plant", walkable: false, hardness: 0,
    parts: [
      { shape: "ellipse", at: [2, 4, 12, 10], ramp: "leaf", step: 2 },
      { shape: "ellipse", at: [3, 3, 10, 9], ramp: "leaf", step: 1 },
      { shape: "dots", at: [5, 6, 9, 5, 11, 8, 6, 10, 9, 9], ramp: "pink", step: 1 },
    ],
    drops: [{ item: "berry", min: 2, max: 3 }], regrow: "day", becomes: "grass", sound: "rustle",
  },
  {
    id: "reed", name: "Reeds", layer: "node", material: "plant", walkable: false, hardness: 0,
    parts: [
      { shape: "line", at: [5, 15, 4, 3], ramp: "leaf", step: 2 },
      { shape: "line", at: [8, 15, 8, 1], ramp: "leaf", step: 1 },
      { shape: "line", at: [11, 15, 12, 4], ramp: "leaf", step: 2 },
      { shape: "rect", at: [7, 1, 2, 4], ramp: "wood", step: 1, anim: "swing" },
    ],
    drops: [{ item: "reed", min: 2, max: 2 }], regrow: "day", becomes: "grass", sound: "rustle",
  },
  {
    id: "pebble", name: "Pebble", layer: "node", material: "stone", walkable: true, hardness: 1,
    parts: [
      { shape: "ellipse", at: [5, 9, 6, 4], ramp: "silver", step: 3 },
      { shape: "rect", at: [6, 9, 2, 1], ramp: "silver", step: 1 },
    ],
    drops: [{ item: "pebble", min: 1, max: 2 }], regrow: "day", sound: "clink",
  },
  {
    id: "dig", name: "Dig spot", layer: "node", material: "soil", walkable: true, hardness: 1,
    parts: [
      { shape: "ellipse", at: [4, 9, 8, 4], ramp: "wood", step: 3 },
      { shape: "dots", at: [5, 8, 9, 8, 11, 10], ramp: "wood", step: 1, anim: "twinkle" },
    ],
    drops: [
      { item: "button", min: 1, max: 2, chance: 0.5 },
      { item: "pebble", min: 1, max: 1, chance: 0.25 },
      { item: "mushroom", min: 1, max: 1, chance: 0.17 },
      { item: "acorn", min: 1, max: 1, chance: 0.08 },
    ],
    regrow: "day", sound: "soft",
  },
]

export const HAND_TOOLS: ToolSpec[] = [
  {
    id: "watering-can", name: "Watering Can", blurb: "Silver, dented, and sure that everything is thirsty.",
    parts: [
      { shape: "rect", at: [3, 6, 8, 7], ramp: "silver", step: 2 },
      { shape: "rect", at: [3, 6, 8, 1], ramp: "silver", step: 1 },
      { shape: "line", at: [11, 9, 14, 6], ramp: "silver", step: 3 },
      { shape: "rect", at: [5, 3, 4, 1], ramp: "silver", step: 4 },
      { shape: "dots", at: [14, 5, 15, 7], ramp: "sky", step: 0, anim: "twinkle" },
    ],
    grip: [7, 3],
    motion: { kind: "pour", speed: "slow", area: "line" },
    effects: [{ material: "soil", does: "water", power: 1 }],
    energy: 1, skill: "farming", recipe: ["pebble", "shell"],
  },
  {
    id: "trowel", name: "Trowel", blurb: "Small enough to be polite to the worms.",
    parts: [
      { shape: "rect", at: [7, 1, 2, 7], ramp: "wood", step: 1 },
      { shape: "rect", at: [6, 8, 4, 1], ramp: "silver", step: 4 },
      { shape: "tri", at: [5, 9, 10, 9, 7, 15], ramp: "silver", step: 2 },
    ],
    grip: [7, 3],
    motion: { kind: "dig", speed: "normal", area: "one" },
    effects: [
      { block: "grass", does: "turn", power: 1, into: "soil" },
      { block: "dig", does: "harvest", power: 1 },
    ],
    energy: 2, skill: "farming", recipe: ["kindling", "pebble"],
  },
  {
    id: "reed-sickle", name: "Reed Sickle", blurb: "A curve of whittled shell. It hums when it cuts.",
    parts: [
      { shape: "rect", at: [7, 8, 2, 7], ramp: "wood", step: 1 },
      { shape: "ellipse", at: [5, 1, 9, 7], ramp: "lilac", step: 0 },
      { shape: "ellipse", at: [6, 3, 6, 5], ramp: "paper", step: 0 },
    ],
    grip: [7, 12],
    motion: { kind: "sweep", speed: "quick", area: "line" },
    effects: [{ material: "plant", does: "harvest", power: 1 }],
    energy: 2, skill: "foraging", recipe: ["shell", "reed"],
  },
  {
    id: "pebble-tap", name: "Pebble Tap", blurb: "A hammer for very small rocks. It knows its limits.",
    parts: [
      { shape: "rect", at: [7, 5, 2, 10], ramp: "wood", step: 1 },
      { shape: "rect", at: [4, 2, 8, 4], ramp: "silver", step: 3 },
      { shape: "rect", at: [4, 2, 8, 1], ramp: "silver", step: 1 },
    ],
    grip: [7, 13],
    motion: { kind: "chop", speed: "normal", area: "one" },
    effects: [{ material: "stone", does: "break", power: 2 }],
    energy: 3, skill: "foraging", recipe: ["pebble", "pebble", "kindling"],
  },
]
