/**
 * lib/baby-game/items.ts — Materials, crafted trinkets, keepsakes, and the five Lamp parts
 *
 * Every item is an 8×8 shape (`SHAPES`) painted in three tones. `tags` are what animals love or hate:
 * a friend's favorite whim (`lib/friend-whims.ts`) picks the tag it loves (`WHIM_TAGS`).
 * Raw materials are gathered or bought at the Swap Stump; trinkets are crafted at the Workbench;
 * a keepsake is the one thing a friend gives you once they trust you; a Lamp part is a keepsake that
 * lights the Orb Lamp. No yellow anywhere.
 */

export type Tag = "sweet" | "crunchy" | "watery" | "green" | "shiny" | "cozy" | "musical" | "bookish" | "fishy" | "soft" | "earthy"

export const TAGS: readonly Tag[] = ["sweet", "crunchy", "watery", "green", "shiny", "cozy", "musical", "bookish", "fishy", "soft", "earthy"]

/** What a friend's favorite whim (from `lib/friend-whims.ts`) makes them love in a gift. */
export const WHIM_TAGS: Record<string, Tag> = {
  doodle: "bookish",
  read: "bookish",
  walk: "earthy",
  splash: "watery",
  stretch: "soft",
  nibble: "sweet",
  soak: "cozy",
  shiny: "shiny",
  hop: "green",
  curl: "cozy",
}

export type ItemKind = "material" | "trinket" | "keepsake" | "part" | "seed" | "crop"

export type ItemDef = {
  id: string
  name: string
  kind: ItemKind
  shape: string
  /** Light, main, dark: letters from `SPRITE_PALETTE`. */
  tones: readonly [string, string, string]
  tags: readonly Tag[]
  /** Buttons at the Swap Stump (sells for a third, rounded down, never under 1). */
  value: number
  blurb: string
  /** What it takes to craft, for trinkets. */
  recipe?: Record<string, number>
  /** What it sells for at the Stump, when that is not a third of `value`. */
  sellFor?: number
  /** A picture drawn for this one item (8 rows of 8 shape letters), used instead of `shape` (`forge.ts`). */
  rows?: readonly string[]
}

const mat = (id: string, name: string, shape: string, tones: ItemDef["tones"], tags: Tag[], value: number, blurb: string): ItemDef => ({
  id,
  name,
  kind: "material",
  shape,
  tones,
  tags,
  value,
  blurb,
})

const made = (
  id: string,
  name: string,
  shape: string,
  tones: ItemDef["tones"],
  tags: Tag[],
  value: number,
  recipe: Record<string, number>,
  blurb: string,
): ItemDef => ({ id, name, kind: "trinket", shape, tones, tags, value, blurb, recipe })

export const ITEMS: Record<string, ItemDef> = {}

function add(...defs: ItemDef[]) {
  for (const def of defs) ITEMS[def.id] = def
}

add(
  mat("berry", "Dew Berry", "round", ["r", "R", "q"], ["sweet"], 3, "Fat and cool. Grows where the orchard drips."),
  mat("acorn", "Acorn", "acorn", ["t", "T", "u"], ["crunchy"], 3, "A small round promise of a tree."),
  mat("reed", "River Reed", "stalk", ["g", "G", "h"], ["watery", "green"], 3, "Hollow, bendy, and a little bit musical."),
  mat("clover", "Clover", "clover", ["g", "G", "h"], ["green"], 2, "Three leaves. Four is a rumor."),
  mat("pebble", "Smooth Pebble", "stone", ["s", "S", "d"], ["earthy"], 2, "Worn by a river that is no longer here."),
  mat("button", "Shiny Button", "button", ["b", "B", "n"], ["shiny"], 5, "Dug up from somewhere a person once stood."),
  mat("mushroom", "Moss Cap", "shroom", ["p", "P", "q"], ["cozy"], 4, "Soft on top, and it likes the dark."),
  mat("fish", "Silver Minnow", "fish", ["s", "S", "d"], ["fishy"], 4, "Quick, cold, and surprised to be here."),
  mat("shell", "Whorl Shell", "shell", ["v", "V", "x"], ["watery", "musical"], 4, "Hold it to an ear. It hums the pond."),
  mat("gem", "Gem", "gem", ["v", "V", "x"], ["shiny"], 4, "Cut by nobody, owned by nobody. Not money: most baby animals just light up when you give them one."),
  mat("feather", "Soft Feather", "feather", ["w", "s", "S"], ["soft"], 3, "Dropped, not lost."),
)

/** The kinds of shell on Valdivia's shores. Each is its own material (`shell-<kind>`), drawn from a liked ComfyUI picture (`shell-sprites.ts`). */
export const SHELL_KINDS: Record<string, { name: string; tones: ItemDef["tones"]; blurb: string }> = {
  abalone: { name: "Abalone Shell", tones: ["v", "V", "x"], blurb: "Teal, violet and rose inside, with a row of round holes." },
  cone: { name: "Cone Shell", tones: ["t", "T", "u"], blurb: "A tan and cream net of small patches." },
  cowrie: { name: "Tiger Cowrie", tones: ["w", "s", "S"], blurb: "Glossy, spotted, and a little proud." },
  nautilus: { name: "Nautilus Shell", tones: ["t", "T", "u"], blurb: "One slow spiral, in brown and cream stripes." },
  scallop: { name: "Scallop Shell", tones: ["r", "R", "q"], blurb: "A ribbed fan, soft pink." },
  spondylus: { name: "Spiny Oyster", tones: ["r", "R", "q"], blurb: "Coral red, with a few brave spines." },
  turbo: { name: "Turban Shell", tones: ["g", "G", "h"], blurb: "A green and brown speckled spire." },
  wentletrap: { name: "Wentletrap", tones: ["w", "s", "S"], blurb: "White, tall, and ribbed in little rings." },
}
export const SHELL_IDS = ["shell", ...Object.keys(SHELL_KINDS).map((k) => `shell-${k}`)]

/** Which kind a gather node holds, fixed by its id so the shell you see is the shell you get. */
export function shellKindOf(nodeId: string): string {
  let h = 2166136261
  for (const ch of nodeId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const kinds = Object.keys(SHELL_KINDS)
  return kinds[(h >>> 0) % kinds.length]!
}

add(
  ...Object.entries(SHELL_KINDS).map(([k, d]) => mat(`shell-${k}`, d.name, "shell", d.tones, ["watery", "musical"], 5, d.blurb)),
  made("jam", "Berry Jam", "jar", ["p", "P", "q"], ["sweet", "cozy"], 9, { berry: 3 }, "Sticky, warm, and gone in one afternoon."),
  made("whistle", "Acorn Whistle", "tube", ["t", "T", "u"], ["musical", "crunchy"], 9, { acorn: 2, reed: 1 }, "One note, very proud of itself."),
  made("basket", "Reed Basket", "basket", ["t", "T", "u"], ["green", "cozy"], 9, { reed: 3 }, "Woven by someone with a lot of patience."),
  made("crown", "Clover Crown", "ring", ["g", "G", "h"], ["green", "soft"], 8, { clover: 3 }, "Fits any head that holds still."),
  made("brooch", "Button Brooch", "gem", ["b", "B", "n"], ["shiny"], 12, { button: 2, pebble: 1 }, "Two buttons and a pebble pretending to be a jewel."),
  made("lamp", "Moss Lamp", "bulb", ["c", "C", "m"], ["cozy", "shiny"], 13, { mushroom: 2, button: 1 }, "A cap that glows a little when it is dark."),
  made("pie", "Minnow Pie", "pie", ["o", "O", "Q"], ["fishy", "sweet"], 12, { fish: 1, berry: 2 }, "Sweet and fishy, which is the point."),
  made("chime", "Shell Chime", "bell", ["v", "V", "x"], ["musical", "watery"], 12, { shell: 2, reed: 1 }, "Rings when the pond does."),
  made("quill", "Feather Quill", "feather", ["w", "s", "S"], ["bookish", "soft"], 10, { feather: 2, reed: 1 }, "For writing songs down before they fly off."),
  made("stack", "Pebble Stack", "stack", ["s", "S", "d"], ["earthy"], 7, { pebble: 3 }, "Three stones that agreed to stay."),
)


const crop = (id: string, name: string, shape: string, tones: ItemDef["tones"], tags: Tag[], sellFor: number, blurb: string): ItemDef => ({
  id, name, kind: "crop", shape, tones, tags, value: sellFor * 3, sellFor, blurb,
})

const seed = (crop: string, name: string, price: number, blurb: string): ItemDef => ({
  id: `${crop}-seed`, name, kind: "seed", shape: "seed", tones: ["t", "T", "u"], tags: [], value: Math.ceil(price / 2), sellFor: Math.max(1, Math.floor(price / 3)), blurb,
})

add(
  mat("firefly", "Jarred Firefly", "bulb", ["c", "b", "B"], ["shiny", "cozy"], 6, "Caught, admired, and let out again. The glow stays on your hands."),
  mat("dewgem", "Dew Gem", "gem", ["c", "C", "m"], ["shiny", "watery"], 8, "A drop of the waterfall that decided to stay."),
  mat("wood", "Wood", "log", ["t", "T", "u"], ["earthy", "cozy"], 3, "A good split log. It still smells like the tree it was."),
  mat("echopetal", "Echo Petal", "leaf", ["p", "P", "q"], ["musical", "soft"], 7, "It hums back whatever you hum at it."),
  mat("stairchip", "Stair Chip", "stone", ["v", "V", "x"], ["earthy", "shiny"], 7, "A step off a staircase that goes nowhere in particular."),
  mat("starshard", "Star Shard", "star", ["c", "b", "B"], ["shiny", "musical"], 9, "A little bit of the night, fallen on purpose."),
  crop("glowbean", "Glowbean", "bean", ["g", "G", "h"], ["green", "shiny"], 8, "Pods that glow a faint green when you whisper to them."),
  crop("puffroot", "Puffroot", "root", ["v", "V", "x"], ["earthy", "cozy"], 11, "Round, warm, and slightly proud of being underground."),
  crop("moonmelon", "Moonmelon", "melon", ["c", "C", "m"], ["sweet", "watery"], 24, "Striped like a small moon. Cool to the touch, even at noon."),
  crop("spiralkale", "Spiralkale", "swirl", ["g", "G", "h"], ["green", "crunchy"], 12, "It curls in the direction of whoever is being kind."),
  crop("twinklegourd", "Twinklegourd", "gourd", ["p", "P", "q"], ["sweet", "shiny"], 18, "Blinks when nobody is looking, which is how you know."),
  crop("snowpearl", "Snowpearl", "round", ["w", "b", "B"], ["watery", "soft"], 20, "Grows in frost and tastes like the first cold morning."),
  crop("shadowradish", "Shadow Radish", "split", ["A", "z", "y"], ["earthy", "soft"], 9, "Jung's favorite. Half of it grows underground, and that half is the one it won't talk about."),
  crop("mandalichoke", "Mandalichoke", "mandala", ["v", "B", "n"], ["green", "musical"], 16, "Every leaf folds around a center, and the center is also a leaf."),
  crop("schrodinberry", "Schrödinberry", "flicker", ["w", "V", "x"], ["sweet", "shiny"], 14, "Ripe and unripe until you look. You may only ever eat the one you didn't look at."),
  crop("parallaxpepper", "Parallax Pepper", "pepper", ["r", "R", "q"], ["crunchy", "shiny"], 10, "Looks closer when you step back. Hot only from a certain angle."),
  crop("fadeleek", "Fadeleek", "leek", ["w", "g", "S"], ["soft", "watery"], 12, "A little paler every day, and a little sweeter. Tastes like remembering."),
  crop("quincidence", "Quincidence", "quince", ["o", "O", "Q"], ["sweet", "cozy"], 22, "Ripens the same night something else happens. Nobody has proved it's related."),
  crop("hypnagogicpea", "Hypnagogic Pea", "bean", ["b", "V", "x"], ["soft", "cozy"], 9, "The pods pop just as you drift off, and you remember a stair that wasn't there."),
  crop("aurorasprout", "Aurora Sprout", "sprout", ["c", "G", "B"], ["green", "shiny", "watery"], 18, "A tiny green sprout holding a tiny green sky. It ripples when it's pleased."),
  seed("glowbean", "Glowbean Seeds", 4, "Lotus Bloom and High Yang. Ready in 3 nights."),
  seed("puffroot", "Puffroot Seeds", 6, "Lotus Bloom and Anicca. Ready in 4 nights."),
  seed("moonmelon", "Moonmelon Seeds", 14, "High Yang and Anicca. Ready in 6 nights."),
  seed("spiralkale", "Spiralkale Seeds", 7, "Anicca and Deep Yin. Ready in 4 nights."),
  seed("twinklegourd", "Twinklegourd Seeds", 11, "Deep Yin and Lotus Bloom. Ready in 5 nights."),
  seed("snowpearl", "Snowpearl Seeds", 12, "Deep Yin only. Ready in 5 nights."),
  seed("shadowradish", "Shadow Radish Seeds", 5, "Lotus Bloom only. Ready in 3 nights."),
  seed("mandalichoke", "Mandalichoke Seeds", 10, "Lotus Bloom only. Ready in 5 nights."),
  seed("schrodinberry", "Schrödinberry Seeds", 9, "High Yang only. Ready in 4 nights, probably."),
  seed("parallaxpepper", "Parallax Pepper Seeds", 6, "High Yang only. Ready in 3 nights."),
  seed("fadeleek", "Fadeleek Seeds", 7, "Anicca only. Ready in 4 nights."),
  seed("quincidence", "Quincidence Seeds", 15, "Anicca only. Ready in 6 nights."),
  seed("hypnagogicpea", "Hypnagogic Pea Seeds", 5, "Deep Yin only. Ready in 3 nights."),
  seed("aurorasprout", "Aurora Sprout Seeds", 12, "Deep Yin only. Ready in 5 nights."),
)

add(
  made("stew", "Glowbean Stew", "jar", ["g", "G", "h"], ["cozy", "green"], 16, { glowbean: 2, puffroot: 1 }, "Warm all the way down, and faintly lit."),
  made("sorbet", "Melon Sorbet", "pie", ["c", "C", "m"], ["sweet", "watery"], 20, { moonmelon: 1, berry: 1 }, "Cold enough to make your ears ring pleasantly."),
  made("crisps", "Kale Crisps", "leaf", ["g", "G", "h"], ["crunchy", "green"], 12, { spiralkale: 2 }, "They crunch in a key somewhere near C."),
  made("lantern", "Gourd Lantern", "bulb", ["p", "P", "q"], ["shiny", "cozy"], 22, { twinklegourd: 1, mushroom: 1 }, "A carved gourd with a glowcap inside. Friendly, not spooky."),
  made("pillow", "Puffroot Pillow", "round", ["v", "V", "x"], ["soft", "cozy"], 18, { puffroot: 2, feather: 1 }, "It sighs when you lean on it."),
  made("starcharm", "Star Charm", "star", ["c", "b", "B"], ["shiny", "musical"], 26, { starshard: 2, button: 1 }, "Hums a note only the person holding it can hear."),
)

/** Keepsakes, one per friend, and the five Lamp parts (given by the last friend of each act). */
const keep = (id: string, name: string, shape: string, tones: ItemDef["tones"], tags: Tag[], blurb: string, kind: ItemKind = "keepsake"): ItemDef => ({
  id,
  name,
  kind,
  shape,
  tones,
  tags,
  value: 0,
  blurb,
})

add(
  keep("hatchling-bell", "Hatchling Bell", "bell", ["e", "w", "E"], ["musical"], "The first bell Ada ever rang. It rings in a small voice."),
  keep("dewdrop-locket", "Dewdrop Locket", "drop", ["b", "B", "n"], ["watery", "shiny"], "A drop that never dries. Pilgrim wears it on holidays."),
  keep("tin-key", "Tiny Tin Key", "key", ["s", "S", "d"], ["shiny", "earthy"], "Opens one small lock, probably a diary's."),
  keep("lamp-wick", "Lamp Wick", "stalk", ["p", "P", "q"], ["soft", "cozy"], "The lamp's braided wick. Daria used it as a ribbon.", "part"),
  keep("puddle-charm", "Puddle Charm", "drop", ["c", "C", "m"], ["watery"], "A charm that smells like rain on warm dirt."),
  keep("skipping-stone", "Skipping Stone", "stone", ["l", "s", "S"], ["watery", "earthy"], "Seven skips on a good day. Euler keeps count."),
  keep("yuzu-charm", "Yuzu Charm", "round", ["o", "O", "Q"], ["sweet", "cozy"], "A warm little fruit that keeps its warmth."),
  keep("frost-feather", "Frost Feather", "feather", ["b", "B", "n"], ["soft", "watery"], "Never melts. Hofstadter considers this showing off."),
  keep("midnight-feather", "Midnight Feather", "feather", ["A", "z", "y"], ["soft", "watery"], "Pynchon's first feather. It came in like a small piece of the night."),
  keep("lamp-glass", "Lamp Glass", "bulb", ["c", "b", "B"], ["shiny", "watery"], "The lamp's glass. Conway thought it was a very nice piece of ice.", "part"),
  keep("crumb-charm", "Crumb Charm", "heart", ["o", "O", "Q"], ["sweet"], "A crumb Hamilton saved, shaped, and fell in love with."),
  keep("leaf-mitten", "Leaf Mitten", "leaf", ["g", "G", "h"], ["green", "soft"], "One mitten, for a paw that only needs one."),
  keep("purr-pebble", "Purr Pebble", "heart", ["a", "A", "z"], ["cozy", "earthy"], "Warm in the hand. It buzzes when you are sad."),
  keep("pouch-stone", "Pouch Stone", "stone", ["a", "A", "z"], ["cozy", "earthy"], "Ernst's warm sleeping stone. Heavier than it looks, and calmer."),
  keep("pearl-button", "Pearl Button", "button", ["w", "l", "s"], ["shiny", "earthy"], "Tegmark found it in the grass. It looked like a very small moon."),
  keep("lullaby-twig", "Lullaby Twig", "stalk", ["t", "T", "u"], ["soft", "musical"], "Kaufman's twig. It hums when it's windy, and it helps you sleep."),
  keep("lamp-oil", "Lamp Oil Flask", "jar", ["c", "C", "m"], ["shiny", "cozy"], "The lamp's oil. Abagnale was keeping it somewhere safe and sly.", "part"),
  keep("wag-whistle", "Wag Whistle", "tube", ["o", "O", "Q"], ["musical"], "Only dogs and very good friends can hear it."),
  keep("silver-horseshoe", "Silver Horseshoe", "ring", ["s", "w", "S"], ["shiny", "earthy"], "Thompson outgrew it. She says she did not."),
  keep("lamp-frame", "Lamp Frame", "cog", ["s", "S", "d"], ["earthy", "shiny"], "The lamp's iron frame. Lynch used it as a very sturdy chair.", "part"),
  keep("moss-perfume", "Moss Perfume", "drop", ["g", "G", "h"], ["green", "cozy"], "Smells of the deep wood, but gently. Mugler insists."),
  keep("black-pearl", "Black Pearl", "round", ["A", "z", "k"], ["shiny", "watery"], "The best of Gaultier's collection. He says it is the second best."),
  keep("song-page", "Song Page", "leaf", ["e", "E", "T"], ["bookish"], "One page of the Evening Song, in Wallace's careful hand."),
  keep("lamp-spark", "Lamp Spark", "gem", ["r", "R", "q"], ["shiny", "cozy"], "The last part: a small, stubborn glow. Vonnegut kept it warm.", "part"),
)

// things the world's props give out
add(
  mat("kindling", "Kindling", "stalk", ["t", "T", "u"], ["cozy", "earthy"], 3, "Split small so it catches. Smells like a good decision."),
  mat("honey", "Wild Honey", "jar", ["b", "B", "n"], ["sweet", "cozy"], 8, "Slow, gold-ish, and worth the one sting."),
  mat("postcard", "Postcard", "leaf", ["w", "s", "S"], ["bookish", "soft"], 6, "From somewhere with a better view than this one."),
  mat("rainbit", "Rainbow Chip", "gem", ["c", "b", "B"], ["shiny", "musical"], 9, "A corner of a rainbow, split off a prism by someone patient."),
  mat("fossil", "Spiral Fossil", "shell", ["s", "S", "d"], ["earthy", "bookish"], 10, "A shell that outlived its sea. It is still curling."),
  mat("diatom", "Diatom", "star", ["c", "C", "m"], ["shiny", "watery"], 9, "A glass house a single cell built. Wow."),
  mat("romanesco", "Romanesco", "swirl", ["g", "G", "h"], ["green", "crunchy"], 10, "Every spiral is made of smaller spirals made of smaller spirals."),
  made("collage", "Scrap Collage", "heart", ["p", "P", "q"], ["bookish", "shiny", "soft"], 14, { feather: 1, button: 1, clover: 1 }, "A feather, a button and a clover, glued into something better than they were."),
)

export const LAMP_PARTS = ["lamp-wick", "lamp-glass", "lamp-oil", "lamp-frame", "lamp-spark"] as const

export function item(id: string): ItemDef {
  return ITEMS[id] ?? { id, name: id, kind: "material", shape: "round", tones: ["s", "S", "d"], tags: [], value: 1, blurb: "" }
}

export const RECIPES = Object.values(ITEMS).filter((def) => def.recipe)

export const SEEDS = Object.values(ITEMS).filter((def) => def.kind === "seed")

/** Eight rows of eight. M main, L light, D dark, k outline, w white, G leaf. */
export const SHAPES: Record<string, readonly string[]> = {
  round: ["...GG...", "..kGGk..", ".kMMMMk.", "kMLMMMDk", "kMLMMMDk", "kMMMMDDk", ".kMDDDk.", "..kkkk.."],
  acorn: ["..kkkk..", ".kDDDDk.", "kDMMMMDk", ".kkkkkk.", ".kMLMDk.", ".kMMMDk.", "..kMDk..", "...kk..."],
  stalk: ["....kk..", "...kMLk.", "...kMDk.", "..kMLk..", "..kMDk..", ".kMLk...", ".kMDk...", "..kk...."],
  clover: ["..kk.kk.", ".kMMkMMk", ".kMLkMLk", "..kkMMk.", ".kMMkkk.", ".kMLkMk.", "..kk.Dk.", "....Dk.."],
  stone: ["........", "..kkkk..", ".kLLMMk.", "kLMMMMDk", "kMMMMMDk", "kMMMDDDk", ".kkkkkk.", "........"],
  button: ["..kkkk..", ".kLLMMk.", "kLMkkMDk", "kMMMMMDk", "kMkMMkDk", "kMMMDDDk", ".kDDDDk.", "..kkkk.."],
  shroom: ["..kkkk..", ".kMLLMk.", "kMLwMMDk", "kMMMMwDk", ".kkkkkk.", "..kLDk..", "..kLDk..", "...kk..."],
  fish: ["........", "..kkk..k", ".kLMMkkM", "kLwMMMMk", "kMMMMMDk", ".kDDDkkD", "..kkk..k", "........"],
  shell: ["..kkkk..", ".kLLMMk.", "kLMLMMDk", "kLMMLMDk", "kMMMMMDk", ".kMMMDk.", "..kDDk..", "...kk..."],
  feather: ["......kk", ".....kLk", "....kLMk", "...kLMk.", "..kLMDk.", ".kLMDk..", "kkMDk...", "k.kk...."],
  jar: [".kkkkkk.", ".kDDDDk.", "..kLMk..", ".kLMMMk.", "kLwMMMDk", "kMMMMMDk", "kMMMDDDk", ".kkkkkk."],
  tube: ["........", "kk......", "kLkkkkkk", "kLMMMMMk", "kMMMMDDk", "kDkkkkkk", "kk......", "........"],
  basket: ["..kkkk..", ".k....k.", "k......k", "kkkkkkkk", "kLMLMLDk", "kMDMDMDk", ".kMLMDk.", "..kkkk.."],
  ring: ["..kkkk..", ".kLLMMk.", "kLk..kMk", "kMk..kDk", "kMk..kDk", "kMMkkMDk", ".kMDDDk.", "..kkkk.."],
  gem: ["..kkkk..", ".kLLwMk.", "kLwMMMMk", "kLMMMMDk", ".kMMMDk.", "..kMDDk.", "...kDk..", "....k..."],
  bulb: ["..kkkk..", ".kLLMMk.", "kLwMMMMk", "kLMMMMDk", ".kMMMDk.", "..kkkk..", "..kDDk..", "..kkkk.."],
  pie: ["........", "..kkkk..", ".kLMMLk.", "kLMMMMMk", "kMDMDMDk", "kkkkkkkk", "kMMMMMDk", ".kkkkkk."],
  bell: ["...kk...", "..kMMk..", ".kLMMMk.", ".kLMMMk.", "kLMMMMDk", "kMMMMMDk", "kkkkkkkk", "...kDk.."],
  stack: ["........", "..kkkk..", ".kLMMDk.", "kkkkkkkk", "kLMMMMDk", "kkkkkkkk", "kLMMMMMk", ".kkkkkk."],
  heart: ["........", ".kk..kk.", "kLMkkMMk", "kLMMMMDk", "kMMMMMDk", ".kMMMDk.", "..kMDk..", "...kk..."],
  drop: ["...kk...", "..kMMk..", "..kLMk..", ".kLMMMk.", "kLwMMMDk", "kMMMMMDk", ".kMMMDk.", "..kkkk.."],
  leaf: ["......kk", "....kkMk", "..kkLMMk", ".kLLMMDk", "kLMMMDDk", "kMMDDkk.", "kDkk....", "kk......"],
  key: ["..kkk...", ".kLMMk..", ".kM.Mk..", ".kMMDk..", "..kMk...", "..kMkk..", "..kMMk..", "..kkk..."],
  split: ["..GkkG..", "...kk...", ".kLMMDk.", "kLMMMMDk", ".kMMMDk.", "..kMDk..", "..kDDk..", "...kk..."],
  mandala: ["..kkkk..", ".kLkMLk.", "kLkMMkDk", "kMMkkMMk", "kMMkkMDk", "kDkMMkDk", ".kDkMDk.", "..kkkk.."],
  flicker: ["..kkkk..", ".kLwMMk.", "kLMwMwDk", "kwMMwMDk", "kMwMMwDk", "kMMwMMDk", ".kMDDDk.", "..kkkk.."],
  pepper: ["....kG..", "...kGk..", "..kLMk..", ".kLMMDk.", ".kLMMDk.", "..kMMDk.", "..kMDk..", "...kk..."],
  leek: ["...GG...", "..kGGk..", "..kLMk..", "..kLMk..", "..kLMDk.", "..kMMDk.", ".kMMMDk.", "..kkkk.."],
  quince: ["...kG...", "..kGk...", "..kLMk..", ".kLMMDk.", "kLMMMMDk", "kMMMMMDk", ".kMMMDk.", "..kkkk.."],
  sprout: ["..k..k..", ".kLkkLk.", ".kMLMLk.", "kLMMMMDk", "kMMLMMDk", ".kMMMDk.", "..kMDk..", "...kk..."],
  log: ["........", "..kkkkk.", ".kLMMMDk", "kLMkkMDk", "kMMkMMDk", ".kMMMDDk", "..kkkkk.", "........"],
  seed: ["........", "...kk...", "..kLMk..", ".kLMMDk.", ".kMMMDk.", "..kMDk..", "...kk...", "........"],
  star: ["...kk...", "...kk...", "kkkLMkkk", "kLLMMMDk", ".kkMMDk.", ".kMMkDk.", "kMDkkMDk", ".kk..kk."],
  bean: ["........", "..kkkk..", ".kLMMMk.", "kLMwMMDk", "kMMMMDDk", ".kMDDDk.", "..kkkk..", "........"],
  root: [".G.GG.G.", "..kGGk..", ".kLMMDk.", "kLMMMMDk", "kMMMMMDk", ".kMMMDk.", "..kMDk..", "...kk..."],
  gourd: ["...kk...", "..kGGk..", ".kLMMDk.", "kLMMMMDk", ".kMMMDk.", "kLMMMMDk", "kMMMMDDk", ".kkkkkk."],
  swirl: ["..kkkk..", ".kLMMMk.", "kLMkkMMk", "kMMkLMDk", "kMMMMMDk", ".kMMMDk.", "..kkkk..", "........"],
  melon: ["..kkkk..", ".kLMLMk.", "kLMDMMDk", "kMLMDMDk", "kMDMLMDk", "kMMDMMDk", ".kMMMDk.", "..kkkk.."],
  cog: ["..k..k..", ".kMkkMk.", "kkMMMMkk", "kMMkkMMk", "kMMkkMDk", "kkMMMDkk", ".kMkkDk.", "..k..k.."],
}
