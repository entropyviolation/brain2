# Casa furnishing: handoff

_Last mapped: 2026-11-03_

**Mission.** Put as much of the "future home" Pinterest board (`homedesignref/`, 261 pictures, contact-sheet numbers = file prefix `0001`..`0261`, links in `homedesignref/source-links.txt`) into the inside of the cottage in the Baby animal game, as pixel art, as close to the pictures as possible. Read `components/BabyGame/README.md` ("Inside", "Furnished", "Interactive furniture") and `lib/baby-game/README.md` first.

## What exists now

- Six rooms: Hall, Noble Floor, Loft, plus the new Sunken Lounge (off the Hall's oval doors), Glasshouse (off the Noble folding doors), Boudoir (off the Loft's round door). Plan and walking: `lib/baby-game/casa.ts`. Shells of the new rooms: `components/BabyGame/casa-rooms.ts`; shared painter kit: `casa-kit.ts`; frame and furniture drawing: `casa-paint.ts`.
- Furniture is data: `lib/baby-game/casa-furniture.ts` (`PLACEMENTS`: floor, sprite id, x, foot y, `wall`, `lift`, `solid`, `glow`, `look`, `label`, `use`). Solids, looks and uses become tiles and spots in `casa.ts`.
- Interactions (`use`): `lamp` toggles glow, `sit` sits you down, `music` (record players), `rummage`. Handled in `Casa.tsx`.
- Sprites: `lib/baby-game/furniture-sprites.ts` is GENERATED. 45 of 54 objects snapped. Pipeline:
  1. `node scripts/baby-furniture-queue.mjs [ids]` draws from words (`furn-<id>_*.png` in `~/ComfyUI-Shared/output`). `FRONT=1` jumps the ComfyUI queue (the log's other batches wait), `SEEDS=3,9` for more tries, `SIZE=` canvas.
  2. `node scripts/baby-furniture-ref.mjs [ids]` redraws from the board's own photo image-to-image (`REFS` maps id to picture number; `DENOISE=0.72`; outputs `furnref-<id>_*.png`). These are much closer to the pictures. Under zsh, pass ids as separate words (a `$var` of several ids does not split).
  3. `npx tsx scripts/baby-furniture-snap.mts preview.png` cuts out, downsizes (`HEIGHT` table, px tall), quantizes to 14 colours + outline, writes the TS file and an optional contact sheet. Prefers `furnref-` over `furn-` (not for `EDGE_OK` ids). `lib/baby-game/furniture.json` (`{ "id": "file.png" }`) overrides the pick.
- Lab: `/lab/baby-casa/` shows every room whole with furniture; tick "solids" for blocked tiles and spots.
- Tests: `lib/baby-game/casa.test.ts` (reachability, doors come back, looks exist). The test lists ids still waiting for a sprite (`hammock-net`, `plant-ivy`).

## Known problems to fix first

1. ~~No sprite for `hammock-net` and `plant-ivy`~~: both are now painted in code (`components/BabyGame/casa-made.ts`, 2026-11-03), along with a dozen other board pieces (tree columns, stained glass, star dome, nook bed, leather sofa, spiral stair, rugs). Still unused ids: `sofa-leather`, `sofa-black`, `lamp-mushroom`, `shelf-green`, `cabinet-steel`, `bed-iron`, `bed-sage` (no PLACEMENT yet; `lamp-mushroom` ref is 0082).
2. Image-to-image jobs were still being generated when this was written (about 21 of 47 done). Re-run the snap after `ls ~/ComfyUI-Shared/output | grep -c furnref-` stops growing, then **look at the contact sheet** and re-roll bad ones with other `SEEDS` or a different `DENOISE` (0.6 keeps closer to the photo), then pin good files in `furniture.json`.
3. Several text-only draws are weak (`table-hand` and `table-marble` came out as a plant stand and a candle on a crate; `table-glass` is a flat top). The ref pass should fix them; check.
4. The snap's background removal fails when the picture keeps its own backdrop (dark rooms, windows). `objectMask(..., wide)` floods flat colour from every border pixel; tune `tol`/the flat step (12) or add a manual crop box per id.
5. Layout was written before sprites existed: sizes (`HEIGHT`) and x/y in `PLACEMENTS` need a pass in the lab page (overlaps, things floating, solids blocking paths). Also review night lights.
6. Nothing was checked in the real game (`/lab/baby-play`): walk every room, press E on every piece, check sit/lamps/music, and the 304x192 camera.

## What of the board is not yet in (do as many as you can)

Walk the contact sheets again (`homedesignref/images/`, sheets: build with sharp, 7 columns, 42 per sheet; see `scratchpad` style in this session's notes below). Ideas not done, by picture:

- **Architecture and fixtures:** spiral stair of stone/iron (0003, 0102), organic plaster tree-column arches (0007, 0001), grotto stair (0060), glass-block walls, columns and floors (0124, 0129, 0133, 0160, 0168, 0173, 0176, 0188), stained-glass oval window (0245), tulip stained-glass door (0078), art-nouveau iron railing and window (0088, 0089), ceiling medallion (0136), star-cut dome (0058), sunken tile sink as a floor tile (0052), tiled green alcoves (0006, 0216), sculpted plaster bath (0053), sunken conversation pit (0010, 0012), built-in alcove beds with curtains (0231, 0238, 0239, 0241, 0248, 0249).
- **Soft furnishings:** velvet throws and satin bedding as rug/bed variants (0027, 0033, 0131, 0139, 0193, 0194), bed canopies (0235, 0253), draped lace and gauze (0029, 0230, 0105, 0106), Persian-style rug rooms (0257).
- **Lighting:** opal jellyfish and glass pendants (0134, 0170, 0180, 0255, 0258), globe and space-age lamps (0020, 0137, 0178), pearl-glass lanterns (0092, 0100), bead-fringe shades (0209), crystal chandeliers (0232, 0235).
- **Objects:** chrome and glass tables (0166, 0167, 0084), steel kitchen (0110, 0114), steel cabinets (0152, 0144), spiral coasters (0093, 0138), cut-glass cups and lily glassware (0143, 0208, 0210), black plate sets (0097), vases (0115, 0161), swan candle holder (0031), clocks and speakers (0135, 0128, 0130), books/shelves (0067 bay window reading seat, 0261 curved bookshelf), cherry glass table (0204), 1970s bedside tables (0068, 0195), pink-glass block (0188).
- **Rooms worth adding** (floor ids 6+; extend `FloorId`, `PLAN`, `casa-rooms.ts`, `LIGHTS`, and a door spot both ways): Library bay (0067, 0261, 0196), Steel Kitchen (0110, 0114, 0122, 0175), Conservatory pool court (0002, 0045, 0059), Plum Salon with chinoiserie (0116, 0119, 0236), Roof terrace (0256 round hole in a hedge).
- **Walls and floors:** the existing rooms still use their old procedural shells; work in more of the plaster-sculpture look (0009, 0044, 0062, 0065 exteriors; 0014, 0037, 0050 interiors) in `casa-paint.ts` / `casa-rooms.ts`.

## Rules to keep

- Silver chrome, never gold; no yellow-dominant rooms; star icons are fine, no celestial costume (memory notes). Mobile app follows `docs/MOBILE_STYLE.md` (not touched).
- After a code change update the folder README once, keep `_Last mapped:_` dates, label unbuilt things **Planned**. No AI attribution in commits.
- ComfyUI is shared and slow (one image about 40 to 70 s, often with other sprite batches ahead). Use `FRONT=1` sparingly and say so. Check the queue with `curl localhost:8188/queue`.
- Run `npx vitest run lib/baby-game/casa.test.ts` and `npx tsc --noEmit -p .` before finishing.
