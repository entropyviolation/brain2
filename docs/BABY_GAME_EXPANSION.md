# Baby animal game: the big expansion

_Last mapped: 2026-11-03_

A plan to make Valdivia about four times larger, with new areas, a bigger cast, new things to do, and new systems. Nothing here is built. It follows `docs/BABY_GAME_REDESIGN.md` (the north star: specs that code turns into sprites and rules) and `docs/BABY_GAME_STATUS.md` (what is done). Style rules still hold: no yellow, silver never gold, no celestial costume (star icons are fine), cool paper and graph-rule look, a gift economy, eastern thought as voice and never as a lecture.

## Where we start

- Map `80×64` tiles (`MAP_W`, `MAP_H` in `lib/baby-game/world.ts`), 13 zones, 14 gates, 10 stations, 35 props, 16 plots, 24 residents, 5 acts, 4 mini games, 24 quests, 6 Casa rooms.
- Zones fill the whole rectangle already. The Index Stacks reach x77 and the Firework Dunes y61, so the world has no free edge. Growth means a bigger rectangle.
- Casa (`casa.ts`, `Casa.tsx`) is already a second kind of place: a walkable interior with its own canvas, spots and stairs. That pattern is the cheap way to add vertical layers (caves, treetops) without making the tile map bigger.
- Saves store trees by tile index (`GameState.trees`, index = `y * MAP_W + x`). Changing `MAP_W` breaks those keys, so the growth needs a migration.

## Targets

| | now | after |
|---|---|---|
| Map | 80×64 | 160×128 (4× the ground) plus interior layers |
| Zones | 13 | about 30 |
| Residents | 24 | about 50 |
| Props | 35 | about 120 |
| Items | about 60 | about 150 |
| Quests | 24 | about 80 |
| Mini games | 4 | about 10 |
| Acts | 5 | 9, then open-ended village projects |

## 1. The map

Old tiles keep their place. The new ground is east (x80..159) and south (y64..127), so tests, props and saves keep their coordinates. The home region is the north-west quarter and the new half wraps around it.

```
            x0                 x80                 x160
   y0       +------------------+--------------------+
            |  Valdivia today  |  Rime Ridge        |  The Long Tail
            |  (13 zones)      |  (Zendo)           |  (steppe)
   y64      +------------------+--------------------+
            |  Prior Terraces  |  Rhizome (town)    |  Voronoi Badlands
            |  Lantern Canopy  |  Mandelbrot Coast  |  The Great Sea
   y128     +------------------+--------------------+
```

The zone names below are drafts, in the house voice of diagrams and data.

**East band**
- **Rhizome** (hub of the new half): a real market town with streets, a post office, bakery, library annex, mill, workshop row, a ferry dock and a small plaza for festivals. Joined to the Index Stacks and Sparkle Lake by a long bridge. Most new residents live or work here.
- **Rime Ridge**: snow switchbacks, ice halos, a frozen waterfall, rope bridges. At the top is the **Zendo**, a mountain monastery where the Zen, Taoist and Buddhist friends gather. Home of the tenth-heart teachings (`dharma.ts` Planned) and the sit action.
- **The Long Tail**: a wide steppe of tall grass where herds graze (a power-law of herds: many small, a few huge). Ranch fences, a windmill, a rodeo ring for the foal and the goat, wild horses you can befriend.
- **Voronoi Badlands**: cracked earth in cells, each cell its own small biome (a salt cell, a moss cell, a glass cell), joined by plank bridges. Cairns, a dry riverbed, the Obsidian entrance to the underground.

**South band**
- **Prior Terraces**: a mountainside of stepped rice and tea paddies, an irrigation puzzle between levels. Farming 2.0: terraces hold water, so crops grow wet or dry by level.
- **Lantern Canopy**: a village in giant trees. The ground level is a normal zone (trunks, roots, mushrooms); the canopy is an interior layer reached by stairs and rope lifts.
- **Tidal Flats**: salt pans, wading birds, clam beds that appear at low tide. Tide is a new daily clock that changes what you can reach.
- **The Garden of Forking Paths**: a hedge maze that changes with the day number, with a small prize at the middle. A cheap puzzle zone.

**Coast and sea (south-east)**
- **Mandelbrot Coast**: coves that repeat at smaller scale, tide pools, a lighthouse that is an Orb Light tower, a boatyard.
- **The Great Sea**: open water you sail by raft and then boat, with an archipelago. Islands are small zones of their own:
  - **The Appendix**: a half-drowned library island, rare books, a diver's ladder.
  - **Kelp Garden**: a dive spot (a short swim mini game), fish and pearls to catalogue.
  - **Hot Spring Islet**: a bath for rest, +energy, friends talk more freely.
  - **The Footnote**: a one-tile island with one secret.

**Under and over (interior layers, Casa-style)**
- **The Residuals** (caves): three floors under Fossil Hill and the Badlands. Mining, crystals, diatom beds, fossils, an underground lake. Lamp light matters.
- **Canopy** (see above) and a **Casa rooftop terrace** (already Planned in the Casa notes).

### Rules that keep it from being empty

- Every zone has a reason to go: one thing found nowhere else (a material, a recipe, a friend, a mini game).
- A path every 20 tiles or so, a landmark in sight at every junction (a tower, a windmill, the lighthouse, a tree taller than the rest).
- Fast travel: signposts become stops (`Signpost` already exists as a prop). Walking is the default; stops are unlocked by visiting.
- The map screen (`map.tsx`) gets fog of war (only visited tiles show), a pan and zoom, and pins you can set.

## 2. The cast

24 more residents, built with the `Character` contract (`character.ts`) so each has looks, personality, role, goals, quests, likes, home and memory, plus a `dharma.ts` path. Species come from the five left-out ones (piglet, raccoon, axolotl, lamb, goat) and from the generated animals in the ComfyUI batches (red panda, quokka, pika, dik-dik, sugar glider, pangolin, dormouse, tarsier, fennec, corgi, squirrel, meerkat, giant panda).

New kinds of role, not only keepers and links:

| Role | What they do | Example |
|---|---|---|
| Shopkeeper | runs a stall that sells by the gift economy (the Commons) or the small market | the raccoon peddler at Rhizome |
| Craftsperson | teaches one skill and holds a recipe tree | the lamb who sells wool, the pangolin tool-smith |
| Ferry captain | opens the sea; fast-travels you | axolotl at the dock |
| Elder | gives the tenth-heart teaching; sits at the Zendo | a quiet panda |
| Rival / foil | races you in a mini game; becomes a friend by act's end | the sugar glider |
| Wanderer | arrives on festival days, from the map edge, then leaves | the quokka |
| Keeper | holds a new Lamp part (see story) | one per ring |

Rules:
- Two to four residents per new zone, never more than a few tiles from their home (`homes.ts`).
- Names follow the existing rule: people and characters the owner admires. **I will not pick them; the owner gives a list** (see open questions).
- Every new friend needs: a sprite (front, side, back, from `sprites.ts` or a snapped ComfyUI draw via `gen-sprites.json`), a home kind, a school of thought, a quest or two, a line set.
- `refreshCharacters` in `save.ts` already rebuilds hand-made characters and keeps memories, so adding residents to an old save is safe.
- Planned dislikes enter play here: a visitor selling lamps built to fail, and the beige fog from the Hush as a regional weather.

## 3. Things to do

New activities, each one small, tested and in its own file:

**Work the land**
- **Mining** in the Residuals: tap rock nodes with a pick (tool tiers), gather crystals, diatoms, fossils, clay. Uses `specs/block.ts` hardness against tool power.
- **Terrace irrigation**: open and close sluices so a level floods or dries.
- **Animal husbandry** (Long Tail): feed and brush a small herd; they leave wool, milk and manure for the plots.
- **Beekeeping and orchards**: the hive prop becomes a loop with seasons.
- **Foraging by region**: each zone has its own forage list and a seasonal peak.

**Make**
- **Cooking**: a kitchen (Rhizome bakery, then a Casa kitchen) with recipes; meals give energy and short buffs (calm, quick, lucky). A recipe book in the Journal.
- **Tool tiers**: hand tools get upgrades at the tool-smith. This is when the Tool BIMBY (`specs/tool.ts`) becomes live.
- **Furniture crafting for Casa**: collect or buy pieces (the layout is already data), and place them yourself. More rooms unlock as the cottage is repaired.
- **Boats**: raft, skiff, sloop. A boat is a tool: it sets where you can go and how fast.

**Go**
- **Sailing** the Great Sea: wind, currents, island hops, a fog that hides the Footnote.
- **Diving** at the Kelp Garden: a breath-bar mini game.
- **Climbing** Rime Ridge: stamina and rope lines.
- **Riding**: wild horse befriending on the Long Tail, then a mount (faster, burns no energy).
- **Cartography**: draw your own map pins and mark secrets; a completed region pays a gift from the mapmaker.

**Play** (mini games, about six more)
- Kelp dive (breath), Tide clam rush (timing against the tide), Windmill sorting, Ridge rope (balance), Hedge-maze race, Rodeo ring (rhythm), Voronoi bridge-builder (puzzle, par from a generated solution as in Stair Weave).

**Find and keep**
- **The Museum of the Index** in the Index Stacks: fossils, shells, diatoms, fish, books, orbs. Donations fill display cases and each full wing opens a prize and a story. It grows the Starlog into a place.
- **Wild fauna**: non-friend animals on each biome with day/night schedules; some can be watched, photographed (photo mode from the redesign plan), or fed.
- **Secrets**: a few hidden dens per zone, and a 100-count collectible (diatoms, orb lights) with a gift at 25, 50, 75 and 100.

**Together** (fits the gift economy)
- **Village projects**: repair the mill, rebuild the Rhizome bridge, light the lighthouse, restore the Appendix. Each is paid for by gifts to the Commons from you and the friends, so it is Stardew's community centre without money. Each finished project opens something real.
- **Festivals per zone**: a lantern boat parade at the coast, a kite day on the Long Tail, a silence day at the Zendo. The day-7 festival stays.
- **Friends talk to each other** (gossip BIMBY, already Planned), now over a larger cast and across zones, so news travels along roads.

## 4. Systems that make a bigger map work

- **Travel cost and pace.** Energy cannot be the only limiter now. Add a stamina-free walking default, rest spots (benches, hot spring), and fast-travel stops.
- **Gating.** Zones open by act as now (`ZONE_ACT`) and also by tool or skill (raft, rope, pick, lamp, level 3 fishing), so the order is not only the story's.
- **Weather by region.** Fog in the marsh, snow on the ridge, salt wind on the flats, heat shimmer in the badlands. `weather` is global today; add a zone modifier, not a second weather system.
- **Seasons feel.** The four cycles tint each zone differently (Anicca drops leaves, Deep Yin freezes the lake).
- **Day length and light.** Underground and under the canopy are always dim; lamps matter there.
- **Difficulty is never punishment.** No death. Worn-out means you wake up at the nearest home. Matches the gift tone.
- **Real life.** `LifeContext` can finally be used: a friend at the Zendo offers a practice from the owner's real list (read-only).

## 5. Story: acts 6 to 9

The five Lamp parts light the Orb Lamp and the Festival ends act 5. Play goes on today but has no spine. Proposal: each ring is an act and a Lamp part becomes a **Lantern**, carried out to a place and lit there.

- **Act 6, Rhizome**: the bridge is out. Fix it, meet the new hub, learn why the lamp's light does not reach past the Stacks (a diagram: the light ends at a line).
- **Act 7, Rime Ridge and the Zendo**: sit, climb, learn what the elders hold back; a Lantern goes on the ridge.
- **Act 8, the Badlands and the Residuals**: find where the light goes underground; mining and caves.
- **Act 9, the Great Sea**: the lighthouse, the Appendix, the Footnote. The ending is a second festival, quieter than the first.
- **After**: village projects, wanderers, the museum, mountains of small things. No fail state.

Each act keeps the shape of the first five: one friend who holds a part, a chain of keepsakes between friends, a scene at the gate. `engine.test.ts` already plays a whole story with a bot; it grows to play nine.

## 6. Making it, in parallel

The same order as the redesign plan: smallest true shape first, then widen. Every step ends with the folder READMEs updated and a screenshot from the in-app browser.

### Step 0: before anything else
- Fix the known red tests in `docs/BABY_GAME_STATUS.md` (thrift rack, dev gems, stair landings, sprite margins). A new map on a red base hides real breakage.
- Land the live `sprites.ts` and `walk.ts` edits.

### Step 1: the map engine (blocks everything)

_Status 2026-11-03: items 1 and 2 done, 3 in a smaller form, 4 done. Items 5 and 6 are not started._ The grid is 160×128 but only the built 80×64 is painted, walked and shown (`EXTENT_W` / `EXTENT_H`), so the painted map did not grow fourfold with nothing in it. Chunk the painted map when a second large zone lands.

1. **Regions as data.** A `regions.ts` table holds each zone: id, name, rect, ground tile, tree mix, scatter rules, act or tool gate, music/weather modifier. `world.ts` reads it instead of hard-coded `carve` / `scatter` lines. This is the same move the generation north star needs (a `ZoneSpec`), so a generated world later fills the same table.
2. **Grow the rectangle** to 160×128 with a save migration (`save.ts`): re-key `trees` and any tile-indexed field from the old width to the new one. Test with an old save fixture.
3. **Chunked rendering.** `buildMapCanvas` paints one canvas for the whole map (1280×1024 now, 2560×2048 at 1×). Cache in 16×16-tile chunks so higher-detail terrain can follow, and only paint chunks near the camera. `render.ts` loops over visible tiles only.
4. **Reachability and tests.** `world.test.ts` BFS must cover every friend, node, home and station across the new rectangle; add a test that every new zone is reachable only through its gates.
5. **Map screen.** Pan, zoom, fog of war, pins, fast-travel stops (`map.tsx`).
6. **Interior layers.** Generalise `casa.ts` spots and walker into a `place` (id, size, solids, spots, exits) so the Residuals and the Canopy are places like Casa. `Casa.tsx` becomes one place among several.

### Step 2: slice one (a playable vertical slice)

_Status 2026-11-03: the Rhizome ground is built (streets, plaza, four shut buildings, shore and pier, gate at act 5, nine props, eleven nodes). Still to do: residents, bakery and cooking, the ferry, the bridge-repair project, act 6, and the Prior Terraces._

Rhizome and the Prior Terraces first, because they use the most existing systems:
- Rhizome plaza, six streets, bakery, post office, ferry dock (closed), bridge repair as the first village project.
- Eight residents (one shopkeeper, one craftsperson, one ferry captain, one wanderer, four townsfolk), with homes, lines, two quests each.
- Terraces with irrigation and four new crops.
- Cooking and recipes (bakery kitchen).
- Act 6 playable end to end, tested by the bot.

### Step 3: the rest of the rings, in any order
Rime Ridge and the Zendo, the Long Tail, the Badlands, the Residuals, the Canopy, the Tidal Flats, the coast and the sea. Each is: region row, tiles and props, nodes, residents, a quest chain, a mini game, a README line. Files do not overlap, so these run as separate sessions.

### Step 4: systems that cut across
Mining and tool tiers; boats and sailing; the museum; gossip; village projects; per-zone weather.

### Workstreams that can run at the same time
| | Work | Touches |
|---|---|---|
| A | Regions table, map size, save migration, chunk cache | `world.ts`, `regions.ts`, `render.ts`, `save.ts` |
| B | Interior `place` generalisation | `casa.ts`, `Casa.tsx` |
| C | Cast: sprites and characters for each ring | `sprites.ts`, `gen-sprites.json`, `cast.ts`, `character.ts` |
| D | Art: tile sets, props, homes, via spec painters and ComfyUI | `art.ts`, `propart.ts`, `homeart.ts`, `trees.ts` |
| E | Systems: cooking, mining, boats, museum | `items.ts`, `farm.ts`, `props.ts`, `engine.ts` |
| F | Story: acts 6 to 9, quests, dharma, lines | `story.ts`, `quests.ts`, `dharma.ts`, `lines.ts` |
| G | Mobile and performance pass | `docs/MOBILE_STYLE.md` |

A and B come first. C to F can start once A's table exists. G is last.

## Risks

- **Size without life.** Four times the ground with the same count of things makes a dull walk. Keep density per zone, not in total.
- **Art volume.** Each zone needs tiles, props, homes and sprites. Use spec painters and the ComfyUI snap pipeline instead of hand-drawing everything, and let hand-made props be the examples.
- **Save compatibility.** Tile-indexed keys and new fields need `save.ts` migrations and old-save tests.
- **Performance.** More tiles, props and friends per frame, plus a 3× detail canvas. Cull to the view, cache chunks, simulate far friends coarsely (`sim.ts` ticks only near ones fully).
- **Tests get slow.** BFS on 160×128 across hundreds of targets. Share one built world per test file.
- **Scope.** The slice in step 2 is the cut line. If it does not feel good, stop and fix before building rings.

## Open questions for the owner

1. **Size.** 4× the ground (160×128) as written, or 2× to start (112×92)?
2. **The sea.** In, or kept for a later pass? It adds boats, diving and an island set.
3. **Names.** A list of people and characters you admire for the 24 new residents, or should the cast come from a Cast BIMBY with your approval step?
4. **Vertical layers.** Caves and the canopy as Casa-style interiors (cheap, as proposed) or as large tile maps (richer, heavier)?
5. **Pace.** Slice first (Rhizome and Terraces), or the Rime Ridge and Zendo first because it ties to the dharma work?
6. **Money.** Keep the Commons and gift economy for the whole new half, or add a market corner in Rhizome (`mixed` preset in `economy.ts`)?
