/**
 * lib/baby-game/seed.ts — The taste seed: everything a new world would be generated from
 *
 * One plain object of lists: what is good, what is bad, the kinds of characters, missions, trinkets and plants
 * you would like to see, and names to borrow from. Valdivia was hand-made from these by hand (see the likes table
 * in `docs/BABY_GAME_REDESIGN.md`). The **Planned** standalone game reads only a seed like this one, plus a local
 * model, and builds a village from it (`docs/BABY_GAME_STANDALONE.md`).
 *
 * Data only. Nothing reads it yet, and it imports nothing, so it can move out of brain2 as is.
 */

export type GameSeed = {
  /** Things the player likes: become places, props, quests and what friends love. */
  good: string[]
  /** Things the player dislikes: become the antagonist and its leftovers, never cruelty aimed at the player. */
  bad: string[]
  /** Kinds of characters: species, roles, temperaments. */
  characters: string[]
  /** Shapes of missions that are fun. Each should reduce to the closed quest steps in `quests.ts`. */
  missions: string[]
  /** Trinkets and crafted things you would like to find or make. */
  trinkets: string[]
  /** Plants and crops, real or impossible. */
  plants: string[]
  /** Where names come from: people, characters, words. */
  names: string[]
  /** Anything else the world should keep in mind (tone, places, rules of the place). */
  notes: string[]
}

/** The owner's seed, as Valdivia was built from it. Edit freely; nothing breaks. */
export const OWNER_SEED: GameSeed = {
  good: [
    "white orb lights", "cobalt blue", "glow in the dark",
    "reflection", "distorted puddles", "light on water",
    "refraction", "prisms", "muted rainbows",
    "wonder", "new ideas",
    "diatoms", "tiny things", "microscope views",
    "collage", "scanned paper",
    "fireworks", "sunrises",
    "dinner parties", "free things", "trading",
    "the index at the back of a book", "libraries",
    "getting better at hard things",
    "percussive maintenance", "fixing things",
    "smells like gasoline and rain",
  ],
  bad: [
    "boredom", "anhedonia", "gloom", "settling",
    "cruelty",
    "planned obsolescence", "corporations",
    "tan paint", "popcorn ceilings",
    "yellow", "gold",
  ],
  characters: [
    "baby animals, sized true to each other",
    "shy friends who spook if you run",
    "lonely chatty friends",
    "a tiny companion hyrax",
    "little black duckling", "baby possums",
  ],
  missions: [
    "bring a friend what they asked for",
    "make something at the workbench",
    "grow and harvest a crop",
    "catch a fish",
    "play a mini game well",
    "do favors",
    "earn a friend's trust",
    "count tiny things",
    "fix something by hitting it",
    "throw a long-table dinner",
  ],
  trinkets: [
    "berry jam", "acorn whistle", "reed basket", "clover crown", "button brooch",
    "moss lamp", "shell chime", "feather quill", "pebble stack",
    "rainbow chip", "star shard", "diatom", "spiral fossil", "postcard",
  ],
  plants: [
    "glowbean", "puffroot", "moonmelon", "spiralkale", "twinklegourd", "snowpearl",
    "shadowradish", "mandalichoke", "schrodinberry", "parallaxpepper",
    "fadeleek", "quincidence", "hypnagogicpea", "aurorasprout",
    "romanesco", "slime mold",
  ],
  names: [
    "admired writers, thinkers, artists and characters",
    "Ada", "Bohm", "Hofstadter", "Pynchon", "Conway", "Tegmark", "Kaufman",
    "Wallace", "Vonnegut", "Gaultier", "Mathilda", "Dobby",
  ],
  notes: [
    "Stardew Valley meets Scribblenauts, with a little Minecraft",
    "a weak local model writes closed specs; code turns them into sprites and rules",
    "friends each hold one idea from Zen, Taoism or Buddhism, offered lightly",
    "silver chrome, never gold",
  ],
}
