# `components/BabyGame/` — the Baby animal game UI

_Last mapped: 2026-11-03 (the slime mold spreads over the map: `slimeart.ts`; one pixel size: `pixelsnap.ts`, 320×200 view, no Scale2x)_

**North star.** The painters here (`art.ts`, `propart.ts`, `trees.ts`, `sprites.ts` via `lib/baby-game/`) are hand-made today. The goal is a game that draws anything: a weak model writes a small spec (parts, named palette ramps, one verb) and a spec painter draws it. Hand-made props become the examples that spec grammar is tested against. Plan: `docs/BABY_GAME_REDESIGN.md`, section _Where this is going_. We are emulating Sprite Fusion's toolset (tilemap editor with auto-tiling, props and sprite generators, animator, Pixel Snapper); the same section lists each tool against what is built here.

Opened by the **Baby animal game** key in `components/friend-details/FriendDetailsPanel.tsx`, which lazy-loads `BabyGame`. A wide dialog in the friend instrument's own look: dark riveted hull, pale steel plates, CRT-green readouts, house keycaps (`.friend-key`). The rules are in `lib/baby-game/` (read its `README.md` first).

```
BabyGame.tsx    dialog + canvas loop + keys + the glue between the engine and the plates
trees.ts        big trees (oak, pine, birch, blossom) painted once each; zone picks the mix
art.ts          hand-painted scenery: the Gaudí cottage (outside), plants, campfire, crops, rain, everyday props
propart.ts      the props drawn from what the player loves and dreads (orb, prism, microscope, wasps, ...)
homeart.ts      the 1× fallback painters for friends' homes (nest, burrow, den, hollow, lodge, hutch, stall, igloo)
houseart note   see `homeart-hi.ts` and `housegen.ts` below: the homes drawn in the game
Casa.tsx        walking about inside the cottage (Hall, Noble Floor, Loft and the three rooms off them): its own canvas and loop
casa-paint.ts   paints the first three rooms and every frame (`drawCasa`), and draws the furniture sprites; named apart from `Casa.tsx` because macOS paths ignore case
casa-kit.ts     the painter's kit shared by the room painters: pixels, plaster, wood, parquet, glass discs, arches, stairs, palettes
casa-rooms.ts   the shells of the Sunken Lounge, Glasshouse and Boudoir
casa-made.ts    furniture painted in code (`madeCanvas`): plaster tree columns, the bookcase bay, stained-glass windows, bead curtain, bubbles, dome of stars, nook bed, net hammock, rugs, spiral stair; sizes in `lib/baby-game/casa-pieces.ts`
casa-grade.ts   one colour grade over every room and sprite (`gradeCanvas`): mint plaster to cream, honey kept and deepened, greens richer, black to green-black ink, white to warm pearl; read off the board: cream plaster, honey and walnut, emerald and olive, black lacquer, silver, rose velvet
casa-deco.ts    what enriches the shells (`decorate`, once per room: wavy plaster ribbon, niches, wall-foot shadow, floor sheen, light thrown on the floor) and the per-frame light (`drawAmbient`: breathing shafts, drifting dust)
map.tsx         the M map (the built extent only, `EXTENT_W` × `EXTENT_H`): tiles at 6px, named zones, gates dimmed, homes as cobalt roofs, live pins
render.ts       paints the 304×192 view: cached map, live water, farm plots, nodes, stations, friends, player and butterflies by their feet, light, rain, meteors, fog, moons
panels.tsx      Talk, Bag, Workbench, Swap Stump, Notice Board (with the festival entry), Lamp, Plot (till / plant / water / harvest), the four mini game plates (`minigames.tsx`), Journal (story, friends, skills, Starlog, diary), Menu, StoryCard, TimingGame
pixel-skin.css  the game's menu look (storybook pixel)
village.tsx     a friend's home (shelf, mind, day, talks, memory) and Village life; `village.css` is its look
village.css     the `bv-*` classes of `village.tsx` and the `.bg-plate.is-full` window, keys and fields; loaded after `pixel-skin.css`
devpanel.tsx    Development mode: the ` plate (Teleport, Time, Story & quests, Items, Friends, Economy, Powers), the DEV readout, the always-on quick bar (`DevQuickBar`), the debug overlay
designpanel.tsx Character design: every view of every friend, a status and a note for the redesign (Journal, Friends tab, **Design** key); links to the generation log
pixel.tsx       PixelSprite (32×32 species) and ItemIcon (8×8 shapes) as small canvases
shake.ts        screen shake and hit-stop in whole pixels (`Shake`)
dither.ts       one 4×4 Bayer grain: `ditherRect` for fades and fog, `Veil` for the night with pools of light cut out
juice.ts        step dust and hands-on bursts (till, water, harvest, gather, hearts), time based, whole pixels
ambient.ts      the living ground: swaying grass and flowers that lean away from walkers, water glints, cloud shadows, falling leaves
housegen.ts     one generic house builder (`HouseSpec`: body, material, roof, door, window, palette ramps, extras); `specFor(kind, id)` customises it per friend; `buildHouse` is pure
homeart-hi.ts   caches each friend's house from `housegen.ts` on the 96 grid, pooled by `pixelsnap.ts`, and stamps it
sceneryart.ts   paints the WFC dressing (`drawScenery`), the living water (`paintWater`) and the Sine Hop cascade (`drawFalls`)
slimeart.ts     paints the slime mold's body (`drawSlime`): cached 32×32 patches per (cell, mass level, joined sides) with a lavender film and pink veins, live pulses streaming out from the hearts, spores, a bright tangle at each heart; `slimeLights` lets thick patches glow through the night veil. Rules and memory are in `lib/baby-game/slime.ts`
flora.ts        paints the ground's drawn plants (snapped ComfyUI sprites from `lib/baby-game/flora-sprites.ts`) in bands so the tops sway; `floraOn` picks the kind per tile
lab pages      `/lab/baby-fx` (effects, `components/Lab/BabyFx/`) and `/lab/baby-world` (the whole map at 1:1 with every station, prop, node, friend spot and home labelled; a review aid, `app/lab/baby-world/page.tsx`) , `/lab/baby-casa` (the three cottage floors whole, `app/lab/baby-casa/page.tsx`) and `/lab/baby-play` (the game opened straight, to walk the cottage; `app/lab/baby-play/page.tsx`)
Casa.tsx        the inside of the cottage as a game mode: its own canvas and loop, arrows/WASD, Shift, E, Esc out
casa-paint.ts   paints the three floors of the cottage once each, plus columns, plants, bed, lamp, the furniture sprites from `lib/baby-game/casa-furniture.ts`, and the night light (`floorCanvas`, `drawCasa`, `furnitureCanvas`)
casa-kit.ts     the shared painter's kit (moved out of `casa-paint.ts` so `casa-rooms.ts` can use it)
casa-rooms.ts   `paintLounge`, `paintGlasshouse`, `paintBoudoir`: walls, windows, floors and built-ins of the three rooms off the first floors
hires.ts        the frame canvas: two real pixels per game pixel (`DETAIL` 2, `HI` 1), shown as is; its `scale2x` is the EPX step `pixelsnap.ts` uses
pixelsnap.ts    `snapTo` (pool a finer picture onto the grid, commonest colour per block), `epx2`, `onGrid`, `pooledLayer` (live fine painters)
gens/           the generation log: ComfyUI outputs with recipes, likes, kinds, tags and notes (`/lab/baby-gens`, its own README)
fx/             effect drafts for the redesign, played only in the lab `/lab/baby-fx` (not in the game yet)
BabyGame.css    hull, HUD, plates, hearts, timing bar, phone pad
```

## What you see

- **HUD.** The companion and its perk, day and clock, energy bar, gems (the money), Bag / Journal / Menu keys. A game day is about six real minutes.
- **World.** A fantasy Earth: green meadows, oaks and pines, boulders, dirt paths, still water that **mirrors the shore** (`reflect` in `render.ts` copies the rows above each water edge, rippled and faded), stone arches over the shut gates, and a ruined Stair Court whose steps run opposite ways. Butterflies, pollen, fireflies after dark, a moon, sun shafts through the wood. The canvas is shown at 3× with `image-rendering: pixelated`. A dusk tint comes on after five. The lamp and campfire glow after dark once one part is in. Rain falls on rain days and non-rain friends hold a leaf over their heads. Meteor showers streak the sky; morning mist drifts in lilac banks. The HUD shows the cycle (Lotus Bloom…) and the weather.
- **Farm.** Standing on a plot makes `E` till, plant, water, or harvest; the Plot panel also has *Water everything thirsty*. Crops draw in three stages and sparkle when ripe.
- **Prompt.** `E` and the thing nearest you. Friends come first. `Shift` runs; quiet friends jump if you run near them.
- **Panels.** Open over the world and pause it. `Esc` closes them. A friend's panel is the heart of play: portrait, ten hearts, mood, their line (typed out, in their bubble effect), what they want, and keys for Talk, Gift, Approach, Favor, Chat, and Give or Ask.
- **Chat** shows a chip, **answered by the local model** or **scripted answer**, so you always know which.
- **Night.** Sleep (bed, or Menu after six) shows the companion's diary page and says if a model wrote it.
- **Back home.** The Notice Board shows the real mission the friend has open, read-only. The game never completes or writes it.

## Behavior that is easy to miss

- **One fine pixel grid.** `drawFrame` paints a 320×200 view at two real pixels per game pixel (`DETAIL` 2, a 640×400 canvas) and the page scales it up whole (`image-rendering: pixelated`). Nothing is smoothed or blended. Everything that stands is on that one grid: trees (painted at 3×, pooled by `pixelsnap.ts` `snapTo` to 2×), the 96px homes (kept at 96), animals (the 32 frame smoothed to 64 with EPX, then pooled to the animal's size), flora (EPX once), and the ground map (painted in game pixels, run through EPX once, `hiMapOf` in `render.ts`). Props, nodes and crops use their thirds-of-a-pixel painters (`proparthi.ts`, `nodeart-hi.ts`) through `pooledLayer`: painted to a scratch canvas, pooled to the grid, stamped, refreshed 8 times a second. Sprites sit on half-pixel steps (`onGrid`). Stations, gates, rain, dither and juice still paint in whole game pixels (2×2 blocks), as effects. **Why:** the 2026-11-03 detail passes had mixed pixel sizes in one frame. **Planned:** stations, gates and the cottage (`paintHouse`) drawn at the fine grid.

- The canvas lives in state (`setCanvas`), not a ref: the dialog portals its children after the first render, so a ref is null when the loop effect first runs.
- A slow frame is walked in 50ms steps (up to half a second), and the clock runs on real time, so a low frame rate does not slow the day.
- Friends start where they would be *now* (`newSim`), so a saved evening opens with everyone at the fire.
- Saves: every state change writes `brain2-baby-game`. **Start over** is in the Menu.
- Desktop first. A touch pad shows when `pointer: coarse`, but this is not yet a `docs/MOBILE_STYLE.md` screen.

## Third pass: bigger, realer, voiced

- **Trees.** A `T.TREE` tile is only the trunk and the collision. `trees.ts` paints each tree once (a canopy of shaded leaf clumps rising about two and a half tiles, a barked trunk, a shadow) and `render.ts` stands them in the y-sorted body list. A tree fades to half when you or the lit area is behind it. Scatter keeps two clear tiles around nodes, stations, and friends so canopies do not bury things.
  _Last mapped: 2026-11-03._ Trees now live (`lib/baby-game/trees.ts` holds the rules): `render.ts` draws each tile by `stageOf` (stump, seedling and sapling via `drawSprout` in `trees.ts`; young trees as the full art at 0.62 scale; mature trees with falling leaves). Stumps and small ones are walkable; young and mature block. Nothing felled or sprouted is stored in the map, only in `GameState.trees`. **Planned:** trunk lean, roots and forks, more kinds (willow, snag), seasonal tints, and a held axe once `specs/tool.ts` plays the `chop` motion.
- **Animals.** 32×32, side view, facing right, feet on row 29, each as big as a baby of its kind next to the others (`sprites.ts`). The renderer mirrors a sprite when its animal walks left, and the companion faces you.
- **Map.** `M` (or the Map key) opens `map.tsx`. The HUD also names the region you are in.
- **World.** 64×52 at the time (80×64 since the homes pass). New: Kauai Highlands (a birch meadow with its own still pond) behind a gate at act 3, and Sparkle Lake (a great lake with a sand rim and a fishing shore) behind a gate at act 4.
- **Voiced talk.** Every line a friend says goes through `voice()` in `BabyGame.tsx`: the script shows first, and when a model is up `llm.voiceLine` rewrites it in the friend's voice (kept only if every item name and number survives). `LifeContext` (`lib/baby-game/life.ts`) is the planned seam for your real tasks, habits and wishes; nothing passes it yet.

## Fourth pass: marble, plants, and the council

- **Cottage.** `art.ts` `paintHouse` paints a white marble ruin over its 5×4 tile block: fluted columns and an arched doorway, arched windows with flower boxes, a roof half terracotta and half open sky, ivy, and a stairway climbing the right corner to an arch onto nothing. The door tile is still the bed.
- **Ground and plants.** Grass shades by smooth noise with tufts; nodes (berries, saplings, reeds, clover, pebbles, feathers, mushroom clusters, shells, dig spots, fish shadows), the campfire (stones, logs, three flame layers, sparks), crops (four stages, eleven shapes; the schrodinberry checker flickers while ripe), and rain (three depths of slanted drops, four-frame crown-and-ring splashes only on open floor tiles (not water, trees, rocks, walls, roofs), and a drifting floor mist, after the Sprite Fusion rain; stateless from `t`) are all painted in `art.ts`.
- **The Center of The World** is a girl in the village-sim-farmer manner: big head, auburn ponytail with a pink bow, cream shirt, blue overalls.
- **Quests.** The Journal has a Quests tab: twenty-four friend errands (`lib/baby-game/quests.ts`) that show at two hearts and are handed in from anywhere. Each shows a one-line lesson from `dharma.ts` (Zen, Taoism, Buddhism). The talk card shows the friend's school and idea from three hearts.
- **The council.** The campfire opens the Macy Council. You type what is weighing on you in real life (optionally urgent). An urgent item pulls every social friend to the fire at any hour. They talk it over in plain text (model-voiced, scripted fallback), offer up to three tiny first steps, and when you finish it for real you mark it done here and everyone cheers. Read-only toward the real app: it is typed in by you today, and `LifeContext` is the seam for it to come from your real lists later.

## Gaudí cottage (2026-11-02)

_Last mapped: 2026-11-03 (furnished, with three more rooms)_

- **Outside.** `art.ts` `paintHouse` paints a 112×112 house over a 7×7 tile block (`HOUSE_TILES`, x 16..22, y 11..17; the three upper rows are `T.ROOF`, the rest `T.WALL`, so the gap in the Thistle Wood corner is built over). Four floors: a diamond-tiled ground floor (blue and white) with a catenary door and two oval windows, a noble floor with a bay of stained-glass discs between bone-shaped columns and a mask-holed balcony, an upper floor of three round windows, and a roof of dragon scales with aqua fins, a mosaic bulb tower with a silver star, a dome tower and a flowering vine. Pastel blue and green, no pink or purple except a rare lilac disc, no yellow, silver not gold.
- **Door.** The old bed station is now `STATIONS.bed` at (19, 17), labelled "Go inside". Using it opens the `inside` mode (`BabyGame.tsx` renders `Casa.tsx` over the stage instead of the overlay). The clover node that stood in the block moved to (22, 18).
- **Inside.** Three floors, plan and walking in `lib/baby-game/casa.ts`, paint in `casa-paint.ts`: the **Hall** (blue-and-white diamond tile, iron lift cage, ticket window, tiled alcove with two oval doors, a grand stair), the **Noble Floor** (a 40-tile room after Casa Batlló: three arches over a bay of leaded glass discs and wavy wooden frames with oval panes, two stone columns with twisted collars, a crystal chandelier, honey herringbone parquet with the bay's coloured light on it, fan-folding doors with glass roundels), and the **Loft** (pebble skylights, wavy honey wainscot, a round-windowed door with a monstera, iron swallows flying uphill, a round rug, the bed). Plaster is cream with a seafoam shade and a crackle of fine cracks. Stairs and exits are spots you press E on; looks give a toast.
- **Furnished (2026-11-03).** Every room is now furnished from the "future home" Pinterest board in `homedesignref/` (261 pictures). The objects were drawn in ComfyUI (`scripts/baby-furniture-queue.mjs`: SDXL + pixel-art-xl, one prompt per object) and snapped to small sprites (`scripts/baby-furniture-snap.mts` into `lib/baby-game/furniture-sprites.ts`: a 14-colour palette plus an outline, rows of palette characters, painted synchronously). `lib/baby-game/casa-furniture.ts` is the layout; solid pieces block tiles and pieces with a `look` become spots. Wall pieces (curtains, pendants, mirrors, the egg fireplace) are painted into the room's canvas; floor pieces are sorted with the walkers by their feet; lit ones add a pool of light at night.
- **Interactive furniture.** Pieces with a `use` in `casa-furniture.ts` become spots (`kind: "use"`): lamps, pendants, candles and the angel switch off and on (their night glow follows), seats sit you down (`Walker.sit`, any step stands you up), the record players start music (notes drift above them), cabinets, dressers, vanities, shelves and the trolley can be rummaged for a small find. Pieces with a `look` give a toast. State (lamps off, music playing) lives in `Casa.tsx` refs and is not saved.
- **Closer to the board.** Sprites are drawn image-to-image from the board's own photo (`scripts/baby-furniture-ref.mjs`, denoise 0.72) so shape, colour and trim follow the picture; the snapper prefers those (`furnref-`) over the words-only draws (`furn-`), except for curtains, the hammock, ivy and the hanging lamps, whose photos carry a window behind them.
- **Three more rooms.** The Hall's oval doors open into the **Sunken Lounge** (sage plaster, round windows, a green ledge, a wool pit in the floor, chrome and glass), the Noble Floor's folding doors into the **Glasshouse** (green iron lattice over sky, emerald tile, black-and-white diamond stone, a round table for a dinner that is about to happen), and the Loft's round door into the **Boudoir** (lilac plaster, a glass-block window wall, an emerald bath alcove, two vanities, a gauze bed). Each has an arched door in the middle of the back wall that goes back. These were "look" spots before; the stairs-and-doors code (`takeStairs`) already handled any spot with a `to`, so `Casa.tsx` did not change.
- **Bed.** Sleeping moved from the door to the Loft bed (`bedSleep` in `BabyGame.tsx`, the same rule as before: evening or worn out).
- **Time.** The world stands still inside, like behind every panel. Night tints the rooms and the lamps are pools of light.
- **More furniture and richer rooms (2026-11-03).** 18 new pieces are painted in code, not drawn in ComfyUI (`casa-made.ts`, sizes in `lib/baby-game/casa-pieces.ts`, so the layout can read them without a canvas): two plaster tree columns that flank the Lounge's door and one in the Hall, the stained-glass oval and tulip windows and the bead curtain in the Noble Floor, a star-cut dome in the Hall's vault and the Boudoir's, a terracotta alcove bed in the Loft, the net hammock and ivy that had no sprite, a leather sofa and a chrome table with lime stools, a persian rug, a moss rug, a spiral stair, vases, a swan candle and an orb clock. `Placement` gained `flat` (a rug, laid under every walker) and `span` (a narrow trunk's half-width for the walking). Every shell now gets `decorate` from `casa-deco.ts`; every frame gets `drawAmbient` (light shafts that breathe, dust). Then `casa-grade.ts` regrades each finished room canvas and each pictured sprite so mint plaster reads as cream, greens are richer and the blacks are green-black ink. The lab page `/lab/baby-casa` shows it all. _Last mapped: 2026-11-03_
- **Planned.** Friends visiting inside, furniture you can move (the layout is data now), the board's other things not yet in (spiral stair, glass-block columns as props, stained-glass tulip door, sunken checkerboard sink as a tile), a rooftop terrace, sound, `Casa.tsx` hint for night lamps, a rooftop terrace, sound.
- The roof, wall and door tiles in the cottage block are still painted as lawn first by `buildMapCanvas`. The old impossible stairway is gone (the Stair Court has its own).

## Fifth pass: tool bar, views, and the player

- **Tool bar.** Five slots at the bottom of the stage: Hand, Hoe, Seeds, Can, Scythe (keys 1 to 5; Q cycles the seed). Tapping a tool selects it, and if a plot is within reach it is used at once: Hoe tills, Seeds plants the chosen seed, Can waters, Scythe harvests. With a tool selected, E on a plot uses it too, and the prompt names the action. With the Hand, E opens the full plot panel as before. The seed slot shows the seed and how many you hold.
- **Two views.** Every animal and the player have a front view (idle, walking toward you or away, and every portrait) and a side view (walking across). `spriteGrid(id, view)` and `playerGrid(view)` pick; `render.ts` chooses from the direction a body is going, and mirrors the side view to face left. Front views are drawn on a 24-unit authoring grid scaled to each animal's real size on the 32×32 canvas (`Front` in `sprites.ts`).
- **The Center of The World.** The player's character is named for the idea that everyone is the sole inhabitant of their own universe. She is drawn smaller than before: about 22 pixels tall front on, a head taller than a baby fox, a girl with auburn hair, a pink bow, and blue overalls.
- **Ground.** Hills and the hayloft yard no longer tile into a checkerboard: moss and grass gather in soft noise-driven patches, and paths grow grass along any edge that meets it.

## Sixth pass: props that do things

- **Props.** Twenty-nine hand-painted props stand in the world. Where is `PROPS` in `lib/baby-game/world.ts`; what each does is `lib/baby-game/props.ts` (read its README section). `drawProp` in `art.ts` paints the everyday ones (mailbox, well, scarecrow, beehive, rowboat, hay, ...) and hands the rest to `drawTasteProp` in `propart.ts`: a white orb light, puddle, prism, little library, thrift rack, collage desk, fireworks crate, daylight-saving clock, pendulum, ducklings, lawn sprinkler, microscope, fossil bed, romanesco, slime mold (its log; the creature itself is `slimeart.ts`), wasp nest and kitten. Many move: the orb bobs and glows after dark, the puddle ripples harder in rain, the pendulum swings on a sine, bees and wasps circle.
- **Using one.** `E` beside a prop shows its verb in the prompt ("Check the mail", "Hold the prism to the light"), and shows "(done for now)" once a once-a-day use is spent. The collage desk opens the Workbench; the rowboat starts the fishing timing game.
- **Drawing.** `render.ts` puts props in the y-sorted body list, so tall ones hide you from behind. Flat ones (blanket, puddle, ducklings, sprinkler, fossil, kitten) paint under everything and are walkable. Sprite Fusion's generator needs an account, so these were painted by hand.
- **Names.** The twenty-four residents are named for people and characters you admire: Ada (Lovelace), Pilgrim (Vonnegut), Dobby, Daria, Mathilda, Euler, Bohm, Hofstadter, Pynchon, Conway, Hamilton (Morris), Johnston (Daniel), Reid (Spencer), Ernst (Max), Tegmark, Kaufman (Andy), Abagnale, Irwin (Steve), Thompson (Hunter S.), Lynch (David), Mugler, Gaultier, Wallace (David Foster), and Vonnegut. Ids are unchanged, so saves still load.
- **Idle life.** A body that stands still is no longer a statue (`lib/baby-game/idle.ts`). `idlePose(id, t)` is a pure schedule from the body's name and the clock, so every friend keeps its own rhythm: a blink about every 3.4 seconds, a slow breath (the torso squashes a pixel), an ear flick about every 7, and now and then a glance, the side view for a beat. Sleeping friends only breathe. The player and the companion do it too. The lab's **Idle life** effect shows it at 3× and as a crowd.
- **Dither and light.** Dusk, night and dawn are no longer a flat tint. `dither.ts` `Veil` paints the day's darkness (`dayVeil` in `render.ts`: purple dusk from 17:00, blue night by 22:00, pink dawn) as a stepped Bayer dither, with pools of light cut out per pixel: the campfire (flickers), the lit lamp, a faint lantern around the player, and glowcaps. The old soft radial gradients for the fire and lamp are gone. Fog is a dither veil with three layers of drifting banks (`ditherRect`). Blob shadows are cool blue-violet, not warm grey. The lab's **Dither + light** effect keeps the old flat look as draft A for comparison.
- Not done: dithered iris fades for sleep and zone changes.
- **Shake and hit-stop.** `shake.ts` `Shake.kick(now, amp, stop)`: an optional two-frame hit-stop, then a jitter that decays from `amp` pixels to nothing in a quarter second, stepped at 30 Hz, integers only, off under reduced motion. Used by: Sine Hop (a splash: 3 px with hit-stop), Orb Light Glade (a jar that closes on nothing: 1 px), Echo Flower (a wrong note shakes the flower in a stepped CSS animation before the result), the world camera (a friend you startle: 1 px; placing a Lamp part: 3 px with hit-stop, applied through `Frame.shake` to the camera).
- **Rain.** The game's own rain (`art.ts` `drawRain`: three layers, four-frame crown splashes on open ground only) already beat the first lab drafts, so those were dropped. The one change: its floor mist is now `ditherRect` bands, so rain shares the grain with the night and fog.
- **Places.** The valley is now **Valdivia** (the Valdivian forest, tiny animals). Zones: Balboa Meadow, Permaculture Patch, Refraction Orchard, Moiré Pond, Ice Halo Cove, Fossil Hill, Swap Meet Yard, Thistle Wood, Kauai Highlands, Sparkle Lake. The lamp is the **Orb Lamp**; its stations are the Orb Light Glade, Sine Hop (the falls), the Swap Stump, and the **Macy Council** at the campfire; the finale is the **Festival of Orb Lights**. Zone ids are unchanged, so saves still load.

## Homes and the bigger map (2026-11-02)

- **Map.** 80×64 now, with three new zones at the edges: Cobalt Glow Marsh, The Index Stacks, Firework Dunes (`lib/baby-game/README.md`, _The world, grown_). `trees.ts` gives the marsh mostly birch and the stacks oak and pine; the dunes use the default mix.
- **Homes.** `render.ts` draws each friend's home (`lib/baby-game/homes.ts`) with `homeart.ts`, depth-sorted with everything else. Friends walk home the hour before bed and sleep on the doorstep.
- **Knock.** E near a home toasts the answer (`sim.knockLine`) and commits `engine.knock`, which only adds a memory.

## Planned: a painter that draws any noun

- Turn `drawTasteProp`'s `switch` into a spec painter (parts such as rect, ellipse and line in a 16×16 box, named ramps from one table, optional motion like bob, sway, flicker) so hand-made and generated props share one path. The same for ground tiles in `art.ts`.
- Paint once per spec hash and cache the canvas, as `trees.ts` and `buildMapCanvas` do.
- A lab at `/lab/baby-props`: type a noun, see the prop, its verb and whether a model or the script made it.
- Characters: body templates plus accessories; `walk.ts` and `idle.ts` already animate any still, so one still per character is enough.
- **Seasons.** The four cycles are now **Lotus Bloom** (the lotus opens), **High Yang** (peak light), **Anicca** (impermanence, the leaves let go), and **Deep Yin** (stillness and dark). Order and crop windows are unchanged.

## Character design panel

_Last mapped: 2026-11-02_

In the Journal's Friends tab each friend has a **Design** key. It opens `designpanel.tsx`: a list of the Center of The World and every friend, the front, side and back views at 6×, a status (fine as is, needs redesign, redesigned) and a note box. Above the stills is a **studio**: the whole character on a small stage, animated live (idle blink and breath, walk, run, a front/side/back turntable), with facing, flip and pause keys. The list picks use the navy plate colours in `pixel-skin.css` (they were white with pale text and unreadable). Notes save as you type under `brain2-baby-game-design` (`lib/baby-game/design-notes.ts`), apart from the village save, so Start over keeps them. **Copy this brief** and **Copy all redo briefs** put plain-text briefs on the clipboard for whoever redraws the sprite. **Planned:** the same panel reviews a generated character and sends it back for another try.

## Night-blue pixel skin

_Last mapped: 2026-11-03 (night blue)._ `pixel-skin.css` (loaded after `BabyGame.css`) is the game's own menu look. It ignores the Brain2 app style. Rules, from pixel-art game UI practice:

- **One unit** (`--u`, 3px). Borders, bevels, notches and shadows are whole multiples, so edges stay crisp. Corners are notched with box-shadow outlines, never `border-radius`.
- **One light source** (top-left): a lit edge on top and left, shade on bottom and right, drop shadow down-right.
- **One palette** (`--px-*` on `.bg-root`): a dark blue interface (navy slabs, steel-blue frames, light-blue text), electric blue for the primary key, sage for good, grown and done (meters, hearts, ticks), a pale sky blue for keyboard focus. `--px-violet` is the steel-blue frame tone (a name kept from earlier skins). Only navy, electric blue and sage: no brown, purple, yellow or gold; metal is silver. The HUD is a night sky with a few fixed stars.
- **Five states on every key:** rest, hover (lighter face and a pointing caret), pressed (sinks one unit), focus (a mint double outline that hover never shows), disabled (hatched, dim). Tabs are folder tabs.
- **Segmented meters**, outlined pixel hearts, drawn checkboxes and sliders, striped rows in long lists.
- **Font:** DotGothic16, a clean one-weight pixel gothic (`next/font/google` in `BabyGame.tsx`, mocked in `tests/next-font-google-mock.ts`). Hierarchy comes from size, colour and letter spacing, never fake bold. The footer shows key hints as keycaps (`HINTS`).
- **Motion** is stepped and short, and off under `prefers-reduced-motion`.

The Brain2 shell paints every `role="dialog"` and `.friend-key`, so plate and key paint carry `!important` under `.bg-root`. **Planned:** put focus on the first key when a plate opens, and arrow-key / gamepad movement between keys.

## Development mode

_Last mapped: 2026-11-02_

A way to play while building the game. **Menu → Development mode** turns it on. It is not the real game:

- **Own save.** Dev mode loads `brain2-baby-game-dev`. The first time, it starts as a copy of your real village. Turning it off loads the real save again, untouched. **Powers → Copy my real village in** and **Fresh dev village** reset the sandbox. Flags live under `brain2-baby-game-devflags`, so dev mode stays on across reloads.
- **Quick bar.** While dev mode is on and no panel is open, a row of lit-when-on toggles sits on the stage: Speed, Noclip, Friends, Freeze, ∞ Energy, Grid, Refill. Keys: **R** cycles walk speed (1×, 2×, 4×, 8×), **N** noclip, **V** show unmet friends, **F** freeze, **G** grid.
- **Story & quests tab.** Set the act, play any scene (intro, each act opening, ending, council, cottage), launch any mini game, and per quest press **Ready** (giver unlocked, objective met), **Done** (claimed) or **Reset**.
- **Show unmet friends.** `setRevealAll` in `cast.ts` makes `inValley` true for every friend, so later-act friends are drawn, walk, and show on the map. Quest and errand rules still use the real act.
- **Weather.** The Clock tab sets clear, rain, meteor or fog. **Hold this weather** (`lockWeather` in the flags) keeps it through new days. With **Show unmet friends** on, the Journal's Friends tab lists every resident (`inValley`), not just those from reached acts.
- **Teleport.** The ` key (or the **Dev** key in the HUD, or the DEV readout) opens the plate. Jump to any region, station, friend's day spot, prop or gate, or type tile `x, y`. Each lands on the nearest open tile (`openTileNear`). In dev mode a click on the **Map** (M) teleports there, and **Alt-click** on the world does too.
- **Powers.** Walk through anything (N), freeze the clock (F), debug overlay (G: tile grid, solid tiles in red, your tile in green), endless energy, unlimited gems (the purse is held at 9999), walk speed 1× to 8×.
- **Time & story.** A clock slider and Dawn, Noon, Dusk and Night keys, day ±1 / +7, weather, jump to act 1 to 5 or the lit lamp, ripen every crop, respawn nodes, fresh day (resets once-a-day uses, keeps milestones), every skill to a level.
- **Items and friends.** Give one item or every kind, +100 gems, empty the bag. Set hearts per friend or for everyone, and jump to any friend.
- **Readout.** Top centre of the stage: `DEV x,y · zone · act` plus the powers that are on.

The rules are pure functions in `lib/baby-game/dev.ts`, tested in `dev.test.ts`. `stepSim` takes `noclip` and `speed` in its input. Play never sets them. The loop walks in shorter steps at high speeds so collisions still hold.

## Shells and plants from real photographs (2026-11-03)

_Last mapped: 2026-11-03_

`scripts/baby-nature-ref.mts` queues ComfyUI jobs from real photographs, the same image-to-image idea as `scripts/baby-furniture-ref.mjs`. The photographs are in `naturerefs/images/`; each one's Wikimedia Commons page and licence is in `naturerefs/sources.json` (public domain, CC0, CC BY and CC BY-SA, so keep the credit).

- `shells`: eight shells (abalone, cone, tiger cowrie, nautilus, turban, wentletrap, scallop, spiny oyster), two seeds each → `shellref-*` in the ComfyUI output folder.
- `orbs`: the same eight, but the starting image is the game's own 8×8 orb trinket icon from `lib/baby-game/items.ts` (`SHAPES`, in the shell's tones) blown up with no smoothing, so the new shell keeps the glossy orb silhouette the friend panel shows → `shellorb-*`.
- `plants`: eight garden plants (prayer plant, echeveria, maidenhair fern, sensitive plant, monstera, moth orchid, air plant, water lily), three seeds each → `plantref-*`.

Run `npx tsx scripts/baby-nature-ref.mts [shells|orbs|plants] [ids...]`. Like or nope the results in `/lab/baby-gens`. **Planned:** snap the liked shells to item icons and the liked plants to crops or props. Nothing in the game uses these images yet; the old 8×8 `shell` shape in `items.ts` is unchanged.

_2026-11-03:_ `drawSprite` takes a scale (`spriteScale(id)` from `lib/baby-game/sprites.ts`), so most animals draw smaller. Homes in `render.ts` draw at `HOME_SCALE` (3×). Speech bubbles and name tags still sit at the old height; **Planned:** lower them for small animals.

_2026-11-03 (2× detail):_ the village frame is now painted at `DETAIL` (2) real pixels per game pixel (`hires.ts`; `drawFrame` scales the context, so every existing painter is unchanged), then Scale2x doubles it again to a 1216×768 display. The casa stays at 1×. `homeart-hi.ts` paints each home kind once onto a 96×96 canvas (shingles, planks, windows, doors, moss, flowers) and `render.ts` stamps it 1:1; `homeart.ts` remains the 1× fallback. **Planned:** animals at a 64px grid, then props and terrain.

_2026-11-03 (zoom, 3×):_ the village view is now 240×152 game pixels (`VIEW_W` / `VIEW_H`, about 15×9.5 tiles), zoomed in from 304×192; the casa keeps 304×192 as `CASA_W` / `CASA_H`. `DETAIL` is 3, so the frame is 720×456 before Scale2x and 1440×912 after. Homes (`homeart-hi.ts`) snap their 96-grid rectangles to the frame density. Trees (`trees.ts`) paint at `Q` = 3 canvas pixels per game pixel, with scalloped rims, leaf grain and a thicker dark outline. Animals drawn smaller than the grid are built as 64 grids: the walk or idle frame is made at 32, then `upscaleGrid` (`lib/baby-game/upscale.ts`) smooths it, and `drawSprite` shrinks it with smoothing. The player and the pixie stay 32. **Planned:** ComfyUI snaps straight to 64 (needs walk and idle that scale with the grid), then props, nodes and terrain tiles at higher detail like the trees.

_2026-11-03 (props):_ `proparthi.ts` paints the eleven everyday props (well, mailbox, firewood, signpost, birdbath, blanket, scarecrow, wheelbarrow, hay bale, beehive, rowboat) in thirds of a game pixel, live each frame so the mailbox flag, the bird and the bees move. `drawProp` in `art.ts` tries it first and falls back to the game-pixel painters when the context is not scaled to 3× or the kind is not listed. **Planned:** the taste props in `propart.ts` (orb, prism, library, thrift, clock and the rest), the gather nodes, crops and terrain tiles.

## Village plates: full width, whole text

_Last mapped: 2026-11-03._ The `bv-*` classes in `village.tsx` had no CSS and `.bg-plate.is-full` had no rule, so a home or Village life was a 520px column with unstyled parts. `village.css` fixes that: a full plate fills the overlay (up to 1120px), a home is the room (sticky shelf, window by time of day, friend and status) beside its pages, and the mind editor, day table, talks and memory use the pixel kit. Entries that may run past a line (beliefs, motivations, likes, goals, a day block's "Doing") use `GrowText`: one line at rest, the whole text while focused, Enter closes. Fields in these plates override the shell's Win95 inset. **Planned:** spine titles that read better on short books, and a lab page that mounts `HomePanel` without walking to a door.

The mind editor also has **Rewrite the description from the mind** (`describeWithModel` in `lib/baby-game/chatter.ts`, reverse of `mindWithModel`). It reads the draft, unsaved edits included, writes the description box only, and waits for Save. With no model it builds plain sentences from the lists.

**Read it all in one go** (book page, beside *Read a little now*): `homeActions.readAll` in `BabyGame.tsx` loops `runReading` until the book is finished, so every sitting is chunked and applied (memory, beliefs, goals, plans) as if the player kept pressing the key. *Stop after this sitting* ends it early; closing the book page also stops it. One summary toast at the end.

## Flora: plants drawn from the likes (2026-11-03)

_Last mapped: 2026-11-03_

The two-pixel flower dots are gone. Every `T.FLOWER` tile, and about 7% of plain grass tiles, now grows a small plant drawn in ComfyUI: daisy, poppy, tulip, pom-pom, bluebell, clover, buttercup, lavender, fern, prayer-plant leaf, toadstool, moss, foxglove, lily pad, cattail, iris, glow mushroom, snowdrop, moth orchid, air plant, cactus, echeveria, dune grass, sprout, berry bush and a monstera sapling. `ambient.ts` `drawGrass` asks `flora.ts` `floraOn` for the kind; `lib/baby-game/flora.ts` holds the kinds each zone grows (so the dunes get cacti, the marsh glow mushrooms, the wood ferns). A plant leans on the gust and away from walkers. With no sprite for a kind it falls back to the old dots.

How it gets better, round by round:

1. `node scripts/baby-flora-queue.mjs` queues every kind (cute, round, plump, saturated; the prompt's `TASTE` line carries what the likes taught). `ROUND=2 SEEDS=4,8 node scripts/baby-flora-queue.mjs daisy poppy` queues a new round of chosen kinds as `flora-r2-<id>`.
2. Like or nope them in `/lab/baby-gens`; say what is off in a note.
3. `npx tsx scripts/baby-flora-snap.mts sheet.png` picks, per kind, the newest liked picture (else newest not noped; `lib/baby-game/flora.json` can name a file) and writes `lib/baby-game/flora-sprites.ts`, with a contact sheet to look at.
4. `PINNED=1` snaps only the plants `flora.json` names, for while a round is still being drawn. Edit `TASTE` or a kind's words from the notes, and go to 1.

The first round started from the liked `plantref-*` photographs (pom-poms, cream and red calathea, silver tufts, violet orchid, ferns, monstera). **Planned:** plants you can pick or that grow back (nodes still draw their own art in `art.ts`), crops and nodes redrawn from the same pictures, seasonal tints, and bigger flora for the 3× detail pass.

_2026-11-03 (match pass):_ the grass shade is read per 4×4 cell with a Bayer nudge, so patches meet in stepped edges, not on tile lines. Flora colours are lifted toward the game's ramp and outlined in the game's ink (`flora.ts` `lift`); grass flora density went from 7% to 4%. The village view is 320×200 (`VIEW_W`, `VIEW_H`); the casa stays 304×192.

## Shells and picked nodes (2026-11-03)

`shell.ts` paints the snapped shell pictures (`lib/baby-game/shell-sprites.ts`) as gather nodes, and `ItemIcon` in `pixel.tsx` uses them for the `shell-<kind>` items. `render.ts` skips a node that is not `nodeReady` instead of drawing it dim. The gift panel (`panels.tsx`) offers "Give 100 gems" at 100 gems, which calls `giftGemHoard`.

_Status:_ round 1 came out mostly as repeating patterns (SDXL at 512 tiles the plant), so only daisy, poppy, tulip and pom-pom are pinned in `flora.json` and snapped; the other kinds fall back to dots. The prompt now says "icon of exactly one", the negative rejects patterns and pots, and the canvas is 640. Round 2 (`flora-r2-*`, seeds 5 and 11, all kinds) is queued; when it lands, like the good ones, drop the pins you no longer want and run the snap without `PINNED`.

## Best friends in the UI (2026-11-03)

`BabyGame.tsx` `goSleep` calls `postLetters` after `sleep`, then lets `penLetter` rewrite each new note in the background (`applyLetterPatch` onto the current state). `sendChat` passes the player's line to `chat` so best friends learn from it. The Journal's Letters tab (`panels.tsx`) lists notes; unread ones stay folded until you check the mailbox. `ItemIcon` draws an invented item from `ItemDef.rows`.

## Cool palette, generated houses, WFC scenery (2026-11-03)

_Last mapped: 2026-11-03_

Brief: more Starbound in colour and texture, less farm; Stardew-level detail; houses cuter and more house-like for any number of future animals; designed nature, not scatter; Wave Function Collapse where it helps.

- **Houses (pods).** After the first pass the look moved to the reference pictures (a Futuro-style pearl pod, a cast-concrete sphere with rimmed portholes and a sweeping stair, stacked rounded modules with roof gardens, a chrome egg on a dish). Every kind is now a `pod` (squashed sphere, panel seams, one big round window with ladder rails, two small ones, a round door; materials `shell` (iridescent in the friend's tint) or `concrete` (pitted, streaked); extras `ivy` overgrowth, `stair`, `pedestal`) or a `stack` (2 to 4 offset octagon modules with ribbon windows and planters). The old cottage, tower, dome and bulb bodies and the scale roofs are still in `housegen.ts` for a friend whose spec asks for them. Species identity: burrow is half-buried and ivied, den has the stair, lodge and stall sit on a silver dish (the lodge over water), igloo is pearl with crystals, nest is a tall concrete egg, hutch and hollow are stacks.
- **Houses.** `housegen.ts` replaced the eight hand-painted kind painters in `homeart-hi.ts`. A house is a `HouseSpec`. Bodies are `cottage`, `tower`, `dome` and `bulb`. Walls are plaster (with a trencadís mosaic band) or stone, ice, log, wicker, turf or bark. Roofs are gable, cone, onion or cap, shingled with overlapping dragon scales. Doors and windows come in three shapes each. Extras are chimney, vine, lantern, flowers, crystals, star, fins, reeds, water and spots. Every part goes through one painter (`part`): a mask, a light from the top left banded with a Bayer grain, and a contour in the part's own deepest tone, then one ink contour round the whole. `specFor(kind, id)` takes what the species keeps from the kind and the colours, shapes and extras from a hash of the friend's id, so a new animal gets a home that belongs without anyone painting one. `render.ts` passes the friend's id. Lit windows glow mint-white, not yellow. Look at it with `npx tsx scripts/baby-house-sheet.mts out.png [lit] [ids...]`. **Planned:** a `HouseSpec` written by the character generator, a second storey and porch parts, snow and season dressing, and giving the Gaudí cottage (`art.ts`) the same builder.
- **WFC.** `lib/baby-game/wfc.ts` is the simple tiled model (see `lib/baby-game/README.md`). `lib/baby-game/scenery.ts` uses it to dress the built map in 16×16 chunks: bloom drifts, ferns, pebble beds, reeds on shores, lily pads on water, glowcaps in the dark wood, crystal sprouts on hills. Each cell's allowed tiles come from the ground and from water next to it; the pair rules make drifts. It never lands on a held, solid or path tile. `sceneryart.ts` paints it; reeds, ferns and blooms sway, glowcaps pulse. **Planned:** learn the rules from hand-made sample patches (`adjacencyFromSample` is ready), WFC for whole new zones and path layouts, a river (needs new water tiles and a pass over reachability).
- **Water.** `paintWater` replaced the flat tile. Depth is a breadth-first distance to land, blended smoothly across tile edges and grained with Bayer into four bands (mint shallows to cobalt deep), cached per tile. Foam breathes at the shore, ripple crescents drift. The old reflection of the shore is much fainter, since it copied pale sand into the water as boxes.
- **Sine Hop.** The `falls` station is now a mossy slate ledge with a sheet of water, running streaks, spray, rings and mist. It still stands on its old tile, in front of the Still Lodge, so the pond's map did not change.
- **Colour.** The grass shades, blades and swaying grass lean teal, and `drawFrame` lays a faint blue soft-light grade over the world before the day's veil. Trees, props and animals keep their own colours for now. **Planned:** regrade trees and flora to the same ramps, and a Starbound-style glow pass after dark.

## Reading controls (2026-11-03)

In a friend's home, Shelf tab, a book shows: a reading style (an hour at a time, or all the way through until Stop), `Read it all in one go` / `Stop reading` (run by `BabyGame.tsx` `runReadAll`, so closing the screen does not stop it), the digest and idea chips, and per sitting the explanation, ideas, question, and an Edit button (`village.tsx` `SittingEditor`) that shows the whole passage and saves the player's version, optionally as a gold example. Gold examples list with a JSON copy at the bottom of the shelf. Menu holds the reading-model name.
