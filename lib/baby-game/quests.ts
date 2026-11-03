/**
 * lib/baby-game/quests.ts — Friends' side quests, in the way of a village sim's quest log
 *
 * Data only. Each friend has one errand beyond their main want: bring things, craft something, bring in a few harvests,
 * catch fish, play a mini game, do favors together, or simply grow close. A quest shows in the Journal once its giver is
 * in reach and trusts you at two hearts; progress is read from the save (`engine.questProgress`), and `engine.claimQuest` pays it.
 * The same shape will carry the real-life quests that come from `life.ts` (Planned): a real task is a quest whose objective
 * is "done outside the game, marked done here".
 */

export type Objective =
  | { kind: "bring"; item: string; qty: number }
  | { kind: "hearts"; id: string; n: number }
  | { kind: "craft"; item: string }
  | { kind: "harvest"; n: number }
  | { kind: "fish"; n: number }
  | { kind: "play"; n: number }
  | { kind: "favors"; n: number }

export type Quest = {
  id: string
  giver: string
  title: string
  text: string
  thanks: string
  objective: Objective
  reward: { buttons: number; items?: Array<[string, number]> }
  trust: number
}

export const QUESTS: Quest[] = [
  {
    id: "breakfast-song", giver: "chick", title: "A Breakfast Song", objective: { kind: "bring", item: "berry", qty: 3 },
    text: "I'm trying to remember the breakfast song and I think it tastes like berries. Three Dew Berries and I'll hum the first line.",
    thanks: "Mm! It starts low, like a yawn. Thank you!", reward: { buttons: 12, items: [["glowbean-seed", 2]] }, trust: 4,
  },
  {
    id: "cozy-nest", giver: "bunny", title: "A Nest for the Oversleeper", objective: { kind: "craft", item: "basket" },
    text: "Could you weave a Reed Basket? Not for anything. I just want to see one made. It's very restful.",
    thanks: "It's perfect. I'm going to sleep in the idea of it.", reward: { buttons: 15 }, trust: 4,
  },
  {
    id: "gate-snack", giver: "gosling", title: "Snacks for the Gatekeeper", objective: { kind: "bring", item: "clover", qty: 2 },
    text: "Guarding is hungry work. Two Clover would help the gate stay shut and me stay awake.",
    thanks: "Crunch. The gate feels safer already.", reward: { buttons: 10, items: [["puffroot-seed", 1]] }, trust: 4,
  },
  {
    id: "quiet-garden", giver: "fawn", title: "A Quiet Garden", objective: { kind: "harvest", n: 3 },
    text: "I'd love to see something you grew. Bring in three harvests from the Homestead Patch, and I'll sit with them awhile.",
    thanks: "They smell like patience. Thank you.", reward: { buttons: 20, items: [["spiralkale-seed", 2]] }, trust: 5,
  },
  {
    id: "puddle-report", giver: "duckling", title: "The Puddle Report", objective: { kind: "fish", n: 3 },
    text: "Everyone says the pond has fish. I say prove it. Catch three and I'll write it in my puddle book.",
    thanks: "Three! The pond is officially real. I'll tell the puddles.", reward: { buttons: 14 }, trust: 4,
  },
  {
    id: "stone-collection", giver: "otter", title: "A Stone Collection", objective: { kind: "bring", item: "pebble", qty: 3 },
    text: "I only skip the good ones. Three Smooth Pebbles, please. I've got a feeling about them.",
    thanks: "Seven skips. Seven! Did you see?", reward: { buttons: 10, items: [["dewgem", 1]] }, trust: 4,
  },
  {
    id: "still-water", giver: "capybara", title: "Be Still With Me", objective: { kind: "hearts", id: "capybara", n: 5 },
    text: "There's nothing to bring. Just come by often and sit. When we are comfortable, I'll know.",
    thanks: "Ah. There it is. The calm. It was always yours too.", reward: { buttons: 18 }, trust: 0,
  },
  {
    id: "cold-treat", giver: "penguin", title: "Something Properly Cold", objective: { kind: "craft", item: "sorbet" },
    text: "I need a Melon Sorbet. Properly cold. No wobble. I will know.",
    thanks: "...Acceptable. Very acceptable. Do not tell anyone I smiled.", reward: { buttons: 22 }, trust: 5,
  },
  {
    id: "crumb-hunt", giver: "mouse", title: "The Great Crumb Hunt", objective: { kind: "bring", item: "acorn", qty: 4 },
    text: "Four Acorns, and I'll show you where I hide the best crumbs. Don't tell the hedgehog. He knows already.",
    thanks: "Under the third stone. Always the third stone.", reward: { buttons: 12 }, trust: 4,
  },
  {
    id: "purr-experiment", giver: "kitten", title: "A Purr Experiment", objective: { kind: "play", n: 1 },
    text: "Science needs a control. Play one of the little games around the valley and tell me how it feels. I'll compare it to purring.",
    thanks: "Very close to a purr. Maybe better. I'll write that down.", reward: { buttons: 16, items: [["firefly", 1]] }, trust: 4,
  },
  {
    id: "good-race", giver: "foal", title: "A Good Race", objective: { kind: "favors", n: 3 },
    text: "Do three favors with friends, any friends. Races are better when you've been practicing being kind. That's my theory.",
    thanks: "You're faster at being kind than at running. That's a compliment.", reward: { buttons: 20, items: [["starshard", 1]] }, trust: 5,
  },
  {
    id: "prickle-brush", giver: "hedgehog", title: "Something Soft", objective: { kind: "bring", item: "feather", qty: 2 },
    text: "Two Soft Feathers. For a brush. It's not for me. It's for feeling less prickly. Which is for me.",
    thanks: "Oh. Oh, that's lovely. I'll hold onto it all winter.", reward: { buttons: 12 }, trust: 4,
  },
]

export const questById = (id: string) => QUESTS.find((q) => q.id === id)
