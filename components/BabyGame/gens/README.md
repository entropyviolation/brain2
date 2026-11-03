# `components/BabyGame/gens/` — the generation log (Baby animal game art)

_Last mapped: 2026-11-02_

Route: `/lab/baby-gens` (`app/lab/baby-gens/page.tsx`). Also linked from the game: Journal → Friends → **Design** → **Generation log**. Part of the Baby animal game only; it is not a Brain2 productivity BIMBY.

Every PNG in the ComfyUI output folder, newest first, beside the recipe it carries. ComfyUI's Save Image node stores the graph that ran in each PNG, so nothing extra is logged at generation time. For each image you can:

- **Like** (♥, key `L`) or **nope** (✕, key `X`). Key `0` clears. Keys `←` `→` move between images.
- Say what it was **meant to be**: character, prop, tile or other.
- Add **tags** and a **note**: what works and what is off.
- **Copy recipe as JSON**.

Two boards sit above the grid. **Setups** groups images by checkpoint, LoRAs and strengths, cfg, sampler and steps. **LoRA at strength** groups by each LoRA at a strength. Both are ranked by `(likes + 1) / (rated + 2)`, so one lucky image cannot beat a long record. Click a setup to filter the grid to it. Note nodes on the ComfyUI canvas show under the recipe.

```
GensLog.tsx   the page: boards, filters, image grid, detail with recipe, note and tags
```

## Where things live

- **Reading the PNGs:** `lib/baby-game/comfy-png.mjs` (plain `.mjs`, so the Node server and the tests share it).
- **Boards and filters:** `lib/baby-game/gens.ts`.
- **Server:** `scripts/baby-gens-api.mjs`, called by `cogs-dev-server.mjs` and `cogs-prod-server.mjs`. A dev server started before this file existed must be restarted.
- **Folder read:** `BABY_GENS_DIR`, else `~/ComfyUI-Shared/output`, plus its first level of subfolders.
- **Notes:** `data/baby-game-gens.json` (gitignored), keyed by file path in the output folder. They are on disk, not in browser storage, so Claude and, later, the game's generation BIMBY can read which recipes won.

## Why

These likes and notes are step 1 of the _Image model road_ in `docs/BABY_GAME_REDESIGN.md`. Liked setups become the fixed recipes the game's small model fills slots in. Notes become the rules. **Planned next:** snap and validate liked images, then save recipes per kind.
