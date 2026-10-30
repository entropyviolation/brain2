# Inventory

_Last mapped: 2026-10-29_

A Go-room over data that already exists. The key in the header is the same pale silver keycap as the other tabs (`data-tab="inventory"` in `app/page.tsx`). The room interior is the house chrome face on the desk, and a separate phone layout at `max-width: 767px`. The bookshelf case stays wood.

Five scenes, switched in the room and stored with `usePersistedTab` on `APP_NAV_KEYS.inventoryScene`:

| Scene | What it reads | This stream |
|-------|----------------|-------------|
| Bookshelf | One list from `useTaskStore`. The list id is `APP_NAV_KEYS.inventoryBookshelfList`. The slot lists items whose `task.lists` includes that id, finished ones included. | List picker (`SingleListPicker`) plus `BookshelfScene`. |
| Closet | `useWardrobeStore` in `lib/wardrobe.ts`. No second copy of the pieces, and no list. | `ClosetScene` shows the piece count. |
| Kitchen | `useKitchenStore` in `lib/kitchen-store.ts`. No list. | `KitchenScene` on the desk, `KitchenPhone` at 767px and under. |
| Shopping | Named views over lists in `useTaskStore`. Bindings are `APP_NAV_KEYS.inventoryShoppingLists`. | `ShoppingScene` on the desk, `ShoppingPhone` at 767px and under. |
| Gems and Trinkets | Finished daily habits in `useHabitsStore` and finished tasks in `useTaskStore`. No list. | `GemsScene` on the desk and at 767px and under. |

The contract later streams import is `inventory-scenes.ts`: `InventorySceneId`, `BookshelfBinding` (`listId`, optional `coverAttrId`), `ClosetBinding`, `KitchenBinding`, `ShoppingBinding`, `GemsBinding`, `InventorySceneBinding`, `INVENTORY_SCENES`, and the read/write helpers. `coverAttrId` is on the type only. This stream does not persist it. `readInventoryBinding()` uses `""` for a bookshelf with no list stored, `{ scene: "kitchen" }` when the kitchen is open, `{ scene: "shopping" }` when shopping is open, and `{ scene: "gems" }` when Gems and Trinkets is open. The bookshelf scene prop is `listId: string | null`. The shopping views are not on that binding.

`lib/screen-location.ts` already restores the desk tab through `APP_TABS`, so the new id is enough. Grocery may bind to `list-inventory` when that list already exists. Ingest in `lib/ingest/apply-inventory.ts` is unchanged.

## Planned

Owned by later streams:

- Closet cutout grid (replace the body of `ClosetScene`; keep the export). Closet board details are planned by that stream.
- Mix-and-match
- Outfit history
- Packing
- Lookbooks, planned by the closet stream

## Files

| File | Role |
|------|------|
| `InventoryView.tsx` | Desk. Scene keys, list picker, scene slot. Mounts the phone tree under 767px. |
| `inventory-scenes.ts` | Scene contract and persisted scene / list id. |
| `bookshelf-scene.tsx` | Bookshelf slot. |
| `bookshelf/bookshelf-stage.tsx` | Desktop Three.js host. |
| `bookshelf/shelf-diorama.ts` | Three-arch cherry bookcase. |
| `bookshelf/shelf-books.ts` | Membership, measured size, pull then open. |
| `bookshelf/shelf-books.test.ts` | Membership, measures, gesture, and search. |
| `bookshelf/shelf-spine.ts` | Spine color sampled from the cover, and the binding texture. |
| `bookshelf/shelf-spine.test.ts` | Cover sampling, and which face receives the picture. |
| `bookshelf/use-shelf-covers.ts` | Fetch covers button for the desk and the phone. |
| `bookshelf/bookshelf.css` | Shelf bar and stage. |
| `lib/book-lookup.ts` | Open Library covers. Google Books is the fallback. |
| `closet-scene.tsx` | Closet slot. |
| `inventory-chrome.css` | Desk interior. Imported from the view. |
| `phone/use-inventory-phone.ts` | 767px gate. |
| `phone/inventory-phone.tsx` | Phone switcher. Cover shelf, closet, `KitchenPhone`, `ShoppingPhone`, and the gems bag. `InventoryPhoneScreen` is the shell entry. |
| `phone/inventory-phone.css` | Phone only. Classes use the `inv-phone-` prefix. |
| `phone/bookshelf-phone.tsx` | Cover browser. No Three.js. |
| `phone/closet-phone.tsx` | Cutout grid, outfits, lookbooks line, settings. |
| `phone/closet-phone-slots.ts` | Even places for a tapped composition. |
| `phone/inventory-phone.test.tsx` | Scene switch, including the phone kitchen. |
| `phone/bookshelf-phone.test.tsx` | Covers, finished items, search, item popup. |
| `phone/closet-phone.test.tsx` | Chips, new piece, wears, a tapped look, packing. |
| `phone/closet-phone-slots.test.ts` | Slot placement. |
| `kitchen/kitchen-scene.tsx` | Desktop kitchen. Mounts `KitchenStage`. |
| `kitchen/kitchen-phone.tsx` | Phone kitchen. No Three.js. |
| `kitchen/kitchen-add-form.tsx` | Name, section, and amount. Calls `putAway`. |
| `kitchen/kitchen-rows.ts` | Living stock as rows, diorama lots, and phone groups. |
| `kitchen/kitchen.css` | Desk window and phone room list. |
| `InventoryView.test.tsx` | Scene switch and list-id persistence. |
| `shopping/shopping-scene.tsx` | Desk shopping ledger. |
| `shopping/shopping-phone.tsx` | Phone shopping ledger. No Three.js. |
| `shopping/shopping-board.tsx` | List keys, source picker, rows, and add. |
| `shopping/shop-source-picker.tsx` | Item-detail list picker for the source lists. |
| `shopping/shop-lists.ts` | Auto-pick, aggregation, new list, and new item shape. |
| `shopping/shop-bindings.ts` | Persisted shopping views. |
| `shopping/shopping.css` | Desk paper, keycaps, and phone targets. Prefix `inv-shop-`. |
| `shopping/shop-lists.test.ts` | Auto-pick, aggregation, stored views, and add-item shape. |
| `shopping/shopping-board.test.tsx` | Several sources, the row click, and a new list key. |
| `gems/earned-stacks.ts` | One gem per met daily-habit day. One trinket per finished task: its Lists orb (`iconFor`). The same photograph stacks. |
| `gems/earned-stacks.test.ts` | Stacks, skips, and the bag summary. |
| `gems/gems-bag.tsx` | Slot grid. A corner count when the stack is more than one. |
| `gems/gems-scene.tsx` | Desk and phone bag. Reads the habit store and the task store. |
| `gems/gems-scene.test.tsx` | A stacked gem and an assigned trinket. |
| `gems/gems.css` | Dark chest on the desk. Flat large slots on the phone. |

## Bookshelf

_Last mapped: 2026-10-30_

The desktop shelf is a three-arch stained-cherry bookcase (Three.js) in `bookshelf/shelf-diorama.ts`. `bookshelf-scene.tsx` mounts it through `bookshelf/bookshelf-stage.tsx`. The list id is `APP_NAV_KEYS.inventoryBookshelfList`. Membership is `tasksForShelf` in `bookshelf/shelf-books.ts`: items whose `task.lists` includes that id, finished ones included.

The case follows the shape of a built-in library photograph: a wide center arch between two narrower ones, molded arches with a small keystone, pilasters, paneled alcove backs, thick shelves with a soft shadow under each, and a wood floor. The stain is dark cherry, reddish brown in the light and burgundy-brown in the shadow, not the photograph's honey oak. A plant sits in each side arch, a vase in the center arch, and an urn stands on the floor at each end. This scene leaves the default chrome where that photograph requires it. The cherry millwork is the shelf's own furniture, not Lists silver. The photograph's watermark, diamond grid, and size caption are not in the scene.

Books without a cover stay spine-out. A book with a cover shows that picture on the front board, cropped to the face with `coverFrame` and drawn without tone mapping. The spine and the left hinge are a generated binding (`bookshelf/shelf-spine.ts`), never the cover bitmap: cloth, paper, or leather, with grain, a darker hinge, a light along the front joint, head and tail bands, and a faint title panel. Spine-out books keep the title as real text on that binding. A covered book's binding has the panel and no second title. Its color is sampled from the cover (the middle of the picture weighs more than a white or black border) once the image has loaded; until then it uses the shelf's cloth color. The back board and the page edges do not take the cover. Books without measurements keep varied cloth sizes. Books with `heightCm`, `widthCm`, and `thicknessCm` are sized inside the shelf range (`shelfMeasures`). Those fields, with `cover`, `isbn`, `author`, and `pageCount`, are on the Book type in `lib/book-types.ts`. Thickness is unchanged: a face-out book uses thickness as depth, and a spine-out book uses it as the width you see. One scale then fits a row into its bay. The picture is the type's hero image when that cell has one, and otherwise the `cover` attribute, including on a task.

The first click pulls one book forward and squares a cover to the camera. The second click on that book opens the existing item popup (`openItemDetailPopup`). Clicking empty shelf clears the selection (`shelfGesture`). Search dims non-matches (`shelfMatchIds`) and does not pull or open. Enter on a single match pulls it (`shelfSearchEnter`). The next Enter opens it.

Fetch covers runs from its button on the desk and on the phone, through `lib/book-lookup.ts`. Any titled row on the shelf is looked up, including a task. A saved picture is left alone. Open Library is the source: the ISBN edition, then a title search. That search tries a shorter title first (a long subtitle, or a trailing volume numeral) and keeps a hit whose author last name matches and that has a real cover id (a `-1` id is empty and is skipped). The ISBN cover is tried when that id has no picture, as ISBN-10 and ISBN-13. Google Books is a fallback for a missing fact, and its image is tried only after Open Library, because those image links often cannot be read from the page. The lookup does not call Amazon. Pictures are saved one at a time as an `idb:` attachment on the book cover attribute. Author, isbn, and pageCount are filled when empty, and so are height, width, and thickness. The status line counts pictures saved separately from titles matched. Misses are remembered for the session.

## Phone

_Last mapped: 2026-10-28_

At 767px and under, `InventoryView` mounts `InventoryPhone` instead of the desk scenes. The switch is Bookshelf, Closet, Kitchen, Shopping, and Gems and Trinkets. The scene bar scrolls sideways so the full names stay on one line. Kitchen stays `kitchen/kitchen-phone.tsx`. Shopping stays `shopping/shopping-phone.tsx`. Gems and Trinkets stays `gems/gems-scene.tsx` with the phone paint.

Bookshelf (`phone/bookshelf-phone.tsx`) is a cover browser. It does not load Three.js. Items are tasks whose `lists` includes the persisted shelf list (`useBookshelfListId`), finished items included, through `tasksForShelf` in `bookshelf/shelf-books.ts`. Titles are `itemTitle`. A cover is the type's hero image when that cell has a picture, and otherwise `BOOK_ATTR.cover`, including on a task. The picture is `useAttachmentSrc`, cropped into a 2:3 jacket with a spine shadow (a gradient on the jacket, not the desktop binding). Fetch covers is the same lookup as the desk (`useShelfCovers`). Search is `shelfMatchIds` (`filterListItemsBySearch`). It dims non-matches and does not pull or open. The first tap pulls one cover forward. The second tap on that cover calls `openItemDetailPopup`, the same popup as the desk. No list: a quiet line and `SingleListPicker` on `APP_NAV_KEYS.inventoryBookshelfList`.

Closet (`phone/closet-phone.tsx`) is a cutout grid. Chips are All, Uncategorized, and each category that has a piece. Uncategorized is `pieceChipId` (`other` and no subtype). Photos use `ClosetPhoto`. New Item reads a photo, then `piecePhotoDataUrl` (cutout on by default; the original stays if removal fails), `putImageDataUrl`, and `addPiece`. In-scene tabs are Closet, Outfits, Lookbooks, and Settings. Outfits shows wears (photo, day, piece names) and saved compositions. A saved look places cutouts at the slot percentages. Tapping pieces toggles them into a new composition (`phoneCompositionSlots`, `addComposition`). The drag board stays on the desk. Lookbooks is one planned line. Settings is the category legend and a read-only packing list from `packingRows`.

The Capacitor shell tab in `components/Mobile/MobileApp.tsx` lazy-loads `InventoryPhoneScreen`, this same room. A book or a packing row opens that shell's item popup through `openItemDetailPopup`.

## Kitchen

_Last mapped: 2026-10-28_

The kitchen scene reads `lib/kitchen-store.ts` and reuses the tracking diorama (`KitchenStage` from `components/Home/Tracking/tracking-log/food/kitchen-stage.tsx`). Lots are mapped the same way as `food-kitchen-panel.tsx`: a living lot is not finished and its amount is above zero; the name comes from `resolveKitchenFood`. There is no list binding and no second store. A name filter hides lots whose names do not contain the query, and those are the lots passed into the stage. A click selects a lot or a cabinet and shows the name and the room. The list under the stage is the same stock, so the shelf still reads if WebGL does not. `KitchenStage` still draws at most five jars in a room; the list shows every living lot. Spice-cabinet stock is included with pantry, fridge, and freezer.

`kitchen-add-form.tsx` sits on the desk and on the phone. Sections are Pantry, Fridge, Freezer, and Spice cabinet (`SHELF_ROOMS`, the rooms the diorama already opens). The section starts as pantry and follows the cabinet or lot you click. Amount defaults to 1 count, the unit `putAway` uses when none is given. Add calls `putAway`, which matches a catalog or saved food, or saves a new name, and writes a living lot for today. The name clears, the section stays, and the status line names both ("Oats are in the pantry."). An empty name does not submit. The new lot shows in the list and in the lots passed to `KitchenStage`.

At 767px and under, `InventoryPhone` renders `kitchen/kitchen-phone.tsx`: a room-by-room list on the phone field, no Three.js. The same form uses a row of section buttons and 44px targets. Meal plan, recipes, and barcode scan stay in Tracking. When `plan` has slots, one line counts them (`plannedMealLine`). An empty kitchen is a quiet line, and the desk still mounts the empty stage.

## Shopping

_Last mapped: 2026-10-29_

One scene. The switcher is a row of shopping lists. The first visit starts with Grocery, Shopping, Wish list, and Wanted. A silver key (`todo-cap`, class `inv-shop-key`) is pressed while that list is showing. **+** asks for a name and adds another key. On the phone those keys stay 44px and use the system face. The pressed key drops.

Each key aggregates as many vault lists as you attach. The control is the item-detail list picker (`ListPicker` in `shop-source-picker.tsx`): search, folders, chips, and a checkbox per list. Rows are `shopAggregate`: an item on two of those lists is one row. A new item is written onto the first attached list.

The binding is one JSON record on `APP_NAV_KEYS.inventoryShoppingLists` (`readShopBindings` / `writeShopBindings`). Version 2 is `{ v: 2, views }`. A missing key is the first visit. An older record of one id per section is read as four views. `autoPickShopLists` fills views that have no sources yet, and will not put two of those guesses on the same list:

- Grocery uses list id `list-inventory` when that list exists, otherwise a name matching `/grocery/i`.
- Shopping uses a name matching `/shopping/i` that grocery did not take. A miss stays unbound and the picker is the fix. Adding an item with no list creates one named "Shopping" and copies `LIST_TEMPLATES.shopping` attributes onto it.
- Wish list uses a name matching `/wish/i`.
- Wanted uses a name matching `/wanted|want list|to buy/i`, skipping lists already taken.

Choosing the same vault list on two shopping lists is allowed. That is an explicit pick. Auto-pick still refuses it. A view that already has sources keeps them, including extras. An empty choice stays empty on later visits.

Add calls `addTask` with `shopAddItem`, which is `createListItem(title, [listId])`. The name clears and the shopping list stays. An empty name does not submit. If that shopping list has no vault list, Add calls `addList` with `shopListDraft` for the original four (default names "Grocery", "Shopping", "Wish list", "Wanted") or `shopListDraftNamed` for a list you added, stores the new id, then adds the item. Rows show the title, `attributes.qty` (`INVENTORY_QTY_ATTR`) when it is set, and `notes` when it is set. The checkbox calls `updateTask` with `completed` flipped, the same write other lists use to finish an item. The rest of the row calls `openItemDetailPopup`.

The desk is a cool ruled list on the chrome stage (`shopping/shopping.css`, prefix `inv-shop-`). At 767px and under the keys are large tap targets, then the rows and the add field. No Three.js.

## Gems and Trinkets

_Last mapped: 2026-10-29_

A fifth scene, id `gems`. No list and no second store.

A daily habit leaves one copy of its current gem (`resolveTaskGem`) for each day the goal is met in `weeklyData`. A habit-done row counts that day when the cell is missing, and does not count it twice. Weekly and monthly habits stay out. A finished task leaves one trinket: the Lists orb from `iconFor`, the same picture Plan's gem-and-trinket month uses. A custom icon replaces that orb. The same photograph stacks, and the corner shows the count when that stack is more than one. Changing a gem or icon later moves the copies already earned, because the bag rebuilds from the records that exist now.

The desk is a dark chest of silver-rimmed slots (`gems/gems.css`, pixel type, one weight). The phone is the same grid with large flat slots. A tap names the stack under the title: the source, the kind, and the count. An empty bag reads "No gems or trinkets."
