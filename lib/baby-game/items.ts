/**
 * lib/baby-game/items.ts — Materials, crafted trinkets, keepsakes, and the five Lamp parts
 *
 * Every item is an 8×8 shape (`SHAPES`) painted in three tones. `tags` are what animals love or hate:
 * a friend's favorite whim (`lib/friend-whims.ts`) picks the tag it loves (`WHIM_TAGS`).
 * Raw materials are gathered or bought at the Trade Stump; trinkets are crafted at the Workbench;
 * a keepsake is the one thing a friend gives you once they trust you; a Lamp part is a keepsake that
 * lights the Hollow Lamp. No yellow anywhere.
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

export type ItemKind = "material" | "trinket" | "keepsake" | "part"

export type ItemDef = {
  id: string
  name: string
  kind: ItemKind
  shape: string
  /** Light, main, dark: letters from `SPRITE_PALETTE`. */
  tones: readonly [string, string, string]
  tags: readonly Tag[]
  /** Buttons at the Trade Stump (sells for a third, rounded down, never under 1). */
  value: number
  blurb: string
  /** What it takes to craft, for trinkets. */
  recipe?: Record<string, number>
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
  mat("feather", "Soft Feather", "feather", ["w", "s", "S"], ["soft"], 3, "Dropped, not lost."),
)

add(
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
  keep("hatchling-bell", "Hatchling Bell", "bell", ["e", "w", "E"], ["musical"], "The first bell Pippin ever rang. It rings in a small voice."),
  keep("dewdrop-locket", "Dewdrop Locket", "drop", ["b", "B", "n"], ["watery", "shiny"], "A drop that never dries. Thimble wears it on holidays."),
  keep("tin-key", "Tiny Tin Key", "key", ["s", "S", "d"], ["shiny", "earthy"], "Opens one small lock, probably a diary's."),
  keep("lamp-wick", "Lamp Wick", "stalk", ["p", "P", "q"], ["soft", "cozy"], "The lamp's braided wick. Willow used it as a ribbon.", "part"),
  keep("puddle-charm", "Puddle Charm", "drop", ["c", "C", "m"], ["watery"], "A charm that smells like rain on warm dirt."),
  keep("skipping-stone", "Skipping Stone", "stone", ["l", "s", "S"], ["watery", "earthy"], "Seven skips on a good day. Marlow keeps count."),
  keep("yuzu-charm", "Yuzu Charm", "round", ["o", "O", "Q"], ["sweet", "cozy"], "A warm little fruit that keeps its warmth."),
  keep("frost-feather", "Frost Feather", "feather", ["b", "B", "n"], ["soft", "watery"], "Never melts. Fizz considers this showing off."),
  keep("lamp-glass", "Lamp Glass", "bulb", ["c", "b", "B"], ["shiny", "watery"], "The lamp's glass. Mochi thought it was a very nice piece of ice.", "part"),
  keep("crumb-charm", "Crumb Charm", "heart", ["o", "O", "Q"], ["sweet"], "A crumb Nib saved, shaped, and fell in love with."),
  keep("leaf-mitten", "Leaf Mitten", "leaf", ["g", "G", "h"], ["green", "soft"], "One mitten, for a paw that only needs one."),
  keep("purr-pebble", "Purr Pebble", "heart", ["a", "A", "z"], ["cozy", "earthy"], "Warm in the hand. It buzzes when you are sad."),
  keep("lamp-oil", "Lamp Oil Flask", "jar", ["c", "C", "m"], ["shiny", "cozy"], "The lamp's oil. Rue was keeping it somewhere safe and sly.", "part"),
  keep("wag-whistle", "Wag Whistle", "tube", ["o", "O", "Q"], ["musical"], "Only dogs and very good friends can hear it."),
  keep("silver-horseshoe", "Silver Horseshoe", "ring", ["s", "w", "S"], ["shiny", "earthy"], "Juniper outgrew it. She says she did not."),
  keep("lamp-frame", "Lamp Frame", "cog", ["s", "S", "d"], ["earthy", "shiny"], "The lamp's iron frame. Maple used it as a very sturdy chair.", "part"),
  keep("moss-perfume", "Moss Perfume", "drop", ["g", "G", "h"], ["green", "cozy"], "Smells of the deep wood, but gently. Pepper insists."),
  keep("black-pearl", "Black Pearl", "round", ["A", "z", "k"], ["shiny", "watery"], "The best of Sooty's collection. He says it is the second best."),
  keep("song-page", "Song Page", "leaf", ["e", "E", "T"], ["bookish"], "One page of the Evening Song, in Sage's careful hand."),
  keep("lamp-spark", "Lamp Spark", "gem", ["r", "R", "q"], ["shiny", "cozy"], "The last part: a small, stubborn glow. Fenn kept it warm.", "part"),
)

export const LAMP_PARTS = ["lamp-wick", "lamp-glass", "lamp-oil", "lamp-frame", "lamp-spark"] as const

export function item(id: string): ItemDef {
  return ITEMS[id] ?? { id, name: id, kind: "material", shape: "round", tones: ["s", "S", "d"], tags: [], value: 1, blurb: "" }
}

export const RECIPES = Object.values(ITEMS).filter((def) => def.recipe)

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
  cog: ["..k..k..", ".kMkkMk.", "kkMMMMkk", "kMMkkMMk", "kMMkkMDk", "kkMMMDkk", ".kMkkDk.", "..k..k.."],
}
