# `lib/baby-game/` — Mossmere Hollow, the baby animal game

_Last mapped: 2026-11-02 (fifth pass: front and side sprite views, the Center of The World)_

The rules and data of the **Baby animal game**: a small Stardew-shaped village in **Mossmere Hollow**, a hidden valley of forests, still lakes and impossible stairways. You enter it from a friend's detail page (**Baby animal game** key in the footer). Twenty baby animals live there. You earn their trust, bring them what they ask for, and they hand you keepsakes that the next friend wants, until five Lamp parts light the Hollow Lamp. The UI is `components/BabyGame/`.

Nothing here touches tasks, habits, points, or the friend gallery. The only read from the app is the friend's personality (`lib/baby-animal-personality.ts`, `lib/friend-whims.ts`) and, in the UI, their bond level and open mission title. Progress is one save in this browser: `brain2-baby-game` (`save.ts`).

## The twenty-four

Twenty were drawn at random from the 25-species roster in `lib/baby-animals.ts` (left out: piglet, raccoon, axolotl, lamb, goat). Four are new side friends: **Inky**, a little black duckling (Act II, the pond), and three baby possums, **Tuck**, **Mabel** and **Sprout** (Act III, Burrow Hill; they borrow a kin species' personality via `PERSONA_OF` in `cast.ts`). Every animal is a 32×32 sprite from `sprites.ts` with a front view and a side view, sized against the others, with fur flecks, ear insides, glinting eyes, paws and tails. The Center of The World is drawn the same way.

hedgehog, foal, cub, fox, puppy, capybara, crow, gosling, chick, owl, otter, kitten, mouse, seal, penguin, fawn, skunk, wolf, duckling, bunny, plus blackduck and possum, possum2, possum3.

## Files

```
sprites.ts      the 24 animals as 32×32 side-view sprites + the Center of The World; palette extends PIXEL_PALETTE (no yellow)
minigames.ts    rules and grades for the four mini games (Firefly Glade, Mossfall Hop, Echo Flower, Stair Weave) and what they pay
items.ts        11 materials, 16 crafted trinkets, 6 crops, 6 seeds, 15 keepsakes, 5 Lamp parts; 8×8 shapes; taste tags
farm.ts         calendar (4 cycles of 7 days, festival on day 7), 6 crops, 4 skills and their perks
cast.ts         the 20 residents: act, wants, keepsake, hearts gate, secret condition, lines; approaches
world.ts        64×52 tile map from rectangles; gates; stations; gather nodes; 16 farm plots; BFS reachability
sim.ts          realtime: walking, friends' day / dusk / sleep routines, shy friends, nearest target
engine.ts       the rules: GameState + pure actions (talk, gift, approach, favor, turnIn, ask, chat, ...)
lines.ts        scripted small talk and reactions by friend tone
story.ts        intro, five acts, Lamp-part scenes, festival ending, farewells
llm.ts          the model as a voice: free talk, re-voicing every scripted line, and the nightly diary, with a script fallback
quests.ts       twelve friend quests (data)
life.ts         LifeContext: the planned seam for real tasks, habits and wishes (nothing passes it yet)
companion.ts    the friend you came with: perk from their weights, stand-in sprite
save.ts         load / save / reset one village
```

Tests: `sprites.test.ts`, `world.test.ts` (every friend and node reachable, gates hold, the chain is solvable), `engine.test.ts` (rules, and a bot that plays the whole story), `sim.test.ts`.

## How a friend is built from what the app already knows

| App data (`speciesPersonality`) | In the game |
|---|---|
| `tone` (gentle, playful, direct, coach) | The approach they like (Soothe, Play along, Be straight, Cheer on). Same ring as the tone dial: right is +5 trust and a better mood, next door +2, across −2 and a worse mood. |
| `cadence` (quiet, occasional, chatty, eager) | Quiet friends **spook** when you run near them. Eager and chatty friends are lonely if you skip them (mood −1 overnight) and talk for +4. Cadence also sets how fast the favor timing bar moves. |
| `whimId` (`lib/friend-whims.ts`) | The **favor** they ask for (a timing game) and the kind of gift they love (`WHIM_TAGS`: splash is watery, doodle is bookish, ...). |
| `dialogEffect` | How their speech bubble looks (bounce, whisper, stamp, sparkle, heart). |
| Hand-written in `cast.ts` | Name, bio, what they want, their keepsake, hearts gate, secret condition, two liked tags, one hated tag, lines. |

## The loop

1. **Talk** (first of the day: +3, or +4 for eager). **Gift** (once a day: love +8, like +4, plain +1, hate −3). **Approach** (once). **Favor** (once, 8 energy, a timing bar: +0, +3, +6). **Chat** (free text; up to 3 trust a day).
2. At **2 hearts** they say what they want (one or two items). **Give what they want** (+10 trust, they now owe you).
3. Asking for the **keepsake** needs their **hearts gate** (3 to 8) and their **secret condition**. A clue about it comes at 4 hearts. `engine.ts` `CONDITION_TEXT` lists them: morning, evening, rain, dry, sneak (not spooked today), alone (nobody within 3 tiles), fed (liked gift today), played (favor today).
4. The next friend wants that keepsake. The last friend of each act holds a **Lamp part**. Place it in the Hollow Lamp and the next gate opens. Five parts end the story at the Festival of Small Lights. Play goes on after.

## The farm, skills, and calendar

- **Farm.** Sixteen plots at the Homestead Patch, south of the meadow. Till (2 energy), plant a seed in its cycle (1), water (1; rain waters for you), harvest when ripe. A crop grows one step each night it was watered and never wilts. Six crops: glowbean, puffroot, moonmelon, spiralkale, twinklegourd, snowpearl. Seeds are sold at the Trade Stump.
- **Skills** (`farm.ts`): farming, foraging, fishing, crafting. XP comes from using them; levels 2 to 5 at 12 / 30 / 60 / 100 XP, each with a perk (cheaper actions, bonus yield, double crafts) and +5 buttons.
- **Calendar.** Bloomtide, Gleamtide, Mosstide, Frosttide, seven days each. Day 7 is a festival: Stump pays half again, friends at 3+ hearts dance with you overnight (+2 trust), and the Notice Board takes one entry for buttons and a ribbon.
- **Weather**: clear, rain, **meteor shower** (digging sometimes turns up Star Shards), **morning mist** (mushrooms give more, shy friends do not spook).
- **Starlog.** Every item you have ever held is logged; every fifth discovery pays 8 buttons.

## Quests and the real-life council

- **Quests.** `quests.ts` holds twelve side quests; `engine.visibleQuests` shows those whose giver trusts you at two hearts, `questProgress` reads progress from the save (items in the bag, hearts, things made, harvests, fish caught, mini games played, favors done), and `claimQuest` pays buttons, items and trust.
- **Real life.** `GameState.real` holds what you told the friends is weighing on you (`addRealTask`, `completeRealTask`, `dropRealTask`, `setRealPlan`). An urgent one pulls the social friends to the campfire at any hour (`sim.anchorFor`). `llm.councilTalk` has them talk it over in plain text, choosing only who speaks among the awake friends and up to three tiny steps; `scriptedCouncil` is the fallback. Finishing one pays 10 or 18 buttons and +2 trust everywhere. Nothing reads or writes the real app: you type it in and tick it off yourself.

## Mini games

Four stations, one per early zone, each a small game with its own plate (`components/BabyGame/minigames.tsx`). They end in a grade 0 to 2; `engine.playMinigame` pays once a day per game (buttons plus Jarred Firefly, Dew Gem, Echo Petal, or Stair Chip, and sometimes a Star Shard) and always costs a little energy.

- **Firefly Glade** (Dewdrop Orchard, after dark): move a jar, catch the fireflies that are glowing, 20 seconds.
- **Mossfall Hop** (Lilting Pond): hop four rows of moving stones up a waterfall; three splashes end it.
- **Echo Flower** (Burrow Hill): a memory tune on four petals, one note longer each round.
- **Stair Weave** (Hayloft Yard): turn the stairs until the arrows lead from the first step to the door; par comes from the generated puzzle.

Around that: gather at nodes (berries, acorns, reeds, clover, pebbles, feathers, mushrooms, shells, dig spots, fishing from the dock), craft at the Workbench, trade at the Stump (buy raw things at twice their value; sell at a third), two daily errands at the Notice Board, the campfire at dusk, rain days, a 2am collapse.

## The model, safely

`llm.ts` uses the same transport as BIM chat: `chatCrew()` and `ollamaCall()` (`lib/bim-flow/`). It does three jobs, and each has closed outputs:

- **Free talk.** The model returns `{ say, feeling, trust −1..2, reveal none | wants | likes | clue }`. `engine.chat` clamps the nudge, caps it at three a day, and writes any revealed fact from the cast itself. A model cannot invent a quest, an item, or a heart.
- **Voicing.** Every other line (hellos, small talk, story beats, quests, thanks, reactions) is written by the game first and shown at once; then `voiceLine` asks the model to say it in the friend's own words. The rewrite is thrown away if it drops an item name or number or runs long (`keepsFacts`).
- **Diary.** At bedtime the companion writes two or three sentences from `GameState.today`, the true list of what happened.

No Ollama, a timeout, or bad JSON: the same shapes come from keywords (`scriptedReply`) or from `scriptedDiary`, and the UI says which one answered. The Menu has a switch (`brain2-baby-game-llm`). This is a BIMBY in the sense used here: one small job, a closed list of outputs, a script behind it.

## Companion

The friend you opened the game from follows you in their species sprite (`spriteFor`; a friend outside the twenty gets a stable stand-in). Their perk follows the weight they already have highest: habits give 15 extra morning energy, To Do gives a 30% extra gather, Next Actions puts a ! over friends you could hand something to. Their bond level gives +4 max energy and +1 button a morning per level past the first.

## Planned

- Side-view walking frames for the animals; the 24×24 sprites are front-facing and static.
- The five left-out species and a few reference animals (opossum, ferret, chinchilla) as visitors.
- Wire `LifeContext` to real tasks, habits and wishes through a read-only BIMBY, so friends can mention them kindly and the story can bend toward them.
- Touch controls beyond the simple pad; a phone layout that follows `docs/MOBILE_STYLE.md`.
- The five left-out species as visitors (a traveling raccoon peddler, a lamb who sells wool).
- Let a real finished mission give the companion a one-day gift (read-only today).
- Friends that talk to each other (a model writing gossip from `GameState.today`).
- Heart events past nine hearts.
