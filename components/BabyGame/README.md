# `components/BabyGame/` — the Baby animal game UI

_Last mapped: 2026-11-02 (fifth pass: tool bar, front and side views, the Center of The World)_

Opened by the **Baby animal game** key in `components/friend-details/FriendDetailsPanel.tsx`, which lazy-loads `BabyGame`. A wide dialog in the friend instrument's own look: dark riveted hull, pale steel plates, CRT-green readouts, house keycaps (`.friend-key`). The rules are in `lib/baby-game/` (read its `README.md` first).

```
BabyGame.tsx    dialog + canvas loop + keys + the glue between the engine and the plates
trees.ts        big trees (oak, pine, birch, blossom) painted once each; zone picks the mix
art.ts          hand-painted scenery: the marble ruin cottage, plants, campfire, crops, rain
map.tsx         the M map: tiles at 6px, named zones, gates dimmed, live pins
render.ts       paints the 304×192 view: cached map, live water, farm plots, nodes, stations, friends, player and butterflies by their feet, light, rain, meteors, fog, moons
panels.tsx      Talk, Bag, Workbench, Trade Stump, Notice Board (with the festival entry), Lamp, Plot (till / plant / water / harvest), the four mini game plates (`minigames.tsx`), Journal (story, friends, skills, Starlog, diary), Menu, StoryCard, TimingGame
pixel.tsx       PixelSprite (32×32 species) and ItemIcon (8×8 shapes) as small canvases
BabyGame.css    hull, HUD, plates, hearts, timing bar, phone pad
```

## What you see

- **HUD.** The companion and its perk, day and clock, energy bar, buttons, Bag / Journal / Menu keys. A game day is about six real minutes.
- **World.** A fantasy Earth: green meadows, oaks and pines, boulders, dirt paths, still water that **mirrors the shore** (`reflect` in `render.ts` copies the rows above each water edge, rippled and faded), stone arches over the shut gates, and a ruined Stair Court whose steps run opposite ways. Butterflies, pollen, fireflies after dark, a moon, sun shafts through the wood. The canvas is shown at 3× with `image-rendering: pixelated`. A dusk tint comes on after five. The lamp and campfire glow after dark once one part is in. Rain falls on rain days and non-rain friends hold a leaf over their heads. Meteor showers streak the sky; morning mist drifts in lilac banks. The HUD shows the cycle (Bloomtide…) and the weather.
- **Farm.** Standing on a plot makes `E` till, plant, water, or harvest; the Plot panel also has *Water everything thirsty*. Crops draw in three stages and sparkle when ripe.
- **Prompt.** `E` and the thing nearest you. Friends come first. `Shift` runs; quiet friends jump if you run near them.
- **Panels.** Open over the world and pause it. `Esc` closes them. A friend's panel is the heart of play: portrait, ten hearts, mood, their line (typed out, in their bubble effect), what they want, and keys for Talk, Gift, Approach, Favor, Chat, and Give or Ask.
- **Chat** shows a chip, **answered by the local model** or **scripted answer**, so you always know which.
- **Night.** Sleep (bed, or Menu after six) shows the companion's diary page and says if a model wrote it.
- **Back home.** The Notice Board shows the real mission the friend has open, read-only. The game never completes or writes it.

## Behavior that is easy to miss

- The canvas lives in state (`setCanvas`), not a ref: the dialog portals its children after the first render, so a ref is null when the loop effect first runs.
- A slow frame is walked in 50ms steps (up to half a second), and the clock runs on real time, so a low frame rate does not slow the day.
- Friends start where they would be *now* (`newSim`), so a saved evening opens with everyone at the fire.
- Saves: every state change writes `brain2-baby-game`. **Start over** is in the Menu.
- Desktop first. A touch pad shows when `pointer: coarse`, but this is not yet a `docs/MOBILE_STYLE.md` screen.

## Third pass: bigger, realer, voiced

- **Trees.** A `T.TREE` tile is only the trunk and the collision. `trees.ts` paints each tree once (a canopy of shaded leaf clumps rising about two and a half tiles, a barked trunk, a shadow) and `render.ts` stands them in the y-sorted body list. A tree fades to half when you or the lit area is behind it. Scatter keeps two clear tiles around nodes, stations, and friends so canopies do not bury things.
- **Animals.** 32×32, side view, facing right, feet on row 29, each as big as a baby of its kind next to the others (`sprites.ts`). The renderer mirrors a sprite when its animal walks left, and the companion faces you.
- **Map.** `M` (or the Map key) opens `map.tsx`. The HUD also names the region you are in.
- **World.** 64×52. New: Aspen Highlands (a birch meadow with its own still pond) behind a gate at act 3, and Mirror Lake (a great lake with a sand rim and a fishing shore) behind a gate at act 4.
- **Voiced talk.** Every line a friend says goes through `voice()` in `BabyGame.tsx`: the script shows first, and when a model is up `llm.voiceLine` rewrites it in the friend's voice (kept only if every item name and number survives). `LifeContext` (`lib/baby-game/life.ts`) is the planned seam for your real tasks, habits and wishes; nothing passes it yet.

## Fourth pass: marble, plants, and the council

- **Cottage.** `art.ts` `paintHouse` paints a white marble ruin over its 5×4 tile block: fluted columns and an arched doorway, arched windows with flower boxes, a roof half terracotta and half open sky, ivy, and a stairway climbing the right corner to an arch onto nothing. The door tile is still the bed.
- **Ground and plants.** Grass shades by smooth noise with tufts; nodes (berries, saplings, reeds, clover, pebbles, feathers, mushroom clusters, shells, dig spots, fish shadows), the campfire (stones, logs, three flame layers, sparks), crops (four stages, six shapes), and rain (two depths of slanted streaks and landing rings) are all painted in `art.ts`.
- **The Center of The World** is a girl in the village-sim-farmer manner: big head, auburn ponytail with a pink bow, cream shirt, blue overalls.
- **Quests.** The Journal has a Quests tab: twelve friend errands (`lib/baby-game/quests.ts`) that show at two hearts and are handed in from anywhere.
- **The council.** The campfire opens the Campfire Council. You type what is weighing on you in real life (optionally urgent). An urgent item pulls every social friend to the fire at any hour. They talk it over in plain text (model-voiced, scripted fallback), offer up to three tiny first steps, and when you finish it for real you mark it done here and everyone cheers. Read-only toward the real app: it is typed in by you today, and `LifeContext` is the seam for it to come from your real lists later.

## Fifth pass: tool bar, views, and the player

- **Tool bar.** Five slots at the bottom of the stage: Hand, Hoe, Seeds, Can, Scythe (keys 1 to 5; Q cycles the seed). Tapping a tool selects it, and if a plot is within reach it is used at once: Hoe tills, Seeds plants the chosen seed, Can waters, Scythe harvests. With a tool selected, E on a plot uses it too, and the prompt names the action. With the Hand, E opens the full plot panel as before. The seed slot shows the seed and how many you hold.
- **Two views.** Every animal and the player have a front view (idle, walking toward you or away, and every portrait) and a side view (walking across). `spriteGrid(id, view)` and `playerGrid(view)` pick; `render.ts` chooses from the direction a body is going, and mirrors the side view to face left. Front views are drawn on a 24-unit authoring grid scaled to each animal's real size on the 32×32 canvas (`Front` in `sprites.ts`).
- **The Center of The World.** The player's character is named for the idea that everyone is the sole inhabitant of their own universe. She is drawn smaller than before: about 22 pixels tall front on, a head taller than a baby fox, a girl with auburn hair, a pink bow, and blue overalls.
- **Ground.** Hills and the hayloft yard no longer tile into a checkerboard: moss and grass gather in soft noise-driven patches, and paths grow grass along any edge that meets it.
