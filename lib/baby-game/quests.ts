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
    text: "I'd love to see something you grew. Bring in three harvests from the Permaculture Patch, and I'll sit with them awhile.",
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
  {
    id: "orb-count", giver: "blackduck", title: "Orbs After Dark", objective: { kind: "bring", item: "firefly", qty: 2 },
    text: "Two Jarred Fireflies, please. I want to float them over the water at night and watch them smear into long white streaks. Dark water is the best screen.",
    thanks: "Look at them hang there. Round little suns. I could stay here all night.", reward: { buttons: 14, items: [["dewgem", 1]] }, trust: 4,
  },
  {
    id: "puddle-mirror", giver: "seal", title: "A Crooked Reflection", objective: { kind: "bring", item: "dewgem", qty: 1 },
    text: "I'd like one Dew Gem. Put it by a puddle at dusk and the whole sky bends. Even the clouds look surprised.",
    thanks: "There! The moon is fat and wobbly in there. It's better than the real one, a little.", reward: { buttons: 14 }, trust: 4,
  },
  {
    id: "prism-hunt", giver: "possum", title: "Light, Split", objective: { kind: "bring", item: "stairchip", qty: 2 },
    text: "Two Stair Chips with a clean edge. Hold them up to the lamp and they throw rainbows on the wall. Don't ask how. I'm still working it out.",
    thanks: "Red, then orange... there's a green I didn't expect. Oh. OH.", reward: { buttons: 16, items: [["starshard", 1]] }, trust: 4,
  },
  {
    id: "collage-night", giver: "possum2", title: "Collage Night", objective: { kind: "bring", item: "feather", qty: 2 },
    text: "I'm cutting up old pages and gluing them down with whatever's lying around. Two Soft Feathers would make the corners flutter.",
    thanks: "Torn paper, feather, a little glue. It means something. I don't know what yet.", reward: { buttons: 12 }, trust: 4,
  },
  {
    id: "diatom-count", giver: "possum3", title: "Tiny Glass Houses", objective: { kind: "bring", item: "shell", qty: 3 },
    text: "Three Whorl Shells! The lagoon is full of invisible houses made of glass and each one is a different shape. I'll draw them if I can look at yours first.",
    thanks: "Triangle! Star! A little ship! Nobody told me the water was so decorated.", reward: { buttons: 14, items: [["echopetal", 1]] }, trust: 4,
  },
  {
    id: "drop-puzzle", giver: "fox", title: "One Hard Thing", objective: { kind: "play", n: 3 },
    text: "Play three of the valley's mini games. Any. The first one is a mess. The third is the one you'll want to brag about. Getting better is the whole fun of it.",
    thanks: "See? Look how smooth that was. A month ago you'd have fumbled. Do you feel it? That's what getting better feels like.", reward: { buttons: 22, items: [["starshard", 1]] }, trust: 5,
  },
  {
    id: "yard-fix", giver: "cub", title: "Percussive Maintenance", objective: { kind: "craft", item: "whistle" },
    text: "My whistle stopped whistling. I smacked it twice and it did again. I need a new Acorn Whistle just in case. Can you make one?",
    thanks: "Perfect. It works first try. The hammer is feeling left out.", reward: { buttons: 16 }, trust: 4,
  },
  {
    id: "long-table", giver: "puppy", title: "A Long Table", objective: { kind: "craft", item: "stew" },
    text: "Everyone should eat together, and I want a big pot of Glowbean Stew in the middle. Dinner parties make friends out of anyone.",
    thanks: "Everybody sat down at once. Nobody even asked who was invited. It just happened.", reward: { buttons: 20, items: [["glowbean-seed", 2]] }, trust: 4,
  },
  {
    id: "smell-of-things", giver: "skunk", title: "A Good Nose", objective: { kind: "bring", item: "mushroom", qty: 3 },
    text: "Three Moss Caps. I'm blending something that smells like rain on warm stone with a little gasoline and sweet wood, and I will not be told it sounds wrong.",
    thanks: "It's a smell that doesn't have a name yet. That's the best kind.", reward: { buttons: 14 }, trust: 4,
  },
  {
    id: "old-pages", giver: "owl", title: "The Index", objective: { kind: "hearts", id: "owl", n: 4 },
    text: "I've kept every song in a book, but nothing lists where anything is. Come by and keep me company while I make an index. The back of a book is where all the doors are.",
    thanks: "Here: S, for song. V, for Vonnegut. W, for wonder. See how everything is a door?", reward: { buttons: 18 }, trust: 0,
  },
  {
    id: "first-light", giver: "wolf", title: "A Sunrise Walk", objective: { kind: "favors", n: 2 },
    text: "Do two favors with friends and I'll walk the ridge with you at first light. The sun comes up every day. I find that very comforting.",
    thanks: "There. It did it again. It always does. Something to count on.", reward: { buttons: 18, items: [["firefly", 1]] }, trust: 5,
  },
  {
    id: "shiny-swap", giver: "crow", title: "A Fair Trade", objective: { kind: "bring", item: "button", qty: 2 },
    text: "Two Shiny Buttons, and I'll swap you something from my hoard that's even shinier. Everything in the valley should be traded freely. Free things are the best things.",
    thanks: "Both ways, nobody loses. That's the entire trick.", reward: { buttons: 14, items: [["dewgem", 1]] }, trust: 4,
  },
]

export const questById = (id: string) => QUESTS.find((q) => q.id === id)
