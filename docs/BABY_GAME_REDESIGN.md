# Baby animal game redesign

_Last mapped: 2026-11-02 (north star added)_

Plan only, except where a section says built. North star: the section **Where this is going: endless generation** just below. Source: Hugo Duprez, "How to make good pixel art effects with Claude" (spritefusion.com/blog). The article is about process, not technique, so the plan takes its process and fills the technique from this game's own code. The game: `components/BabyGame/` (UI, README first) and `lib/baby-game/` (rules).

## Where this is going: endless generation

_Added 2026-11-02._ The ultimate goal is a sprite game that never runs out: **Scribblenauts meets Stardew Valley, from the year 3000**. Give it any situation ("a lighthouse keeper whose lamp went out", "the pond is a portal") and a **weak, small local model** builds the whole village around it: the props, the tiles, the characters, the quests, and the places where those meet. Valdivia is the hand-made first world and the test bed. Everything below is **Planned**; nothing is built yet.

### The rule that makes a weak model enough

A small model cannot paint pixels and should not try. It writes **specs**: short JSON from a closed grammar. Code turns a spec into pixels and rules. The same idea `llm.ts` already uses for talk (closed outputs, a script behind it), widened from words to things. Each job is a **BIMBY**:

| BIMBY | Reads | Writes (closed shape) | Code that realizes it |
|---|---|---|---|
| Situation | the player's sentence | a `Premise`: place, mood, a want, a lack, 3 to 6 nouns | `story.ts` acts become data, not text |
| Prop | a noun ("lighthouse lamp") | `PropSpec`: parts from a shape grammar, palette ramp names, one `use` from a closed verb list, size | `propart.ts` becomes a spec painter, not a `switch` |
| Tile / Block | a ground word ("salt flat") or a thing to gather | `BlockSpec` (`specs/block.ts`, shape built): ground or node layer, material, hardness, look (base ramp, pattern, accent) or parts, drops, regrow, what it becomes, sound. **Planned:** an edge rule | `art.ts` ground painter, `dither.ts` for blends |
| Tool | a sentence ("a can that waters a whole row") | `ToolSpec` (`specs/tool.ts`, shape built): parts and a grip, one motion (frames are code's), area, effects on materials or blocks with a power that must beat hardness | **Planned:** `render.ts` plays the motion on a paw; `engine.ts` runs effects through `Result` |
| Character | a role ("tide clerk") | a `Character` (`lib/baby-game/character.ts`): looks, name, personality, role, goals, quests, likes, home, memory | `sprites.ts` templates + `walk.ts`, `idle.ts` already animate any still; `homes.ts` paints a home per kind |
| Quest | the above | a chain of closed steps (bring item, reach place, use prop, raise hearts) | `quests.ts` progress readers already work from the save |
| Layout | all of the above | rectangles and placements on the 80×64 grid | `world.ts` `buildWorld` + BFS reachability |

**The constant: characters first.** _Added 2026-11-02._ Whatever a player asks for, a new game always begins by creating its characters, each with looks, a name, a personality, a role, goals, quests, likes and a home, plus a memory that fills as they play. That shape is built: `Character` in `lib/baby-game/character.ts`, created by `newGame` into `GameState.characters` and kept in the save. It is the base every situation builds on: the same villager can be given memory, connected to a model (`characterBrief`), and cast into a different game per player. Today the cast is the hand-made twenty-four. **Planned:** the Character BIMBY writes them from the seed and the player's prompts and actions, and the rules move from `RESIDENTS` to `characters`.

Verbs are the Scribblenauts half: a noun is only real once it can **do** something. `props.ts` `Use` (energy, item, buttons, xp, trust, forecast) is the closed verb list a Prop BIMBY picks from; add a verb by adding code, never by letting the model write code.

### The reference toolset: Sprite Fusion, tool by tool

_Added 2026-11-02, from spritefusion.com._ The goal is to emulate Sprite Fusion's whole toolset, but driven by a weak model and a seed instead of a person at a browser. Sprite Fusion makes **usable** assets: tiles that auto-join, props at a fixed size, characters that keep one style, pixel grids that are clean. "Usable" is the bar every generated piece must clear. Where we are against each tool:

| Sprite Fusion tool | What it does | Our counterpart | Status |
|---|---|---|---|
| Tilemap Editor: draw with tiles | paint a level from a tileset | `world.ts` builds terrain from rectangles; `render.ts` caches it | Built (code, no editor). **Planned:** `/lab/baby-world` becomes an editor view |
| Auto-tiling, smart fill | place the right edge or corner from the neighbors | paths grow grass along edges that meet it; hills use noise patches | Partial. **Planned:** a `TileSpec` edge rule (a 16-case or 47-case mask) so any generated ground blends |
| Collisions and layers | mark a layer solid | `T.*` solid tiles, `FLAT_PROPS` walkable, BFS reachability in `world.test.ts` | Built |
| Import any tileset | drop in a sheet | none; every tile is painted in code | **Planned:** tiles as data (`TileSpec`), so a sheet or a generated tile is the same thing |
| Props generator (32×32) | text to a prop sprite | `propart.ts` and `art.ts`, 29 hand-painted props at tile size | Hand-made only. **Planned:** the Prop BIMBY and spec painter above |
| Pixel Art Generator | text to a game-ready sprite | `sprites.ts`, 24 animals at 32×32, front, side and back | Hand-made only. **Planned:** the Cast BIMBY |
| 8-direction sprites | one character from every side | three views (front, side, back); side mirrors for left | Partial. **Planned:** diagonals, only if the top-down feel needs them |
| Same-style generation | new assets match the old ones | one palette (`PIXEL_PALETTE`) and ramps; yellow only when the subject needs it, metal silver not gold | Partial. **Planned:** one named ramp table; a spec can only name ramps from it |
| Animation sprites | animate a still | `walk.ts` and `idle.ts` make walk and idle from any still | Built, and it works on generated stills too |
| Pixel Art Editor | touch up a result | none | **Planned:** lab view to nudge a generated prop's parts, not its pixels |
| Pixel Snapper | clean off-grid, blurry or noisy pixels onto a crisp grid and palette | none | **Planned.** Open source (see below) to port. Needed only for image input; a spec painter never makes off-grid pixels |
| Normal map generator | lighting from sprites | `dither.ts` `Veil` paints light and shadow as a stepped dither, with no per-sprite normals | Optional, later. Its open source Rust/WASM code could do it in the browser (see below); the dither light stays the default look |
| Free pixel art effects | rain, dash, ice, dust | `/lab/baby-fx` and `fx/` | Built (drafts); see the lab above |
| Color palettes | named palettes | `PIXEL_PALETTE` and extensions | Built |
| Engine export (Unity, Godot, JSON, TMX, UVTT) | ship a map elsewhere | none | Out of scope. A generated world exports as its premise + seed + specs (JSON), which is our own format |

Sprite Fusion's lesson for a weak model is the **Pixel Snapper** and **same-style** rows: let the model be rough, and make the game do the cleaning and the matching. That is why the validator step in the order of work comes before any model call.

#### Open source pieces we can borrow

All MIT. Read on 2026-11-02; none is a dependency yet.

- **Map data shape, from `Hugo-Dz/bevy_spritefusion`.** The plugin is for the Bevy engine (Rust), so we cannot use the code. Its JSON is the useful part: `{ tileSize, mapWidth, mapHeight, layers: [{ name, collider, tiles: [{ id, x, y, attributes }] }] }`. Make `TileSpec` maps and `world.ts` output use this shape: named layers, a `collider` flag per layer, free `attributes` per tile (spawn, node kind, prop id). Two wins: a generated map is plain data a model can write layer by layer, and a map made in the real Sprite Fusion editor imports with no converter. The attributes field is where a prop or friend placement lives.
- **Pixel snapping, from `x0x0b/ComfyUI-spritefusion-pixel-snapper`.** A Python port of Sprite Fusion's Rust Pixel Snapper (`Hugo-Dz/spritefusion-pixel-snapper`, the upstream). It auto-detects the true pixel size of a blurry image, snaps to that grid, and reduces to `k_colors` (default 16, seeded k-means). Knobs worth copying: `pixel_size` override, `k_colors`, a seed, integer nearest-neighbor `output_scale`. Our change: quantize to the fixed `PIXEL_PALETTE` ramps, not a free k-means palette, so a snapped result can only use colors we have named. Yellow is one of them, as its own ramp. This is the Pixel Snapper row, and it matters for a second path below. The port says its results may differ from upstream; port from the Rust source if exactness counts.
- **Normals, from `Hugo-Dz/spritefusion-sprite-normals`.** Rust CLI and a WebAssembly build (`generate_normal_map(bytes, json)` returns a normal PNG, a color PNG and frame metadata). It keeps pixel resolution and handles sheets and animations (`--frame-size`). Strength, detail, smoothing and volume are tunable. Fits one idea only: lit sprites that react to the campfire and Orb Lamp. Not before the dither light is judged; it would need a normal-aware draw path in `render.ts`.

**A second generation path this unlocks.** Specs are the main road. A hosted or local image model (ComfyUI, PixelLab, Sprite Fusion's own API) could also draw a sprite, which is then snapped to the grid and palette, cached by hash, and used like any other. That path is for premium or large assets; a weak local model keeps the spec road. Both end in the same validator and cache.

### What the code already gives us

- `walk.ts` and `idle.ts` animate **any** still grid, so a generated character needs one still, not a sprite sheet.
- `items.ts` 8×8 shapes, `sprites.ts` 32×32 grids with a shared palette, and `propart.ts` rectangles are all small grids and rectangles a spec can describe.
- `world.ts` builds terrain from rectangles and proves reachability (BFS); `world.test.ts` and `engine.test.ts` (a bot plays the whole story) are the validators a generated world must also pass.
- `llm.ts` `keepsFacts`, clamped nudges and scripted fallbacks are the pattern: the model proposes, the game disposes.
- `life.ts` `LifeContext` is the seam to bend a premise toward the player's real life, read-only.

### What has to change first

1. **Open the closed unions.** `PropKind`, `NodeKind`, the `ITEMS` table and the 24 `RESIDENTS` are compile-time lists. A generated world needs the same shapes as **data in the save**: `PropSpec[]`, `TileSpec[]`, `CastSpec[]`, `Premise`, with ids that cannot collide with built-ins.
2. **A spec painter per kind.** Turn the hand-drawn `drawTasteProp` cases into small spec data (parts + ramps) so hand-made and generated props go through one painter. Hand-made ones become the training examples in the prompt.
3. **Validate every spec before it exists.** Schema check, palette check (named ramps only; yellow allowed only through its own ramp, and only where the noun calls for it; metal silver, never gold), size and tile budget, verbs from the list, the world still reachable, the quest chain still solvable. A failed spec is retried once, then replaced by the nearest built-in. The player never sees a broken prop.
4. **Cache and name by content.** A spec is hashed; the painted canvas is cached the way `buildMapCanvas` and `trees.ts` already paint once. The same noun twice gives the same prop.
5. **Seeds, not randomness.** Every generation takes a seed so a world can be replayed and tested like `engine.test.ts`.
6. **A premise runner.** One pipeline: Situation, then Layout, then Props and Tiles, then Cast, then Quests, each stage validated before the next. Shown in the lab as a step view so a weak model's output can be judged stage by stage.

### Weak-model rules

- One small question per call; never "build the village". Two or three fields, not twenty.
- Pick from lists wherever a list can exist (ramps, patterns, verbs, bodies). Free text only for names and lines.
- Show the model two or three hand-made specs as examples inside the prompt, not a long instruction.
- Every stage has a scripted generator behind it (random but valid), so the game works with no model and tests run offline.
- Say in the UI which pieces a model made and which the script made, as the chat chip does today.

### Order of work for generation

1. **Spec the grammar** in `lib/baby-game/` (types plus validators, no model yet) and port five hand-made props to it. Tests: every built-in round-trips.
2. **Prop BIMBY in a lab** (`/lab/baby-props`): type a noun, see the prop and its verb, with the script fallback. This is the Scribblenauts moment and the cheapest proof.
3. **Tile BIMBY**, same lab, with edge blending checked beside stock tiles.
4. **Cast BIMBY**: body templates plus accessories, animated for free by `walk.ts` and `idle.ts`.
5. **Premise runner** that generates a small second world (one act, three friends, one Lamp-part equivalent) and runs the bot test over it.
6. **Save and share**: generated worlds stored in the save; export a premise plus seed to replay.
7. Then the rest of this document (walk cycles, camera, sound, mobile) applies to generated worlds as much as to Valdivia.

### Open questions for generation

- How big may a prop be: 1 tile (16 px) only, or 2×2 for landmarks? Default: 1 tile, 2×2 for the premise's one landmark.
- Is the model asked for part lists (`rect`, `ellipse`, `line` in a 16×16 box) or for a pixel grid? Default: part lists; grids come out wrong from small models.
- Where do generated worlds live: one save slot each, or all in `brain2-baby-game`? Default: one slot each, Valdivia stays untouched.

### Image model road: liked recipes become the game's presets

_Added 2026-11-02._ **Planned.** Allie wants the game's own local models to make sprites, props and tiles from a player's words, or from a description a model writes. The bar has four parts: it **looks cute**, it **works** (right size, clean edges, readable at 1×), it **goes where it should** (right layer, collider, grid cell), and it **looks how it should** (matches its description and the village's style). Tagging ComfyUI outputs while we develop the game with Claude is the first step. Each like or note is training data for this road.

**Today's setup.** ComfyUI lives in `~/ComfyUI-Installs/ComfyUI`. Models and output are in `~/ComfyUI-Shared`. Installed: `sd_xl_base_1.0` plus four pixel LoRAs (`pixel-art-xl`, `pixel-art-hadi`, `pixel-icon-lizozom`, `pixel-slider-ntc`). No IPAdapter, Flux Kontext or Qwen-Image-Edit yet. Each `output/sprite_*.png` already stores its full recipe in PNG `prompt` metadata: checkpoint, LoRA and strengths, prompts, seed, steps, cfg, sampler and size. So nothing extra has to be logged at generation time.

**The rule, same as specs.** The small model never writes a free Stable Diffusion prompt. It fills slots in a **recipe**: a liked, saved setup per asset kind (character, prop, tile). For example, `{subject}` and `{facing}` go into the otter recipe's prompt, and LoRA, strength, cfg, seed range and negatives stay fixed. Recipes come only from outputs Allie liked. Notes become the rules ("LoRA above 1.2 adds noise", "add 'chibi' for cute").

**Pipeline per asset:**

1. **Describe.** A BIMBY writes a closed spec: kind, noun, size class, facing, palette ramp names, and one verb for props.
2. **Recipe.** Code picks the best-liked recipe for that kind and fills its slots.
3. **Generate.** Code calls ComfyUI's local API (`POST /prompt`, then the websocket for the result).
4. **Clean.** Remove the background, then pixel-snap to the grid and to `PIXEL_PALETTE` (the Pixel Snapper row above).
5. **Validate.** Check the exact size (16 px tile and prop, 32 px animal). Check for a transparent background, a filled silhouette with no specks, palette-only colours, and readability at 1×. Tiles must wrap edge to edge. A failure retries with a new seed, then falls back to the spec painter.
6. **Place.** The spec, not the image, decides the layer, the collider and the cell (`world.ts` attributes, BFS still passes).
7. **Cache** by spec hash, and mark the asset as model-made in the UI.

**Keeping one style.** Generated cast must look like they belong together. Planned: IPAdapter (or a multi-image edit model) fed with two or three liked sprites as the style reference. That is also how two images get "combined" (one animal's look, another's colours or pose).

**Tiles stay on the spec road at first.** SDXL rarely makes seamless tiles. Revisit with a seamless-tiling node once props and characters work.

**Order:**

1. **Generation log lab** (`/lab/baby-gens`), **built 2026-11-02**. It reads the output folder and shows each image beside its recipe, with like or nope, a kind (character, prop, tile), tags and a note. Setup and LoRA-at-strength boards rank by likes. It changed from the plan in one way: notes go to `data/baby-game-gens.json` on disk, not browser storage, keyed by file path, so Claude and the future BIMBY can read them. See `components/BabyGame/gens/README.md`.
2. **Snap and validate** liked images through steps 4 and 5. Any image that fails teaches us what the validator must catch.
3. **Save recipes** from the best liked setups, one per kind, with named slots.
4. **Generate BIMBY** in the lab: noun in, through steps 1 to 7, sprite out, with the fallback.
5. Then IPAdapter style reference and, later, a small vision model that scores "cute" against liked examples.

## What the article says, and what it means here

1. **Code as clay.** Effects are code, not sprite sheets. This game already works that way: `art.ts`, `trees.ts`, `render.ts` paint everything from rectangles on a 304×192 canvas shown at 3×.
2. **Many cheap drafts.** Ask for 5 to 10 first drafts of one idea, render each as a short clip, pick one direction, refine.
3. **Trust your eyes.** Iterate on timing and motion feel, not just look. Ask "does it feel right, what would balance it". Hours on one effect is normal.
4. **References build taste.** Study how shipped games do rain, fire, impact, sparks, debris.
5. **High bar before shipping.** Approve an effect only when it meets it.

Sprite Fusion's open effect library (dash afterimages, rain with splashes and mist, ice and shatter) is a reference for the Rain, Dash and Frost items below.

## The loop: an effects lab (built 2026-11-02)

Built: `/lab/baby-fx`, `components/Lab/BabyFx/`, effects in `components/BabyGame/fx/`. Starter drafts: shake and hit-stop, dust, heart burst, rain v2 (three each). Next: judge them, keep winners, add the rest of the list below.

Add `app/lab/baby-fx/`, a page that plays one effect at a time on a plain 304×192 canvas, at 3×, on a loop, with a draft switcher (`A` to `J`) and a speed slider (1×, 0.25×).

- Each effect is a pure function `(ctx, t, seed) => void` in `components/BabyGame/fx/<name>.ts`. No game state. The game imports the winner; the lab imports every draft.
- Drafts live in `fx/drafts/<name>-a.ts` ... and are deleted once one wins. The winner keeps a one-line note of why.
- A record button writes a short WebM clip with `MediaRecorder` on the canvas stream, so a draft can be judged and compared side by side, as in the article.
- Verify through the in-app browser (`browser_batch`), not by guessing.

Why first: every item below is motion or feel. Without a loop that makes ten drafts cheap, we will ship the first one.

## Bar every effect must clear

- Hard pixel edges. No blur, no sub-pixel smoothing, no fractional drawing coordinates (`Math.round` at the end).
- Palette: `PIXEL_PALETTE` plus its existing extensions. Yellow is allowed when the subject needs it (a chick, honey, sunflowers, lemons, a lit window, a warm lamp, sunlight on a path), as one named `yellow` ramp used on purpose, not as a general tint or UI accent. Metal and chrome accents stay silver, never gold. Glow is the CRT green or pink already in `BabyGame.css`.
- No celestial or astrology costume added. Moons and meteors already exist; do not grow them.
- Frame-rate independent: step on elapsed time like the existing 50ms walker, never per frame.
- Honors reduced motion (`prefers-reduced-motion`): effects drop to a static or one-frame version.
- Reads on a phone at 1× scale (see Mobile).

## Motion and feel (the biggest gap)

`render.ts` has a walking bob, water reflection, fireflies, rain and campfire sparks, and nothing else that responds to what you do. Candidates, each run through the lab:

| Effect | Where it fires | Notes |
|---|---|---|
| Footstep dust and grass blades | player and friends walking, `Shift` run | 2 to 4 specks, 6 to 10 frames, tint by tile (grass, path, sand, shallow water ripple) |
| Squash and stretch on landing, turning, hopping | `spriteCanvas` draw in `drawSprite` | scale in whole pixels only, 1 px max, hold 2 frames |
| Idle life | friends | blink, ear flick, tail wag, breathing offset, each on its own random timer per friend |
| Heart burst | gift loved, trust up | hearts rise with a small sine drift, ease out |
| Talk pop | panel opens | plate scales 92% to 100% over 120ms with a short overshoot; the bubble effects from `dialogEffect` already exist and stay |
| Harvest pop | Plot harvest | crop lifts, spins in 4 steps, sparkle ring, drops into the bag icon |
| Water and till | Can, Hoe | splash arc, soil crumbs; ring on the plot when watered |
| Fishing | dock | bobber with ripples, a tug, then a splash and a catch arc |
| Mini game juice | `minigames.tsx` | hit-stop (2 frames), tiny screen shake on a miss (1 px, 4 frames), combo glow on streaks |
| Screen transitions | sleep, day change, zone change | iris wipe or dither fade, not a plain fade |
| Rain v2 | rain days | three depths, splashes with a tiny crown, ripples on water, mist near the ground (Sprite Fusion's Rain is the reference) |
| Frost | Deep Yin | frost creeping in at tile edges, breath puffs from friends, slower puddle shine |

Shake and hit-stop are the cheapest wins in this table. Do them early.

## Style and art

- **Shared dither.** Use one ordered 4×4 dither (Bayer) for light falloff, dusk, fog, fades and transitions, so the whole world has one grain. Today gradients are flat tints.
- **Light.** The lamp and campfire already glow after dark. Add a hue-shifted shadow rule: shadows lean cool, highlights lean warm-pink; yellow is kept for things that are yellow. Cast a short, soft-edged blob shadow under every body that squashes with the bob.
- **Outlines.** Pick one rule and hold it: selective outline (darker tone of the fill, no black) for animals and the player; none for scenery. Check `sprites.ts` against it.
- **Ramp discipline.** Each material gets a 3 to 4 step ramp, defined once in `art.ts`, so trees, marble, water and crops stop drifting.
- **Sprite sheet pass.** Animals have two views and a bob, but no walk cycles (README Planned). Add a 4-frame side walk and a 2-frame front step for the player first, then the companion, then the twenty-four.
- **Props that move.** Windmill-style slow loops on the cottage flower boxes, lamp flicker with a stepped noise curve, reeds sway, banners.
- **Water.** Reflection exists. Add sparkle glints on a slow moving mask, and shore foam that advances and retreats on a sine.
- **Weather feel.** Cloud shadows drifting across the meadow (a large low-contrast dither mask).
- **Mockups.** `docs/mockups/` is the place for stills. Do not use a slant from `docs/mockups/slants/` unless asked by name.

## Design (UI around the canvas)

The hull is the friend instrument's look: riveted dark hull, pale steel plates, CRT-green readouts. Keep it. Changes:

- Plates animate in and out as in "Talk pop"; today they just appear.
- Hearts fill one at a time with a click tick and a spark, instead of snapping.
- The HUD clock and energy bar get a stepped (not smooth) tween; numbers tick like an odometer.
- The Tool bar slot you use pulses once on use and shows a cooldown notch.
- Toast (`bg-toast-in`) gets a pixel icon and a short slide, not only a fade.
- Type: pixel type is already the house direction (`docs/DESIGN_STYLE.md`); audit that panels use one pixel face at whole-number sizes.

## Features and detail

Taken from the README Planned list and from what the effects unlock:

- **Walk cycles** (above).
- **Friends talk to each other:** model-written gossip from `GameState.today`, shown as small paired bubbles between two friends who stand near each other. Closed outputs, scripted fallback, as in `llm.ts`.
- **Wire `LifeContext`** to real tasks, habits and wishes through a read-only BIMBY. Still read-only; the game never completes or writes a real item.
- **Visitors:** the five left-out species (raccoon peddler, lamb wool seller) arrive on festival days, with their own arrival effect (a hop in from the map edge).
- **Heart events past nine hearts:** short staged scenes using the camera moves below.
- **Camera:** a gentle follow with lag, a zoom-in to 4× on talk and heart events, and a pan on gate opening. All in whole pixels.
- **Sound:** step, pick, splash, the harvest chime, a heart tick. Off by default, one Menu switch. Pixel-style, short, synthesized in the browser.
- **Photo mode:** `P` hides the HUD and saves the canvas as a PNG at 3×.
- **Details to chase:** footprints that fade on soft ground, sleeping friends with a drifting "z", puddles that fill after rain and dry by noon, the companion reacting to rain with a leaf, crops with a sway when walked through.

## Mobile

Per `docs/MOBILE_STYLE.md` the game is not yet a mobile screen. A pass is needed before shipping any of the above to the phone:

- Controls: a floating stick plus one `E` key at 44×44 minimum, outside the safe-area insets; close key in the safe area.
- Pause effects when the app is backgrounded; cap particles at a lower budget on touch devices.
- Check legibility of 1 px effects at the phone's real size. Pinch zoom stays on.

## Order of work

1. The lab (`app/lab/baby-fx/`), recording, draft switcher. Nothing else starts until it exists.
2. Cheap feel: shake, hit-stop, footstep dust, heart burst, panel pop. Five drafts each; keep one.
3. Shared dither, shadows, one outline rule. Re-render the world once and compare stills.
4. Walk cycles, then idle life.
5. Rain v2 and Frost.
6. Camera and transitions.
7. Gossip, `LifeContext`, visitors, heart events.
8. Sound and photo mode.
9. Mobile pass.

These steps polish the hand-made world. Generation (above) can start in parallel after step 2, since a spec painter and the lab share the same tools.

Each step ends with the folder README updated (`components/BabyGame/README.md`, `lib/baby-game/README.md`) and a screenshot or clip from the in-app browser.

## Open questions

- Should clips from the lab be kept in the repo (`docs/mockups/`) or stay local? Default here: local, only winners get a still.
- Should motion effects be a single Menu switch ("Calm mode") or follow the system reduced-motion setting only? Default here: follow the system, with a Menu override.

## Story from the likes list (2026-11-02)

The owner's likes and dislikes are the source for the storylines. Done in `story.ts` and `quests.ts`:

| Like | Where it shows |
| --- | --- |
| White orb lights, cobalt blue, glow in the dark | The Orb Lamp is a white orb with a cobalt heart; `orb-count` quest |
| Reflection, distorted puddles, light on water | `puddle-mirror` quest; Glass part; fireworks falling twice at the festival |
| Refraction, prisms, muted rainbows | Glass part throws seafoam, lilac, cornflower bands; `prism-hunt` |
| Wonder, "wow", new ideas | The Hush is "nothing worth wondering about"; Frame part scene |
| Diatoms, tiny things, microscope views | `diatom-count` |
| Collage, scanned paper | `collage-night` |
| Fireworks, sunrises that always happen | Festival ending; `first-light` |
| Dinner parties, free things and trade | `long-table`; `shiny-swap` |
| Index (back of book), libraries | `old-pages` |
| Getting better at hard things | `drop-puzzle` |
| Percussive maintenance, fixing things | `yard-fix` |
| Smells (gasoline, rain) | `smell-of-things` |

| Dislike | How it is used |
| --- | --- |
| Boredom, anhedonia, gloom, settling | The Hush itself |
| Cruelty | Nobody in Valdivia is cruel; the antagonist is flatness |
| Planned obsolescence, corporations | **Planned:** a later visitor selling lamps built to fail |
| Tan paint, popcorn ceilings | **Planned:** beige fog patches the Hush leaves behind |

Friends are named for admired writers, thinkers, artists and characters (see the component README). Left out on purpose: brands and the dislikes that would only sting.
