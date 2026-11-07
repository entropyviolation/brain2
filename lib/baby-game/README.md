# `lib/baby-game/` — Valdivia, the baby animal game

_Last mapped: 2026-11-03 (studying and manifestos; best friends: C, letters, invented gifts; every friend loves gems and 100 gems seal a bond; fish sit on water; eight shell kinds; picked nodes vanish; friends seek each other to talk; liked-image sprites for otter, fawn, wolf; north star: endless generation; eastern-thought pass; bigger world, homes, character contract)_

**North star.** Valdivia is the hand-made first world of a game meant to be endlessly generative: give it any situation and a weak local model writes closed-shape specs for props, tiles, characters and quests, which code turns into sprites and rules (Scribblenauts meets Stardew Valley, from the year 3000). Plan: `docs/BABY_GAME_REDESIGN.md`, section _Where this is going_, which also maps each Sprite Fusion tool (tilemap editor, auto-tiling, props and sprite generators, animator, Pixel Snapper) to what we have and what is missing. Today the lists here (`PropKind`, `NodeKind`, `ITEMS`, `RESIDENTS`) are fixed at compile time; making them data in the save is the first step.

**Every game starts by making characters.** This stays true for every world and every player: a new game creates its cast before anything else, and every member is a `Character` (`character.ts`) with looks, a name, a personality, a role, goals, quests, likes, a home and a memory. It is the abstraction of a pixel-game villager that the rest is built on: the sprite reads `looks`, the rules read `goals` and `likes`, the map reads `home`, and the model reads `characterBrief` to speak as them with what they remember. Today the cast is Valdivia's hand-made twenty-four. **Planned:** a Cast BIMBY writes the cast from the player's seed, prompts and actions, in the same shape, checked by `character.test.ts`, so the characters can be given memory, connected to a model and dropped into different game situations per player.

**Standalone.** The game is meant to leave brain2 someday as its own app, run from one taste seed (`seed.ts`: likes, dislikes, characters, missions, trinkets, plants, names) and a local model. It still lives and works here. `docs/BABY_GAME_STANDALONE.md` lists every import into brain2 and the **Planned** steps out.

The rules and data of the **Baby animal game**: a small Stardew-shaped village in **Valdivia**, a hidden valley of forests, still lakes and impossible stairways. You enter it from a friend's detail page (**Baby animal game** key in the footer). Twenty baby animals live there. You earn their trust, bring them what they ask for, and they hand you keepsakes that the next friend wants, until five Lamp parts light the Orb Lamp. The UI is `components/BabyGame/`.

Nothing here touches tasks, habits, points, or the friend gallery. The only read from the app is the friend's personality (`lib/baby-animal-personality.ts`, `lib/friend-whims.ts`) and, in the UI, their bond level and open mission title. Progress is one save in this browser: `brain2-baby-game` (`save.ts`).

**Money is gems.** Every place a player sees money says gems (_2026-11-02_). The save field is still `GameState.buttons`, and rewards are still `buttons` in `quests.ts` and `minigames.ts`, so old saves load. The **Shiny Button** is a separate item, a material, and keeps its name. Development mode plays on its own sandbox save, `brain2-baby-game-dev`, with its flags under `brain2-baby-game-devflags` (`dev.ts`).

## The twenty-four

Twenty were drawn at random from the 25-species roster in `lib/baby-animals.ts` (left out: piglet, raccoon, axolotl, lamb, goat). Four are new side friends: **Pynchon**, a little black duckling (Act II, the pond), and three baby possums, **Ernst**, **Tegmark** and **Kaufman** (Act III, Fossil Hill; they borrow a kin species' personality via `PERSONA_OF` in `cast.ts`). The Center of The World is the one human, a pixie in black with white go-go boots (`people/`). Every animal is a 32×32 sprite from `sprites.ts` with a front view and a side view, sized against the others, with fur flecks, ear insides, glinting eyes, paws and tails. The Center of The World is drawn the same way.

hedgehog, foal, cub, fox, puppy, capybara, crow, gosling, chick, owl, otter, kitten, mouse, seal, penguin, fawn, skunk, wolf, duckling, bunny, plus blackduck and possum, possum2, possum3.

## Files

```
people/         the human: the pixie Center of The World (a snapped ComfyUI render, with a layered drawer as fallback); see its README
upscale.ts      Scale2x (EPX) on letter grids: a 32 sprite frame becomes a smooth 64 one for animals drawn small
walk.ts         four-frame walk cycles made from any still grid (feet swing in side view, alternate lift in front and back, body lifts on the pass frames)
idle.ts         idle life made from the stills: blink, breathe, ear flick, glance, on a per-body schedule (`idlePose`)
sprites.ts      the 24 animals as 32×32 side-view sprites + the Center of The World; palette extends PIXEL_PALETTE (yellow only where a subject needs it)
hyrax.ts        the companion hyrax, hand-drawn: tiny (about 13×11 px, a third of a capybara pup), seated round loaf, dark head, lighter back, blunt dark nose
minigames.ts    rules and grades for the four mini games (Orb Light Glade, Sine Hop, Echo Flower, Stair Weave) and what they pay
items.ts        11 materials, 16 crafted trinkets, 6 crops, 6 seeds, 15 keepsakes, 5 Lamp parts; 8×8 shapes; taste tags
farm.ts         calendar (4 cycles of 7 days, festival on day 7), 6 crops, 4 skills and their perks
cast.ts         the 20 residents: act, wants, keepsake, hearts gate, secret condition, lines; approaches
casa.ts         the inside of the cottage: six rooms (Hall, Noble Floor, Loft, Sunken Lounge, Glasshouse, Boudoir), solid rects (plus the furniture's), spots (exit, stairs, doors, bed, looks), walker physics; pure
casa-furniture.ts  the layout of every room's furniture (`PLACEMENTS`: floor, sprite id, x, foot y, wall / lift / solid / glow / look), and `furnitureSolids`; pure
casa-pieces.ts   sizes of the furniture painted in code (`MADE`) and `pieceSize(id)`, which answers for those and for the pictured sprites; pure
furniture-sprites.ts  (scripts: `baby-furniture-queue.mjs` words to ComfyUI, `baby-furniture-ref.mjs` from the board photos) GENERATED by `scripts/baby-furniture-snap.mts` from the newest `furn-<id>_*.png` ComfyUI outputs (or `furniture.json` picks): palette + rows of palette characters per object
furniture.json  optional: which ComfyUI file to use for a furniture id when the newest is not the best
rhizome.ts      Rhizome's town plan as rows of characters (buildings, streets, plaza, spine, pier), laid over its ground by `world.ts`
regions.ts      the zones as data (name, rectangle, act, ground, scatter), `MAP_W` × `MAP_H` (the 160×128 grid) and `EXTENT_W` × `EXTENT_H` (how far the built world reaches, 111×64 with Rhizome); row and `order` numbers feed one random stream, so only append
world.ts        tile map carved and scattered from `regions.ts` (the grid is 160×128, the built part 111×64 with Rhizome, the rest solid wood); 13 zones; gates; stations; gather nodes; 16 farm plots; 35 props; homes held clear; BFS reachability
homes.ts        every friend's home: kind by species (nest, burrow, den, hollow, lodge, hutch, stall, igloo), name, tile; door on the tile below
character.ts    the character contract: `Character` (looks, personality, role, goals, quests, likes, home, memory); `createCharacters`, `remember`, `characterBrief`
props.ts        what each prop does on E: once-a-day uses that give energy, items, gems, skill xp, trust or a forecast
sim.ts          realtime: walking, friends' day / dusk / bedtime / sleep routines (home to bed), shy friends, friends seeking each other out to talk, nearest target, knocking
engine.ts       the rules: GameState + pure actions (talk, gift, approach, favor, turnIn, ask, chat, ...)
lines.ts        scripted small talk and reactions by friend tone
story.ts        intro, five acts, Lamp-part scenes, festival ending, farewells
llm.ts          the model as a voice: free talk, re-voicing every scripted line, and the nightly diary, with a script fallback
quests.ts       twenty-four friend quests (data)
dharma.ts       each friend's outlook from Zen, Taoism or Buddhism (belief, sayings, koan, council counsel, practice) and one lesson per quest
design-notes.ts redesign notes and status per character, and the briefs made from them (own key, not the village save)
comfy-png.mjs   reads a ComfyUI output PNG's recipe (checkpoint, LoRAs, prompts, seed, sampler, size) and changes one generation note (`withGenNote`); plain .mjs so `scripts/baby-gens-api.mjs` shares it
gen-sprites.json  which liked ComfyUI image, figure number and height each animal view is snapped from (duckling, blackduck, kitten, possum, puppy, hedgehog, meerkat; otter, fawn and wolf added 2026-11-03 from the liked redesign sheets; the otter side is a three-quarter sitting view, the wolf side an upright three-quarter)
gen-sprites.ts    GENERATED by `scripts/baby-gen-sprites.mts` from that manifest: 32×32 letter grids that `spriteGrid` reads before the hand-drawn ones. Possum, puppy, hedgehog and meerkat added 2026-11-02. One possum drawing serves all three possum coats. Yellow letters are skipped on all but the duckling (a sprite test). The meerkat has no cast member yet.
slime.ts        the slime mold: one body of 2×2-tile cells over the whole map, with a memory (`SlimeState` on `GameState.slime`); pure, ticked once a second; tests in `slime.test.ts`
shell-sprites.ts  GENERATED by `scripts/baby-shell-snap.mts` from the liked (else newest orb) `shellorb-*` / `shellref-*` ComfyUI pictures: eight shells; `shell.json` names a file per kind (abalone uses an orb, its liked photo redraw kept its background box)
bestie.ts       the Best Friends BIMBY, pure half: `isBestFriend` (10 hearts) rules, `bestBrief` (call them C, ask things, what they read, what C told them), scripted letters, `postLetters` overnight, `collectMail` at the mailbox
letters.ts      its model half: `penLetter` rewrites a letter in the friend's voice and runs the gift tools (`give_item`, `invent_item`); `applyLetterPatch`
forge.ts        the Item Forge BIMBY: a description becomes an item (clean spec, best-of-three 8×8 drawing scored by `scoreRows`, nearest-shape fallback); `registerCustom`
flora.ts        which small plants grow in which zone (`FLORA`, `floraKind`); pure
flora-sprites.ts  GENERATED by `scripts/baby-flora-snap.mts` from the liked `flora-*` ComfyUI pictures (palette plus rows); `flora.json` optionally names a file per plant
snap.mjs          pixel snapper: figure mask, numbering, snap to the palette, outline, place on the grid
shelf.ts        the bookshelf: books as metadata, 4000-character sittings, ideas and a digest per book, `replaceReading` (the player's perfect version), gold examples, read style; pure (`shelf.test.ts`)
study.ts        studying and the manifesto, pure: `shelfActivity` (read, study or write this hour), `applyStudy`, `adoptTopic`, `announceManifestos`, `applyOutline`, `applySection`, `manifestoText`, `giveCopy`, `syncCopies`, `pitchTarget`, `applyPitch` (`study.test.ts`)
study-llm.ts    the Study BIMBIES: `runStudySession` (an agent loop with search and note tools, a strict check on every note), `topicWithModel`, `outlineWithModel`, `sectionWithModel`, each with a script behind it, and `embedWithOllama`
passages.ts     the shelf search tools: passages with pages, BM25, optional re-rank by meaning, `hasQuote`
chatter.ts      the Village Life BIMBY: deep turn-by-turn book talk, reading sittings, minds from a description
gens.ts        generation log types, setup and LoRA boards ranked by likes, filters (`/lab/baby-gens`, `components/BabyGame/gens/`)
life.ts         LifeContext: the planned seam for real tasks, habits and wishes (nothing passes it yet)
companion.ts    the friend you came with: perk from their weights, stand-in sprite
save.ts         load / save / reset one village, in the play slot or the dev slot
dev.ts          development mode: flags (incl. unlimited gems, reveal unmet friends, speed ladder), teleport places, and pure powers over the state (act, clock, weather, items, gems, hearts, skills, ripen, fresh day, quest ready/done/reset)
seed.ts         the taste seed a generated world would start from (data only; nothing reads it yet)
specs/          PropSpec, CastSpec, BlockSpec and ToolSpec, their validators, named color ramps, and Valdivia written as specs (nothing reads them yet)
```

Tests: `character.test.ts` (a new game creates the whole cast; every character fills every part of the contract; one keeper per act; memory is kept, capped and survives a reload; a generated character survives a reload), `homes.test.ts` (every friend has a home in their zone, on its own solid tile, with a door they can walk to; bedtime and sleeping on the doorstep), `dharma.test.ts` (every friend has a path, every quest a lesson, all three traditions appear), `idle.test.ts` (every pose stays valid, most bodies blink and breathe, the schedule is pure), `walk.test.ts` (every body, view and frame stays square, on the palette, and moves its feet), `sprites.test.ts`, `world.test.ts` (every friend and node reachable, gates hold, the chain is solvable), `engine.test.ts` (rules, and a bot that plays the whole story), `sim.test.ts`.

## Gems, shells and picked things (2026-11-03)

- **Gems.** Every friend loves a gem (`tasteOf`), with no exceptions; `gemLove` in `economy.ts` is no longer read. A hoard of `GEM_HOARD` (100) gems given with `giftGemHoard` takes trust straight to 100 (10 hearts), ignores the once-a-day gift, and spends the 100. The gift panel shows the button once you hold 100.
- **Fish** nodes sit on water tiles (`world.test.ts` checks it). Their ripples and shadow used to draw on sand, grass and the dock.
- **Shells.** Eight kinds (`SHELL_KINDS` in `items.ts`: abalone, cone, cowrie, nautilus, scallop, spondylus, turbo, wentletrap), each its own material `shell-<kind>` with its own snapped sprite. A shell node holds the kind its id hashes to (`shellKindOf`); a fishing catch picks a random kind. "A shell" in recipes, quests, errands and gifts means any shell: `have(s, "shell")` sums them and `bag(s, "shell", -n)` spends the plain Whorl Shell first, then the named ones.
- **Picked things.** A gathered node is not drawn, not lit (mushrooms) and not targetable until the next morning (`nodeReady`). It used to show dimmed.

## Best friends (2026-11-03)

At 10 hearts (`isBestFriend`) a friend calls you **C** and stops being careful. Their prompt (`bestBrief`, added in `chatSystem`) tells them to ask C a short question about themselves, say what they have been reading and what they would like to read next (they know C brings the books, from `readingBrief` over `GameState.shelves`), and use what C told them (`GameState.aboutC`, filled by `chat(s, id, reply, told)`, which also writes `told` and `asked` memories).

- **Letters.** Overnight the village calls `postLetters` (from `goSleep`, not from `sleep`): each best friend may leave a note (question, reading, gift or plain), at most one unread and one per `LETTER_GAP` days. A model (`penLetter`) rewrites it in their voice afterwards; the script stands if it cannot. `Check the mail` (`props.ts`) calls `collectMail`: notes are read, gifts go in the bag. The Journal has a Letters tab.
- **Gifts by tool call.** In a gift letter the model answers with one closed shape: `tool` is `none`, `give_item` (an existing material or trinket, checked against `ITEMS`) or `invent_item` (name, description, kind, tags, colour). An invention goes through the Item Forge (`forge.ts`) and is kept in `GameState.custom`, put back into `ITEMS` on load (`registerCustom` in `save.ts`). Its picture is `ItemDef.rows`.
- **Planned.** The Forge's last stage: send the description to the ComfyUI item graph and snap the liked picture, as shells and plants are. Letters for friends who reach 10 hearts while away from the game, and answering a question by letter instead of in talk.

## The world, grown (2026-11-02)

`MAP_W` × `MAP_H` went from 64×52 to 80×64. Every old tile kept its place, so saves, props and tests did not move. Three new zones fill the new edges:

- **Cobalt Glow Marsh** (act 1, south of the farm through an open path): five still pools on a boardwalk, reeds, fish, mushrooms, an orb light and a slime mold.
- **The Index Stacks** (act 3, east of Kauai Highlands, behind the highlands' own gate): long shelves of stone with a path down the middle, like the index at the back of a book. A little library and a prism.
- **Firework Dunes** (act 4, south of Sparkle Lake): sand, rocks, an oasis with fish, a fireworks crate and a puddle. A path also runs west to the marsh, gated at act 4 so the dunes cannot be reached early.

Nobody lives in the new zones yet. They are room for visitors and for a generated cast. **Planned:** residents for them.

## Rhizome (2026-11-03)

The first zone of the expansion (`docs/BABY_GAME_EXPANSION.md`), east of the Index Stacks at x84..108, y36..58. A corridor leaves the stacks' south end along y40..41 and meets a gate at x79 that opens at **act 5** (the game stops at 5 acts today; act 6 will move it). Inside: Long Street, a plaza, a bakery and post office north, a mill and workshop south, an alley, gardens, a shore, and a pier with a rowboat. Nine props (well, signpost, bird bath, mailbox, firewood, little library, thrift rack, orb light, rowboat) and eleven gather nodes sit in it. All of it is appended to `PROPS` and `NODES`, so old prop indices and node ids still match.

- **Nobody lives there yet, and the buildings are shut.** The doors are plain door tiles; no interiors. **Planned:** eight residents (a shopkeeper, a craftsperson, a ferry captain, a wanderer, four townsfolk), a bakery kitchen, the ferry, and the bridge repair as the first village project.
- **Map.** The zone is a `rhizome` row in `regions.ts`; the plan is in `rhizome.ts`. Trees are an oak and birch mix at low density.

## Homes (2026-11-02)

Every friend has a home (`homes.ts`): one solid tile in their own zone, a few steps from their day spot, with the door on the tile below. The kind follows the animal: birds nest, diggers burrow, fox, wolf and cub keep a den, the owl, fawn and possums a tree hollow, otter and capybara a lodge, the penguin and seal an igloo, the foal a stall, puppy and kitten a little house. Each has its own name (Ada's is The Eggcup, Wallace's The Song Archive).

- **Building size (2026-11-03).** Homes are drawn `HOME_SCALE` (3) times their painter's 16×16, three tiles wide, standing on the home tile with the door tile below it clear. The footing is solid on the tiles left and right of the home too (`world.ts`). Hit and door logic still use the single home tile. At the 2× detail the picture is the hand-painted 96px one from `homeart-hi.ts`.
- **Animal size (2026-11-03).** `SPRITE_SCALE` in `sprites.ts` sets how big each animal stands: chick, mouse and ducklings 0.4, bunny, kitten and possums about 0.5, fox and puppy 0.65, up to wolf and foal 0.9. The player and the pixie stay 1. `drawSprite(…, scale)` keeps the feet on the ground line.
- **Bedtime.** In the hour before a friend sleeps (`sim.bedtime`), they walk home, even from the campfire. Asleep, they are on their doorstep; anyone who did not make it is tucked in at once.
- **Knocking.** Near a home, E says "Knock at Ada's nest". The answer (`sim.knockLine`) is asleep inside, home and waving, or out. The friend remembers the first knock each day (`engine.knock`). It changes no rule.
- **Seen.** `components/BabyGame/homeart.ts` paints each kind; a window glows after dark while its friend is home and up. The M map shows homes as small cobalt roofs.

## The character contract (`character.ts`, 2026-11-02)

`newGame` creates `GameState.characters`, one `Character` per friend, and the save keeps them. Each holds:

| Part | What it is | Where it comes from today |
|---|---|---|
| `looks` | species (the sprite key) and one drawable line | `MARKS` in `character.ts` |
| `name` | | `cast.ts` |
| `personality` | tone, cadence, dialog effect, whim, shy, social, rain lover, sleep hours, bio, outlook | `temper()` and `dharma.ts` |
| `role` | `keeper` (holds a Lamp part) or `link` (passes a keepsake on); title, act, zone | `cast.ts` |
| `goals` | what they want in their own words, the items, what they give back, the hearts gate and condition | `cast.ts` |
| `quests` | quest ids they give | `quests.ts` |
| `likes` | liked tags, hated tag, loved tag | `cast.ts`, `temper()` |
| `home` | kind, name, tile | `homes.ts` |
| `memory` | what happened with the player, oldest first, capped at 40 | the engine, as you play |

- **Memory.** `remember` is called by `talk` (first meeting), `gift`, `turnIn`, `ask` (the keepsake), `claimQuest`, `chat` (what they said) and `knock`.
- **The model.** `llm.ts` `chatSystem` adds `characterBrief`: looks, role, home, goals, and the last six memories.
- **Old saves.** `save.ts` calls `refreshCharacters`: hand-made characters are rebuilt from code and keep their memories; a character the code does not know is kept as saved, so a generated cast survives.
- **Planned.** `createCharacters(seed)`: a Cast BIMBY writes characters from the taste seed and the player's prompts, validated against this shape, falling back to the hand cast. Then the rules read `characters` instead of `RESIDENTS`, which is what lets a generated cast actually play. Today the rules still read `cast.ts`.

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
4. The next friend wants that keepsake. The last friend of each act holds a **Lamp part**. Place it in the Orb Lamp and the next gate opens. Five parts end the story at the Festival of Orb Lights. Play goes on after.

## Eastern thought (`dharma.ts`)

Each of the 24 friends holds one idea chosen to fit who they already are: Ada (chick) is beginner's mind and the chick and hen pecking one shell, Dobby the gateless gate, Mathilda "every day is a good day", Bohm the clearing of muddy water, Hofstadter the second arrow, Pynchon "know the white, keep to the black", Conway the jewel sewn in the robe, the three possums the Three Jewels in spirit (Ernst: friends are all of the path, Tegmark: Indra's net, Kaufman: the infant, Tao Te Ching 55), Abagnale the wild fox and skillful means, Irwin Joshu's "Mu" and the lute string, Thompson riding the horse looking for the horse, Gaultier Ryokan's moon, Wallace "the way that can be spoken", Vonnegut "be a lamp unto yourself". Sources are named in `Path.source`. Quotes are paraphrased, never invented.

- **In play.** One everyday remark in three (once you have a heart and they are not cranky) is the friend's own saying or koan (`pathTalk`, called from `engine.talk`). The talk card shows their school and idea from three hearts. Each quest has a `LESSONS` entry, shown in the Journal and as a note when claimed. The council's first scripted voice speaks the friend's `counsel`, and the scripted plan starts with three slow breaths.
- **In the model.** `chatSystem` adds `pathBrief` (outlook, belief, "offer lightly, never lecture, never invent quotes"). Voicing treats a teaching line (`isTeaching`) as a thought to keep, with its named idea and any person or text it mentions.
- **Story.** The intro adds "be a lamp unto yourself"; each act blurb names a theme (beginner's mind, water and stillness, attention and enough, tuned effort, emptiness and the passed flame); the ending adds Wallace's "the song was never in the pages".
- **Nothing here changes a rule.** It is voice and reference only.

## The farm, skills, and calendar

- **Farm.** Sixteen plots at the Permaculture Patch, south of the meadow. Till (2 energy), plant a seed in its cycle (1), water (1; rain waters for you), harvest when ripe. A crop grows one step each night it was watered and never wilts. Fourteen crops. Six older ones (glowbean, puffroot, moonmelon, spiralkale, twinklegourd, snowpearl) and eight surreal single-cycle ones: Lotus Bloom has shadowradish (Jung's shadow, half underground) and mandalichoke; High Yang has schrodinberry (ripe and unripe until looked at) and parallaxpepper; Anicca has fadeleek (paler and sweeter each day) and quincidence (synchronicity quince); Deep Yin has hypnagogicpea and aurorasprout. The Swap Stump stocks a seed only in its own cycle (`stocked()` in `engine.ts`; `buy` refuses the rest). _Last mapped: 2026-11-02_
- **Skills** (`farm.ts`): farming, foraging, fishing, crafting. XP comes from using them; levels 2 to 5 at 12 / 30 / 60 / 100 XP, each with a perk (cheaper actions, bonus yield, double crafts) and +5 gems.
- **Calendar.** Lotus Bloom, High Yang, Anicca, Deep Yin, seven days each. Day 7 is a festival: Stump pays half again, friends at 3+ hearts dance with you overnight (+2 trust), and the Notice Board takes one entry for gems and a ribbon.
- **Weather**: clear, rain, **meteor shower** (digging sometimes turns up Star Shards), **morning mist** (mushrooms give more, shy friends do not spook).
- **Starlog.** Every item you have ever held is logged; every fifth discovery pays 8 gems.

## Quests and the real-life council

- **Quests.** `quests.ts` holds twenty-four side quests; `engine.visibleQuests` shows those whose giver trusts you at two hearts, `questProgress` reads progress from the save (items in the bag, hearts, things made, harvests, fish caught, mini games played, favors done), and `claimQuest` pays gems, items and trust.
- **Real life.** `GameState.real` holds what you told the friends is weighing on you (`addRealTask`, `completeRealTask`, `dropRealTask`, `setRealPlan`). An urgent one pulls the social friends to the campfire at any hour (`sim.anchorFor`). `llm.councilTalk` has them talk it over in plain text, choosing only who speaks among the awake friends and up to three tiny steps; `scriptedCouncil` is the fallback. Finishing one pays 10 or 18 gems and +2 trust everywhere. Nothing reads or writes the real app: you type it in and tick it off yourself.

## Mini games

Four stations, one per early zone, each a small game with its own plate (`components/BabyGame/minigames.tsx`). They end in a grade 0 to 2; `engine.playMinigame` pays once a day per game (gems plus Jarred Firefly, Dew Gem, Echo Petal, or Stair Chip, and sometimes a Star Shard) and always costs a little energy.

- **Orb Light Glade** (Refraction Orchard, after dark): move a jar, catch the fireflies that are glowing, 20 seconds.
- **Sine Hop** (Moiré Pond): hop four rows of moving stones up a waterfall; three splashes end it.
- **Echo Flower** (Fossil Hill): a memory tune on four petals, one note longer each round.
- **Stair Weave** (Swap Meet Yard): turn the stairs until the arrows lead from the first step to the door; par comes from the generated puzzle.

Around that: gather at nodes (berries, acorns, reeds, clover, pebbles, feathers, mushrooms, shells, dig spots, fishing from the dock), craft at the Workbench, trade at the Stump (buy raw things at twice their value; sell at a third), two daily errands at the Notice Board, the campfire at dusk, rain days, a 2am collapse.

## The model, safely

`llm.ts` uses the same transport as BIM chat: `chatCrew()` and `ollamaCall()` (`lib/bim-flow/`). It does three jobs, and each has closed outputs:

- **Free talk.** The model returns `{ say, feeling, trust −1..2, reveal none | wants | likes | clue }`. `engine.chat` clamps the nudge, caps it at three a day, and writes any revealed fact from the cast itself. A model cannot invent a quest, an item, or a heart.
- **Voicing.** Every other line (hellos, small talk, story beats, quests, thanks, reactions) is written by the game first and shown at once; then `voiceLine` asks the model to say it in the friend's own words. The rewrite is thrown away if it drops an item name or number or runs long (`keepsFacts`).
- **Diary.** At bedtime the companion writes two or three sentences from `GameState.today`, the true list of what happened.

No Ollama, a timeout, or bad JSON: the same shapes come from keywords (`scriptedReply`) or from `scriptedDiary`, and the UI says which one answered. The Menu has a switch (`brain2-baby-game-llm`). This is a BIMBY in the sense used here: one small job, a closed list of outputs, a script behind it.

## Companion

The friend you opened the game from follows you in their species sprite (`spriteFor`; a friend outside the twenty gets a stable stand-in). Their perk follows the weight they already have highest: habits give 15 extra morning energy, To Do gives a 30% extra gather, Next Actions puts a ! over friends you could hand something to. Their bond level gives +4 max energy and +1 gem a morning per level past the first.

## Props

`PROPS` in `world.ts` lists 29 things standing in the world; each is one tile, solid unless it is in `FLAT_PROPS`. `props.ts` holds what each does. `sim.nearest` offers them as a `prop` target (the label comes from `propLabel`), and `tryProp` runs the use: pure, returns a `Result`, refuses without changing the state. Most are once a day (`seen["prop<i>d<day>"]`), the clock once a week, the signpost and thrift rack any time. Two open an existing screen instead (`PROP_SCREEN`): the collage desk is a second Workbench and the rowboat is a fishing spot.

- **Everyday.** Mailbox (gems, a postcard), firewood (kindling), well (cold water, +12 energy), signpost (tomorrow's weather, ripe crops, festival), bird bath (a feather), picnic blanket (eat the best food you carry for 1.5× energy), beehive and wasp nest (honey; smoke from kindling keeps you from a sting), scarecrow (harvest luck +25% for the day, read in `engine.harvest`), wheelbarrow (a seed packet), hay bales (a nap), sprinkler (waters every thirsty crop free).
- **From what the player loves.** White orb light (energy, and a Star Shard at night), puddle (splash: +12 energy in rain), prism (a Rainbow Chip, clear daylight only), little library (2 xp in your weakest skill), thrift rack (6 gems for a random trinket), collage desk, fireworks (4 gems at night, +2 trust for every friend), pendulum (crafting xp), ducklings, microscope (a Diatom), fossil bed (a Spiral Fossil), romanesco (a vegetable), slime mold (speak with it: it eats a sweet thing from your bag, says what it remembers, pays gems and crafting xp; see _The slime mold_), kitten (energy; feed it a minnow for gems).
- **From what the player dreads.** The wasps, and the daylight-saving clock (once a week it gives you an hour back).
- New items for them: kindling, honey, postcard, rainbit, fossil, diatom, romanesco, and the Scrap Collage recipe.

## Layout pass (2026-11-02)

- **Where props live.** The meadow is the hub (bed, bench, board, lamp, fire, stump), so each prop now stands with what it belongs to: the well at the edge of the farm, firewood by the campfire, the thrift rack beside the Trade Stump, the signpost at the east gate, the birdbath and prism by the cottage roofline, fireworks out in the hayloft yard.
- **Stable trees.** `scatter` rolls once per tile whether or not the tile is held, so moving a prop no longer reshuffles the trees. Check a move with `world.test.ts` and `props.test.ts` (a prop must not sit on a node, and the paths in must stay open).
- **Overview.** `/lab/baby-world` paints the whole terrain at 1:1 with every prop, station, node and friend spot labelled.
- **Resolution.** One pixel size (_2026-11-03_): the village is a 320×200 view on a fine grid of two real pixels per game pixel, no smoothing. Finer art is pooled to that grid by `components/BabyGame/pixelsnap.ts`.
- **Trees grow and fall** (_2026-11-03_). `world.ts` still scatters the starting trees as `T.TREE`, now with grove noise and no touching trees outside the wood, and `World.held` lists tiles kept clear. `trees.ts` adds the rest: `GameState.trees` (tile index to `{k: cut|seed|bare, t: day}`), `stageOf` (stump 2 nights, seedling to 2, sapling to 4, young to 7, then mature), `syncTrees` (young and mature are solid), and `growTrees`, run after `sleep`, where each mature tree has a 10% chance a night to seed one free tile within 3 (never held, never touching, never a crowd). `engine.ts` `chop` (3 energy, 2 to 3 wood, 30% acorn, leaves a stump that sprouts again) and `clearStump` (1 energy, 1 wood, open ground). `sim.ts` `nearest(sim, s, world)` offers "Chop the tree" and "Dig out the stump". The map has little free ground (most is held), so wild spread is slow by design; felled trees always come back. **Planned:** weather and season effects on growth, saplings that die in a crowd.
- **Real detail is not done.** The art is 16px tiles and 32px animals on a 304×192 view. More detail means redrawing `sprites.ts`, `art.ts`, `trees.ts` and `propart.ts` at a larger grid, then widening `TILE` and the zones with them. **Planned.**

## Planned

- **The big expansion** (_2026-11-03_). Step 1 is partly done: `regions.ts` holds the zones, the grid is 160×128 with a save migration (`GameState.mapW`, `rekeyTrees` in `trees.ts`), and cameras, the painted map, the map screen and tree growth stop at `EXTENT_W` × `EXTENT_H`. The old 80×64 world is tile for tile the same. Not yet: chunked map painting, map pan, zoom and fog, interior `place` generalisation. Map to about 160×128 with about 30 zones, 50 residents, caves and a canopy as Casa-style interior places, a sea, cooking, mining, boats, a museum, village projects and acts 6 to 9. Plan, steps and open questions: `docs/BABY_GAME_EXPANSION.md`. Next: add zone rows (each with nodes, props, gates, residents).
- **Tools.** The game has no held tools; you gather by walking up to a node. `specs/tool.ts` is the shape they will take (_2026-11-02_): 16×16 parts plus a grip pixel, one motion from a closed list (chop, sweep, poke, pour, dig, cast, shake) whose frames are code's `MOTION_KEYS`, and up to four effects (break, harvest, turn, water, catch) on a block or a material, with a power that must beat the block's hardness. `specs/block.ts` gives ground tiles and nodes a material, hardness, drops, regrow and what is left behind, so a tool knows what it can touch. The validator refuses a tool that could never work. Four hand-made tools (`HAND_TOOLS`: watering can, trowel, reed sickle, pebble tap) are the Tool BIMBY's few-shot examples. **Planned:** the Tool BIMBY in a lab, `render.ts` playing the motion on a paw, and `engine.ts` running effects like `gather`.
- **Endless generation.** Specs instead of hand lists: `PropSpec`, `TileSpec`, `CastSpec`, `Premise`, validated (schema, palette, verbs from the `props.ts` `Use` list, reachability, solvable chain) and cached by hash. Small BIMBIES write them from a noun or a situation, with a scripted generator behind each, so tests run offline. `walk.ts` and `idle.ts` already animate any still, `world.ts` already proves reachability, and `engine.test.ts` already plays a whole story with a bot: those are the validators a generated world must pass.
- Hand-drawn walk frames (today they are made from the stills by `walk.ts`); a run cycle with a longer stride; sit, sleep and eat poses, a tail wag in the side view, hand-drawn blinks for the few bodies whose eyes `idle.ts` cannot find.
- The five left-out species and a few reference animals (opossum, ferret, chinchilla) as visitors.
- Wire `LifeContext` to real tasks, habits and wishes through a read-only BIMBY, so friends can mention them kindly and the story can bend toward them.
- Touch controls beyond the simple pad; a phone layout that follows `docs/MOBILE_STYLE.md`.
- The five left-out species as visitors (a traveling raccoon peddler, a lamb who sells wool).
- Let a real finished mission give the companion a one-day gift (read-only today).
- Friends that talk to each other (a model writing gossip from `GameState.today`).
- Heart events past nine hearts.
- Eastern thought: a tenth-heart teaching from each friend (a longer parable, told at the festival); a "sit" action at the Bench that spends no energy and gives a calm day bonus; practice prompts (`Path.practice`) offered as optional real-life missions through `LifeContext`.

## Seeking company (2026-11-03)

A free friend who finishes a wander step may decide to walk to another friend (`sim.ts` `trySeek`): social friends 75% of the time, the rest 35%. They pick an awake, out, not-busy friend within 26 tiles whose pair cooldown is over, scored by bond, social, and nearness with a little luck. `seekStep` re-draws the path every 2.5 s as the target moves and gives up after 40 s, at bedtime, at the fire, or if the target gets busy. Arriving within `MEET_REACH` (now 1.6 tiles) queues the pair as before. The pair cooldown went from 150 to 120 s. Tests: `sim.test.ts`. **Planned:** visits that carry a reason (a goal or a plan from `chatter.ts`), and a small speech bubble while walking over.

## The slime mold (2026-11-03)

_Last mapped: 2026-11-03_

No longer just a prop. The two `slime` props in `PROPS` are the **hearts** of one creature, `GameState.slime` (`slime.ts`). Its body is a map of **cells** two tiles wide, each holding a mass from 0 to 1. It crosses open ground, roots and boulders; never water, walls, gates, soil or stations.

- **Grows and recedes.** From its hearts it creeps outward. Night and rain make it spread and thicken; the noon sun makes it draw back into its thick roads; fire (lit campfire, after dusk, once a Lamp part is in) burns it. How many cells it may hold (`capOf`) rises with `size`, which grows with days and with being fed. Each new day it dreams a night of growth and notes how much.
- **Memory.** `like` per cell, -1 to 1, is what real slime molds do: the tubes stay thick where good things happened. Walking over it, a friend crossing it, and feeding it raise `like`; fire lowers it. A liked cell keeps a floor of mass through the day, is where it sprouts new patches at night, and fades over about a week. A short `memory` list (fed, burned, walked, friend, rain, dream) is what it speaks from.
- **Mood.** `moodOf`: curious (leans toward you), content (fed in the last day), hungry (not fed for days), wary (burned lately; keeps away from you and the fire).
- **Voice.** `slimeThought` picks a line from its mood, the sky and its memories. Standing within about 70 pixels of it shows the line as a bubble in `BabyGame.tsx`. E on a heart feeds it (one of berry, jam, glowbean, moonmelon, pie, sorbet), remembers where, and pays gems that rise with its size.
- **Wiring.** `BabyGame.tsx` ticks it with the clock once a second (not while dev Freeze is on); `save.ts` keeps it through `refreshSlime`; `components/BabyGame/slimeart.ts` paints it.

**Planned:** let a friend ask it the shortest path between two places (what real slime molds do), and let it keep a remembered road open on purpose.

## Wave Function Collapse and scenery (2026-11-03)

`wfc.ts` is the simple tiled model after mxgmn/WaveFunctionCollapse: lowest-entropy cell first, weighted pick, propagation until stable, a restart with the next seed on a contradiction. `solveWfc(rules, w, h, { seed, pins })` is pure. Rules come from `adjacencyFromSample` (learn from a small picture) or `adjacencyFromPairs`; `pins` limit a cell's options, which is how a cell is fixed to a tile or kept to water. `scenery.ts` `buildScenery(world)` dresses the map with it (reeds, lilies, blooms, ferns, stones, glowcaps, crystals); `components/BabyGame/sceneryart.ts` paints the result. Tests in `wfc.test.ts`. The scenery is a visual layer only: nothing in it blocks or is saved.

## Deep reading and book talk (2026-11-03)

_Last mapped: 2026-11-03_

Why: the talks were all scripted, and a scripted talk can only repeat one quoted line. The reading behind it was one 2400-character chunk and one vague takeaway, so there was nothing to discuss.

- **Reading** (`readWithModel`): `CHUNK` is 4000 characters. Each sitting states what the author claims, then what the friend makes of it; explains the idea to a younger friend; names up to three ideas (`Book.ideas`, kept 24); keeps a question; and rewrites a digest of the book so far (`Book.digest`), which the next sitting reads first. The ideas, not the 40-slot memory, are what talks draw on.
- **Talk** (`talkWithModel`): `talkSeed` picks an idea one of them took from a book, the least-discussed first, else a belief. Six turns (`TURNS`: bring it up, say it back and ask, explain with an example, push back, answer, land it), each a separate call made as that speaker with only what they know (the responder has not read the book, only their own related idea), temperature 0.8. A closing call writes what each learned; `applyTalk` stores it as a `neighbor` memory, counts the idea shared (`shareIdea`) and may make it a belief.
- **Read all the way through.** `GameState.readStyle[id]` is `hourly` or `allatonce`. The run lives in `BabyGame.tsx` (`runReadAll`), not the home panel, so it goes on when you leave the screen, until Stop or the last page. With no model (switched off, or none answering) the run does not start; a model that stops answering ends it rather than filling the notes with script.
- **The player's perfect version.** On a sitting, Edit shows the whole passage. "Replace in their mind" swaps the log entry, the `read` memory, the ideas and the belief or goal that sitting gave. "Keep as a gold example" also saves the pages, the model's output, the player's version and a note (`GameState.gold`, 30 kept). The newest for that friend goes into their next reading prompt as a worked example; Copy all as JSON exports them to improve prompts, examples and tools.
- **Models.** Menu has "Model for reading and book talk" (`llm.ts` `deepModelName`, `thinkingModel`): an Ollama name, blank for the usual one. `ModelCall` takes an optional `temperature`.
- **Planned.** A book-end synthesis (one lesson for life from the whole digest), friends who recommend a book to each other, using gold examples to pick few-shot by similarity, and a stronger remote model for the closing call.

## Studying and the manifesto (2026-11-03)

Every friend with a book on their shelf is slowly writing a manifesto. Why: reading gave them notes but nothing to build; studying with a bar for what counts as a note gives them something to say, and a manifesto gives the village something to read.

- **Which hour.** The "reading from the bookshelf" block (`Place` `read`) stays the only schedule entry, so old saves and edited days are untouched. `shelfActivity(s, id, hour)` decides what that hour is, from a hash of friend, day and hour: reading four hours in six, studying two in six; once writing is unlocked, studying two, writing two and reading two. A friend whose books are all finished studies instead of idling. `BabyGame.tsx` `readOnSchedule` calls it; `runReading`, `runStudy` and `runWrite` all hold `npc.reading` (with `npc.shelfDoing` for the label).
- **A study session** (`study-llm.ts` `runStudySession`). The model picks a theme (its own open questions and ideas, not recent themes), then takes JSON steps: `search_shelf`, `search_book`, `take_note`, `finish`, at most nine. Searches return three passages of about 700 characters with their page (`passages.ts`: BM25, then the keyword shortlist re-ranked by `nomic-embed-text` when Ollama has it; otherwise keywords alone). `take_note` is refused unless the quote is word for word in a passage shown this session, the idea is not a repeat, and a second strict call says it is **good, worthy and truthful**. Most sessions keep one to four notes. The session ends with a cap-off summary. With no model, `scriptedSession` searches for one of their ideas and keeps up to two sentences that really answer it.
- **Where it is kept.** `GameState.study[id]`: `notebook` (free notes), `workbook` (manifesto study notes), `sessions`, `manifesto`. The Study tab in the home panel shows all of it. Each session also leaves a `study` memory.
- **The topic.** After `SESSIONS_FOR_TOPIC` (10) free sessions `topicDue` is true and `topicWithModel` draws one topic and title from the summaries and notes (script: the two words they share most). The manifesto is saved unannounced; `goSleep` calls `announceManifestos`, which says "{name} has decided to write a manifesto about {topic}" in the morning card and a toast. Until then they study as before.
- **The workbook and writing.** After the announcement study notes go to the workbook. After `WORKBOOK_SESSIONS_FOR_OUTLINE` (3) manifesto sessions the "working on my manifesto" hour unlocks (`canWrite`): first `outlineWithModel` (a thesis and five to eight parts, each saying what it argues and from which sources), then one `sectionWithModel` per sitting (about 300 words, quoting sources, claiming nothing they do not back) until `manifestoDone`.
- **Sharing.** With an outline, an author who meets a friend with no copy asks them to read it in two meetings of three (`pitchTarget`, called from `startTalk`; `chatter.ts` `pitchWithModel`: the ask, the friend's own answer with a yes or no, the author's reply). A friend who said no is asked again after `PITCH_AGAIN` (5) days. A yes puts a `Book` named "{name}: {title}" on their shelf (`giveCopy`): `manifestoBy` is the author and the words are `inline`, so `bookText` never touches the attachment store, and they read it like any other book (sittings, ideas, talks). `syncCopies` refreshes every copy as the author writes more, keeping where each reader got to.
- **Planned.** Friends who finish a manifesto write back to the author; revising a finished manifesto after talks; caching embeddings in the attachment store (they are in memory today).

_Homes (2026-11-03):_ `homes.ts` has `BLOCKS`: friends who share a building (`Home.block`). A tenant keeps its own door, bed and name; tenants stand two tiles apart on the block's row. Footing is one tile either side of each home (`world.ts`), so keep homes four tiles apart.

_Homes (later 2026-11-03):_ six blocks of three friends (`BLOCKS`), six single homes; footing is two tiles either side of a single home, one either side of each tenant, so keep singles six tiles from their neighbours.
