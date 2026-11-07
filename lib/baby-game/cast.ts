/**
 * lib/baby-game/cast.ts — The thirty-nine residents of Valdivia
 *
 * One resident per drawn species (`sprites.ts`). The chain is five acts of four or five friends: each act's
 * friends hand their keepsake to the next, and the last one in an act holds a Lamp part. Everything a resident
 * *is* in play comes from the friend personality the app already has (`lib/baby-animal-personality.ts`):
 * tone picks the approach they like, cadence picks how easily they spook, and the favorite whim picks the
 * favor they ask for and the kind of gift they love. What is written here is what the personality cannot say:
 * names, wants, secrets, and lines.
 */

import { speciesPersonality, type FriendCadence, type FriendDialogEffect, type FriendTone } from "@/lib/baby-animal-personality"
import { friendWhim } from "@/lib/friend-whims"
import { WHIM_TAGS, type Tag } from "./items"
import { NEWCOMERS, NEWCOMER_PERSONA } from "./newcomers"
import type { ZoneId } from "./world"

/** What must be true when you ask a trusting friend for their keepsake. A friend's clue says which. */
export type Condition = "none" | "morning" | "evening" | "rain" | "dry" | "sneak" | "alone" | "fed" | "played"

export const CONDITION_TEXT: Record<Condition, string> = {
  none: "no special day",
  morning: "ask before noon",
  evening: "ask after sundown",
  rain: "ask on a rainy day",
  dry: "ask on a dry day",
  sneak: "have not spooked them today",
  alone: "ask when no one else is near",
  fed: "give them a gift first today",
  played: "do their favor first today",
}

export type Resident = {
  id: string
  name: string
  title: string
  zone: ZoneId
  act: number
  /** Items turned in before they will trust you with the keepsake. */
  wants: string[]
  gives: string
  /** Hearts (of 10) you need before they hand it over. */
  gate: number
  condition: Condition
  likes: Tag[]
  hates: Tag
  /** Where they spend the day, in tiles. */
  day: [number, number]
  /** Does this friend come to the campfire at dusk? */
  social: boolean
  /** Hours they are asleep, `[from, to]`, wrapping midnight. Default 22–6. */
  sleeps?: [number, number]
  rainLover?: boolean
  bio: string
  hello: string
  quest: string
  thanks: string
  give: string
  /** Said (once) at four hearts: the hint that names their condition. */
  clue: string
  /** Heart events: said at three, six, and nine hearts. */
  story: [string, string, string]
}

export const RESIDENTS: Resident[] = [
  // Act I — Refraction Orchard
  {
    id: "chick", name: "Ada", title: "Hatchling of the orchard", zone: "orchard", act: 1,
    wants: ["jam"], gives: "hatchling-bell", gate: 3, condition: "morning", likes: ["sweet", "soft"], hates: "fishy",
    day: [6, 9], social: true,
    bio: "Still wearing half her egg. Believes it is a very good hat.",
    hello: "Peep! Are you the Center of The World? Nice hat. Mine's an egg.",
    quest: "I lost the Evening Song the night the lamp went out. Bring me Berry Jam. Singing is hungry work!",
    thanks: "JAM! I remember a note! It's a small one. Thank you!",
    give: "Here. This is the bell I rang when I hatched. Ring it when you're brave.",
    clue: "I wake with the sun and the sun is bossy. Ask me for things in the morning, before lunch!",
    story: [
      "Everyone says the Hush came in one night. I think it came in a long breath. I held mine. Then I saw a dewdrop turn the whole orchard upside down, and I let it out.",
      "Daria's been wearing something soft and braided. I think it's the lamp's wick. Don't tell!",
      "When I hatched, the lamp sang. I thought the whole world sang, and that every round white light was a tiny sun. I'd like to hear it again.",
    ],
  },
  {
    id: "bunny", name: "Pilgrim", title: "Oversleeper of the burrows", zone: "orchard", act: 1,
    wants: ["hatchling-bell", "crown"], gives: "dewdrop-locket", gate: 3, condition: "played", likes: ["green", "sweet"], hates: "fishy",
    day: [9, 8], social: true,
    bio: "Has overslept every morning since the Hush. Blames the quiet.",
    hello: "Oh! A visitor! Sorry, I was asleep. It is... is it noon?",
    quest: "I keep sleeping through everything. I need a little bell to wake me, and a Clover Crown so I feel important about it.",
    thanks: "A bell AND a crown. I will be up before dawn! (I will not.)",
    give: "Take my Dewdrop Locket. It holds one drop of the last good rain.",
    clue: "I'm much too sleepy to be serious. Hop around with me first, then ask. A tired bunny forgets to say no.",
    story: [
      "I used to wake before everyone. The lamp's humming was my alarm.",
      "Dobby says he found a tiny key under the orchard bench. He won't say whose it is. I think he knows.",
      "Do you ever feel like you're asleep even when you're up? That's the Hush. The cure is wondering about anything at all. Try it. What is a yawn FOR?",
    ],
  },
  {
    id: "gosling", name: "Dobby", title: "Gatekeeper, self-appointed", zone: "orchard", act: 1,
    wants: ["dewdrop-locket", "basket"], gives: "tin-key", gate: 4, condition: "alone", likes: ["earthy", "green"], hates: "shiny",
    day: [13, 15], social: true,
    bio: "Guards the orchard gate. Nobody asked him. He does it very well.",
    hello: "HALT. State your name and business. ...I'm Dobby. Hello.",
    quest: "I want a locket to polish and a Reed Basket to carry it. A guard should look the part.",
    thanks: "It's perfect. I look so official. Don't tell the others I cried.",
    give: "I found this Tiny Tin Key under the bench. I don't know whose lock it opens. Maybe you do.",
    clue: "I only hand things over in private. It's a guard thing. Nobody else should be near.",
    story: [
      "I guard the gate because the lamp used to guard us. Someone has to be big.",
      "Daria keeps a diary. It has a lock. I've seen her check the bench for her key every morning.",
      "I'm not brave. I'm loud. It's close enough that nobody checks.",
    ],
  },
  {
    id: "fawn", name: "Daria", title: "Keeper of quiet things", zone: "orchard", act: 1,
    wants: ["tin-key", "crown"], gives: "lamp-wick", gate: 5, condition: "sneak", likes: ["soft", "cozy"], hates: "crunchy",
    day: [8, 10], social: false,
    bio: "Speaks softly, writes everything down, and wears something braided.",
    hello: "...oh. Hello. I didn't hear you come. That's a good thing.",
    quest: "My diary's lock is missing its key. If you find it, and bring a Clover Crown for the page I'm on, I'll tell you a secret.",
    thanks: "My key! My diary! You have no idea. Okay. You have some idea.",
    give: "This is the Lamp Wick. I've been wearing it as a ribbon. I thought it was just pretty. Take it. Please light it.",
    clue: "Please don't run at me. Walk slowly. I only give things to friends who never startle me.",
    story: [
      "Loud things make me small. Soft things make me tall. You're quiet. Thank you.",
      "The lamp's wick is braided from wishes. I found it the morning after the Hush.",
      "I've written it all down: every animal, every day, with little diagrams in the margins. When the lamp lights, I'll read it aloud.",
    ],
  },
  // Act II — Moiré Pond
  {
    id: "duckling", name: "Mathilda", title: "Puddle enthusiast", zone: "pond", act: 2,
    wants: ["chime"], gives: "puddle-charm", gate: 3, condition: "rain", likes: ["watery", "musical"], hates: "crunchy", rainLover: true,
    day: [34, 18], social: true,
    bio: "Wears a teal scarf in every weather. Has opinions about puddles.",
    hello: "Quack! Splash! Hello! Did you bring puddles?",
    quest: "The pond used to ring like a bell. Bring me a Shell Chime and I'll show it how.",
    thanks: "It rings! It RINGS! The pond heard that!",
    give: "My Puddle Charm! It smells like rain on warm dirt. Best smell ever.",
    clue: "Ask me when it's raining. Everything is better then. I might say yes to anything.",
    story: [
      "The Hush is sad. Rain is the only thing that still sounds like itself. Stand in it with me. Don't bring an umbrella. Umbrellas are cowards.",
      "Euler skips stones when he's worried. He skipped forty yesterday.",
      "I'm not scared of the dark. I'm scared of nobody singing in it. And of puddles with nothing in them. A puddle should hold a whole upside-down sky.",
    ],
  },
  {
    id: "otter", name: "Euler", title: "Stone-skipper", zone: "pond", act: 2,
    wants: ["puddle-charm", "pie"], gives: "skipping-stone", gate: 4, condition: "played", likes: ["fishy", "watery"], hates: "bookish", rainLover: true,
    day: [37, 24], social: true,
    bio: "Keeps count of every skip. Pretends he doesn't.",
    hello: "Hey hey! Watch this. ...it sank. Watch THIS.",
    quest: "I'm hungry and I'm sad. A charm to cheer me and a Minnow Pie to fix the rest.",
    thanks: "Pie. Charm. You're good at this. Do you want to skip stones?",
    give: "My best Skipping Stone. Seven skips. Don't skip it. Hold it.",
    clue: "I'll give you anything after we play. Splash with me. Once we're laughing, I forget to be stingy.",
    story: [
      "I skip stones to count. Each skip is a ring, and the rings cross each other and make a pattern that is gone by the time you see it. If I stop counting, the days run together.",
      "Bohm sits so still the pond forgets he's there. It's the bravest thing I know.",
      "The lamp used to make the pond shine. I'd swim across it every night. Nobody swims now.",
    ],
  },
  {
    id: "capybara", name: "Bohm", title: "The calm of the pond", zone: "pond", act: 2,
    wants: ["skipping-stone", "jam"], gives: "yuzu-charm", gate: 4, condition: "evening", likes: ["cozy", "sweet"], hates: "musical", rainLover: true,
    day: [34, 14], social: true,
    bio: "Wears a yuzu on his head. It is not a hat. It is a friend.",
    hello: "Hello. Please sit. There is no hurry. The yuzu says hello too.",
    quest: "A stone to rest my paw on and some jam to rest my mind. Nothing else. Take your time.",
    thanks: "Ah. Stone. Jam. Peace. You've done something real.",
    give: "A Yuzu Charm. It keeps its warmth. Like me. Like everyone, if we let it.",
    clue: "Evenings are for sitting. Come when the sun goes low and I'll have nothing better to do than give.",
    story: [
      "Everyone is rushing to fix the Hush. I think it's okay to rest in it for a bit. Rest is a kind of balance, like a stone on a stone.",
      "Hofstadter is cold all the time and pretends it's a personality. He's kind. Don't tell him I said.",
      "The lamp was never meant to be fixed by one person. Take your friends along. Things get easier when they swing back and forth between us, like a pendulum we're all pushing.",
    ],
  },
  {
    id: "penguin", name: "Hofstadter", title: "Chilly perfectionist", zone: "cove", act: 2,
    wants: ["yuzu-charm", "brooch"], gives: "frost-feather", gate: 5, condition: "fed", likes: ["fishy", "shiny"], hates: "cozy", rainLover: true,
    day: [39, 6], social: false,
    bio: "Fuzzy, grey, and absolutely certain he is a very serious bird.",
    hello: "State your purpose. Be brief. I'm cold. I'm always cold.",
    quest: "A Yuzu Charm to warm my flipper and a Button Brooch to look dignified. In that order.",
    thanks: "Warm. Sharp-dressed. Acceptable. ...Thank you. Quietly.",
    give: "My Frost Feather. It never melts. I did not give you this. You found it.",
    clue: "Don't ask me anything on an empty stomach. Bring a snack first. A fish, ideally. I'll consider the request.",
    story: [
      "I wasn't always cold. The lamp used to warm the whole cove, and ice looked like glass jewelry with halos around it. Cold is only unpleasant when nobody makes it beautiful.",
      "Conway swallowed something that glowed once. She thinks it's a nice piece of ice.",
      "I act serious because I'm worried about being embarrassed. Do you ever do that? Being embarrassed is a very small thing and I treat it like a flood.",
    ],
  },
  {
    id: "blackduck", name: "Pynchon", title: "The little black duckling", zone: "pond", act: 2,
    wants: ["reed", "button"], gives: "midnight-feather", gate: 4, condition: "rain", likes: ["watery", "fishy"], hates: "crunchy",
    day: [40, 13], social: true, rainLover: true,
    bio: "Hatched black as a button among cream-colored siblings, and has decided that is the best color to be.",
    hello: "Peep. Yes, I'm the dark one. It's very good for being found in the rain. Hello.",
    quest: "One River Reed to chew on and one Shiny Button for my collection. I'm told I'm too small for opinions. I have a few.",
    thanks: "A reed that bends AND a button that shines. This is the best day of my whole life so far, which is nine days.",
    give: "My Midnight Feather. It's the first feather I ever grew in. Everyone else's came in pale. Mine came in like a small piece of the night.",
    clue: "I love rainy days. Everyone else hides. I paddle out and the whole pond sounds like applause. Ask me when it's raining.",
    story: [
      "My siblings are the color of cream. I'm the color of the ink in Wallace's jar. We still swim in a line, and nobody has to tell us how. It just works out.",
      "Mathilda says I'm her favorite and I'm not supposed to know. Everyone knows.",
      "When the Hush came the pond went silent and I thought, finally, a place where nobody can see me. I hated it. Black water is only good when something small and bright floats on it. Please light the lamp.",
    ],
  },
  {
    id: "seal", name: "Conway", title: "Round and unbothered", zone: "pond", act: 2,
    wants: ["frost-feather", "quill"], gives: "lamp-glass", gate: 6, condition: "rain", likes: ["fishy", "soft"], hates: "shiny", rainLover: true,
    day: [42, 24], social: false,
    bio: "Soft as a cloud. Has been hiding a very important piece of ice.",
    hello: "Oooh. Hi. Are you bringing snacks? You look like snacks.",
    quest: "A Frost Feather for my whiskers and a Feather Quill, so I can write letters to the fish. They never write back.",
    thanks: "Fluff! Letters! I feel so held. Okay, okay, okay.",
    give: "I think this is the Lamp's Glass? I thought it was a very nice piece of ice. Take it. Hold it gently.",
    clue: "I only get chatty in the rain. I like how it sounds on my back. Come see me then.",
    story: [
      "I swallowed something shiny once. I coughed it up. It glowed, a quiet blue-white, like a pearl with a pulse. I've kept it ever since.",
      "The Hush isn't a monster. It's a long pause. We all have to keep our place until it ends, and then the song picks up on the very next beat.",
      "You're the first person to bring me jam in weeks. I won't forget that.",
    ],
  },
  // Act III — Fossil Hill
  {
    id: "mouse", name: "Hamilton", title: "Collector of crumbs", zone: "hill", act: 3,
    wants: ["stack"], gives: "crumb-charm", gate: 4, condition: "alone", likes: ["sweet", "earthy"], hates: "musical",
    day: [9, 26], social: false,
    bio: "Small, fast, and shy. Keeps every crumb and knows each one's story.",
    hello: "Eep. Hi. I'm Hamilton. Please be quiet. Please stay.",
    quest: "I'm building a tiny mountain and I need a Pebble Stack for the base. It'll make my crumbs feel tall.",
    thanks: "It's the perfect base. Look. LOOK. My crumb mountain!",
    give: "A Crumb Charm. I made it from a crumb I loved too much to eat.",
    clue: "I'm too shy for an audience. Come when nobody else is around and I'll be braver.",
    story: [
      "Everyone's bigger than me. It's fine. Small things hear more.",
      "Johnston's making a collection of leaves. He won't say why. It's for someone special.",
      "I heard the lamp's song once from very close. It was in my ears for days. It had a wobble in it, two notes just apart, that made a third one. I miss it.",
    ],
  },
  {
    id: "hedgehog", name: "Johnston", title: "Prickly, but soft inside", zone: "hill", act: 3,
    wants: ["crumb-charm", "lamp"], gives: "leaf-mitten", gate: 4, condition: "sneak", likes: ["cozy", "green"], hates: "shiny",
    day: [13, 26], social: false,
    bio: "Rolls into a ball when startled. Is startled easily and often.",
    hello: "...*rustle*... oh. A person. I'm fine. I'm a ball. It's fine.",
    quest: "A Crumb Charm for the little thing in my chest, and a Moss Lamp so my burrow isn't so dark.",
    thanks: "Warm. Glow. I'm unrolling. Look, I'm unrolling.",
    give: "A Leaf Mitten. For a paw that only needs one. I only have one good paw. The other is a secret.",
    clue: "Walk, don't run. If I get startled today I will not talk to you until tomorrow.",
    story: [
      "I roll up because the world is loud. It isn't that I'm afraid of you. It's that I'm full. A ball is the most symmetrical shape there is. It is hard to be wrong as a ball.",
      "Reid is the only one who pets me without asking. I don't mind. Don't tell.",
      "When the lamp was lit, I'd unroll. Now I forget how.",
    ],
  },
  {
    id: "kitten", name: "Reid", title: "Purr scientist", zone: "hill", act: 3,
    wants: ["leaf-mitten", "whistle"], gives: "purr-pebble", gate: 5, condition: "evening", likes: ["cozy", "musical"], hates: "watery",
    day: [9, 33], social: true,
    bio: "Naps in every sunbeam. Insists it is research.",
    hello: "Mrrp. Sit. No. Lie down. We're doing science.",
    quest: "A Leaf Mitten to knead and an Acorn Whistle to chase. I can't be expected to think without them.",
    thanks: "Perfect. Purring has begun. It cannot be stopped.",
    give: "A Purr Pebble. It buzzes when you're sad. I made it by being very sad on a rock, a lot.",
    clue: "I'm most cooperative at dusk. The light is gold, the world is soft. I'll give you almost anything.",
    story: [
      "I nap to catch the lamp's last warmth. It left a stripe on the grass. I follow it.",
      "Abagnale has been hiding something shiny. Fox things. You'd understand if you were a fox.",
      "Hush or no Hush, a cat is a cat. Be quiet, be warm, be there. Warm is a sunbeam you carry in your fur.",
    ],
  },
  {
    id: "possum", name: "Ernst", title: "Eldest of the possum three", zone: "hill", act: 3,
    wants: ["basket"], gives: "pouch-stone", gate: 4, condition: "sneak", likes: ["soft", "cozy"], hates: "musical",
    day: [4, 37], social: true,
    bio: "Faints when startled. Is working on it. Rides his sisters' backs when the grass is tall.",
    hello: "Oh! Hi. Sorry. If I fall over, I'm fine. It's a possum thing. Hello.",
    quest: "A Reed Basket, please. For the three of us to sleep in. We've been sharing one leaf and it is not a good leaf.",
    thanks: "A basket! A real one! Tegmark is going to cry and Kaufman is going to jump in it immediately.",
    give: "My Pouch Stone. It's warm from sleeping on it. Please don't startle me while I hand it over, or I'll drop it, and then myself.",
    clue: "I'm only brave when nobody has surprised me today. Walk, don't run. Then ask.",
    story: [
      "There are three of us. We were born in the same blink. I'm the eldest by one second and I mention it a lot. Tegmark says it is not a coincidence. Tegmark says nothing is.",
      "When I play dead, I can hear everything. Everyone says kind things when they think I'm gone.",
      "I'm not scared of the dark. I'm scared of being the only one awake in it. That's why there are three of us.",
    ],
  },
  {
    id: "possum2", name: "Tegmark", title: "Nightshift possum", zone: "hill", act: 3,
    wants: ["jam", "stack"], gives: "pearl-button", gate: 5, condition: "evening", likes: ["sweet", "earthy"], hates: "fishy", sleeps: [6, 15],
    day: [11, 32], social: true,
    bio: "Sleeps all day, hangs from branches by her tail all night, and takes her work very seriously.",
    hello: "*upside down* Hello. I'm on duty. The duty is looking at the stars. It's important.",
    quest: "Berry Jam to keep me going and a Pebble Stack to prop up my branch. Don't ask how a pebble stack props a branch. Just trust me.",
    thanks: "Jam. Stable branch. I could hang here forever. I intend to.",
    give: "A Pearl Button. I found it in the grass and it looked like a small moon. I've been keeping it company.",
    clue: "I'm only fully awake after sundown. Come then and I'll hand you anything. Before that I'm useless and rude.",
    story: [
      "Ernst worries. Kaufman wanders. Somebody has to look at the stars and tell them we're still here.",
      "Hanging by my tail makes the whole world turn upside down, like a reflection. It's very calming. The Hush is just up. Down, we're fine.",
      "I count stars. I'm at nine hundred and four. They don't move much. They do blink, though, when you say a good thing. I think they're answering with the same word every time. Wow.",
    ],
  },
  {
    id: "possum3", name: "Kaufman", title: "Youngest, loudest, smallest", zone: "hill", act: 3,
    wants: ["crown", "pie"], gives: "lullaby-twig", gate: 5, condition: "fed", likes: ["green", "sweet"], hates: "bookish",
    day: [13, 33], social: true,
    bio: "Third out of three. Has never once been quiet. Tiny, white, and unstoppable.",
    hello: "HI! Hi hi hi! Are you the Center of The World? Can I ride on you? ...No? Okay! Hi!",
    quest: "A Clover Crown to be tall and a Minnow Pie to eat! Crown first! Pie second! Pie also first!",
    thanks: "I'm tall! I'm full! I'm so tall AND so full! Tegmark, LOOK!",
    give: "My Lullaby Twig. It hums when it's windy. It helps me sleep and it'll help you. Please keep it nice.",
    clue: "Feed me first. Everything makes more sense once I've been fed. That's how it is when you're three out of three.",
    story: [
      "Ernst says I'm too loud. Tegmark says I'm a lighthouse. I like being a lighthouse.",
      "When I get scared I go quiet. It's the quietest I've ever been. That's how you know.",
      "If the lamp comes back, I'll be the loudest thing in the whole valley and nobody can stop me. Okay. Some people can. It's Ernst. I'll make up songs on the spot, and sing them anyway, and they'll rhyme only by accident.",
    ],
  },
  {
    id: "fox", name: "Abagnale", title: "Sly, but kind about it", zone: "hill", act: 3,
    wants: ["purr-pebble", "quill"], gives: "lamp-oil", gate: 6, condition: "played", likes: ["bookish", "shiny"], hates: "fishy",
    day: [13, 35], social: true,
    bio: "Has a plan for everything. Most plans are about snacks.",
    hello: "Well, well, well. A new face. Let me guess: you need something.",
    quest: "A Purr Pebble to keep my paws warm and a Feather Quill for my schemes. Fair is fair.",
    thanks: "Pebble. Quill. You know, I might even like you.",
    give: "The Lamp's Oil. I borrowed it. For safety! I thought if I hid it, the Hush couldn't get it. Silly. Take it.",
    clue: "Play with me first. I've got plans and I'm happy to let you in on them if you're any fun.",
    story: [
      "I'm the sly one. Everyone says so. I just notice things first. Like the way a leaf and a lizard have the same pattern, if you squint.",
      "I hid the oil because I was scared someone would waste it. Turns out that was the waste.",
      "If the lamp relights, I'll tell everyone I planned it. Let me have that, okay?",
    ],
  },
  // Act IV — Swap Meet Yard
  {
    id: "puppy", name: "Irwin", title: "Professional enthusiast", zone: "barn", act: 4,
    wants: ["pie", "basket"], gives: "wag-whistle", gate: 5, condition: "morning", likes: ["earthy", "fishy"], hates: "soft",
    day: [34, 32], social: true,
    bio: "Greets everyone as if they've returned from a very long war.",
    hello: "YOU'RE HERE! I KNEW IT! I didn't know! But I KNEW!",
    quest: "A Minnow Pie to eat and a Reed Basket to carry the leftovers. There will not be leftovers.",
    thanks: "PIE! BASKET! YOU'RE THE BEST PERSON! Do it again!",
    give: "A Wag Whistle! Only dogs and very good friends can hear it. You're a very good friend!",
    clue: "I'm best in the morning! Come early! By afternoon I'm a puddle of sleep.",
    story: [
      "The Hush was so loud. I barked and barked and nothing barked back. I think it's the loneliest sound to be the only one saying hello.",
      "Thompson is too proud to say she misses the races. She does. Run with her, maybe.",
      "I'll keep trying until the lamp lights. I'm very good at trying. It's all I'm good at. Honestly it's most of what anyone is good at. Practice looks a lot like trying.",
    ],
  },
  {
    id: "foal", name: "Thompson", title: "Fast, and knows it", zone: "barn", act: 4,
    wants: ["wag-whistle", "crown"], gives: "silver-horseshoe", gate: 5, condition: "played", likes: ["green", "earthy"], hates: "bookish",
    day: [40, 37], social: true,
    bio: "Races the wind daily and loses daily. Considers it practice.",
    hello: "Race you to the fence! ...You don't have to. I'm just warming up.",
    quest: "A Wag Whistle to start races fairly and a Clover Crown for the winner. Obviously me.",
    thanks: "Fair starts. Fair crowns. I might have to race you someday.",
    give: "My old Silver Horseshoe. I outgrew it. I say I didn't, but I did. Take it.",
    clue: "Run with me first. A good race and I'd give you my last oat.",
    story: [
      "I race because standing still feels like the Hush. The wind is fast but it can't do a backflip. I'm working on that.",
      "Lynch's much stronger than he looks. He sat on the lamp frame. That's how he knew it was iron.",
      "Do you ever want to be bigger so nothing can hurt you? Me neither. (I do.)",
    ],
  },
  {
    id: "cub", name: "Lynch", title: "Gentle giant, mostly", zone: "barn", act: 4,
    wants: ["silver-horseshoe", "jam", "pie"], gives: "lamp-frame", gate: 6, condition: "fed", likes: ["sweet", "cozy"], hates: "bookish",
    day: [35, 34], social: true,
    bio: "Sits on things. Doesn't know it's a problem.",
    hello: "Oh! Hi! Did you bring snacks? You can tell me. I won't judge.",
    quest: "A Silver Horseshoe for luck, plus Jam AND Pie. I have a lot of feelings and they're all in my stomach.",
    thanks: "JAM. PIE. LUCK. I could cry. I'm crying. It's fine.",
    give: "The Lamp Frame! It's a very sturdy chair. I'll miss it. But I'll miss the lamp more.",
    clue: "Feed me first. I can't think about giving until I've been given. That's just how a bear works.",
    story: [
      "I sat on a metal thing once and it felt like the safest place in the world. I like to fix what is broken by sitting very hard on it. Sometimes a thump is all a gadget needs.",
      "Irwin has too much energy. I love him. He's a tornado with a face.",
      "If the lamp relights, I'll be happy. If it doesn't, I'll be happy. It's a bear thing. But I'd love to see it. Warm light on a cold barn at night is the best thing there is.",
    ],
  },
  // Act V — Thistle Wood
  {
    id: "skunk", name: "Mugler", title: "Misunderstood perfumer", zone: "wood", act: 5,
    wants: ["brooch", "stack"], gives: "moss-perfume", gate: 5, condition: "alone", likes: ["green", "cozy"], hates: "sweet",
    day: [20, 6], social: false,
    bio: "Smells wonderful, mostly. Resents the stereotype.",
    hello: "Yes, I'm a skunk. No, I won't. Hello.",
    quest: "A Button Brooch to look nice and a Pebble Stack to prop up my perfume bottles. Don't ask about the bottles.",
    thanks: "Gorgeous. Stable. You're hired as my best friend.",
    give: "Moss Perfume. It smells like the deep wood. Gently. I insist on gently.",
    clue: "I'd rather not be near anyone when I do something nice. It's a reputation thing. Come alone.",
    story: [
      "Everyone's polite. They stand back. It's kind and lonely. Smell is memory. If you give people a good one they forgive the rest.",
      "Gaultier collects shiny things. He has a pearl. He says it's the second best. I say it's the best.",
      "I made a perfume of the Hush once. It smelled like nothing. That was the most frightening part. Even rain and rust and gasoline smell like something. Nothing is the worst smell.",
    ],
  },
  {
    id: "crow", name: "Gaultier", title: "Collector of the shiny", zone: "wood", act: 5,
    wants: ["moss-perfume", "brooch"], gives: "black-pearl", gate: 6, condition: "fed", likes: ["shiny", "musical"], hates: "soft",
    day: [29, 3], social: false,
    bio: "Keeps a hoard. Is very proud of it. Has named each piece.",
    hello: "Caw! You have a button on you. I can feel it. Give it? ...No? Hello then.",
    quest: "A Moss Perfume to make my nest smell expensive and a Button Brooch. Shiny, shiny, shiny.",
    thanks: "Smells like a rich crow. Shines like a richer one. Welcome to the family.",
    give: "My Black Pearl. It's the second-best thing I own. The best is the way you just looked at me.",
    clue: "Bring me a gift first. Anything. A crow trusts a hand that arrives full.",
    story: [
      "I collect shiny things because they're loud in a world that went quiet. Chrome orbs, sparkly water, a button that throws light. Light is a kind of noise you can see.",
      "Wallace is writing the Song down in case we forget it. She's not sure if she's allowed.",
      "I'll give you the pearl. I'll give you more. But please, never call me a thief. Collector. Collector.",
    ],
  },
  {
    id: "owl", name: "Wallace", title: "Archivist of songs", zone: "wood", act: 5,
    wants: ["black-pearl", "quill"], gives: "song-page", gate: 7, condition: "evening", likes: ["bookish", "soft"], hates: "sweet", sleeps: [7, 16],
    day: [22, 9], social: false,
    bio: "Writes the Evening Song down so it can't be forgotten. Naps through the day.",
    hello: "*yawn* Hmm? Oh. Quiet, please. I've just gotten to a good line.",
    quest: "A Black Pearl for my inkwell's lid and a Feather Quill, because mine is down to the stub.",
    thanks: "Pearl lid. Fresh quill. Now the ink runs like a stream. Thank you.",
    give: "One page of the Evening Song. In my own careful hand. The rest is in Vonnegut's memory. Ask him.",
    clue: "I sleep through the daylight. Find me after sunset, when I'm awake and generous.",
    story: [
      "The song has seven verses. I only remember five. Vonnegut knows the sixth. I think he knows the seventh too. I keep an index so I can find anything, and the index of the song is the one page I can't finish.",
      "The Hush is when a song is too heavy to carry. So we share it. That's the whole idea of a chorus. Many small voices, one larger thing that none of them is.",
      "I used to think writing it down would save it. Now I think singing it would. Will you sing with me?",
    ],
  },
  {
    id: "wolf", name: "Vonnegut", title: "Keeper of the last spark", zone: "wood", act: 5,
    wants: ["song-page", "lamp"], gives: "lamp-spark", gate: 8, condition: "alone", likes: ["earthy", "cozy"], hates: "shiny",
    day: [26, 11], social: false, sleeps: [6, 14],
    bio: "Quiet and watchful. Has been carrying something warm since the Hush.",
    hello: "...Center of The World. I've been expecting you. Not quickly. Slowly. As things should be.",
    quest: "Wallace's Song Page, so I remember the words. And a Moss Lamp, because the dark is still the dark.",
    thanks: "The words. The light. I can almost hear it.",
    give: "The Lamp Spark. It's been warm in my chest since the Hush. I'm afraid of the dark. I'm not afraid of you.",
    clue: "I give this only when I am alone. It's too tender for a crowd. Come when we're by ourselves.",
    story: [
      "I kept the Spark because someone had to. Big things get lost. Small warm things get kept. It glows blue at the edge, like the last ember of a very long fire.",
      "I'm not strong. I'm stubborn. It's different. It's better, honestly.",
      "When the lamp lights, don't thank me. Thank everyone. Then thank me quietly. That's enough. And after that, let's watch the sunrise. It always comes. That's my favorite part.",
    ],
  },
  // Side friends who moved into the empty zones
  ...NEWCOMERS,
]

export function resident(id: string): Resident | undefined {
  return RESIDENTS.find((r) => r.id === id)
}

let revealAll = false

/** Development mode: show friends who have not been met or unlocked yet. Play never sets it. */
export function setRevealAll(on: boolean): void {
  revealAll = on
}

/** Is this friend in the valley (drawn, walking, on the map) at this act? Dev mode's reveal puts everyone there. */
export function inValley(r: Resident, act: number): boolean {
  return revealAll || r.act <= act
}

export function residentsOfAct(act: number): Resident[] {
  return RESIDENTS.filter((r) => r.act === act)
}

/** What the app already knows about this species as a friend. */
export type Temper = {
  tone: FriendTone
  cadence: FriendCadence
  effect: FriendDialogEffect
  whimId: string
  whim: string
  love: Tag
}

/** Friends whose species is not in the app's roster borrow the personality of a kin species. */
const PERSONA_OF: Record<string, string> = { blackduck: "duckling", possum: "mouse", possum2: "kitten", possum3: "hedgehog", ...NEWCOMER_PERSONA }

export function temper(id: string): Temper {
  const p = speciesPersonality(PERSONA_OF[id] ?? id)
  return {
    tone: p.tone,
    cadence: p.cadence,
    effect: p.dialogEffect,
    whimId: p.whimId,
    whim: friendWhim(p.whimId).title,
    love: WHIM_TAGS[p.whimId] ?? "soft",
  }
}

/** Quiet friends spook when you run near them. */
export function isShy(id: string): boolean {
  return temper(id).cadence === "quiet"
}

/** The four ways to approach a friend, in the same order as the app's tone ring. */
export const APPROACHES: ReadonlyArray<{ tone: FriendTone; label: string; blurb: string }> = [
  { tone: "gentle", label: "Soothe", blurb: "Soft voice, slow hands." },
  { tone: "playful", label: "Play along", blurb: "Be silly. Mean it." },
  { tone: "direct", label: "Be straight", blurb: "Say it plainly. No fluff." },
  { tone: "coach", label: "Cheer on", blurb: "You've got this. Let's go." },
]

/** 0 is the tone they like; 1 is next door on the ring; 2 is across it. */
export function approachDistance(preferred: FriendTone, tried: FriendTone): number {
  const ring = APPROACHES.map((a) => a.tone)
  const gap = Math.abs(ring.indexOf(preferred) - ring.indexOf(tried))
  return Math.min(gap, ring.length - gap)
}
