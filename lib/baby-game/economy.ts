/**
 * lib/baby-game/economy.ts — How a world shares: the economy and population schema, its baked presets, and the seam to generate one
 *
 * Every world runs on one `EconomySpec`, kept in the save (`GameState.economy`), so a generated world can bring its own.
 * The spec is a closed shape on purpose: a weak model, a keyword reading of the player's words, or a hand-made preset
 * all fill the same fields, and `parseEconomy` clamps whatever comes back. The game leans one way. The default is a
 * gift economy: nobody is paid, the village says thanks in kind, and the Commons shelf gives by need (Mauss, Kropotkin,
 * Graeber's "baseline communism"). Gems are not money. They are a thing most baby animals love to be given.
 * Only the `mixed` preset keeps a small market, with buttons as its scrip, for contrast and for old saves.
 *
 * Wired today: `market`, `rewards`, `gemRate`, `gemLove`, `shelf`, `offerings`, `festival` (read in `engine.ts`, `props.ts`).
 * **Planned:** `population` shapes the generated cast (how many residents, how work and decisions are shared). Valdivia's
 * cast is hand-made, so today `population` only goes into prompts and shows in the Journal and the dev plate.
 *
 * Imports nothing from the engine, so it can move out with `seed.ts` (`docs/BABY_GAME_STANDALONE.md`).
 */

export type Labor = "by ability" | "rotating" | "assembly"
export type Decisions = "council" | "consensus" | "assembly"
export type Festival = "feast" | "giveaway" | "fair"

export type EconomySpec = {
  v: 1
  id: string
  name: string
  /** One or two plain sentences, shown to the player. */
  blurb: string
  /** Thinkers and traditions it draws on, short enough to look up. */
  sources: string[]
  /** "none": only the Commons shelf. "remnant": a Trade Corner beside it, with buttons as scrip. */
  market: "none" | "remnant"
  /** How the village says thanks: "gifts" (gems and things in kind) or "scrip" (buttons; only with a market remnant). */
  rewards: "gifts" | "scrip"
  /** Gems per point of a reward's worth (a quest worth 12 gives 12 × gemRate gems, at least one). */
  gemRate: number
  /** The share of residents who love being given a gem, 0 to 1. */
  gemLove: number
  shelf: {
    /** Things anyone may take from the Commons a day. */
    share: number
    /** One more as your standing grows (Neighbor, Elder). Rewards giving, never holding. */
    standing: boolean
    /** Extra on a worn-out day: to each according to need. */
    need: number
    /** Tit for tat: how far takes may run ahead of gives before the friends mirror you. Null never mirrors. */
    mirrorGap: number | null
  }
  /** What each friend brings to the shelf every morning: from each according to ability. */
  offerings: number
  /** The day-7 festival. "feast": the shelf doubles. "giveaway": gifts to the shelf that day earn double trust. "fair": the Stump pays half again. */
  festival: Festival
  population: {
    /** How many residents the world is made with. Valdivia: 24. */
    size: number
    /** How the work gets shared. */
    labor: Labor
    /** How the village decides things. */
    decisions: Decisions
    /** Who is cared for first, in a few words. */
    care: string
  }
}

const VALDIVIA_POP = { size: 24, labor: "by ability", decisions: "council", care: "the youngest and the worn out" } as const

export const ECONOMIES: Record<string, EconomySpec> = {
  "gift-commons": {
    v: 1, id: "gift-commons", name: "Gift Commons",
    blurb: "Nobody is paid. Friends thank you in kind, often with a gem, and the Commons shelf gives what you need.",
    sources: ["Marcel Mauss, The Gift (1925)", "Peter Kropotkin, Mutual Aid (1902)", "David Graeber, Debt: The First 5,000 Years (2011), on baseline communism"],
    market: "none", rewards: "gifts", gemRate: 0.34, gemLove: 0.75,
    shelf: { share: 3, standing: true, need: 1, mirrorGap: 8 },
    offerings: 1, festival: "feast", population: { ...VALDIVIA_POP },
  },
  "mutual-aid": {
    v: 1, id: "mutual-aid", name: "Mutual Aid Society",
    blurb: "Everyone helps everyone. The shelf never keeps score, and the festival is a giveaway.",
    sources: ["Peter Kropotkin, Mutual Aid (1902)", "Colin Ward, Anarchy in Action (1973)", "Dean Spade, Mutual Aid (2020)"],
    market: "none", rewards: "gifts", gemRate: 0.34, gemLove: 0.8,
    shelf: { share: 4, standing: false, need: 2, mirrorGap: null },
    offerings: 1, festival: "giveaway", population: { ...VALDIVIA_POP, decisions: "consensus", care: "whoever is struggling today" },
  },
  commune: {
    v: 1, id: "commune", name: "The Commune",
    blurb: "From each according to ability, to each according to need. Friends bring twice as much, and need decides the shelf.",
    sources: ["Karl Marx, Critique of the Gotha Programme (1875)", "The Paris Commune (1871)", "Rosa Luxemburg, The Russian Revolution (1918)"],
    market: "none", rewards: "gifts", gemRate: 0.3, gemLove: 0.7,
    shelf: { share: 3, standing: false, need: 3, mirrorGap: 12 },
    offerings: 2, festival: "feast", population: { ...VALDIVIA_POP, labor: "rotating", decisions: "assembly", care: "the sick, the old and the very small" },
  },
  mixed: {
    v: 1, id: "mixed", name: "Commons and a Trade Corner",
    blurb: "The Commons shelf, plus a small market where buttons buy raw things. How Valdivia first worked.",
    sources: ["Karl Polanyi, The Great Transformation (1944)", "Elinor Ostrom, Governing the Commons (1990)"],
    market: "remnant", rewards: "scrip", gemRate: 0.34, gemLove: 0.6,
    shelf: { share: 3, standing: true, need: 1, mirrorGap: 8 },
    offerings: 1, festival: "fair", population: { ...VALDIVIA_POP },
  },
}

export const DEFAULT_ECONOMY = "gift-commons"

/** The world's economy: its own spec if it has one, else the gift commons. */
export const economyOf = (s: { economy?: EconomySpec }): EconomySpec => s.economy ?? ECONOMIES[DEFAULT_ECONOMY]!

/** Does this friend love gems? Stable per friend, so the same `gemLove` always picks the same ones. */
export function lovesGems(id: string, gemLove: number): boolean {
  let h = 2166136261
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return ((h >>> 0) % 1000) / 1000 < gemLove
}

// ─── validation: anything a model or a hand writes is clamped to the closed shape ───

const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d)
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d)
const text = (v: unknown, max: number, d: string) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : d)

/** Read an economy from untrusted JSON. Fields that are missing or wrong fall back to `base`. Never throws. */
export function parseEconomy(raw: unknown, base: EconomySpec = ECONOMIES[DEFAULT_ECONOMY]!): EconomySpec {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const sh = (o.shelf && typeof o.shelf === "object" ? o.shelf : {}) as Record<string, unknown>
  const pop = (o.population && typeof o.population === "object" ? o.population : {}) as Record<string, unknown>
  const market = oneOf(o.market, ["none", "remnant"] as const, base.market)
  // scrip needs somewhere to spend it; without a market every thanks is a gift
  const rewards = market === "none" ? "gifts" : oneOf(o.rewards, ["gifts", "scrip"] as const, base.rewards)
  const mirror = sh.mirrorGap === null ? null : sh.mirrorGap === undefined ? base.shelf.mirrorGap : Math.round(clamp(sh.mirrorGap, 2, 40, base.shelf.mirrorGap ?? 8))
  const sources = Array.isArray(o.sources) ? o.sources.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 5).map((x) => x.slice(0, 120)) : []
  return {
    v: 1,
    id: text(o.id, 40, base.id).toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    name: text(o.name, 48, base.name),
    blurb: text(o.blurb, 240, base.blurb),
    sources: sources.length ? sources : base.sources,
    market,
    rewards,
    gemRate: clamp(o.gemRate, 0.1, 1, base.gemRate),
    gemLove: clamp(o.gemLove, 0, 1, base.gemLove),
    shelf: {
      share: Math.round(clamp(sh.share, 1, 8, base.shelf.share)),
      standing: typeof sh.standing === "boolean" ? sh.standing : base.shelf.standing,
      need: Math.round(clamp(sh.need, 0, 4, base.shelf.need)),
      mirrorGap: mirror,
    },
    offerings: Math.round(clamp(o.offerings, 0, 3, base.offerings)),
    festival: oneOf(o.festival, ["feast", "giveaway", "fair"] as const, base.festival),
    population: {
      size: Math.round(clamp(pop.size, 4, 60, base.population.size)),
      labor: oneOf(pop.labor, ["by ability", "rotating", "assembly"] as const, base.population.labor),
      decisions: oneOf(pop.decisions, ["council", "consensus", "assembly"] as const, base.population.decisions),
      care: text(pop.care, 80, base.population.care),
    },
  }
}

// ─── inference: the no-model reading of the player's own words ───

const SAYS = (t: string, words: RegExp) => words.test(t)

/**
 * Read an economy from a sentence ("a tiny village where nobody owns anything and the festival is a giveaway").
 * Picks the nearest preset, then nudges fields the words name. Leans to the gift side: a market comes back only when
 * the words ask for buying and selling outright.
 */
export function inferEconomy(prompt: string): EconomySpec {
  const t = prompt.toLowerCase()
  const marketWanted = SAYS(t, /\b(market|shop|store|buy|sell|money|coins?|prices?|wages?|trade corner)\b/) && !SAYS(t, /\b(no|without|abolish\w*|never|instead of)\s+(a\s+)?(market|money|shop|wages?|prices?)/)
  const id = marketWanted
    ? "mixed"
    : SAYS(t, /\b(marx|commune|communis\w*|according to (need|ability)|soviet|assembl\w*|collective\w*)\b/)
      ? "commune"
      : SAYS(t, /\b(mutual aid|anarch\w*|kropotkin|solidarity|no one keeps score|nobody keeps score|consensus)\b/)
        ? "mutual-aid"
        : "gift-commons"
  const base = ECONOMIES[id]!
  const out: EconomySpec = structuredClone(base)
  if (SAYS(t, /\b(tiny|small|few|hamlet)\b/)) out.population.size = 10
  if (SAYS(t, /\b(big|large|bustling|crowded|town|city)\b/)) out.population.size = 40
  const n = t.match(/\b(\d{1,2})\s+(residents|animals|friends|neighbou?rs|villagers)\b/)
  if (n) out.population.size = Math.max(4, Math.min(60, Number(n[1])))
  if (SAYS(t, /\bgive\s?away|potlatch|give everything away\b/)) out.festival = "giveaway"
  if (SAYS(t, /\bfeast|banquet|dinner part\w*\b/)) out.festival = "feast"
  if (SAYS(t, /\b(gems?|jewels?|crystals?|shiny)\b/)) out.gemLove = Math.min(1, out.gemLove + 0.15)
  if (SAYS(t, /\b(rotat\w*|take turns|shifts)\b/)) out.population.labor = "rotating"
  if (SAYS(t, /\bconsensus\b/)) out.population.decisions = "consensus"
  if (SAYS(t, /\bassembl\w*\b/)) out.population.decisions = "assembly"
  if (SAYS(t, /\b(no score|never mirror|unconditional|no strings)\b/)) out.shelf.mirrorGap = null
  if (SAYS(t, /\b(generous|abundan\w*|plenty)\b/)) out.shelf.share = Math.min(8, out.shelf.share + 2)
  if (SAYS(t, /\b(scarce|scarcity|lean|hard times)\b/)) out.shelf.share = Math.max(1, out.shelf.share - 1)
  const care = t.match(/\bcare (?:for|about) ([a-z ,']{3,60})/)
  if (care) out.population.care = care[1]!.trim()
  return parseEconomy({ ...out, id: `${id}-custom`, name: `${base.name} (from your words)` }, base)
}

// ─── the model seam ───

/** The JSON schema a model answers in. Same closed shape as `EconomySpec`, minus the version. */
export const ECONOMY_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string", maxLength: 40 },
    name: { type: "string", maxLength: 48 },
    blurb: { type: "string", maxLength: 240 },
    sources: { type: "array", items: { type: "string", maxLength: 120 }, maxItems: 5 },
    market: { type: "string", enum: ["none", "remnant"] },
    rewards: { type: "string", enum: ["gifts", "scrip"] },
    gemRate: { type: "number", minimum: 0.1, maximum: 1 },
    gemLove: { type: "number", minimum: 0, maximum: 1 },
    shelf: {
      type: "object",
      properties: {
        share: { type: "integer", minimum: 1, maximum: 8 },
        standing: { type: "boolean" },
        need: { type: "integer", minimum: 0, maximum: 4 },
        mirrorGap: { type: ["integer", "null"], minimum: 2, maximum: 40 },
      },
      required: ["share", "standing", "need", "mirrorGap"],
    },
    offerings: { type: "integer", minimum: 0, maximum: 3 },
    festival: { type: "string", enum: ["feast", "giveaway", "fair"] },
    population: {
      type: "object",
      properties: {
        size: { type: "integer", minimum: 4, maximum: 60 },
        labor: { type: "string", enum: ["by ability", "rotating", "assembly"] },
        decisions: { type: "string", enum: ["council", "consensus", "assembly"] },
        care: { type: "string", maxLength: 80 },
      },
      required: ["size", "labor", "decisions", "care"],
    },
  },
  required: ["name", "blurb", "sources", "market", "rewards", "gemRate", "gemLove", "shelf", "offerings", "festival", "population"],
} as const

/** The system prompt for a model filling in an economy. The lean is stated, not hidden. */
export function economySystem(): string {
  return [
    "You design how a cozy village of baby animals shares things, for a farming and friendship game.",
    "Lean toward socialist, communist and anarchist thought and gift economies: Mauss, Kropotkin, Marx's 'from each according to ability, to each according to need', Graeber, Ostrom.",
    "Default to market \"none\" and rewards \"gifts\". Choose market \"remnant\" (a small market with buttons as scrip) only if the player plainly asks for buying and selling.",
    "Gems are never money. gemLove is how many residents love to be given a gem; gemRate turns a reward's worth into gems given as thanks.",
    "shelf: share is what anyone may take from the Commons a day; need is extra on a worn-out day; mirrorGap is how far taking may outrun giving before friends gently mirror it, or null for never.",
    "Only name real thinkers and real books in sources. Keep the blurb to one or two plain sentences a child could read.",
    `A worked example: ${JSON.stringify(ECONOMIES["gift-commons"])}`,
  ].join("\n")
}
