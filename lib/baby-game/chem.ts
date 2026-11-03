/**
 * lib/baby-game/chem.ts — the world's chemistry: elements, reactions, heat, and a small falling-sand sim
 *
 * The shape follows Sandboxels (R74n, https://github.com/R74nCom/sandboxels): every element has a behavior
 * (powder, liquid, gas, wall, fire, life), a state, a density, a resting temperature, what it turns into above
 * `tempHigh` and below `tempLow`, how it burns (`burn`, `burnTime`, `burnInto`), what it breaks into, and pair
 * reactions (`a` touching `b` becomes `into1` and `into2`, with a chance and an optional heat window).
 * The data and code here are our own: real-world chemistry, our palette. Sandboxels' source is not copied in;
 * its license (R74n Content License) is all rights reserved and non-commercial, and this game is meant to leave brain2.
 *
 * Pure: no canvas. `ChemGrid` steps cells on a grid with a seeded rng. Two gravities:
 *  - `side`: classic falling sand (the lab, `/lab/baby-chem`).
 *  - `top`: the game's 3/4 view. Up the screen is height, so gas and fire rise, a falling drop or crumb drops for
 *    its `fall` pixels and then lands; landed liquid spreads on the ground, landed powder rests.
 * `components/BabyGame/chemfx.ts` runs one in the world; `matter.ts` says what any thing is made of.
 */

export type Behavior = "powder" | "liquid" | "gas" | "wall" | "fire" | "life"
export type State = "solid" | "liquid" | "gas" | "plasma"
export type Category = "land" | "liquids" | "gases" | "solids" | "energy" | "life" | "powders"

export type ElementDef = {
  id: string
  name: string
  category: Category
  behavior: Behavior
  state: State
  /** kg/m³, roughly; heavier liquids sink under lighter ones, gas under 2. */
  density: number
  /** Two or three colors; a cell keeps one for life. No yellow except fire's flicker. */
  color: readonly string[]
  /** Temperature it is made at, °C. Defaults to the room. */
  temp?: number
  tempHigh?: number
  stateHigh?: string | null
  tempLow?: number
  stateLow?: string | null
  /** Chance per tick (0..100) to catch from a burning neighbour. */
  burn?: number
  /** Ticks it burns once lit. */
  burnTime?: number
  burnInto?: readonly string[]
  /** What a tool knocks it into. */
  breakInto?: string
  /** 0 is picked by paw, 1 needs the strongest tool. */
  hardness: number
  /** Carries a spark. */
  conducts?: boolean
  /** Fades on its own after about this many ticks (smoke, steam, sparks). */
  life?: number
  /** One plain line a model can read. */
  blurb: string
}

const E = (d: ElementDef) => d

/** Every element the valley knows. Ids are snake case; `matter.ts` and the model only ever name these. */
export const ELEMENTS: Record<string, ElementDef> = Object.fromEntries(
  [
    // liquids
    E({ id: "water", name: "Water", category: "liquids", behavior: "liquid", state: "liquid", density: 1000, color: ["#7fb2e8", "#93c0ee"], tempHigh: 100, stateHigh: "steam", tempLow: 0, stateLow: "ice", hardness: 0, conducts: true, blurb: "Puts out fire, wets sand and dirt, freezes at 0 and boils at 100." }),
    E({ id: "salt_water", name: "Salt water", category: "liquids", behavior: "liquid", state: "liquid", density: 1026, color: ["#6fa6dc", "#82b4e2"], tempHigh: 102, stateHigh: "steam", tempLow: -2, stateLow: "ice", hardness: 0, conducts: true, blurb: "Sea water. Leaves salt behind when it boils." }),
    E({ id: "mud", name: "Mud", category: "liquids", behavior: "liquid", state: "liquid", density: 1700, color: ["#6b4f3b", "#7c5d46"], tempHigh: 100, stateHigh: "dirt", tempLow: -5, stateLow: "dirt", hardness: 0.05, blurb: "Wet dirt. Dries back to dirt in the sun." }),
    E({ id: "honey", name: "Honey", category: "liquids", behavior: "liquid", state: "liquid", density: 1420, color: ["#d9a066", "#c98f55"], tempHigh: 160, stateHigh: "caramel", hardness: 0, blurb: "Slow and sweet. Dissolves in water." }),
    E({ id: "oil", name: "Lamp oil", category: "liquids", behavior: "liquid", state: "liquid", density: 850, color: ["#8a7a5a", "#9a8a68"], burn: 40, burnTime: 120, burnInto: ["fire", "smoke"], tempHigh: 300, stateHigh: "fire", hardness: 0, blurb: "Floats on water and burns hot." }),
    E({ id: "lava", name: "Lava", category: "liquids", behavior: "liquid", state: "liquid", density: 2800, color: ["#e8604a", "#f08a5a", "#c84a3a"], temp: 1100, tempLow: 800, stateLow: "rock", hardness: 0, blurb: "Molten rock. Sets things alight and turns to rock as it cools." }),
    E({ id: "slime", name: "Slime mold", category: "life", behavior: "liquid", state: "liquid", density: 1100, color: ["#c8e070", "#b6d060"], tempHigh: 60, stateHigh: "dirt", hardness: 0, blurb: "A thinking puddle. Creeps toward food." }),
    // gases
    E({ id: "steam", name: "Steam", category: "gases", behavior: "gas", state: "gas", density: 0.6, color: ["#e8eef6", "#d6e0ec"], temp: 110, tempLow: 95, stateLow: "water", life: 90, hardness: 0, blurb: "Water as a gas. Condenses back to water as it cools." }),
    E({ id: "smoke", name: "Smoke", category: "gases", behavior: "gas", state: "gas", density: 0.1, color: ["#8a8496", "#a29cae", "#6e687a"], temp: 110, life: 70, hardness: 0, blurb: "Rises from burning things and fades. Calms bees." }),
    E({ id: "cloud", name: "Cloud", category: "gases", behavior: "gas", state: "gas", density: 0.5, color: ["#f4f4fa", "#e6e8f2"], life: 400, hardness: 0, blurb: "Rains water now and then." }),
    E({ id: "bubble", name: "Bubble", category: "gases", behavior: "gas", state: "gas", density: 1.1, color: ["#d9ecff", "#ffffff"], life: 50, hardness: 0, blurb: "Air in a skin of water. Pops." }),
    // energy
    E({ id: "fire", name: "Fire", category: "energy", behavior: "fire", state: "plasma", density: 0.1, color: ["#f0705a", "#f8a070", "#ffd6b0"], temp: 600, life: 28, tempLow: 100, stateLow: "smoke", hardness: 0, blurb: "Burns anything with burn, makes smoke, boils water. Water puts it out." }),
    E({ id: "ember", name: "Ember", category: "energy", behavior: "powder", state: "solid", density: 700, color: ["#e8604a", "#c84a3a"], temp: 700, life: 160, tempLow: 200, stateLow: "ash", hardness: 0, blurb: "A glowing bit of wood. Can start a fire where it lands." }),
    E({ id: "spark", name: "Spark", category: "energy", behavior: "gas", state: "plasma", density: 0.1, color: ["#ffffff", "#d6f6ff", "#ffd6e8"], temp: 300, life: 18, hardness: 0, blurb: "A pinch of electricity. Runs along metal and water." }),
    E({ id: "light", name: "Light", category: "energy", behavior: "gas", state: "plasma", density: 0, color: ["#ffffff", "#f4eefc"], life: 24, hardness: 0, blurb: "A mote of orb light. Bends into a rainbow through glass." }),
    // land and powders
    E({ id: "dirt", name: "Dirt", category: "land", behavior: "powder", state: "solid", density: 1220, color: ["#8a6a52", "#7a5c46", "#9a7a60"], tempHigh: 1200, stateHigh: "lava", hardness: 0.1, blurb: "Soil. Turns to mud with water; plants grow in it." }),
    E({ id: "sand", name: "Sand", category: "land", behavior: "powder", state: "solid", density: 1600, color: ["#efe6d2", "#e2d6bc", "#d8cab0"], tempHigh: 1700, stateHigh: "glass", hardness: 0.05, blurb: "Tiny rock. Wet with water, glass in great heat." }),
    E({ id: "wet_sand", name: "Wet sand", category: "land", behavior: "powder", state: "solid", density: 1900, color: ["#cdbf9f", "#bfb090"], tempHigh: 100, stateHigh: "sand", hardness: 0.08, blurb: "Packs into shapes. Dries back to sand." }),
    E({ id: "snow", name: "Snow", category: "land", behavior: "powder", state: "solid", density: 100, color: ["#ffffff", "#eef4fa"], temp: -5, tempHigh: 2, stateHigh: "water", hardness: 0, blurb: "Feathery ice. Melts to water above freezing." }),
    E({ id: "ash", name: "Ash", category: "powders", behavior: "powder", state: "solid", density: 700, color: ["#b8b4c0", "#a29eaa"], life: 900, hardness: 0, blurb: "What fire leaves. Feeds soil." }),
    E({ id: "salt", name: "Salt", category: "powders", behavior: "powder", state: "solid", density: 2160, color: ["#ffffff", "#eceef2"], tempHigh: 801, stateHigh: "lava", hardness: 0.1, blurb: "Melts ice, makes salt water." }),
    E({ id: "sawdust", name: "Sawdust", category: "powders", behavior: "powder", state: "solid", density: 210, color: ["#e0c8a0", "#d2b890"], burn: 25, burnTime: 40, burnInto: ["fire", "smoke"], hardness: 0, blurb: "Cut wood. Catches fire very easily." }),
    E({ id: "seed", name: "Seed", category: "life", behavior: "powder", state: "solid", density: 700, color: ["#a98f72", "#8a6a52"], burn: 10, burnTime: 20, burnInto: ["ash"], hardness: 0, blurb: "Grows into a plant on wet dirt." }),
    E({ id: "caramel", name: "Caramel", category: "powders", behavior: "powder", state: "solid", density: 1100, color: ["#b07a4a", "#9a683e"], burn: 5, burnTime: 60, burnInto: ["smoke"], hardness: 0.05, blurb: "Cooked sugar." }),
    // solids
    E({ id: "rock", name: "Rock", category: "land", behavior: "wall", state: "solid", density: 2600, color: ["#b0b7c0", "#a2a9b2", "#c0c6ce"], tempHigh: 1200, stateHigh: "lava", breakInto: "gravel", hardness: 0.6, blurb: "Stone. Breaks into gravel, melts into lava." }),
    E({ id: "gravel", name: "Gravel", category: "land", behavior: "powder", state: "solid", density: 1700, color: ["#a2a9b2", "#8e959e"], tempHigh: 1200, stateHigh: "lava", hardness: 0.3, blurb: "Broken rock." }),
    E({ id: "clay", name: "Clay", category: "land", behavior: "powder", state: "solid", density: 1750, color: ["#c8907a", "#b88068"], tempHigh: 900, stateHigh: "brick", hardness: 0.1, blurb: "Soft earth that fires into brick and pottery." }),
    E({ id: "brick", name: "Brick", category: "solids", behavior: "wall", state: "solid", density: 1900, color: ["#b86a5a", "#a65c4e"], tempHigh: 1600, stateHigh: "lava", breakInto: "gravel", hardness: 0.5, blurb: "Fired clay. Pots, tiles, chimneys." }),
    E({ id: "glass", name: "Glass", category: "solids", behavior: "wall", state: "solid", density: 2500, color: ["#d9ecff", "#c4def4"], tempHigh: 1500, stateHigh: "lava", breakInto: "sand", hardness: 0.4, blurb: "Melted sand. Clear; light bends through it." }),
    E({ id: "ice", name: "Ice", category: "solids", behavior: "wall", state: "solid", density: 917, color: ["#cfe6f8", "#e2f0fc"], temp: -5, tempHigh: 2, stateHigh: "water", breakInto: "snow", hardness: 0.2, blurb: "Frozen water. Melts above 0; salt melts it too." }),
    E({ id: "wood", name: "Wood", category: "solids", behavior: "wall", state: "solid", density: 600, color: ["#a98f72", "#8a6a52", "#b89c7c"], tempHigh: 400, stateHigh: "fire", burn: 5, burnTime: 300, burnInto: ["ember", "charcoal", "fire"], breakInto: "sawdust", hardness: 0.15, blurb: "Trees, planks, furniture. Burns slowly into charcoal and embers." }),
    E({ id: "charcoal", name: "Charcoal", category: "solids", behavior: "powder", state: "solid", density: 300, color: ["#4e4858", "#3c3746"], burn: 3, burnTime: 500, burnInto: ["fire", "ash"], hardness: 0.1, blurb: "Wood burned without air. Burns long and hot." }),
    E({ id: "metal", name: "Silver metal", category: "solids", behavior: "wall", state: "solid", density: 7800, color: ["#d8dde3", "#b0b7c0", "#eef1f4"], tempHigh: 1500, stateHigh: "lava", conducts: true, hardness: 0.8, blurb: "Iron and steel, bright as chrome. Conducts sparks; rusts in water." }),
    E({ id: "rust", name: "Rust", category: "powders", behavior: "powder", state: "solid", density: 5200, color: ["#a65c4e", "#8e4e42"], hardness: 0.1, blurb: "Metal that water got to." }),
    E({ id: "paper", name: "Paper", category: "solids", behavior: "wall", state: "solid", density: 800, color: ["#f6f2ea", "#ece6da"], tempHigh: 233, stateHigh: "fire", burn: 40, burnTime: 25, burnInto: ["fire", "ash"], hardness: 0, blurb: "Pressed wood pulp. Books, letters, maps. Burns fast." }),
    E({ id: "cloth", name: "Cloth", category: "solids", behavior: "wall", state: "solid", density: 400, color: ["#e8d8ec", "#d8c6de"], tempHigh: 300, stateHigh: "fire", burn: 20, burnTime: 60, burnInto: ["fire", "ash", "smoke"], hardness: 0, blurb: "Woven wool or cotton. Blankets, clothes, sails." }),
    E({ id: "wax", name: "Wax", category: "solids", behavior: "wall", state: "solid", density: 900, color: ["#f4ecf0", "#e8dce4"], tempHigh: 60, stateHigh: "oil", burn: 2, burnTime: 400, burnInto: ["fire", "smoke"], hardness: 0.05, blurb: "Candles and honeycomb. Melts at 60." }),
    E({ id: "bone", name: "Bone", category: "solids", behavior: "wall", state: "solid", density: 1900, color: ["#f4eee2", "#e6dece"], tempHigh: 1000, stateHigh: "ash", hardness: 0.4, blurb: "Fossils and shells keep their shape for ages." }),
    E({ id: "crystal", name: "Crystal", category: "solids", behavior: "wall", state: "solid", density: 2650, color: ["#e6d6ff", "#d6f6ff", "#ffffff"], tempHigh: 1700, stateHigh: "lava", hardness: 0.7, blurb: "Star shards and prisms. Splits light into colors." }),
    // life
    E({ id: "plant", name: "Plant", category: "life", behavior: "life", state: "solid", density: 1050, color: ["#6fb05f", "#8fcf7a", "#5a9a4c"], tempHigh: 100, stateHigh: "ash", tempLow: -2, stateLow: "leaves", burn: 15, burnTime: 30, burnInto: ["fire", "ash", "smoke"], breakInto: "leaves", hardness: 0, blurb: "Grass, crops, flowers. Drinks water and grows; burns when dry." }),
    E({ id: "leaves", name: "Leaves", category: "life", behavior: "powder", state: "solid", density: 500, color: ["#c8a070", "#b6d060", "#d88a6a"], burn: 30, burnTime: 25, burnInto: ["fire", "smoke"], life: 1200, hardness: 0, blurb: "Fallen leaves. Rot into dirt, burn quickly." }),
  ].map((d) => [d.id, d]),
)

export type Reaction = { a: string; b: string; into1?: string | null; into2?: string | null; chance: number; tempMin?: number; tempMax?: number }

/**
 * Pair reactions. `into1` replaces `a`, `into2` replaces `b`; `undefined` keeps it, `null` removes it.
 * Burning is not listed here: anything with `burn` catches from fire, ember or lava (see `ChemGrid.burnStep`).
 */
export const REACTIONS: readonly Reaction[] = [
  { a: "water", b: "fire", into1: "steam", into2: null, chance: 0.9 },
  { a: "water", b: "ember", into1: "steam", into2: "charcoal", chance: 0.8 },
  { a: "water", b: "lava", into1: "steam", into2: "rock", chance: 0.6 },
  { a: "water", b: "dirt", into1: null, into2: "mud", chance: 0.4 },
  { a: "water", b: "sand", into1: null, into2: "wet_sand", chance: 0.4 },
  { a: "water", b: "salt", into1: "salt_water", into2: null, chance: 0.5 },
  { a: "water", b: "honey", into1: "water", into2: null, chance: 0.05 },
  { a: "water", b: "ash", into1: "mud", into2: null, chance: 0.2 },
  { a: "water", b: "metal", into2: "rust", chance: 0.0004 },
  { a: "water", b: "seed", into2: "plant", chance: 0.004 },
  { a: "water", b: "plant", into1: null, chance: 0.02 },
  { a: "water", b: "slime", into1: null, into2: "slime", chance: 0.02 },
  { a: "water", b: "clay", into1: "mud", chance: 0.05 },
  { a: "salt", b: "ice", into2: "salt_water", chance: 0.3 },
  { a: "salt", b: "snow", into2: "salt_water", chance: 0.4 },
  { a: "mud", b: "seed", into2: "plant", chance: 0.01 },
  { a: "lava", b: "ice", into2: "water", chance: 0.8 },
  { a: "lava", b: "sand", into2: "glass", chance: 0.05 },
  { a: "fire", b: "ice", into2: "water", chance: 0.3 },
  { a: "fire", b: "snow", into1: "steam", into2: "water", chance: 0.6 },
  { a: "fire", b: "sand", into2: "glass", chance: 0.002 },
  { a: "fire", b: "clay", into2: "brick", chance: 0.01 },
  { a: "smoke", b: "water", into1: null, chance: 0.1 },
  { a: "steam", b: "ice", into1: "water", chance: 0.3 },
  { a: "spark", b: "oil", into2: "fire", chance: 0.5 },
  { a: "spark", b: "sawdust", into2: "fire", chance: 0.3 },
  { a: "light", b: "glass", into1: "spark", chance: 0.05 },
  { a: "light", b: "crystal", into1: "spark", chance: 0.1 },
  { a: "slime", b: "leaves", into1: "slime", into2: "slime", chance: 0.01 },
  { a: "plant", b: "ash", into2: "dirt", chance: 0.01 },
  { a: "leaves", b: "dirt", into1: "dirt", chance: 0.001 },
]

/** Lookup by unordered pair: `pairs.get("a|b")` with `a` first. */
const PAIRS = new Map<string, Reaction>()
for (const r of REACTIONS) {
  PAIRS.set(`${r.a}|${r.b}`, r)
  if (!PAIRS.has(`${r.b}|${r.a}`)) PAIRS.set(`${r.b}|${r.a}`, { a: r.b, b: r.a, into1: r.into2, into2: r.into1, chance: r.chance, tempMin: r.tempMin, tempMax: r.tempMax })
}

export const element = (id: string): ElementDef | undefined => ELEMENTS[id]
export const reactionOf = (a: string, b: string): Reaction | undefined => PAIRS.get(`${a}|${b}`)
export const isElement = (id: unknown): id is string => typeof id === "string" && id in ELEMENTS

const pick = <T>(xs: readonly T[], r: number): T => xs[Math.min(xs.length - 1, Math.floor(r * xs.length))]!

/** What `a` and `b` do together, in plain facts: a reaction, a burn, a melt, or nothing. Pure; a model can voice it. */
export function outcome(a: string, b: string): { happens: boolean; text: string; into: string[] } {
  const ea = ELEMENTS[a]
  const eb = ELEMENTS[b]
  if (!ea || !eb) return { happens: false, text: "Nothing anyone knows of.", into: [] }
  const r = reactionOf(a, b)
  if (r) {
    const into = [r.into1 === undefined ? a : r.into1, r.into2 === undefined ? b : r.into2].filter((x): x is string => !!x)
    return { happens: true, text: `${ea.name} and ${eb.name.toLowerCase()} make ${into.map((i) => ELEMENTS[i]!.name.toLowerCase()).join(" and ") || "nothing at all"}.`, into }
  }
  const hot = (e: ElementDef) => e.id === "fire" || e.id === "ember" || e.id === "lava"
  for (const [h, o] of [[ea, eb], [eb, ea]] as const) {
    if (!hot(h)) continue
    if (o.burn) return { happens: true, text: `${o.name} catches from ${h.name.toLowerCase()} and burns into ${(o.burnInto ?? ["ash"]).map((i) => ELEMENTS[i]!.name.toLowerCase()).join(", ")}.`, into: [...(o.burnInto ?? ["ash"])] }
    if (o.tempHigh !== undefined && o.stateHigh && (h.temp ?? 20) >= o.tempHigh) return { happens: true, text: `${h.name} heats ${o.name.toLowerCase()} past ${o.tempHigh}°: it becomes ${ELEMENTS[o.stateHigh]!.name.toLowerCase()}.`, into: [o.stateHigh] }
  }
  return { happens: false, text: `${ea.name} and ${eb.name.toLowerCase()} sit side by side.`, into: [] }
}

/** A short table of every element for a model's system prompt: id, state, what it does. */
export function chemBrief(ids: readonly string[] = Object.keys(ELEMENTS)): string {
  return ids
    .map((id) => ELEMENTS[id])
    .filter((e): e is ElementDef => !!e)
    .map((e) => `${e.id} (${e.state}${e.burn ? ", burns" : ""}${e.conducts ? ", conducts" : ""}): ${e.blurb}`)
    .join("\n")
}

// ——— the sim ———

export type Gravity = "side" | "top"

export type Cell = { el: string; temp: number; age: number; /** pixels left to drop before it lands (top view) */ fall: number; tone: number; /** ticks left burning; 0 is not burning */ burning: number }

export type ChemOptions = {
  w: number
  h: number
  gravity: Gravity
  /** The air's temperature, °C. */
  ambient?: number
  /** Ground under a cell in the top view (an element id or null for none), for landing reactions. */
  ground?: (x: number, y: number) => string | null
  /** A pixel nothing moves into (walls, trees). */
  blocked?: (x: number, y: number) => boolean
  seed?: number
  max?: number
}

/** A sparse grid of cells: only what is there is stored, so a 1280×1024 world costs what is alive in it. */
export class ChemGrid {
  readonly w: number
  readonly h: number
  gravity: Gravity
  ambient: number
  cells = new Map<number, Cell>()
  private ground?: ChemOptions["ground"]
  private blocked?: ChemOptions["blocked"]
  private seed: number
  private max: number
  tick = 0

  constructor(o: ChemOptions) {
    this.w = o.w
    this.h = o.h
    this.gravity = o.gravity
    this.ambient = o.ambient ?? 20
    this.ground = o.ground
    this.blocked = o.blocked
    this.seed = o.seed ?? 1
    this.max = o.max ?? 6000
  }

  /** mulberry32: the same seed plays the same way, so tests hold. */
  rand(): number {
    let t = (this.seed = (this.seed + 0x6d2b79f5) | 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  private key = (x: number, y: number) => y * this.w + x
  inside = (x: number, y: number) => x >= 0 && y >= 0 && x < this.w && y < this.h
  get(x: number, y: number): Cell | undefined {
    return this.cells.get(this.key(x, y))
  }

  /** Put an element at a pixel. Returns false when the spot is taken, out of bounds, or the grid is full. */
  add(el: string, x: number, y: number, o: { fall?: number; temp?: number } = {}): boolean {
    x = Math.round(x)
    y = Math.round(y)
    const def = ELEMENTS[el]
    if (!def || !this.inside(x, y) || this.cells.size >= this.max || this.cells.has(this.key(x, y)) || this.blocked?.(x, y)) return false
    this.cells.set(this.key(x, y), { el, temp: o.temp ?? def.temp ?? this.ambient, age: 0, fall: o.fall ?? 0, tone: Math.floor(this.rand() * def.color.length), burning: 0 })
    return true
  }

  remove(x: number, y: number) {
    this.cells.delete(this.key(x, y))
  }

  clear() {
    this.cells.clear()
  }

  private set(x: number, y: number, c: Cell) {
    this.cells.set(this.key(x, y), c)
  }

  /** Turn a cell into another element, keeping its heat unless the new one is made hot or cold. */
  private become(x: number, y: number, c: Cell, el: string | null) {
    if (el === null) return this.remove(x, y)
    const def = ELEMENTS[el]
    if (!def) return
    c.el = el
    c.age = 0
    c.burning = 0
    if (def.temp !== undefined) c.temp = def.temp
    c.tone = Math.floor(this.rand() * def.color.length)
  }

  private free(x: number, y: number) {
    return this.inside(x, y) && !this.cells.has(this.key(x, y)) && !this.blocked?.(x, y)
  }

  /** Move a cell to a free spot, or swap with a lighter liquid or gas in the way. */
  private tryMove(x: number, y: number, c: Cell, nx: number, ny: number): boolean {
    if (!this.inside(nx, ny) || this.blocked?.(nx, ny)) return false
    const k = this.key(nx, ny)
    const o = this.cells.get(k)
    if (!o) {
      this.cells.delete(this.key(x, y))
      this.cells.set(k, c)
      return true
    }
    const de = ELEMENTS[c.el]!
    const od = ELEMENTS[o.el]!
    const down = this.gravity === "side" ? ny > y : false
    if (down && od.behavior !== "wall" && od.behavior !== "life" && od.density < de.density && od.state !== "solid") {
      this.cells.set(this.key(x, y), o)
      this.cells.set(k, c)
      return true
    }
    return false
  }

  /** One tick. Cells are walked bottom to top (side) in a shuffled column order so nothing drifts one way. */
  step() {
    this.tick++
    const keys = [...this.cells.keys()]
    keys.sort((a, b) => b - a)
    const moved = new Set<Cell>()
    for (const k of keys) {
      const c = this.cells.get(k)
      if (!c || moved.has(c)) continue
      const x = k % this.w
      const y = Math.floor(k / this.w)
      moved.add(c)
      this.live(x, y, c)
    }
  }

  private live(x: number, y: number, c: Cell) {
    const def = ELEMENTS[c.el]!
    c.age++
    if (def.life && c.age > def.life * (0.7 + this.rand() * 0.6)) {
      // smoke and steam thin out; embers cool to ash; fire dies to smoke
      if (def.id === "fire") return this.become(x, y, c, this.rand() < 0.4 ? "smoke" : null)
      if (def.id === "ember") return this.become(x, y, c, "ash")
      return this.remove(x, y)
    }
    // heat drifts toward the air, faster for gas
    const toward = def.state === "gas" || def.state === "plasma" ? 0.04 : 0.01
    if (def.id !== "fire" && def.id !== "lava" && def.id !== "ember") c.temp += (this.ambient - c.temp) * toward
    if (def.tempHigh !== undefined && def.stateHigh !== undefined && c.temp >= def.tempHigh) return this.become(x, y, c, def.stateHigh)
    if (def.tempLow !== undefined && def.stateLow !== undefined && c.temp <= def.tempLow) return this.become(x, y, c, def.stateLow)
    if (c.burning > 0) {
      c.burning--
      if (this.rand() < 0.3) this.add("fire", x, y - 1)
      if (c.burning === 0) return this.become(x, y, c, pick(def.burnInto ?? ["ash"], this.rand()))
    }
    this.touch(x, y, c)
    if (!this.cells.has(this.key(x, y)) || this.get(x, y) !== c) return
    this.move(x, y, c, def)
  }

  /** Reactions, burning and heat with one random neighbour each tick. */
  private touch(x: number, y: number, c: Cell) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const
    const [dx, dy] = dirs[Math.floor(this.rand() * 4)]!
    const nx = x + dx
    const ny = y + dy
    const o = this.get(nx, ny)
    if (!o) {
      if (this.gravity === "top" && c.fall === 0 && this.ground) this.onGround(x, y, c)
      return
    }
    const def = ELEMENTS[c.el]!
    const od = ELEMENTS[o.el]!
    // heat flows
    const flow = (c.temp - o.temp) * 0.1
    c.temp -= flow
    o.temp += flow
    const r = reactionOf(c.el, o.el)
    if (r && this.rand() < r.chance && (r.tempMin === undefined || c.temp >= r.tempMin) && (r.tempMax === undefined || c.temp <= r.tempMax)) {
      if (r.into2 !== undefined) this.become(nx, ny, o, r.into2)
      if (r.into1 !== undefined) this.become(x, y, c, r.into1)
      return
    }
    const hot = (id: string) => id === "fire" || id === "ember" || id === "lava"
    if (hot(c.el) && od.burn && !o.burning && this.rand() * 100 < od.burn) o.burning = od.burnTime ?? 30
    if (hot(o.el) && def.burn && !c.burning && this.rand() * 100 < def.burn) c.burning = def.burnTime ?? 30
    if (c.el === "spark" && od.conducts && this.rand() < 0.5) {
      // a spark runs along: hop past the conductor
      const tx = nx + dx
      const ty = ny + dy
      if (this.free(tx, ty)) {
        this.remove(x, y)
        this.set(tx, ty, c)
      }
    }
  }

  /** Top view: a landed cell meets the ground under it (water soaks dirt, embers scorch grass). */
  private onGround(x: number, y: number, c: Cell) {
    const g = this.ground!(x, y)
    if (!g || this.rand() > 0.05) return
    if (g === "water" && ELEMENTS[c.el]!.state !== "gas" && c.el !== "fire") {
      // anything that lands in the lake sinks; fire just goes out
      return this.become(x, y, c, c.el === "ember" || c.el === "lava" ? "steam" : null)
    }
    if (g === "water" && c.el === "fire") return this.become(x, y, c, "steam")
    const r = reactionOf(c.el, g)
    if (r && this.rand() < r.chance) {
      // the ground stays (it is the map); show what it turned into for a while as this cell
      const shown = r.into2 === undefined ? r.into1 : r.into2
      this.become(x, y, c, shown ?? null)
      return
    }
    const hot = c.el === "fire" || c.el === "ember" || c.el === "lava"
    const gd = ELEMENTS[g]
    if (hot && gd?.burn && this.rand() * 100 < gd.burn * 0.2) this.become(x, y, c, "ash")
  }

  private move(x: number, y: number, c: Cell, def: ElementDef) {
    const r = this.rand()
    const side = r < 0.5 ? 1 : -1
    if (this.gravity === "top") {
      if (c.fall > 0 && def.state !== "gas" && def.state !== "plasma") {
        c.fall--
        if (!this.tryMove(x, y, c, x, y + 1)) c.fall = 0
        return
      }
      switch (def.behavior) {
        case "gas":
        case "fire":
          if (this.rand() < (def.behavior === "fire" ? 0.7 : 0.5)) this.tryMove(x, y, c, x + (this.rand() < 0.3 ? side : 0), y - 1) || this.tryMove(x, y, c, x + side, y)
          return
        case "liquid":
          // a landed puddle spreads a little in any direction, slower as it ages
          if (this.rand() < 0.25 / (1 + c.age / 60)) {
            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const
            const [dx, dy] = dirs[Math.floor(this.rand() * 4)]!
            this.tryMove(x, y, c, x + dx, y + dy)
          }
          return
        default:
          return
      }
    }
    switch (def.behavior) {
      case "powder":
        if (!this.tryMove(x, y, c, x, y + 1)) this.tryMove(x, y, c, x + side, y + 1) || this.tryMove(x, y, c, x - side, y + 1)
        return
      case "liquid":
        if (!this.tryMove(x, y, c, x, y + 1) && !this.tryMove(x, y, c, x + side, y + 1)) this.tryMove(x, y, c, x + side, y) || this.tryMove(x, y, c, x - side, y)
        return
      case "gas":
        if (!this.tryMove(x, y, c, x + (this.rand() < 0.4 ? side : 0), y - 1)) this.tryMove(x, y, c, x + side, y) || this.tryMove(x, y, c, x - side, y)
        return
      case "fire":
        if (this.rand() < 0.8) this.tryMove(x, y, c, x + (this.rand() < 0.5 ? side : 0), y - 1)
        return
      case "life":
        // plants reach up toward light when they have drunk
        if (c.age % 40 === 0 && this.rand() < 0.15 && this.free(x, y - 1) && !this.free(x, y + 1)) this.add("plant", x + (this.rand() < 0.2 ? side : 0), y - 1)
        return
      default:
        return
    }
  }

  /** The color a cell shows now: fire flickers, hot things glow. */
  colorOf(c: Cell): string {
    const def = ELEMENTS[c.el]!
    if (def.behavior === "fire" || c.burning) return def.id === "fire" ? def.color[(c.tone + (this.tick >> 1)) % def.color.length]! : this.tick % 4 < 2 ? "#f0705a" : def.color[c.tone]!
    return def.color[c.tone % def.color.length]!
  }

  count(el?: string): number {
    if (!el) return this.cells.size
    let n = 0
    for (const c of this.cells.values()) if (c.el === el) n++
    return n
  }
}
