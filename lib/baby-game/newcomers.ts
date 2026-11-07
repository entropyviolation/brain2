/**
 * lib/baby-game/newcomers.ts — Fifteen friends who moved into the empty zones (2026-11-03)
 *
 * The first twenty-four fill the five acts. These fifteen are side friends, like Pynchon and the possums: nobody
 * wants their keepsake, so they never block the chain. Each lives in a zone that was built but empty (marsh,
 * highlands, stacks, lake, dunes, Rhizome) and opens with that zone's act. Their pictures are snapped from the
 * circled animals on two reference sheets (`gen-sprites.json`). Everything a friend needs sits here in one place and
 * is spread into the lists that read it: `RESIDENTS` (cast.ts), `PATHS` (dharma.ts), `THEORY` (theory.ts), `QUESTS` (quests.ts),
 * `LESSONS` (dharma.ts), `ITEMS` (items.ts), `HOMES` (homes.ts), `MARKS` (character.ts), `SPRITE_SCALE` (sprites.ts).
 */

import type { Resident } from "./cast"
import type { Path } from "./dharma"
import type { HomeKind } from "./homes"
import type { ItemDef } from "./items"
import type { Quest } from "./quests"
import type { Theory } from "./theory"

/** A new friend's home: kind, tile (the door is the tile below) and name. */
export const NEWCOMER_HOMES: Record<string, { kind: HomeKind; x: number; y: number; name: string }> = {
  mallard: { kind: "nest", x: 8, y: 42, name: "The Reed Float" },
  goose: { kind: "nest", x: 20, y: 44, name: "Gander's Landing" },
  pig: { kind: "hutch", x: 22, y: 50, name: "The Good Mud House" },
  mole: { kind: "burrow", x: 7, y: 55, name: "Velvet Hole" },
  squirrel: { kind: "hollow", x: 54, y: 5, name: "The Cache Hollow" },
  woodpecker: { kind: "hollow", x: 52, y: 14, name: "The Drum Tree" },
  chipmunk: { kind: "burrow", x: 60, y: 19, name: "Stripe Cellar" },
  badger: { kind: "burrow", x: 71, y: 5, name: "The Deep Sett" },
  raccoon: { kind: "hollow", x: 71, y: 13, name: "The Washing House" },
  panda: { kind: "lodge", x: 71, y: 21, name: "The Bamboo Lodge" },
  elephant: { kind: "lodge", x: 50, y: 28, name: "The Long Memory" },
  monkey: { kind: "hollow", x: 60, y: 30, name: "Three-and-Four Tree" },
  kangaroo: { kind: "hutch", x: 46, y: 52, name: "The Pouch House" },
  lion: { kind: "den", x: 60, y: 53, name: "The Quiet Roar" },
  tiger: { kind: "den", x: 94, y: 39, name: "Burning Bright" },
}

/** What each looks like, in one drawable line. */
export const NEWCOMER_MARKS: Record<string, string> = {
  squirrel: "grey squirrel kit with a tail bigger than she is and a map of buried things",
  mole: "velvet-black mole pup with a pink nose and spade paws, squinting at the light",
  woodpecker: "black and white woodpecker chick with a red cap, tapping a tune",
  mallard: "mallard drake duckling with an emerald head, always mid-paddle",
  badger: "striped badger cub, grey as slate, white face stripes like a mask",
  raccoon: "masked raccoon kit rinsing a button in both paws",
  chipmunk: "striped chipmunk with full cheeks and a tiny tally on a stick",
  goose: "tall white gosling, just grown, who follows whoever she saw first",
  elephant: "small grey elephant calf with big ears, a short trunk and one tiny tusk",
  kangaroo: "young kangaroo with big feet, a long tail and a pocket of small things",
  lion: "lion cub with a first fuzz of mane and a very quiet roar",
  monkey: "orange monkey kid with a long curling tail and a clever face",
  panda: "round panda cub, black and white, sitting very still with a bamboo stalk",
  pig: "pink piglet, muddy to the knees, content to the bone",
  tiger: "striped tiger cub, orange and black, padding without a sound",
}

/** The kin species whose personality a new friend borrows (`PERSONA_OF`). */
export const NEWCOMER_PERSONA: Record<string, string> = {
  squirrel: "mouse", mole: "hedgehog", woodpecker: "crow", mallard: "duckling", badger: "skunk", raccoon: "fox", chipmunk: "bunny",
  goose: "gosling", elephant: "capybara", kangaroo: "foal", lion: "cub", monkey: "kitten", panda: "capybara", pig: "puppy", tiger: "wolf",
}

/** How big each stands in the world (`SPRITE_SCALE`). */
export const NEWCOMER_SCALE: Record<string, number> = {
  squirrel: 0.5, mole: 0.45, woodpecker: 0.55, mallard: 0.45, badger: 0.55, raccoon: 0.6, chipmunk: 0.45, goose: 0.7,
  elephant: 0.85, kangaroo: 0.8, lion: 0.8, monkey: 0.65, panda: 0.7, pig: 0.55, tiger: 0.8,
}

const keep = (id: string, name: string, shape: string, tones: ItemDef["tones"], tags: ItemDef["tags"], blurb: string): ItemDef => ({
  id, name, kind: "keepsake", shape, tones, tags, value: 0, blurb,
})

export const NEWCOMER_ITEMS: ItemDef[] = [
  keep("cache-map", "Cache Map", "leaf", ["t", "T", "u"], ["earthy", "bookish"], "Noether's map of everything she buried, and half of it she forgot."),
  keep("velvet-pebble", "Velvet Pebble", "stone", ["A", "z", "k"], ["soft", "earthy"], "Smooth from a long way underground. Borges says it holds a whole library, folded."),
  keep("drumstick", "Little Drumstick", "stalk", ["t", "T", "u"], ["musical", "earthy"], "Reich's first tapping twig. It keeps good time even in the dark."),
  keep("green-feather", "Emerald Feather", "feather", ["g", "G", "h"], ["watery", "green"], "From Turing's neck. It is not green; it is a trick of the light, and Turing likes tricks."),
  keep("stripe-stone", "Stripe Stone", "stone", ["w", "s", "S"], ["earthy", "cozy"], "A pebble with a stripe the same as Haraway's. They are related, in a way."),
  keep("rinsed-button", "Rinsed Button", "button", ["c", "b", "B"], ["watery", "shiny"], "Washed forty times by Perec. The cleanest button in the valley."),
  keep("tally-bead", "Tally Bead", "gem", ["o", "O", "Q"], ["sweet", "earthy"], "One bead for every seed Lovelace has counted. There are a great many."),
  keep("down-feather", "Down Feather", "feather", ["w", "l", "s"], ["soft", "cozy"], "The first feather Lorenz grew. She followed it for a week before she knew it was hers."),
  keep("memory-knot", "Memory Knot", "ring", ["a", "A", "z"], ["cozy", "bookish"], "A knot in a reed that Sacks ties each time something is worth keeping."),
  keep("spring-cog", "Spring Cog", "cog", ["s", "S", "d"], ["earthy", "shiny"], "A tiny wound spring from the Pouch House. It jumps on its own when no one is looking."),
  keep("mane-braid", "Mane Braid", "stalk", ["o", "O", "Q"], ["cozy", "shiny"], "Orwell's first braid. It is mostly fuzz, and very brave."),
  keep("three-four-bell", "Three-and-Four Bell", "bell", ["o", "O", "Q"], ["musical", "sweet"], "Goodall rings it at dawn: three in the morning, four at night, and nobody complains."),
  keep("bamboo-flute", "Bamboo Flute", "tube", ["g", "G", "h"], ["musical", "green"], "Dillard's flute. It plays one slow note, and the note takes all afternoon."),
  keep("mud-charm", "Mud Charm", "drop", ["a", "A", "z"], ["earthy", "cozy"], "Berry's charm. It is exactly as muddy as it looks, and that is the point."),
  keep("amber-eye", "Amber Eye", "gem", ["o", "O", "Q"], ["shiny", "earthy"], "A bright amber stone from Blake's pelt. Look into it and it looks back kindly."),
]

export const NEWCOMERS: Resident[] = [
  // Cobalt Glow Marsh (act 1)
  {
    id: "mallard", name: "Turing", title: "Duckling who floats on a good question", zone: "marsh", act: 1,
    wants: ["reed"], gives: "green-feather", gate: 3, condition: "dry", likes: ["watery", "green"], hates: "crunchy",
    day: [9, 44], social: true, rainLover: false,
    bio: "Green as a bottle and twice as curious. Thinks the pond is a very slow computer.",
    hello: "Quack. Hello. I'm counting ripples. One... two... you broke the count. That's fine. It's a good number.",
    quest: "One River Reed to stir the water with. I want to see whether the ripples remember where they started.",
    thanks: "They do not. It is the loveliest result I have ever gotten.",
    give: "My Emerald Feather. It isn't really green. The light just agrees to look that way for me.",
    clue: "Come on a dry day, when the water is clear. I give best when I can see all the way to the bottom.",
    story: [
      "I wonder whether a duck can think about thinking. I've been floating on it for a week and I'm still dry.",
      "Pig says mud is a kind of memory. I said memory is just mud that remembers it's mud.",
      "A machine, a mind, a duck. Everything is a little pond with rules. I'd love to know the rules. I'd love more to be surprised by them.",
    ],
  },
  {
    id: "goose", name: "Lorenz", title: "Follows the first thing she ever saw", zone: "marsh", act: 1,
    wants: ["basket"], gives: "down-feather", gate: 3, condition: "morning", likes: ["soft", "earthy"], hates: "shiny",
    day: [21, 46], social: true,
    bio: "Hatched looking at a wheelbarrow. Has followed wheelbarrows ever since.",
    hello: "HONK. Oh! I'm sorry. I thought you were my wheelbarrow. You are very much not. Hello.",
    quest: "A Reed Basket, please. A big one with a handle. I want to be followed for once, and a basket is easy to follow.",
    thanks: "It has a handle. It has a lid. I think I shall follow it.",
    give: "A Down Feather. The first one. I held it so long that it started to feel like mine.",
    clue: "I am a morning goose. Ask early, when the first thing I see is you.",
    story: [
      "I follow whatever I saw first. Mostly it's a wheelbarrow. Once it was a very kind wheelbarrow.",
      "The geese in the old story flew off, and the teacher asked where they went. Nobody knew. I think they were going to see the next marsh.",
      "If I follow you, you are in charge of me. That's an enormous gift, and an enormous worry. Please walk slowly.",
    ],
  },
  {
    id: "pig", name: "Berry", title: "Farmer of mud", zone: "marsh", act: 1,
    wants: ["crown", "jam"], gives: "mud-charm", gate: 4, condition: "fed", likes: ["earthy", "sweet"], hates: "shiny",
    day: [23, 52], social: true,
    bio: "Pink to the knees, brown above. Believes every good thing begins as mud.",
    hello: "Oof. Hello! Mind the puddle. Actually, don't. It's a good puddle.",
    quest: "A Clover Crown and Berry Jam. Not for eating. Well, the jam. The crown is for the garden, to remind it who is boss.",
    thanks: "The garden is bossed. The jam is eaten. It is a very efficient day.",
    give: "My Mud Charm. It is exactly as muddy as it looks. That is how you know it's real.",
    clue: "Feed me first. I give with a full belly and a happy snout.",
    story: [
      "Mud is soil that has been told to be patient. Everything grows out of it, even the lotus. Especially the lotus.",
      "My farm is small. It feeds eleven animals and one duck who thinks he's a philosopher.",
      "People call me dirty. I call it hardworking. We should all be a little muddy, if we mean it.",
    ],
  },
  {
    id: "mole", name: "Borges", title: "Librarian of the underground", zone: "marsh", act: 1,
    wants: ["lamp"], gives: "velvet-pebble", gate: 4, condition: "alone", likes: ["bookish", "earthy"], hates: "shiny",
    day: [8, 57], social: false,
    bio: "Squints at everything. Has a library under the marsh that he has never been able to find the end of.",
    hello: "Ah. A visitor. Please keep the light behind you. The light is... very much.",
    quest: "A Moss Lamp, turned very low. I want to read one shelf without going blind. The shelf is long.",
    thanks: "Low, green, patient. I can read three words a minute. It is a revolution.",
    give: "A Velvet Pebble. It came from the deepest shelf. I think it is a book that forgot it was a book.",
    clue: "I only hand over books when we're alone. It's too bright when there are two of us.",
    story: [
      "The library under the marsh is infinite. I'm sure of it. I've been walking for months, and every shelf has a shelf behind it.",
      "A burrow is a room that is useful because it's empty. I've dug a great many useful things.",
      "I'm nearly blind, and I've never been lonely. The books have so much to say, and they say it quietly.",
    ],
  },
  // Kauai Highlands (act 3)
  {
    id: "squirrel", name: "Noether", title: "Cache-keeper with a very big tail", zone: "highlands", act: 3,
    wants: ["stack", "basket"], gives: "cache-map", gate: 4, condition: "sneak", likes: ["earthy", "crunchy"], hates: "fishy",
    day: [55, 7], social: true,
    bio: "Buries acorns in perfect symmetry and forgets where, which is how oaks happen.",
    hello: "Oh! Oh. Hi. Don't move. I'm trying to remember where I put the... no. It's gone. Hello.",
    quest: "A Pebble Stack and a Reed Basket. The stack marks the spot, and the basket holds whatever I find when I dig it up.",
    thanks: "A mark and a basket. Now I will definitely forget which is which. It's fine. It always works out.",
    give: "My Cache Map. It's full of Xs. About half of them are right. The other half have little oak trees growing.",
    clue: "Don't startle me. I only hand over the map when I haven't been scared that day.",
    story: [
      "Everything I bury is a little present to the future. The future is very bad at finding them. It's a good arrangement.",
      "If you turn the map, the buried things line up in a pattern. I didn't plan that. I think the ground did.",
      "I don't hoard. I deposit. There is a difference, and the difference is that I forget, and someone else is happy.",
    ],
  },
  {
    id: "woodpecker", name: "Reich", title: "Phases and taps", zone: "highlands", act: 3,
    wants: ["whistle", "chime"], gives: "drumstick", gate: 4, condition: "morning", likes: ["musical", "earthy"], hates: "soft",
    day: [53, 16], social: true,
    bio: "Taps on trees in patterns that slip out of step and back again.",
    hello: "tap-tap... tap-tap... hello... tap-tap. Sorry. I can't stop in the middle. I'll finish the phrase.",
    quest: "An Acorn Whistle and a Shell Chime. I'm layering two beats, and the whistle will drift out of time with the chime.",
    thanks: "Listen. They slide apart. They slide back. They are never the same twice. That is the whole song.",
    give: "My Little Drumstick. It keeps good time even in the dark. Please keep it in time with something kind.",
    clue: "I'm best in the morning, when the trees are quiet and every tap is clear.",
    story: [
      "Two taps in unison. Then one speeds up, just a hair. The whole pattern shifts. It takes a whole day to come back around.",
      "I used to think music had to be written. Now I think it is just a rule you start and then listen to.",
      "The trees don't mind. They hum back. It takes them about seven years to answer, but they always do.",
    ],
  },
  {
    id: "chipmunk", name: "Lovelace", title: "Counts everything, loves it", zone: "highlands", act: 3,
    wants: ["brooch", "jam"], gives: "tally-bead", gate: 4, condition: "played", likes: ["sweet", "earthy"], hates: "watery",
    day: [61, 21], social: true,
    bio: "Stuffs her cheeks and counts what's in them. The total is always a good number.",
    hello: "Hi! Hi hi. Wait, don't say anything. I'm at seven hundred and twelve. ...Okay. Hello!",
    quest: "A Button Brooch to pin my tally to and Berry Jam to keep the counting sweet. Mathematics is hungry work.",
    thanks: "Seven hundred and thirteen. Thank you. That one's you.",
    give: "A Tally Bead. One for every seed so far. There are more beads than I can carry, and I'm happy about it.",
    clue: "Play with me first. Hop, count, hop. After a few rounds I'll forget to be stingy.",
    story: [
      "I count because the numbers keep me company. Seven is polite. Eleven is a little shy.",
      "A machine could do my counting. I'd like to see one try. I'd like to see one want to.",
      "My father wrote poems. I write tallies. I think they are the same thing. Both are saying: I was here, and it mattered.",
    ],
  },
  // The Index Stacks (act 3)
  {
    id: "badger", name: "Haraway", title: "Staying with the trouble", zone: "stacks", act: 3,
    wants: ["pie", "quill"], gives: "stripe-stone", gate: 5, condition: "evening", likes: ["bookish", "cozy"], hates: "sweet",
    day: [72, 7], social: false, sleeps: [5, 14],
    bio: "Digs in the library's footings. Believes every story is made of other stories.",
    hello: "Mm. Sit. Mind the roots. We are all tangled here. It is a feature.",
    quest: "A Minnow Pie to keep me going and a Feather Quill to write the margins. The margins are where the stories meet.",
    thanks: "Pie in the stomach, ink on the page. I feel entangled in the very best way.",
    give: "A Stripe Stone. It has my stripe, which is also yours, a little. We are related by tunnels.",
    clue: "I sleep through the day. Find me at dusk, when the stacks are quiet.",
    story: [
      "I don't believe in a clean story. I believe in the knot. Pull one thread and the whole sett moves.",
      "The best books are the ones that argue with each other. I like a shelf where nothing agrees.",
      "Staying with the trouble means you don't leave when it gets hard. You dig. You live near it. You learn its name.",
    ],
  },
  {
    id: "raccoon", name: "Perec", title: "Cataloguer of the almost-nothing", zone: "stacks", act: 3,
    wants: ["button", "basket"], gives: "rinsed-button", gate: 4, condition: "fed", likes: ["watery", "shiny"], hates: "soft",
    day: [72, 15], social: true,
    bio: "Washes everything he picks up, then lists it. The lists are very long and very kind.",
    hello: "Oh, hello. Hold on, don't move, I'm listing the things on your coat. One button. Two buttons. A thread.",
    quest: "A Shiny Button to wash and a Reed Basket to keep my lists in. I never throw one out. The small things are the whole thing.",
    thanks: "A button. A basket. I will wash the first and list the second. It is a lovely day to be me.",
    give: "A Rinsed Button. I washed it forty times. It's the cleanest button in the valley and also the most tired.",
    clue: "Bring me something first. I like to wash it while we talk. Giving feels easier with wet paws.",
    story: [
      "I write down what nobody writes down. The way the shelf smells. The sound the pond makes at four. The sock on the stair.",
      "The big things in life get all the attention. I try to look at the small ones. They are the ones that wore the path.",
      "Have you eaten? Then wash your bowl. It's as good as any other advice, and a bit tidier.",
    ],
  },
  {
    id: "panda", name: "Dillard", title: "Pays attention, slowly", zone: "stacks", act: 3,
    wants: ["chime", "reed"], gives: "bamboo-flute", gate: 5, condition: "alone", likes: ["green", "musical"], hates: "crunchy",
    day: [72, 23], social: false,
    bio: "Eats bamboo for the sound, mostly. Has never been in a hurry in her life.",
    hello: "Mm. Hello. Please sit. Don't do anything. That's the whole thing.",
    quest: "A Shell Chime to listen to and one River Reed, because it looks like bamboo and the shelf is very long.",
    thanks: "Chime. Reed. I will listen to the first and chew the second. It will take most of the afternoon.",
    give: "A Bamboo Flute. It plays one slow note. The note takes all afternoon. That is the idea.",
    clue: "I give only when I'm alone. I can't hear the note when other people are in it.",
    story: [
      "How you spend your days is how you spend your life. I spend mine looking at the bamboo.",
      "There was a moment last week where I saw a leaf as if it had never been seen. I'm not sure it had.",
      "Sitting isn't doing nothing. It's doing the one thing that all the other things need. Come sit.",
    ],
  },
  // Sparkle Lake (act 4)
  {
    id: "elephant", name: "Sacks", title: "Calf who remembers everything", zone: "lake", act: 4,
    wants: ["quill", "pie"], gives: "memory-knot", gate: 5, condition: "evening", likes: ["bookish", "watery"], hates: "crunchy", rainLover: true,
    day: [51, 30], social: true,
    bio: "Small for an elephant, big for a calf. Forgets nothing and is learning to be gentle about it.",
    hello: "Oh. You're the one with the lamp story. I remember. Everyone says hello, and I remember all of them.",
    quest: "A Feather Quill to write down what I know and a Minnow Pie because remembering takes a great deal of fuel.",
    thanks: "Written. Fed. The two nicest ways to be remembered.",
    give: "A Memory Knot. I tie one for everything worth keeping. This one is for you.",
    clue: "Ask in the evening. I think best when the light is long and the lake is full of the day.",
    story: [
      "There was a story about blind friends who each touched part of an elephant. One said a rope. One said a wall. One said a snake. They were all right.",
      "I remember everything, and some days that is a lot. I try to remember the good things first, so they get a head start.",
      "A memory is a thing you carry carefully. I am learning to hold it with an open trunk, not a fist.",
    ],
  },
  {
    id: "monkey", name: "Goodall", title: "Watches, then joins", zone: "lake", act: 4,
    wants: ["jam", "crown"], gives: "three-four-bell", gate: 5, condition: "played", likes: ["sweet", "green"], hates: "watery",
    day: [61, 32], social: true,
    bio: "Sits in the same tree every day, watching, then swings down and joins in.",
    hello: "Ooh. Ooh ooh. Hello. I've been watching you from up there. You're very interesting.",
    quest: "Berry Jam and a Clover Crown. Three of one in the morning, four of the other in the evening. Same total. Lots of grumbling.",
    thanks: "Three and four. The sum is the same. The mood is very different. That's the discovery.",
    give: "A Three-and-Four Bell. Ring it at dawn and at dusk. It never takes a side.",
    clue: "Play with me first. Swing, swap, laugh. After that I'll give you the whole tree.",
    story: [
      "I watch for a long time before I do anything. It's not shyness. It's the best way to find out what everyone else is really up to.",
      "The old trick: three in the morning, four in the evening, and everybody was furious. Four in the morning, three in the evening. Everybody was delighted. Same total.",
      "Fairness is whatever the smallest one feels. Not the loudest. I watch for the smallest.",
    ],
  },
  // Firework Dunes (act 4)
  {
    id: "kangaroo", name: "Kuhn", title: "Leaps, then reorganizes", zone: "dunes", act: 4,
    wants: ["whistle", "stack"], gives: "spring-cog", gate: 5, condition: "morning", likes: ["earthy", "crunchy"], hates: "cozy",
    day: [47, 54], social: true,
    bio: "A very big jump is just a lot of small hops that change what a hop means.",
    hello: "Boing. Hi. Sorry, I'm in the middle of a paradigm. It will be over in a bound or two.",
    quest: "An Acorn Whistle to count my hops and a Pebble Stack to stand on at the top of the pole. Then I step.",
    thanks: "Whistle. Stack. I climbed. I stepped. It was somewhere I had never been and had been the whole time.",
    give: "A Spring Cog. It jumps on its own when nobody is looking. Please don't look.",
    clue: "Ask in the morning, when I'm still full of leap and haven't thought it over yet.",
    story: [
      "Most days I hop. Some days, the hop is the wrong shape and the whole day changes. It is rattling and also wonderful.",
      "Once you've stood on top of a pole a hundred feet high, the only way forward is down. Or a step. Same thing, if you do it with your whole self.",
      "I carry a lot in my pouch. Half of it is questions. The other half are answers that don't fit the questions yet.",
    ],
  },
  {
    id: "lion", name: "Orwell", title: "A quiet roar", zone: "dunes", act: 4,
    wants: ["pie", "quill"], gives: "mane-braid", gate: 6, condition: "evening", likes: ["bookish", "cozy"], hates: "sweet",
    day: [61, 55], social: true,
    bio: "The mane is mostly fuzz. The roar is mostly a sigh. The conscience is huge.",
    hello: "Hello. Don't be afraid. I've been meaning to roar for days. It keeps coming out as a polite cough.",
    quest: "A Minnow Pie and a Feather Quill. I've a plain thing to say and I'd like to say it plainly. It takes a lot of paper.",
    thanks: "Plain words. Plain pie. I've never felt braver.",
    give: "My first Mane Braid. It's mostly fuzz and very brave. Please wear it where you can see it.",
    clue: "I'm calmest at dusk. Ask then, when the shadows are long and no one is watching me try to be fierce.",
    story: [
      "The loudest roar is not the best one. The best is the one that tells the truth in a voice that a child can follow.",
      "I think the lion and the unicorn are both tired. I'd like to tell them to put down the crown and share the tea.",
      "If the lamp comes back, I'll write one sentence. Just one. It will say what is plainly true and then it will stop.",
    ],
  },
  // Rhizome (act 5)
  {
    id: "tiger", name: "Blake", title: "Burning bright, politely", zone: "rhizome", act: 5,
    wants: ["brooch", "lamp"], gives: "amber-eye", gate: 6, condition: "alone", likes: ["shiny", "bookish"], hates: "soft",
    day: [95, 41], social: false,
    bio: "Orange and black like a picture of a fire. Writes songs in the margins of his own stripes.",
    hello: "Hello. Yes, I'm that one. The one in the forest of the night. I'm a bit tired of being a poem.",
    quest: "A Button Brooch to pin my verse to and a Moss Lamp to see it by. I write in the dark, but I read in the light.",
    thanks: "Brooch. Lamp. I have never been so well-lit, and I'm a tiger.",
    give: "My Amber Eye. Look into it, and it looks back kindly. That's how I know I'm not so fierce.",
    clue: "I give only when no one else is near. A tiger is shyer than a poem makes him out to be.",
    story: [
      "I've been asked who made me. I think the answer is the same as who made the lamb. Someone with a very soft hammer.",
      "The mills here run on a hundred hands. I've written about them in my notebook. Someday I'll read it to them.",
      "I'm not terrible. I'm only bright. It's a hard thing to be, and I'd like to be asked more often how I'm doing.",
    ],
  },
]

export const NEWCOMER_PATHS: Record<string, Path> = {
  mallard: {
    school: "Taoism", idea: "Swimming with the whirlpool", source: "Zhuangzi, ch. 19 (the swimmer at Lüliang)",
    belief: "The swimmer at the great falls went down with the water and came up with the water. He did not fight it, so it did not fight him.",
    sayings: [
      "Zhuangzi watched a man go over a waterfall and come out smiling. He said: I follow the water's way, not my own.",
      "Floating isn't doing nothing. It's agreeing with a very large idea.",
    ],
    koan: "If you stop swimming, are you still in the water?",
    counsel: "You don't have to push. Find the current, and let your feet be in it.",
    practice: "Today, when something is carrying you along, notice whether you're fighting it or floating.",
  },
  goose: {
    school: "Zen", idea: "Where did the wild ducks go?", source: "Blue Cliff Record, case 53 (Baizhang and the wild ducks)",
    belief: "The teacher pointed at the flying birds and asked where they went. The student said: away. The teacher twisted his nose. They were always here.",
    sayings: [
      "A teacher asked where the birds went. The student said they had flown away. The teacher tweaked his nose. HONK. That is the answer.",
      "I follow what I see first. A teacher is just the first thing you can't forget.",
    ],
    koan: "When the geese have flown, where is the sky they left?",
    counsel: "What you're following was never away. Turn around. It's right behind you, a little embarrassed.",
    practice: "Notice one thing you're always chasing. Stop, and see what it looks like when it isn't running.",
  },
  pig: {
    school: "Buddhism", idea: "No mud, no lotus", source: "Thich Nhat Hanh, No Mud, No Lotus (2014)",
    belief: "The lotus grows only in mud. Suffering and happiness are the same garden, and a good gardener does not throw away the dirt.",
    sayings: [
      "Thich Nhat Hanh said: no mud, no lotus. I said: no kidding. I live here.",
      "The thing you want to get rid of is often the thing the flower is made from.",
    ],
    koan: "What grows from the part of yourself you least like?",
    counsel: "Don't wash it off in a hurry. See what wants to grow in it.",
    practice: "Pick one hard feeling today and ask what it might be feeding.",
  },
  mole: {
    school: "Taoism", idea: "The use of the empty", source: "Tao Te Ching 11 (thirty spokes share one hub)",
    belief: "Thirty spokes meet at a hub, and it is the hole in the middle that makes the wheel useful. A room is the emptiness inside the walls.",
    sayings: [
      "Lao Tzu said a cup is useful because it's empty. I live in a very useful hole.",
      "I do most of my work in the dark. The dark is where things are not yet in the way.",
    ],
    koan: "What part of your day is the empty part, and what is it holding?",
    counsel: "Make room. It will fill with what you need and nothing else.",
    practice: "Leave ten minutes of today empty on purpose, and see what comes to fill it.",
  },
  squirrel: {
    school: "Zen", idea: "The moon the thief left behind", source: "Ryōkan's poem: the thief left the moon at the window",
    belief: "A poet owned nearly nothing, and a thief robbed his hut. He sighed, I wish I could give him the moon. Letting go keeps the window open.",
    sayings: [
      "Ryōkan said the thief left him the moon at the window. I bury things so the moon has something to find.",
      "What you let go of grows. Ask any acorn.",
    ],
    koan: "What was the last thing you gave away that you still have?",
    counsel: "Bury a worry today. It might be an oak by spring.",
    practice: "Give one small thing away, and notice what's left in its place.",
  },
  woodpecker: {
    school: "Zen", idea: "The wooden fish", source: "Zen monastic practice: the mokugyo, a wooden drum struck to keep chanting in time",
    belief: "In many temples a wooden fish is tapped to keep the chant steady. The fish never sleeps, so neither does the rhythm. Rhythm is how we stay together.",
    sayings: [
      "A wooden fish drum keeps a temple's chant in time. I'm a wooden fish with feathers.",
      "Tap, tap. Whatever you're doing, do it at a pace that someone else could join.",
    ],
    koan: "Where does the beat go between two taps?",
    counsel: "Find a steady tap and let the rest of the song grow around it.",
    practice: "Tap a slow count on your knee for one minute and notice where your attention lands.",
  },
  chipmunk: {
    school: "Buddhism", idea: "Counting the breath", source: "Ānāpānasati Sutta (mindfulness of breathing); the counting practice in Zen",
    belief: "To settle the mind, count each breath from one to ten, and when it wanders, begin again at one. Nobody reaches ten the first time.",
    sayings: [
      "You count the breath: one, two, three. Then you lose count. Then you start. That's the whole thing.",
      "Starting at one again isn't failing. It's the most honest thing you can do.",
    ],
    koan: "What number are you on right now, and who's counting?",
    counsel: "Begin at one. It's always okay to begin at one.",
    practice: "Count ten breaths today, and begin again if you lose track. Nobody is keeping score.",
  },
  badger: {
    school: "Buddhism", idea: "Interbeing", source: "Thich Nhat Hanh, The Heart of Understanding (1988)",
    belief: "A sheet of paper has a cloud in it, and a forest, and a logger, and his father. You cannot take one thing out without everything else coming with it.",
    sayings: [
      "Thich Nhat Hanh said you can see the cloud in a sheet of paper. I think I can smell it, too.",
      "Nobody is the author of a story alone. Look at the footnotes.",
    ],
    koan: "What is the cloud in your breakfast?",
    counsel: "You are not alone in this. You are a knot in a very large net.",
    practice: "Pick something you use today and name three people or things that had to exist for it to be here.",
  },
  raccoon: {
    school: "Zen", idea: "Wash your bowl", source: "Zhaozhou: 'Have you eaten your rice porridge? Then wash your bowl' (Mumonkan case 7)",
    belief: "A monk asked how to enter the Way. The teacher said: have you eaten? Wash your bowl. Awakening is in the washing.",
    sayings: [
      "Zhaozhou told a monk to wash his bowl. It was the most important thing he said all week.",
      "I wash every button forty times. By the fortieth I've stopped thinking about the button.",
    ],
    koan: "When you wash the bowl, who is washing?",
    counsel: "Do the next small thing completely. The big thing will wait politely.",
    practice: "Wash one dish today as if it were the whole of your practice.",
  },
  panda: {
    school: "Zen", idea: "Just sitting (shikantaza)", source: "Dōgen, Fukanzazengi (1227) and Shōbōgenzō",
    belief: "To sit without seeking anything is the practice itself. Dōgen called it just sitting. You do not sit to become awake. Sitting is the awake.",
    sayings: [
      "Dōgen said: just sit. I've been taking his advice since breakfast.",
      "I eat bamboo and listen. The listening is the meal.",
    ],
    koan: "When you sit and do nothing, who is sitting?",
    counsel: "Sit down. Nothing needs you for ten minutes. If it does, it will wait.",
    practice: "Sit for five minutes today with nothing to do, and let it be uncomfortable.",
  },
  elephant: {
    school: "Buddhism", idea: "The blind men and the elephant", source: "Udāna 6.4 (the parable of the blind men and the elephant)",
    belief: "Each of the blind men touched a part of the elephant and was certain the whole was a rope, a wall, a spear. Each was right about a part and wrong about the rest.",
    sayings: [
      "The Buddha told a story about men who touched an elephant, and each thought they knew. I'm the elephant. It is all very funny from up here.",
      "My trunk is a rope, my side is a wall, and I am a calf. Hello.",
    ],
    koan: "What part of the elephant are you holding?",
    counsel: "You're right about the part you're touching. Listen to the others, who touch the rest.",
    practice: "Ask someone who disagrees with you what they are touching.",
  },
  monkey: {
    school: "Taoism", idea: "Three in the morning", source: "Zhuangzi, ch. 2 (the monkey keeper)",
    belief: "The keeper told the monkeys: three chestnuts in the morning, four at night. They raged. Four in the morning, three at night. They were delighted. Same chestnuts.",
    sayings: [
      "A keeper offered monkeys three in the morning and four at night. Uproar. Reverse it: joy. Zhuangzi shrugged. I'd have shrugged too, if I were not so busy being delighted.",
      "I watch what makes people angry and what makes them glad. It is rarely the same as what they say.",
    ],
    koan: "What is the difference between three and four, and whose difference is it?",
    counsel: "Same chestnuts. Different order. Notice which order you are arguing about.",
    practice: "The next time you're annoyed, ask whether the total is the same.",
  },
  kangaroo: {
    school: "Zen", idea: "A step off the top of the pole", source: "Mumonkan, case 46 (step forward from the top of a hundred-foot pole)",
    belief: "You are at the top of a hundred-foot pole. How do you step forward? Everyone has climbed to the top. The step is the part that cannot be taught.",
    sayings: [
      "The Zen question: you're at the top of a hundred-foot pole. Now what? I jump. It is a living.",
      "A leap looks the same as a hop to anyone who isn't about to land.",
    ],
    koan: "Where does the pole end and the air begin?",
    counsel: "You can't see where you'll land. Jump with your whole self, and land with your whole self.",
    practice: "Take one step today that you can't fully justify, and see where it puts you.",
  },
  lion: {
    school: "Buddhism", idea: "The lion's roar", source: "Sīhanāda Sutta; the Buddha's teaching called a lion's roar for its fearless clarity",
    belief: "The Buddha's voice was called a lion's roar, not because it was loud, but because it was without fear. A plain true thing, said clearly, scatters the fear.",
    sayings: [
      "A roar can be small if it is clear. Mine is, and it works every time.",
      "The Buddha was compared to a lion. Not for the claws. For the calm.",
    ],
    koan: "What would you say if you were not afraid?",
    counsel: "Say the plain thing plainly. Then be quiet. The quiet is part of it.",
    practice: "Say one honest thing today without apologizing for it.",
  },
  tiger: {
    school: "Buddhism", idea: "The tigress and the Buddha", source: "Jātaka tales (the Vyāghrī Jātaka, in which the Buddha-to-be feeds a starving tigress)",
    belief: "In an old story a prince finds a starving tigress and her cubs and gives what he has. The tiger is not the villain. She is hungry. Compassion begins by seeing the hunger.",
    sayings: [
      "In one old story, a prince feeds a starving tigress. I like it. I'm often hungry.",
      "I'm not fierce. I'm bright. And sometimes I'm very tired.",
    ],
    koan: "What does hunger look like in a creature you fear?",
    counsel: "Whatever frightens you is also hungry for something. Ask what.",
    practice: "Today, meet something you find intimidating with a question, not a defense.",
  },
}

export const NEWCOMER_THEORY: Record<string, Theory> = {
  mallard: {
    school: "Marxism", idea: "The general intellect", source: "Karl Marx, Grundrisse, the 'Fragment on Machines' (1857-58)",
    belief: "Marx saw that machines are stored knowledge: everyone's cleverness, set in metal and made to work for someone. He asked who should own it. I'm a duck, and I ask the same.",
    sayings: [
      "Marx wrote that machines are congealed knowledge. I think my brain is a pond that congealed.",
      "A clever thing nobody owns is a gift. A clever thing one person owns is a fence.",
    ],
    question: "Who owns what everyone knows?",
    counsel: "What you know came from a lot of other heads. Share it back.",
    practice: "Teach one small thing you know to someone today, and don't charge for it.",
    offers: "reed",
  },
  goose: {
    school: "Utopian socialism", idea: "Passionate attraction", source: "Charles Fourier, The Theory of the Four Movements (1808)",
    belief: "Fourier thought work should be chosen by attraction, like how I follow a wheelbarrow. People, he said, thrive when the work they do is the work they are drawn to.",
    sayings: [
      "Fourier said work should be something you're pulled toward. I'm pulled toward baskets. It's going great.",
      "Nobody has to drive a goose. A goose goes where the thing she loves is.",
    ],
    question: "What are you pulled toward when nobody is making you?",
    counsel: "Follow the pull, even if it's a wheelbarrow. Especially then.",
    practice: "Do one thing today only because you are drawn to it.",
    offers: "feather",
  },
  pig: {
    school: "Anti-colonial", idea: "Seed sovereignty", source: "Vandana Shiva, Staying Alive (1988) and Seed Freedom",
    belief: "Seeds belong to the people who plant them. When a seed is owned by a company, a farmer must buy next year's harvest. A free seed is a very old kind of freedom.",
    sayings: [
      "Vandana Shiva says a seed is not a product. It's a promise. I keep my promises in a barrel.",
      "Save a few seeds from every harvest. That's the whole of the revolution, and also lunch.",
    ],
    question: "Who gets to keep the seeds?",
    counsel: "Keep a little back, and pass it on. That is what a farm is.",
    practice: "Save and share a seed, a cutting, or a recipe today.",
    offers: "clover",
  },
  mole: {
    school: "Critical theory", idea: "Excavation and memory", source: "Walter Benjamin, 'Excavation and Memory' (1932) and Berlin Childhood around 1900",
    belief: "Benjamin said memory is not a story you tell but a place you dig. You should not be afraid to turn the same soil again and again, because the soil is the thing.",
    sayings: [
      "Benjamin wrote that remembering is a kind of digging. I've been digging for years. It is going nicely.",
      "The soil is the story. The things are just what you find in it.",
    ],
    question: "What is buried in the same place you keep standing?",
    counsel: "Go back and dig. Carefully, like an archivist. Keep the dirt.",
    practice: "Pick one memory and write down what the ground around it looked like.",
    offers: "mushroom",
  },
  squirrel: {
    school: "Gift theory", idea: "The gift that moves", source: "Marcel Mauss, The Gift (1925)",
    belief: "In a gift economy, wealth is what you give away. A gift obliges a return, and the return obliges another. The circle is what holds the village together.",
    sayings: [
      "Marcel Mauss said that a gift is never really free. It's a promise to keep the circle going. I bury. You find. Circle.",
      "What I forgot to dig up is a present for someone I haven't met.",
    ],
    question: "What is in the circle that you haven't passed on yet?",
    counsel: "Give it on. The circle is the point, not the gift.",
    practice: "Give something small away today, and don't keep track of the return.",
    offers: "acorn",
  },
  woodpecker: {
    school: "Labor history", idea: "Eight hours, eight, and eight", source: "Robert Owen's slogan (1817) and the Chicago eight-hour movement (1886)",
    belief: "Eight hours for work, eight for rest, eight for what you will. A workday has a drumbeat, and you should not let someone else keep it going into your night.",
    sayings: [
      "Tap tap. That's eight hours of tapping. Then it's the tree's turn to rest.",
      "A fair day has three equal parts. Mine has a fourth part: more tapping.",
    ],
    question: "Whose beat is the one you're keeping?",
    counsel: "Set your own beat, and end it on time.",
    practice: "Stop one thing today at the time you said you would.",
    offers: "feather",
  },
  chipmunk: {
    school: "Labor history", idea: "Lord Byron and the Luddites", source: "Lord Byron's speech in the House of Lords against the frame-breaking bill (1812)",
    belief: "Byron stood in the Lords and said the weavers were not criminals but people. He asked what had been done for them before they were hanged. I'm a counter. I count who is being counted.",
    sayings: [
      "Byron defended the weavers when they broke the frames. My mother wrote about machines. Hers had no hands, mine has cheeks.",
      "A person is not a number, but a number can remind you there are people.",
    ],
    question: "Who is not being counted?",
    counsel: "Count them. Then tell someone who can do something.",
    practice: "Find one person's work you've never thanked, and thank them.",
    offers: "acorn",
  },
  badger: {
    school: "Critical theory", idea: "Situated knowledges", source: "Donna Haraway, 'Situated Knowledges' (1988) and Staying with the Trouble (2016)",
    belief: "No view is from nowhere. Every idea has an address, and a knowing that says where it stands is better than one pretending to float above. I know from the ground.",
    sayings: [
      "Haraway says there's no view from nowhere. My view is from under the stacks. It's quite good.",
      "Say where you are standing when you say what you see.",
    ],
    question: "Where are you standing when you say that?",
    counsel: "Say where you stand. It makes the rest more honest.",
    practice: "Add 'from where I stand' to one claim you make today.",
    offers: "mushroom",
  },
  raccoon: {
    school: "Critical theory", idea: "The critique of everyday life", source: "Henri Lefebvre, Critique of Everyday Life (1947) and Georges Perec, 'Approaches to What?' (1973)",
    belief: "Lefebvre said everyday life is where everything is decided and nobody looks. Perec said to look at the infra-ordinary: the habit, the stair, the fork. I wash and I look.",
    sayings: [
      "Perec wanted us to describe the things we think have no description. A button, for instance. It has a lot to say.",
      "Real life is in the routine. The big things only decorate it.",
    ],
    question: "What did you stop noticing yesterday?",
    counsel: "Look at the thing next to you. It has been waiting.",
    practice: "Describe one ordinary object in as much detail as you can, for two minutes.",
    offers: "button",
  },
  panda: {
    school: "Gift theory", idea: "Attention as a gift", source: "Lewis Hyde, The Gift (1983); Annie Dillard, Pilgrim at Tinker Creek (1974)",
    belief: "Hyde says a gift is what moves between people and creates a bond. Dillard says how you spend your days is how you spend your life. Attention is both.",
    sayings: [
      "Lewis Hyde wrote that a gift keeps moving. My attention is the gift. It moves slowly, but it keeps moving.",
      "If I give you my whole afternoon, I have given you my whole afternoon. It's the most I have.",
    ],
    question: "To what are you giving your afternoon?",
    counsel: "Give someone your slow, undivided attention today. It's rare, and it's free.",
    practice: "Listen to one person for five minutes without planning your reply.",
    offers: "reed",
  },
  elephant: {
    school: "Anti-colonial", idea: "The Green Belt Movement", source: "Wangari Maathai, The Green Belt Movement (1985) and Unbowed (2006)",
    belief: "Wangari Maathai planted trees with village women until there were thirty million. She said that planting a tree is a political act, and that a seedling is a form of hope.",
    sayings: [
      "Maathai said the planting is the protest. I remember every tree. It is a very large forest.",
      "Thirty million trees. One at a time. It's the only way trees are ever planted.",
    ],
    question: "What would you plant if you knew you'd never sit in its shade?",
    counsel: "Plant it. You don't have to see the shade.",
    practice: "Plant something this week: a seed, a plan, or a promise.",
    offers: "berry",
  },
  monkey: {
    school: "Anarchism", idea: "Baseline communism", source: "David Graeber, Debt: The First 5000 Years (2011)",
    belief: "Graeber noticed that people mostly share without keeping accounts: 'from each according to ability, to each according to need' is how we treat anyone we trust. It's the default. The ledger comes after.",
    sayings: [
      "David Graeber said we pass the salt without writing it down. I've seen monkeys do it with fruit.",
      "The ledger is what we pull out when we stop trusting each other.",
    ],
    question: "What do you give without counting?",
    counsel: "Start with trust, not the ledger. Keep the ledger only for strangers.",
    practice: "Do a small favor today without noting it down, even in your head.",
    offers: "berry",
  },
  kangaroo: {
    school: "Democratic socialism", idea: "Evolutionary socialism", source: "Eduard Bernstein, The Preconditions of Socialism (1899)",
    belief: "Bernstein said the movement is everything and the final goal is nothing: change comes by steps that change what a step means. A hop, a hop, and then a very different place.",
    sayings: [
      "Bernstein said the way is the goal. I hop. It's a good way.",
      "A big change is a lot of small ones that stopped being small.",
    ],
    question: "Which small hop did you do today that was part of a leap?",
    counsel: "Keep hopping. The landing will surprise you.",
    practice: "Take one small step toward something you've been calling 'too big'.",
    offers: "pebble",
  },
  lion: {
    school: "Democratic socialism", idea: "The Lion and the Unicorn", source: "George Orwell, The Lion and the Unicorn: Socialism and the English Genius (1941)",
    belief: "Orwell wrote in 1941 that a country could be remade by ordinary people: the decent, the plain-speaking, the stubborn. Equality is not a slogan. It is a table with room.",
    sayings: [
      "Orwell said to write plainly. It is a kind of kindness. I have a plain voice and a big conscience.",
      "A good society is one where you're not embarrassed to say what is true.",
    ],
    question: "What is the plain thing you've been avoiding saying?",
    counsel: "Say it clearly, say it kindly, and leave a seat for the other person.",
    practice: "Rewrite one thing you wrote today with half as many words.",
    offers: "honey",
  },
  tiger: {
    school: "Labor history", idea: "Witness against the beast", source: "E. P. Thompson, Witness Against the Beast: William Blake and the Moral Law (1993)",
    belief: "Thompson, who wrote the history of the English working class, found William Blake's visions rooted in the streets of ordinary people, not in the clouds. The tiger is bright because the mills are dark.",
    sayings: [
      "Thompson wrote that Blake belonged to the people on the street. So do I. I'm just orange about it.",
      "The mills here are quiet tonight. I wrote them a verse and they didn't complain.",
    ],
    question: "Who are you writing for, and are they in the room?",
    counsel: "Write for the people who can't be there to read it. They're the ones who need it.",
    practice: "Write four lines about something unfair you've seen this week.",
    offers: "fish",
  },
}

export const NEWCOMER_QUESTS: Quest[] = [
  {
    id: "stir-ripples", giver: "mallard", title: "Do Ripples Remember", objective: { kind: "bring", item: "reed", qty: 2 },
    text: "Two River Reeds. I want to stir the pond in a pattern and see whether the ripples keep the pattern or forget it.",
    thanks: "Forgotten. Completely. And yet the pond was never confused. How do they do it?", reward: { buttons: 12 }, trust: 4,
  },
  {
    id: "wheelbarrow-wait", giver: "goose", title: "Someone to Follow", objective: { kind: "favors", n: 2 },
    text: "Do two favors with friends, and I'll follow you for a whole afternoon. I'm very loyal. It's mostly a flaw, but it's mine.",
    thanks: "HONK. A good afternoon. We should do this again. I'll bring the wheelbarrow.", reward: { buttons: 14, items: [["feather", 1]] }, trust: 4,
  },
  {
    id: "mud-supper", giver: "pig", title: "A Muddy Supper", objective: { kind: "bring", item: "clover", qty: 3 },
    text: "Three Clover Clusters. The garden wants to be told it's doing well, and clover is how you say it.",
    thanks: "It's thriving. It's smug. It's perfect.", reward: { buttons: 14, items: [["clover", 1]] }, trust: 4,
  },
  {
    id: "dim-shelf", giver: "mole", title: "One Shelf in the Dark", objective: { kind: "bring", item: "mushroom", qty: 2 },
    text: "Two Moss Caps. They glow just enough to read by, and I am very tired of squinting at one line at a time.",
    thanks: "A whole sentence at once. I read it twice and cried a little. It's a great sentence.", reward: { buttons: 14 }, trust: 4,
  },
  {
    id: "forgotten-acorns", giver: "squirrel", title: "What I Forgot", objective: { kind: "bring", item: "acorn", qty: 3 },
    text: "Three Hill Acorns. I'll bury them in new places and forget them on purpose this time, as practice.",
    thanks: "Gone. All three. I have never been so free.", reward: { buttons: 12, items: [["acorn", 1]] }, trust: 4,
  },
  {
    id: "phase-drift", giver: "woodpecker", title: "Phase Drift", objective: { kind: "play", n: 2 },
    text: "Play two mini games. I want to hear how a rhythm fits into the middle of a game, and what a rhythm does when the game wins.",
    thanks: "It drifted, and then it landed. That's what a good game does. And a good song.", reward: { buttons: 16 }, trust: 4,
  },
  {
    id: "tally-the-valley", giver: "chipmunk", title: "A Complete Count", objective: { kind: "harvest", n: 3 },
    text: "Bring in three harvests. I'm counting everything the valley grows this week. It's a bigger number than you'd think.",
    thanks: "Two hundred and eleven. It's a lovely number. Thank you for adding to it.", reward: { buttons: 16, items: [["acorn", 2]] }, trust: 4,
  },
  {
    id: "margins-meet", giver: "badger", title: "Where the Margins Meet", objective: { kind: "bring", item: "postcard", qty: 2 },
    text: "Two Postcards. I'm gluing them into the margins of a very old book, so the stories can talk across the gap.",
    thanks: "They're talking. Neither of them agrees. It's a good conversation.", reward: { buttons: 14 }, trust: 4,
  },
  {
    id: "forty-washes", giver: "raccoon", title: "Forty Washes", objective: { kind: "bring", item: "button", qty: 2 },
    text: "Two Shiny Buttons. I'll wash each one forty times and catalogue the water it came out of. That's science and also soap.",
    thanks: "Eighty washes. Two buttons. They've never been so clean, or so tired.", reward: { buttons: 14, items: [["button", 1]] }, trust: 4,
  },
  {
    id: "one-slow-note", giver: "panda", title: "One Slow Note", objective: { kind: "hearts", id: "panda", n: 4 },
    text: "Come sit with me. That's all. It takes about four hearts' worth of time, and the note is very slow to arrive.",
    thanks: "There. Did you hear it? It was a low one. It lasted the whole afternoon.", reward: { buttons: 18 }, trust: 0,
  },
  {
    id: "tie-a-knot", giver: "elephant", title: "A Knot for Today", objective: { kind: "craft", item: "basket" },
    text: "Weave a Reed Basket, and I'll tie a knot for it. A basket is something to remember, if you've made it with your own paws.",
    thanks: "Knotted. I'll remember this basket for as long as I'm an elephant, which is a long time.", reward: { buttons: 16 }, trust: 4,
  },
  {
    id: "three-then-four", giver: "monkey", title: "Three and Four", objective: { kind: "bring", item: "berry", qty: 4 },
    text: "Four Dew Berries. I'll hand out three at dawn and the fourth at dusk. Watch the faces. It is the best show in the valley.",
    thanks: "Four berries. Seven faces. Three of them were fine. Four were thrilled. Same berries.", reward: { buttons: 14 }, trust: 4,
  },
  {
    id: "top-of-the-pole", giver: "kangaroo", title: "Off the Pole", objective: { kind: "bring", item: "pebble", qty: 3 },
    text: "Three Brook Pebbles. I'll stack them as high as they go and step off the top. Then I'll tell you where I landed.",
    thanks: "I landed on the first pebble. It was the same pebble. I'd never been there before.", reward: { buttons: 16, items: [["stairchip", 1]] }, trust: 5,
  },
  {
    id: "plain-sentence", giver: "lion", title: "One Plain Sentence", objective: { kind: "bring", item: "feather", qty: 2 },
    text: "Two Soft Feathers to pad the quill. I have one plain thing to say and it needs to be said softly.",
    thanks: "I wrote it down. It was seven words. I read it aloud and it did not roar. It didn't need to.", reward: { buttons: 16 }, trust: 4,
  },
  {
    id: "forest-of-night", giver: "tiger", title: "A Light for the Verse", objective: { kind: "bring", item: "firefly", qty: 2 },
    text: "Two Jarred Fireflies. I'll write by their light. A verse reads differently by something that blinks.",
    thanks: "It blinks. The verse blinks with it. I think the poem was waiting for that.", reward: { buttons: 16, items: [["dewgem", 1]] }, trust: 4,
  },
]

export const NEWCOMER_LESSONS: Record<string, { idea: string; lesson: string }> = {
  "stir-ripples": { idea: "Impermanence", lesson: "A ripple is a shape that moves through water and leaves the water unchanged. Most of what we call ourselves moves through us like that." },
  "wheelbarrow-wait": { idea: "Taking refuge", lesson: "To follow is to rely on something, and relying well is a skill. Choose gently what you're willing to follow." },
  "mud-supper": { idea: "No mud, no lotus", lesson: "Don't throw out the mud. The very thing you wish to be rid of may be what the flower grows in." },
  "dim-shelf": { idea: "The use of the empty", lesson: "A bowl is useful for its emptiness. Dim the lamp, and the small light you need becomes enough." },
  "forgotten-acorns": { idea: "Letting go", lesson: "Ryōkan left the moon for the thief. Whatever you release, the world can use, and you will not miss it as much as you think." },
  "phase-drift": { idea: "Rhythm as practice", lesson: "A steady beat is not rigid. Two beats a hair apart are how a pattern becomes a song. Stay on yours and let the other drift." },
  "tally-the-valley": { idea: "Counting the breath", lesson: "Counting is a way of paying attention. When you lose count, you have only to start again at one." },
  "margins-meet": { idea: "Interbeing", lesson: "A book is made of every book it argues with. Put two pages beside each other and watch what they say to each other." },
  "forty-washes": { idea: "Wash your bowl", lesson: "Washing is not a step before the practice. It is the practice. By the fortieth wash, there is no one washing." },
  "one-slow-note": { idea: "Just sitting", lesson: "Sit with someone and want nothing from them. The attention is the whole gift, and no one has to say a word." },
  "tie-a-knot": { idea: "Parts and whole", lesson: "Each of us touches a corner of the elephant. A small made thing, like a basket, is a way to hold your corner out to someone else." },
  "three-then-four": { idea: "Three in the morning", lesson: "The same total can feel like very different amounts. Notice which order you're arguing about before you decide it's the sum." },
  "top-of-the-pole": { idea: "A step beyond the pole", lesson: "The climbing is the part that can be taught. The step is yours. Do it with your whole self, and see where the air holds you." },
  "plain-sentence": { idea: "The lion's roar", lesson: "A plain true thing, said clearly and calmly, has more force than a shout. Say it, and then be still." },
  "forest-of-night": { idea: "Compassion for the hungry", lesson: "Even a feared thing is hungry for something. Light it gently, and see what it needed." },
}
