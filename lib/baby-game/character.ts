/**
 * lib/baby-game/character.ts — The character contract: what every friend in every world is made of
 *
 * Whatever the world, a new game always starts by creating its characters. Each one is a `Character`: looks, a name,
 * a personality, a role, goals, quests, likes, a home, and a memory that grows as you play. It is the abstraction of a
 * pixel-game villager that everything else builds on: the sprite reads `looks`, the rules read `goals` and `likes`, the
 * map reads `home`, and the model reads `characterBrief` (looks, role, goals, home and the latest memories) to speak
 * as them. A new game stores the whole cast in the save (`GameState.characters`), so a generated cast fits the same slot.
 *
 * Today `createCharacters` builds Valdivia's hand-made twenty-four from `cast.ts`, `homes.ts`, `quests.ts` and
 * `dharma.ts`. **Planned:** a Cast BIMBY writes `Character`s from the player's taste seed (`seed.ts`) and their
 * prompts and actions, validated against this same shape (`character.test.ts`), with this hand cast as its fallback.
 */

import type { FriendCadence, FriendDialogEffect, FriendTone } from "@/lib/baby-animal-personality"
import { isShy, RESIDENTS, temper, type Condition, type Resident } from "./cast"
import { pathOf } from "./dharma"
import { homeKindFor, HOMES, HOME_NOUN, type Home } from "./homes"
import { ITEMS, type Tag } from "./items"
import { QUESTS } from "./quests"
import { ZONES, type ZoneId } from "./world"

export type CharacterLooks = {
  /** Body plan; also the sprite key in `sprites.ts`. */
  species: string
  /** One line a sprite maker (a person, ComfyUI, or a BIMBY) can draw from. */
  marks: string
}

export type CharacterPersonality = {
  tone: FriendTone
  cadence: FriendCadence
  effect: FriendDialogEffect
  /** The favor they ask for (`lib/friend-whims.ts`). */
  whim: string
  shy: boolean
  social: boolean
  rainLover: boolean
  /** Hours asleep, `[from, to]`. */
  sleeps: [number, number]
  bio: string
  /** Their one idea from Zen, Taoism or Buddhism (`dharma.ts`), if they have one. */
  outlook?: string
}

/** What part a character plays. `keeper` holds a Lamp part, `link` passes a keepsake down the chain. */
export type CharacterRoleKind = "keeper" | "link" | "companion" | "visitor"

export type CharacterRole = { kind: CharacterRoleKind; title: string; act: number; zone: ZoneId }

export type CharacterGoal = {
  /** In their own words. */
  text: string
  /** Item ids they need brought. */
  needs: string[]
  /** What they hand over once it is done, and when. */
  gives: string
  gate: number
  condition: Condition
}

export type CharacterLikes = { tags: Tag[]; hates: Tag; loves: Tag }

/** `neighbor` is a talk with another friend (`chatter.ts`); `read` is a sitting at their bookshelf (`shelf.ts`). */
export type MemoryKind = "met" | "gift" | "wish" | "keepsake" | "quest" | "chat" | "visit" | "neighbor" | "read" | "told" | "asked" | "letter" | "study"

export type Memory = { day: number; kind: MemoryKind; text: string }

export type Character = {
  id: string
  name: string
  looks: CharacterLooks
  personality: CharacterPersonality
  role: CharacterRole
  goals: CharacterGoal[]
  /** Quest ids they give (`quests.ts`). */
  quests: string[]
  likes: CharacterLikes
  home: Home
  /** What happened to them, oldest first, capped at `MEMORY_MAX`: with the player, with other friends, and in what they read. */
  memory: Memory[]
}

export const MEMORY_MAX = 40

/** What each of the twenty-four looks like, in one drawable line. */
const MARKS: Record<string, string> = {
  chick: "round yellow-white chick still wearing the top half of her eggshell as a hat",
  bunny: "sleepy cream bunny with one ear always flopped, eyes half shut",
  gosling: "grey fluffy gosling standing very upright, chest out, like a tiny guard",
  fawn: "small spotted fawn with a soft braided ribbon around her neck",
  duckling: "yellow duckling in a teal scarf, wet feet",
  otter: "sleek brown otter pup holding a flat skipping stone",
  capybara: "calm round capybara with a small yuzu balanced on his head",
  penguin: "fuzzy grey penguin chick with a very serious face",
  blackduck: "little duckling black as a button, bright eyes",
  seal: "soft white seal pup, round as a cloud, whiskers",
  mouse: "tiny brown mouse with big ears and a crumb in her paws",
  hedgehog: "small hedgehog, soft face, spines half raised in alarm",
  kitten: "striped kitten mid-stretch in a sunbeam",
  possum: "grey baby possum with a pink nose and long bare tail",
  possum2: "grey baby possum hanging by her tail, sleepy at noon",
  possum3: "tiny white baby possum, smallest of three, mouth open mid-shout",
  fox: "orange fox kit with a white-tipped tail and a sly half smile",
  puppy: "floppy-eared puppy wagging so hard his whole back half moves",
  foal: "long-legged foal with a windblown mane, mid-gallop",
  cub: "big soft bear cub sitting on something he shouldn't",
  skunk: "black and white skunk kit with a tidy fluffy tail",
  crow: "glossy black crow chick with something shiny in his beak",
  owl: "round owlet with huge eyes and a feather quill",
  wolf: "grey wolf pup, quiet and watchful, carrying a warm ember",
}

function roleOf(r: Resident): CharacterRole {
  return { kind: ITEMS[r.gives]?.kind === "part" ? "keeper" : "link", title: r.title, act: r.act, zone: r.zone }
}

/** One Valdivia resident as a full character, with an empty memory. */
export function characterFromResident(r: Resident): Character {
  const t = temper(r.id)
  const path = pathOf(r.id)
  const home = HOMES[r.id] ?? { kind: homeKindFor(r.id), name: `${r.name}'s ${HOME_NOUN[homeKindFor(r.id)]}`, x: r.day[0], y: r.day[1] - 1 }
  return {
    id: r.id,
    name: r.name,
    looks: { species: r.id, marks: MARKS[r.id] ?? `a baby ${r.id}` },
    personality: {
      tone: t.tone, cadence: t.cadence, effect: t.effect, whim: t.whim, shy: isShy(r.id), social: r.social, rainLover: !!r.rainLover,
      sleeps: r.sleeps ?? [22, 6], bio: r.bio, outlook: path ? `${path.school}: ${path.idea}` : undefined,
    },
    role: roleOf(r),
    goals: [{ text: r.quest, needs: [...r.wants], gives: r.gives, gate: r.gate, condition: r.condition }],
    quests: QUESTS.filter((q) => q.giver === r.id).map((q) => q.id),
    likes: { tags: [...r.likes], hates: r.hates, loves: t.love },
    home: { ...home },
    memory: [],
  }
}

/** The cast a new game starts with. Today Valdivia's twenty-four; **Planned:** generated from the player's seed. */
export function createCharacters(): Record<string, Character> {
  return Object.fromEntries(RESIDENTS.map((r) => [r.id, characterFromResident(r)]))
}

/**
 * A loaded save's cast, brought up to date. Hand-made characters are rebuilt from code (so edits to `cast.ts` reach old
 * saves) and keep their memories; a character the code does not know (a generated one) is kept as saved.
 */
export function refreshCharacters(saved: Record<string, Character> | undefined): Record<string, Character> {
  const fresh = createCharacters()
  for (const [id, c] of Object.entries(saved ?? {})) {
    if (fresh[id]) fresh[id] = { ...fresh[id]!, memory: Array.isArray(c.memory) ? c.memory.slice(-MEMORY_MAX) : [] }
    else fresh[id] = c
  }
  return fresh
}

/** Add a memory to a character, in place. For use on a state already cloned by an engine action. */
export function remember(cast: Record<string, Character>, id: string, day: number, kind: MemoryKind, text: string) {
  const c = cast[id]
  if (!c) return
  c.memory = [...c.memory, { day, kind, text }].slice(-MEMORY_MAX)
}

/** The paragraph the model is given to play this character: looks, role, goals, home, and what they remember. */
export function characterBrief(c: Character, recent = 6): string {
  const zone = ZONES[c.role.zone]?.name ?? c.role.zone
  const lines = [
    `You look like this: ${c.looks.marks}.`,
    `Your role: ${c.role.title}, in ${zone}${c.role.kind === "keeper" ? "; you keep a part of the Orb Lamp" : ""}.`,
    `You live in ${c.home.name}, your ${HOME_NOUN[c.home.kind]}.`,
    `What you want: ${c.goals.map((g) => g.text).join(" ")}`,
  ]
  const mem = c.memory.slice(-recent)
  if (mem.length) lines.push(`You remember (oldest first): ${mem.map((m) => `day ${m.day}, ${m.text}`).join("; ")}.`)
  return lines.join("\n")
}
