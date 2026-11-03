# Baby animal game: project status

_Last mapped: 2026-11-02_

One page per in-progress project: what is done, what is planned, what is left. Written when all local work on `main` was committed in one sweep (commits `873b3f7e`, `733461bc`, `55664133`, `492707b2`, and a final wip commit). Deeper plans: `docs/BABY_GAME_REDESIGN.md`, `docs/BABY_GAME_STANDALONE.md`, and the folder READMEs in `lib/baby-game/` and `components/BabyGame/`.

## Test state at commit time

`npx vitest run lib/baby-game components/BabyGame`: about 201 pass, 5 to 8 fail (the count moves because `sprites.ts` and `walk.ts` were still being edited in Cursor). `tsc --noEmit` shows no `baby` errors. Known failing:

| Test | Why |
| --- | --- |
| `casa.test` stairs | a staircase landing returns `null` for some floor |
| `dev.test` adds gems | expects 100 gems, gets 0 |
| `props.test` thrift rack, `specs/prop.test` | the rack now sells for 6 gems ("Browse the thrift rack (6 gems)"); tests and the example spec still expect "Swap at the thrift rack" |
| `idle`, `walk`, `sprites` tests | square-grid, palette and margin checks fail for some bodies after sprite edits |
| `minigames.test` stair puzzle | "never solved at the start, solvable at par" fails for some seed |

Fixing these is the first job in any of the projects below.

## 1. Valdivia, the hand-made world

**Done**
- 24 animals at 32×32 with front, side and back views; four-frame walk cycles and idle life made from any still (`walk.ts`, `idle.ts`).
- World grown from 64×52 to 80×64: Cobalt Glow Marsh, The Index Stacks, Firework Dunes. Old saves still load.
- A home for every friend (`homes.ts`, `homeart.ts`) and friends who walk home at dusk and sleep; the player's Casa with staircases (`Casa.tsx`, `casa.ts`, `casa-paint.ts`), now six furnished rooms (Hall, Noble Floor, Loft, Sunken Lounge, Glasshouse, Boudoir) with ComfyUI-drawn furniture from the `homedesignref/` board (`casa-furniture.ts`, `furniture-sprites.ts`, `casa-rooms.ts`).
- The `Character` contract (`character.ts`), `dharma.ts` (Zen, Taoism, Buddhism per friend), gems economy, prop uses, thrift rack, chemistry and theory helpers.
- Dev mode on its own sandbox save (`dev.ts`, `devpanel.tsx`); design notes per character (`design-notes.ts`, `designpanel.tsx`).
- Story from the owner's likes list: quests for orbs, prisms, diatoms, collage, fireworks, index, and so on.

**Planned**
- Walk cycles wired fully into the renderer for every body (player, companion, friends).
- Five left-out species as festival visitors (raccoon peddler, lamb wool seller).
- Friends talk to each other (model-written gossip from `GameState.today`).
- Heart events past nine hearts, with staged scenes.
- `LifeContext` wired to real tasks, habits and wishes through a read-only BIMBY.
- A companion gift from a real finished mission (read-only today).
- Planned dislikes in play: a visitor selling lamps built to fail; beige fog from the Hush.

**Left to do**
- Make the failing tests above pass (they point at real drift: thrift rack price, gems in dev mode, stair landings, sprite margins).
- Commit or finish the live `sprites.ts` and `walk.ts` edits.
- Verify the new zones and homes in the in-app browser, with a screenshot.

## 2. Effects lab and game feel

**Done**
- `/lab/baby-fx` plays one effect at a time at 3×, with draft switcher, slow-mo, pause and WebM record.
- Starter drafts in `components/BabyGame/fx/`: shake and hit-stop, footstep dust, heart burst, rain v2, light, idle, walk.
- Helpers used by the game: `shake.ts`, `juice.ts`, `dither.ts` (shared Bayer dither).

**Planned** (from the redesign order of work)
- Pick winners from the drafts, keep a one-line note of why, delete the rest.
- Squash and stretch, talk pop, harvest pop, water and till, fishing, mini game juice, screen transitions, frost.
- Hue-shifted shadows, one outline rule, ramp discipline, water glints, cloud shadows.
- Camera follow, zoom on talk, pan on gates.
- Sound (off by default) and photo mode.

**Left to do**
- Judge the drafts in the lab and wire the winners into `render.ts` and the panels.
- Respect `prefers-reduced-motion` in every wired effect.
- Mobile pass per `docs/MOBILE_STYLE.md`: controls, particle budget, 1× legibility.

## 3. Spec grammar and endless generation

**Done**
- `lib/baby-game/specs/`: `PropSpec`, `CastSpec`, `BlockSpec`, `ToolSpec`, named ramps, validators that return errors and never throw.
- `examples.ts` writes 12 props and 7 residents as specs and tests them against live data.
- `seed.ts`: `GameSeed` / `OWNER_SEED` (data only).

**Planned**
- Open the closed unions (`PropKind`, `NodeKind`, `ITEMS`, `RESIDENTS`) into data in the save.
- A spec painter in `realize/` so hand-made props become examples; edge rules for auto-tiling.
- Prop BIMBY lab (`/lab/baby-props`), then Tile BIMBY, Cast BIMBY, Premise runner, save and share.
- Validator pipeline: schema, palette, size, verbs, reachability, quest solvable. Cache by spec hash; seeds, not randomness.
- A `host.ts` seam, then split `sprites.ts`, `engine.ts`, `panels.tsx`, then chunked world, then leave brain2 as its own app (`docs/BABY_GAME_STANDALONE.md`).

**Left to do**
- Reconcile the thrift rack example spec with the live label so `specs/prop.test` passes.
- Nothing reads specs yet; the first consumer is the spec painter.

## 4. Image model road (ComfyUI)

**Done**
- `/lab/baby-gens` log of ComfyUI outputs with like or nope, kind, tags, notes, and setup and LoRA boards (`gens/GensLog.tsx`, `gens.ts`).
- `scripts/baby-gens-api.mjs` served by both cogs servers; notes in `data/baby-game-gens.json`.
- PNG recipe reader (`comfy-png.mjs`), a pixel snapper draft (`snap.mjs`), and a sprite-gen script and queue (`gen-sprites.ts`, `scripts/baby-gen-sprites.mts`, `scripts/baby-gens-queue.mjs`).

**Planned**
- Snap and validate liked images (size, transparent background, filled silhouette, palette only, tiles wrap).
- Save recipes per kind (character, prop, tile) with named slots; Generate BIMBY that calls ComfyUI at `POST /prompt`.
- IPAdapter style reference; later a small vision model that scores "cute" against liked examples.

**Left to do**
- Keep tagging outputs while developing; that is the training data.
- Second batch queued 2026-11-03 (`node scripts/baby-gens-queue.mjs second`): otter, giant panda, siamese and grey kittens, hyrax, quokka, pika, dik-dik, sugar glider, pangolin, dormouse, tarsier. Three singles and two sheets each, with extra glitch negatives. Like the clean ones in `/lab/baby-gens`.
- Snap more liked images: 7 animals are generated so far; squirrel, red panda, fennec, corgi and the kittens still wait for likes. Side and back views of hedgehog and meerkat come from their unliked turnaround sheets.
- Restart any dev server started before `baby-gens-api.mjs` existed.
