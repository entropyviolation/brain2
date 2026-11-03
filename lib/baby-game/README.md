# `lib/baby-game/` — Mossmere Hollow, the baby animal game

_Last mapped: 2026-11-02_

The rules and data of the **Baby animal game**: a small Stardew-shaped village you enter from a friend's detail page (**Baby animal game** key in the footer). Twenty baby animals live there. You earn their trust, bring them what they ask for, and they hand you keepsakes that the next friend wants, until five Lamp parts light the Hollow Lamp. The UI is `components/BabyGame/`.

Nothing here touches tasks, habits, points, or the friend gallery. The only read from the app is the friend's personality (`lib/baby-animal-personality.ts`, `lib/friend-whims.ts`) and, in the UI, their bond level and open mission title. Progress is one save in this browser: `brain2-baby-game` (`save.ts`).

## The twenty

Drawn at random from the 25-species roster in `lib/baby-animals.ts` (left out: piglet, raccoon, axolotl, lamb, goat). Each is a 16×16 sprite built by `sprites.ts`.

hedgehog, foal, cub, fox, puppy, capybara, crow, gosling, chick, owl, otter, kitten, mouse, seal, penguin, fawn, skunk, wolf, duckling, bunny.

## Files

```
sprites.ts      the twenty sprites + the Nestkeeper; palette extends PIXEL_PALETTE (no yellow)
items.ts        10 materials, 10 crafted trinkets, 15 keepsakes, 5 Lamp parts; 8×8 shapes; taste tags
cast.ts         the 20 residents: act, wants, keepsake, hearts gate, secret condition, lines; approaches
world.ts        48×40 tile map from rectangles; gates; stations; gather nodes; BFS reachability
sim.ts          realtime: walking, friends' day / dusk / sleep routines, shy friends, nearest target
engine.ts       the rules: GameState + pure actions (talk, gift, approach, favor, turnIn, ask, chat, ...)
lines.ts        scripted small talk and reactions by friend tone
story.ts        intro, five acts, Lamp-part scenes, festival ending, farewells
llm.ts          the model as a voice: free talk and the nightly diary, with a script fallback
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

Around that: gather at nodes (berries, acorns, reeds, clover, pebbles, feathers, mushrooms, shells, dig spots, fishing from the dock), craft at the Workbench, trade at the Stump (buy raw things at twice their value; sell at a third), two daily errands at the Notice Board, the campfire at dusk, rain days, a 2am collapse.

## The model, safely

`llm.ts` uses the same transport as BIM chat: `chatCrew()` and `ollamaCall()` (`lib/bim-flow/`). It does two jobs, and both have closed outputs:

- **Free talk.** The model returns `{ say, feeling, trust −1..2, reveal none | wants | likes | clue }`. `engine.chat` clamps the nudge, caps it at three a day, and writes any revealed fact from the cast itself. A model cannot invent a quest, an item, or a heart.
- **Diary.** At bedtime the companion writes two or three sentences from `GameState.today`, the true list of what happened.

No Ollama, a timeout, or bad JSON: the same shapes come from keywords (`scriptedReply`) or from `scriptedDiary`, and the UI says which one answered. The Menu has a switch (`brain2-baby-game-llm`). This is a BIMBY in the sense used here: one small job, a closed list of outputs, a script behind it.

## Companion

The friend you opened the game from follows you in their species sprite (`spriteFor`; a friend outside the twenty gets a stable stand-in). Their perk follows the weight they already have highest: habits give 15 extra morning energy, To Do gives a 30% extra gather, Next Actions puts a ! over friends you could hand something to. Their bond level gives +4 max energy and +1 button a morning per level past the first.

## Planned

- Touch controls beyond the simple pad; a phone layout that follows `docs/MOBILE_STYLE.md`.
- The five left-out species as visitors (a traveling raccoon peddler, a lamb who sells wool).
- Let a real finished mission give the companion a one-day gift (read-only today).
- Friends that talk to each other (a model writing gossip from `GameState.today`).
- Heart events past nine hearts.
