# The Baby animal game as its own thing

_Last mapped: 2026-11-02_

The Baby animal game (Valdivia) lives inside brain2 and keeps working there. This page says where its edges are, so it can leave later as its own folder, then its own app. Nothing has moved yet. Everything under **Planned** is unbuilt.

## Where the game is today

| Folder or file | What it is |
| --- | --- |
| `lib/baby-game/` | Rules, data, sprites, world, sim, model voice, save. Read its `README.md`. |
| `components/BabyGame/` | The canvas, painters, panels, mini games. Read its `README.md`. |
| `components/BabyGame/fx/`, `components/Lab/BabyFx/`, `app/lab/baby-fx/`, `app/lab/baby-world/` | Effect drafts and review lab pages. |
| `lib/baby-game/seed.ts` | The taste seed (`GameSeed`, `OWNER_SEED`): likes, dislikes, characters, missions, trinkets, plants, names. Data only. |
| `lib/baby-game/character.ts`, `homes.ts` | The character contract every new game creates first (looks, name, personality, role, goals, quests, likes, home, memory), saved in `GameState.characters`; and each friend's home. |
| `lib/baby-game/comfy-png.mjs` | Reads the recipe inside a ComfyUI PNG and keeps a like or note on it. No imports. |
| `scripts/baby-gens-api.mjs` | `/api/baby-gens`: lists ComfyUI outputs (`BABY_GENS_DIR`, else `~/ComfyUI-Shared/output`) and saves notes to `data/baby-game-gens.json`. |
| `docs/BABY_GAME_REDESIGN.md` | The plan, including _Where this is going: endless generation_. |

## The seams into brain2

The game imports brain2 in only these places. Each is small. To go standalone, each gets a local copy or a stand-in.

| Game file | Brain2 import | What it needs | Standalone stand-in |
| --- | --- | --- | --- |
| `cast.ts`, `companion.ts`, `engine.ts`, `lines.ts`, `BabyGame.tsx`, `panels.tsx` | `lib/baby-animal-personality` | `speciesPersonality`, `FriendTone`, `FriendCadence`, `FriendDialogEffect` | Copy the per-species table into the game, or read it from the seed |
| `cast.ts` | `lib/friend-whims` | `friendWhim` (the favor kind) | Copy the whim list |
| `companion.ts` | `lib/string-utils` | `hashString` | A ten-line local hash |
| `sprites.ts` | `components/friend-details/PixelIcon` | `PIXEL_PALETTE` | Copy the palette |
| `save.ts`, `design-notes.ts` | `lib/storage-keys` | `persistKey` | Plain `localStorage` keys |
| `llm.ts` | `lib/bim-flow/chat-models`, `lib/bim-flow/ollama` | `chatCrew`, `ollamaCall` | A direct Ollama call; the shape is already closed |
| `BabyGame.tsx` | `components/ui/dialog`, `friend-details/friend-details.css` | The dialog frame and key look | A full-window page |
| `scripts/cogs-dev-server.mjs`, `cogs-prod-server.mjs` | call `baby-gens-api.mjs` | Serving the ComfyUI log | Its own tiny server |

Brain2 reaches into the game in one place: `components/friend-details/FriendDetailsPanel.tsx` lazy-loads `BabyGame` and passes the friend. That stays the way in, whatever happens to the code behind it.

Saves are browser keys: `brain2-baby-game` (the village), `brain2-baby-game-llm` (model switch), and the design notes key. A standalone build keeps the same keys so a save carries over.

## Target structure (Planned)

The game is meant to be a generative, endless game: Scribblenauts meets Stardew Valley meets Minecraft, from the year 3000. In that game most content is data a model writes, not code. So the structure is built around a spec contract, not around hand-made things.

```
baby-game/
  core/        small, stable engine: time, save, world chunks, entities, verbs, quest steps
  specs/       the contract: GameSeed, Premise, PropSpec, TileSpec, CastSpec, ItemSpec, QuestSpec
  realize/     spec to pixels and rules: spec painters, sprite templates, walk and idle, auto-tiling
  bimbies/     generators: seed or sentence to specs (local model, script fallback, validator)
  packs/
    valdivia/  the hand-made world, as data in the same spec shapes
  ui/          panels, HUD, map; they show whatever exists
  host/        the brain2 seam: friend personality, model transport, dialog
```

The rules that make it work:

- **Specs are the contract.** Every other folder depends on `specs/` and not on each other. One agent can work on a painter, another on a BIMBY, another on a pack, and none of them touch the same files.
- **Content is data, so it never collides.** A new animal, crop or trinket is a new file in a pack, not an edit to `sprites.ts` or `items.ts`.
- **Valdivia is the test set.** Rewriting the hand-made world as specs proves the grammar can carry good content. The hand painters (`art.ts`, `propart.ts`) become reference examples for the spec painter, not code to keep growing.
- **Verbs, not cases.** A prop is parts, a palette and one verb from a closed list (give, heal, reveal, grow, open, ...). The engine knows about twenty verbs, not hundreds of nouns. Today `art.ts` switches on 21 kinds and `propart.ts` on 17; those become a registry fed by specs.
- **Chunks for the Minecraft part.** `world.ts` is one fixed 80×64 map from rectangles. Endless means chunks: made when you arrive, saved as changes from what was generated, with place and break. Map, sim, save and reachability all assume a fixed map today, so this is a core change to plan early.
- **Two saves.** Generated content (specs) and play state (trust, bag, plots) are kept apart, so a world can be regenerated, shared or replayed from a seed.
- **Language-neutral shapes.** Specs are written as JSON Schema (or zod that exports it), so a Rust core could later run the same specs and packs. Rust stays a later option for `core/` and `realize/` if chunks and large sims need the speed; TypeScript first.

What happens to today's big files:

| File | Becomes |
| --- | --- |
| `lib/baby-game/sprites.ts` (54 KB, every animal) | One data file per animal in `packs/valdivia/`, in `CastSpec` shape |
| `lib/baby-game/engine.ts` (47 KB, 58 actions) | `GameState` and helpers stay; actions split by verb into `core/` files, re-exported so callers do not change |
| `components/BabyGame/art.ts`, `propart.ts` | Kept as reference; the spec painter in `realize/` replaces them over time |
| `components/BabyGame/panels.tsx` (13 panels) | One file per panel in `ui/panels/`, each with its own CSS |
| `components/BabyGame/BabyGame.tsx` | The loop stays; input and panel routing move out |
| `lib/baby-game/world.ts` | A chunk generator in `core/`, with Valdivia as a fixed pack chunk set |

## Run from a seed (Planned)

The standalone game starts from one `GameSeed` and a local model, nothing else. Each list feeds a BIMBY from the redesign plan:

- `good` and `bad` become the premise, the antagonist, props, and gift tastes.
- `characters` become `Character`s (`character.ts`, built): looks, name, personality, role, goals, quests, likes, home, memory. A new game always creates its cast first, whatever the seed; `sprites.ts`, `walk.ts` and `idle.ts` already animate them and `homes.ts` gives each a home.
- `missions` become chains of the closed quest steps `quests.ts` already reads: bring, craft, harvest, fish, play, favors, hearts.
- `trinkets` and `plants` become item and crop specs, which `items.ts` and `farm.ts` would read as data, not code.
- `names` seeds resident names.
- ComfyUI likes from `data/baby-game-gens.json` pick which looks win, for sprites later.

The first step is the one the redesign plan already names: make `PropKind`, `NodeKind`, `ITEMS` and `RESIDENTS` data in the save. Then the seed can fill them.

## Leaving brain2 (Planned)

In order, each step keeping the game working in brain2:

1. **Specs first.** Add `lib/baby-game/specs/` with `PropSpec` and `CastSpec` (beside `GameSeed` in `seed.ts`; `CastSpec` is the model-written half of the `Character` contract in `character.ts`, which already exists and is saved), each with a validator and tests that the hand-made Valdivia props and residents can be written in that shape. New files only; nothing reads them yet.
   _Done 2026-11-02._ `lib/baby-game/specs/`: `PropSpec` (shape-grammar parts, named ramps from `ramps.ts`, size, one verb of ten taken from `props.ts`: give, heal, feast, reveal, grow, teach, trade, cheer, rewind, open) and `CastSpec` (body template, ramps, accessory, tone, cadence, want, likes, hates, habits). Each validator returns errors and never throws. `examples.ts` writes 12 props and 7 residents as specs, and the tests check them against the live game data.
2. **Host seam.** Replace each import in the seams table with one game-local file (`lib/baby-game/host.ts`). Brain2 passes its personality and model call in; the game falls back to its own.
3. **Split the hotspots** in the table above, behavior unchanged, tests and typecheck green. Only when no other agent has uncommitted work in those files.
4. **Spec painter.** A `realize/` painter that draws a `PropSpec`; hand-made props move to specs one at a time.
5. **Valdivia as a pack.** Residents, items, crops and props as data in `packs/valdivia/`.
6. **Chunks.** World chunks, generated on arrival, saved as diffs.
7. **One folder.** Move it all under `games/baby-animal/` with path aliases so brain2 imports do not change, then give it its own `package.json` and a plain Vite page (or a Tauri app) that runs without brain2.
8. **Later, maybe Rust** for `core/` and `realize/`, reading the same specs.
