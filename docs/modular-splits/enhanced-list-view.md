# Split `enhanced-list-view.tsx`

_Last mapped: 2026-10-27. Shipped. `enhanced-list-view.tsx` is the compositor, 710 lines. `EnhancedCategoryView` stays on that path, with the stylesheet import and the Lists Names stamp._

Pure structural extraction of `components/Lists/enhanced-list-view.tsx`. Same props, same behavior, same DOM, same class names, same copy. No visual tweak, no store-shape change, no new product behavior.

The file is one client component, **2,153 lines**. `EnhancedCategoryView` runs from ~272 to the end. Lists README still says 2,035; that count is stale. Hooks, views, dialogs, and toolbar are already extracted. What remains is store wiring, derived shelf and open-list data, maintenance writes, selection and clipboard actions, and the window JSX.

Do not touch `components/Modules/`. Do not edit `filemanager98.css`. The working tree already has unrelated session and tracking edits. Do not revert, stage, or rewrite those files. Each extraction step touches only the new Lists module, the shrinking orchestrator, the stamp-test path if the inspector moves, and the docs that step makes stale.

## 1. Current responsibilities and stable surface

### Public export

| Symbol | Contract |
|--------|----------|
| `EnhancedCategoryView` | Named export. Props: `onTaskSelect: (taskId: string) => void`. |
| Import path | `@/components/Lists/enhanced-list-view` and the relative paths the Lists tests use. |

Call sites that must keep compiling with no import edit:

- `app/page.tsx` — `lazy(() => import("@/components/Lists/enhanced-list-view").then(mod => ({ default: mod.EnhancedCategoryView })))`, rendered with `onTaskSelect={handleTaskSelect}`.
- `components/Mobile/MobileApp.tsx` — the same lazy import.
- `app/page.test.tsx` — `vi.mock("@/components/Lists/enhanced-list-view", …)` expecting `EnhancedCategoryView`.
- `components/Lists/enhanced-list-view.test.tsx` — `import { EnhancedCategoryView } from "./enhanced-list-view"`.
- `components/Lists/__tests__/enhanced-list-view.integration.test.tsx` — `import { EnhancedCategoryView } from "../enhanced-list-view"`.

There is no second named export. Do not add one that callers start to depend on. If the function body moves, the original file re-exports `EnhancedCategoryView`. Prefer keeping the function in the original file (section 2) so the CSS import and the `data-ui-name="Lists"` stamp stay on the module the lazy import evaluates.

`"use client"` stays on the original file. `import "./filemanager98.css"` stays on the original file. A re-export-only entry that forgets the CSS import drops the Lists skin.

### `onTaskSelect` is part of the signature and is unread

The prop is destructured and never called. Opening a row uses internal `setSelectedTaskId`, which mounts `TaskDetailPopup` inside this window. The page still passes `handleTaskSelect`. Keep the prop on the type and the destructure. Do not wire it, and do not remove it. Wiring it would open a second detail surface. Removing it breaks the page call and the page test mock.

### What the component does today

Line ranges are a map of the file as of 2026-10-27, not a contract. Re-read before cutting.

| Seam | Lines (approx.) | Role |
|------|-----------------|------|
| Module helpers | 179–270 | `latestTouch`, `InspectorFacts`, `sameIds`, `sameFolderTree`, `sameListShelf`, `scheduleMaintenanceKey`. |
| Store subscriptions | 273–330 | `task-store` tasks, lists, folders, and mutators; item types; goals objective count; modules; a wide `lists-ui-store` slice (pins, smart lists, period ledgers, displays, icon layout, All-items filters, type filters). |
| Existing hooks | 332–336, 369–390 | `useListsNavigation`, `useListsSearch`, `useListsDragDrop`, `useListsSelection`, `useListsTaskActions`. Search-clear wrappers `handleNavTo` / `handleOpenEntry` call `chooseListsLocation`. |
| Local dialog and chrome state | 338–396, 730–732, 1331–1332 | New/edit list and folder, CSV, bulk add, sent-items, selected task, settings, duplicate subject, clipboard, paste, folder context menu, rename, icon picker, folder organize snapshot and epoch, list-desktop organize / pile / gravity epochs, gravity settings, list caption search, select-band height. |
| Dedupe on mount | 398–401 | `dedupeFolders()` and `dedupeLists()` once. |
| Hydration gate | 403–407 | `useTaskStore.persist.hasHydrated` / `onFinishHydration`. |
| Shelf index | 409–422, 507–592 | `scheduleMaintenanceKey`, `buildListsTaskIndex` with a prev ref, `categoryById`, smart/archive/period/list task getters, folder counts, completion rate, item label, `entries` (`buildGridEntries` or the Item Types virtual folder). |
| Shelf maintenance | 424–505 | Idle (`requestIdleCallback` timeout 400, else `setTimeout` 32) inside `startTransition`. Order: `syncNextActionsSmartLists`, `syncScheduledFolderHierarchy`, `syncFolderAllItemsCategories`, `syncGlobalAllItemsList`, `joinArchiveListMembership`, then `sameFolderTree` / `sameListShelf` so a no-op sync does not `setState`, then module folder/content sync and `ensureFilmTypeOnFilmsLists`. Deps: `taskStoreHydrated`, `taskScheduleKey`, `modules`. |
| Open-list chrome | 594–650, 795–801 | Which target is open, All Items backing list, name, icon, offered displays, current display, breadcrumb, here/tree counts, inner caption. |
| Open-list items | 651–793 | `openTasks` → `withoutStepItems` / sent-this-week / type filter → `listedTasks` → caption-search state and schema → session or persisted sort → `shownTasks`. Sort runs only when `currentDisplay === "default"`. |
| Create list and folder | 803–923 | Single and bulk create, including filing the current selection into a new list. `newListSeed` is the toolbar search text when no list already has that exact name. |
| Duplicate, paste, rename | 925–1104 | Duplicate subject, folder context menu, in-place rename, paste confirm, Cmd/Ctrl+C/V on `window` gated by `isListsClipboardSurfaceActive(listsSurfaceRef)` and `isListsClipboardKeyboardBlocked`. |
| List settings for All Items | 1106–1135 | `handleEditCategory` writes `updateList`. `openFolderAllSettings` finds or creates the backing All Items list (`__all-items__root` or the folder’s list) and only then opens edit. |
| CSV | 1137–1218, hidden input ~1797 | Parse, alert copy, import into a new or existing list, force spreadsheet display, open that list. |
| Icon and velvet organize | 1220–1257 | `applyIcon` for category, folder, or task. Folder auto-organize snapshot + `commitIconLayout(..., "auto")` + `organizeEpoch`. |
| Select-mode actions | 1266–1523 | Keep/move placement, place lists into a folder, place items into lists, select-all variants, delete confirms, merge apply (list and item, with tombstones), `folderViewCommon` / `folderRenameProps`, paste Same-enabled reasons. |
| Select-band measure | 1330–1350 | ResizeObserver. Height is `ceil(border box) + 3` (margin). Closed strip forces `0`. |
| `renderMainContent` | 1525–1717 | Exclusive branch order: search results, habits, objectives, open list (`ListContentPanel`), else folder view icons / list / details / cards. |
| Window return | 1719–2151 | `fm98` shell, `fm-window` Names stamp, title bar, toolbar, hidden file input, address bar, select strip, split (tree, caption, main, inspector), status bar, dialogs, popups. |

### Names stamps that tests read from source

`components/UiNames/ui-names-stamps.test.ts` reads file text:

- `components/Lists/enhanced-list-view.tsx` must still contain `data-ui-name="Lists"` and `data-ui-docs="components/Lists/README.md"`. Leave that root in the original file.
- The same test expects `data-ui-name="List inspector"` in that file today (four inspector roots, ~1948–2042). Moving the inspector means updating that one stamp row to the new path in the same step. The attribute values stay `"List inspector"` and `components/Lists/README.md`.

Other Names roots (`List settings`, `Lists settings`, `Folder settings`, `New list`, `New folder`, `Sheet fullscreen`) already live in their own files. Do not move them.

### Subscription rule

Every Zustand selector stays in `EnhancedCategoryView`. Pass values into hooks and children. A hook or child that calls `useTaskStore` / `useListsUiStore` subscribes on its own. That changes which parent re-renders, which effects run, and when the maintenance pass sees `modules`. The maintenance effect may keep using `useTaskStore.getState()` and `useTaskStore.setState()` inside the idle callback. That is not a subscription. `persist.hasHydrated` / `onFinishHydration` move with that effect.

Do not wrap extracted components in `React.memo`. Do not add `useDeferredValue` or another `startTransition`. The maintenance pass already has the one `startTransition`.

## 2. Proposed files

New modules are interior. Nothing outside `components/Lists/` may import them. `hooks/` stays private to this room, matching the Lists README public-door note.

`EnhancedCategoryView` stays in `components/Lists/enhanced-list-view.tsx`. After the split that file is the compositor: selectors, hook calls, and the `fm98` / `fm-window` layout. It should land around 450–650 lines. If it is still over ~800, a dialog or pane prop was left inline; move that JSX, not the selectors.

### Move

| New file | What moves | Notes |
|----------|------------|--------|
| `components/Lists/lib/lists-shelf-sync.ts` | `sameIds`, `sameFolderTree`, `sameListShelf`, `scheduleMaintenanceKey`. | Pure. Not a new write path. Used only by the maintenance hook. |
| `components/Lists/hooks/useListsShelfMaintenance.ts` | Dedupe effect, hydration flag, idle maintenance effect. | Arguments: `allTasks`, `modules`, and the dedupe functions. Calls `getState` / `setState` exactly as now. Does not subscribe. |
| `components/Lists/hooks/useListsShelf.ts` | Task-index ref and memo, `categoryById`, `getSmartTasks`, `getTasksForCategory`, `countForFolder`, `getCategoryCompletionRate`, `itemLabelFor`, `isItemTypes`, `entries`. | Arguments in, memos out. `buildListsTaskIndex` prev-ref stays inside this hook so a title edit can still reuse the index object. |
| `components/Lists/lib/open-list-chrome.ts` | Pure `resolveOpenListChrome(...)`. | Returns `openCategory`, `openSmart`, `openHabits`, `openObjectives`, `openTypeList`, `openFolderAll`, `isRootAll`, `canEditFolderAllSettings`, `folderAllList`, `viewList`, `openName`, `openIconKey`, `rawDisplay`, `offeredDisplays`, `currentDisplay`, `innerCaption`. No state. The sent-items reset effect (`setShowSentItems(false)` when `openCategory?.id` changes) stays beside the caller, or inside `useOpenListItems` — one place only. |
| `components/Lists/hooks/useOpenListItems.ts` | `openTasks`, `listedTasks`, `typeFilterForOpen`, caption-search state (`listSearchOpen`, `listSearchQuery`, `listSearchAllFields`, reset on `openKeyForSearch`), `closeListSearch`, `listSearchable`, `listSchemaDefs`, `sessionSorts`, `currentSort`, `handleSortChange`, `sortOptions`, `shownTasks`. | One hook. See “Leave together”. |
| `components/Lists/board/list-inner-caption.tsx` | The open-list caption bar (~1885–1943). | Presentational. Receives query, flags, and callbacks. Owns no search state. |
| `components/Lists/hooks/useListsClipboard.ts` | `listsClipboard`, `pasteOpen`, keydown effect, `handleConfirmPaste`, `pasteSameEnabled`, `pasteSameDisabledReason`. | `listsSurfaceRef` stays in the orchestrator (it is on the `fm98` root) and is passed in. |
| `components/Lists/hooks/useListsCreate.ts` | New-list and new-folder open flags, `newListSeed`, create and bulk-create handlers. | Seed rule stays: exact existing list name yields `""`. |
| `components/Lists/hooks/useListsDuplicate.ts` | `duplicateOpen`, `duplicateSubject`, open helpers, `handleConfirmDuplicate`. | Includes the ancestor-skip and settings-vs-contents list skip. Closes edit dialogs through callbacks the orchestrator passes (`setEditingFolder`, `setEditingCategory`). |
| `components/Lists/hooks/useFolderContextMenu.ts` | Menu state, `handleFolderContextMenu`, `handleCommitFolderRename`, `renamingFolderId`, `folderRenameProps`. | Rename still refuses non-editable folders and empty names. |
| `components/Lists/hooks/useListsCsvImport.ts` | `csvRef`, `csvImport`, `handleCsvFile`, `performCsvImport`. | Hidden `<input>` can render here or stay in the orchestrator with `ref` forwarded. Accept string stays character-for-character. |
| `components/Lists/hooks/useListsSelectionActions.ts` | Placement modes, `placeListsIntoFolder`, `placeItemsIntoLists`, select-all handlers, both delete handlers, merge list/item memos, `handleApplyMerge`, `handleApplyItemMerge`, merge dialog flags, `effectivePlacement`, `itemCanMove`, `effectiveItemPlacement`, `itemSelectActive`, `listSelectActive`, `selectStripOpen`, search list/item presence flags. | `confirm()` copy stays verbatim. Protected lists (Reminders, People I Know, Instagram people) still skip delete. Item merge still tombstones and clears `selectedTaskId` when the open popup’s id was discarded. |
| `components/Lists/hooks/useListsIconChrome.ts` | `iconPickerFor`, `applyIcon`, `iconPickerCurrent`, folder `organizeEpoch` / `organizeFromSnapshot` / `handleAutoOrganize` / `handleCanvasWidth`, list-desktop epochs, gravity settings open flag, the toolbar callbacks that bump those epochs and clear gravity on auto-organize and pile-up. | Folder organize and list-desktop epochs stay separate state. Do not merge them into one counter. |
| `components/Lists/board/lists-title-bar.tsx` | Title bar (~1737–1747). | Minimize and Maximize stay buttons with `aria-label` and no `onClick`. Close stays `KeycapClose` calling `closeTarget`. |
| `components/Lists/board/lists-address-bar.tsx` | Address status row (~1805–1810). | |
| `components/Lists/board/lists-status-bar.tsx` | Bottom status bar (~2046–2073). | Labels “This folder:” and “Tree:”, test ids `fm-status-here` and `fm-status-tree`, Smart lists checkbox, and the global-All “Show to do / done / undone” checkbox (`data-testid="fm-status-period-ledgers"`). |
| `components/Lists/board/lists-select-strip.tsx` | Select band (~1812–1866) plus the measure effect. | Owns `selectBandRef` and reports `selectBandPx`. Window `height` / `minHeight` stay in the orchestrator, using that number. |
| `components/Lists/board/lists-inspector.tsx` | `InspectorFacts`, `latestTouch`, and all four inspector branches (~1948–2043). | One file, four exclusive branches. |
| `components/Lists/board/lists-main-pane.tsx` | `renderMainContent` (~1525–1717), including `folderViewCommon` and the media-add closure. | One function, same branch order. Not memoized. |
| `components/Lists/board/lists-dialog-host.tsx` | Dialog and popup mount (~2077–2149) except the hidden file input if that stays with CSV. | Hosts existing dialog components. Inline `onSave` / `onDelete` / `confirm` strings move verbatim. |

`board/` is new. It is not a public door.

### Stay in `enhanced-list-view.tsx`

- The export, the props type, and the unused `onTaskSelect` destructure.
- `"use client"` and the CSS import.
- The `fm98` root (`listsSurfaceRef`, the `calc(100vh - 150px)` height, `minHeight: 560 + selectBandPx`) and the `fm-window` Names root.
- Every store selector listed above.
- Calls to the existing navigation, search, drag, selection, and task-action hooks, plus `handleNavTo` and `handleOpenEntry`.
- `showSentItems` if the reset effect is not inside `useOpenListItems`. Pick one home and do not duplicate the reset.
- `showBulkAdd`, `addingTaskToTarget`, `selectedTaskId`, `showCategorySettings`, `editingCategory`, `editingFolder`. These are opened from the caption, the inspector, the toolbar, cards, and the dialog host. Threading them through one more hook splits setters from the JSX that flips them and is easy to get wrong. Pass the setters down. Do not invent a second copy of this state.
- Composition: toolbar, address, strip, tree, caption, main pane, inspector, status bar, dialog host. `FolderTree` stays a direct child so its props are not re-bundled through the main pane.

### Leave together

These are real seams that share too much local state or too strict an order to split further without a behavior risk.

1. **Open-list item pipeline, one hook.** `openTasks`, `listedTasks`, the type filter, attribute schema, caption-search state, session sort, and `shownTasks` are one pipeline. Search resets when the open target key changes. Sort persists on `viewList.defaultView` or, for a smart list with no `List` record, on session state. `shownTasks` filters, then sorts only in Default. A caption component that owned its own query would double-filter or show a stale count. `resolveOpenListChrome` may be pure and separate because it has no state. It must run before the items hook, and `currentDisplay` is an input to `shownTasks`.

2. **`renderMainContent` branch order, one component.** Search, then habits, then objectives, then any other open target, then folder icons / list / details / cards. The branches are mutually exclusive. Splitting each into a file that re-reads `openTarget` can mount two panes or skip cards (the final `return`). Private functions in `lists-main-pane.tsx` are fine. Separate files per branch are not.

3. **The four inspectors, one file.** Today the conditions are `openCategory`, else `openFolderAll && (isRootAll \|\| currentFolder)`, else `openSmart`, else a plain folder. Two inspectors must not mount. All Items filters, the uncategorized checkbox, and the sentence “Items added here stay uncategorized until filed into a list.” stay in the folder-all branch. The smart-list sentence “Synced with the dashboard To-Do panel.” stays in that branch. Type filter is repeated in the list branch and the All branch; keep both copies rather than “deduping” props in a way that drops `ariaLabel` (`"Filter types"`, `"Filter folders"`, `"Filter lists"`).

4. **Maintenance effect body, one hook.** The snapshot `mut` object is local to the idle callback. Do not export it, and do not reuse it for module sync (module sync already uses `taskStoreModuleListsMutators()` after the shelf `setState`). Do not run the pass synchronously. Do not drop `sameFolderTree` / `sameListShelf`. Do not add fields to `scheduleMaintenanceKey` (title edits must not rerun it). Order and idle timing stay as in the table above. `syncModuleListFolders` still calls `addListToFolder` / `removeListFromFolder`, which no-op when membership is unchanged. That is why this pass must not publish a new tree on a wash.

5. **Select strip DOM and its measure, one component.** The `+ 3` is the strip’s margin outside the border box. The ref has to sit on that wrapper. Reporting a number upward is fine. Reimplementing the measure with a different observer or a layout effect that skips the closed-to-zero write will change `minHeight` and the folder-tree height the README promises stays put when select mode toggles.

6. **Folder auto-organize snapshot and `organizeEpoch`.** They are a pair passed to `FolderViewIcons`. List-desktop epochs are a different pair passed to `ListContentPanel`. Same hook file is fine. Same state variable is not.

7. **Selectors.** Already covered. Do not “simplify” by letting `lists-inspector.tsx` call `useListsUiStore`.

## 3. Extraction order

Each step leaves `EnhancedCategoryView` importable from the same path and the app working. Run the focused tests at the end of the step before starting the next. Do not batch doc updates to the end; the doc line for that step is in section 6.

1. **Pure shelf equality.** Add `lib/lists-shelf-sync.ts` and import it from the orchestrator. No JSX change. Delete the in-file copies in the same edit so there is one definition.
2. **Maintenance hook.** Move dedupe, hydration, and the idle effect together. Orchestrator calls the hook once, unconditionally, after the store selectors it needs. Confirm the dependency list is still `taskStoreHydrated`, `taskScheduleKey`, `modules`.
3. **Shelf hook.** Move the task index, getters, and `entries`. Orchestrator passes the same inputs the memos close over today, including `objectiveCount`, `homePinned`, `showSmartLists`, `showPeriodLedgerListsInAll`.
4. **Open-list chrome function, then `useOpenListItems`.** Chrome first, still called from the orchestrator. Then move the item pipeline and caption-search state in one edit. `shownTasks` must still be what `ListContentPanel` and the caption match count receive.
5. **Caption presentational component.** Swap the inline caption JSX for `ListInnerCaption` with the same class string `` `fm-title-bar inactive fm-list-caption${listSearchOpen ? " searching" : ""}` ``, `data-testid="fm-inner-caption"`, `data-no95`, `fm-cap-key` / `fm-cap-key-close`, `CaptionKeyGlyph` kinds, and the aria labels “Close list search” / “Search this list” / “Add item” / “List settings” / “Close”.
6. **Clipboard hook.** Move clipboard state and the window listener together. The listener stays on `window`, not on the div.
7. **Create hook, duplicate hook, folder-context hook, CSV hook.** One hook per step. Dialog JSX can stay inline until step 12, calling the new handlers.
8. **Selection-actions hook.** Move placement, select-all, delete, and merge together so `effectiveItemPlacement` is not computed in two places. `handleCreateCategory` still reads it; pass it into the create hook or keep the create handler as a thin wrapper that sees the value. One computation only.
9. **Icon chrome hook.** Move picker state and both epoch families. Toolbar props stay the same names the existing `ListsToolbar` already accepts.
10. **Select strip component**, including the measure effect. Orchestrator applies the returned pixel value to the existing `height` / `minHeight` style. No other style on `fm98`.
11. **Title bar, address bar, status bar.** One component per step. Copy the inline style objects (`minWidth: 180`, `minWidth: 90`, `minWidth: 160`, flex gap 4) rather than replacing them with classes.
12. **Inspector.** Move JSX and `InspectorFacts`. Update the stamp-test path in the same edit. Four `data-ui-name="List inspector"` roots stay. Width stays `168` via the inline style.
13. **Main pane.** Move `renderMainContent` in one edit. Pass `shownTasks`, drag handlers, and selection flags in. Do not recompute the task list inside the pane.
14. **Dialog host.** Move the dialog mount list in one edit. `TaskDetailPopup`, `OrbPickerDialog`, `NextActionsSettingsDialog`, and `GravitySettingsDialog` stay the same components.

Stop when the orchestrator is only composition. Do not continue into `ListContentPanel`, folder views, or `components/Modules`.

## 4. Behavior and visual invariants

- DOM order inside `.fm-window` stays: title bar, window body (toolbar, hidden file input, address bar, optional select strip, `.fm-split`, status bar), then the dialogs as siblings of `.fm-window` inside `.fm98`.
- Class names that tests and CSS bind: `fm98`, `fm-window`, `fm-title-bar`, `fm-title-bar-text`, `fm-title-bar-controls`, `fm-title-btn`, `fm-window-body`, `fm-status-bar`, `fm-status-field`, `fm-status-label`, `fm-crt-count`, `shrink`, `fm-split`, `fm-list-caption`, `searching`, `fm-list-caption-name`, `fm-cap-keys`, `fm-cap-key`, `fm-cap-key-close`, `fm-sidebar`, `fm-inspector`, `fm-inspector-facts`, `fm-inspector-sep`, `fm-inspector-actions`, `fm-btn`, `fm-btn-sm`.
- Names attributes and help string stay: `data-ui-name="Lists"`, `data-ui-help="Folders, lists, and items in a file-manager window."`, `data-ui-docs="components/Lists/README.md"`.
- Status test ids and labels stay: `fm-status-here` (“This folder:”), `fm-status-tree` (“Tree:”), `fm-status-period-ledgers` (“Show to do / done / undone”), “Smart lists”.
- Inspector copy stays, including “List Settings”, “Change Icon”, “Pin to Home” / “Unpin Home”, “Folder Settings”, “New List Here”, “Add Task”, the uncategorized sentence, and the smart-list sentence. No Delete on the rail.
- Caption keys stay in order: Search (only if `listSearchable`), Add item (same), List settings (list or editable All Items), Close.
- Window height formula stays `calc(100vh - 150px)` plus the band, and `minHeight` stays `560 + selectBandPx`.
- Select-mode delete confirms, list delete confirm, folder delete confirm, and the CSV alert stay the same strings.
- Merge still goes through `applyListMerge` / `applyItemMerge` and `setLists` / `setTasks` tombstone options. Search-result select and in-list select still share those two handlers.
- Clipboard shortcuts still no-op when the Lists surface is not the visible desk, when focus is in a blocked field, when select mode is off (copy), or when the payload is empty. Checkboxes and radios still do not block the shortcut.
- Choosing Quick Access, the folder tree, Up, or a folder icon still clears search via `chooseListsLocation` / `clearSearch` before navigation.
- Maintenance still does not write when the folder tree and list shelf compare equal, and still does not rerun on a title-only task edit.
- Item Types location still builds virtual entries instead of `buildGridEntries`. Step items still never appear (`withoutStepItems`). Sent-this-week hiding still follows `visibleListItems` until Show sent.
- Default display sort still persists on the list record. Smart-list sort still lasts for the session only. Caption search still does not change membership.
- Gallery and documents still appear as offered displays only when the list allows those types, and a photo list with no saved display still opens on gallery (documents next).
- Protected singleton deletes (Reminders, People I Know, Instagram people lists, folder All Items where the edit dialog already refuses) stay refused. Do not re-check that policy by changing confirm copy.
- `onTaskSelect` stays unused.
- No new CSS file. No class rename. No copy edit. No `React.memo`.

## 5. Test plan

No new product behavior, so no new feature tests are required. A unit test of `sameFolderTree` / `scheduleMaintenanceKey` is optional and must not change production code to suit the test. Do not add a snapshot of the whole window.

Existing tests that mount this component or read its source:

| Test | What a broken split would fail |
|------|--------------------------------|
| `components/Lists/enhanced-list-view.test.tsx` | Title bar (“Lists — File Manager”), search clear on Quick Access and on the folder tree, settings dialog from the toolbar, “This folder:” / “Tree:”, toolbar separators and the mode bay. |
| `components/Lists/__tests__/enhanced-list-view.integration.test.tsx` | Open list, toolbar search, Quick Access clears search, quick-add, Enter add, checklist reflection cancel, Completed and Missed filing, no Kanban mode, Default rows + list-name caption + inspector facts and no rail Delete, caption search (names vs All fields), Default sort persisted and no sidebar Delete, List Settings Clear + Delete, folder All and global All settings without delete, All filters and uncategorized overrides without membership writes, select-mode folder create / move / keep, merge lists, item select add / move / delete, new list from selection, multi-list add, item merge, search-result item merge tombstones. |
| `components/UiNames/ui-names-stamps.test.ts` | `Lists` stamp still in `enhanced-list-view.tsx`. `List inspector` stamp in whichever file holds the rail after step 12. |
| `app/page.test.tsx` | Mock still resolves `EnhancedCategoryView` from `@/components/Lists/enhanced-list-view`. |

After each step, run:

```bash
npx vitest run components/Lists/enhanced-list-view.test.tsx components/Lists/__tests__/enhanced-list-view.integration.test.tsx components/UiNames/ui-names-stamps.test.ts
```

After step 13 (main pane) and step 14 (dialogs), also run `npx vitest run components/Lists`. Those other Lists tests mount panels and dialogs directly; they should stay green because those files are not edited. If a test imports the orchestrator, it must still import the same path.

`e2e/lists.spec.ts` covers the file-manager title, creating a list, and toolbar search (`npm run test:e2e` starts the dev server). Run it once at the end if a dev server is already up. It is not required between every step.

Manual check only if a test cannot see layout: select mode grows the window by the strip, and `.fm-split` keeps its height. The integration tests already cover select mode behavior. Do not restyle while checking.

## 6. Doc updates

Do these in the same step that makes them stale. Do not rewrite unrelated README sections.

| When | Update |
|------|--------|
| Step 2 | `components/Lists/README.md` Mount cost: the idle effect moves from `enhanced-list-view.tsx` (~424) to `hooks/useListsShelfMaintenance.ts`. Say why the equality bail stays. `MODULE_LISTS.md` “Where Module Lists come from”: hydration still runs from that hook, which the orchestrator calls. |
| Step 3 | `components/Lists/README.md` architecture tree: add the shelf hook. `lib/README.md` row for `lists-grid-entries.ts`: used by `useListsShelf`, which the orchestrator calls. |
| Step 4 | `components/Lists/DEFAULT_VIEW.md` sort paragraph and the comment in `lib/list-item-sort.ts`: `shownTasks` lives in `useOpenListItems`. `components/Lists/README.md` one-list search can keep its behavior text; point the implementation at the hook plus `board/list-inner-caption.tsx` once step 5 lands. |
| Step 12 | Lists README inspector paragraph: rail component path. Architecture file tree: `board/`. Replace the “2,035 lines / single orchestrator” sentence with the real entry size and the list of `board/` and new hooks. Public door sentence stays: other rooms import `EnhancedCategoryView` from `enhanced-list-view.tsx`. |
| Step 14 | `components/README.md` Lists row: orchestrator composes `board/` and the Lists hooks. Do not change the feature prose. `docs/DESIGN_STYLE.md` Lists row may keep the entry path. `docs/SPEC_MAPPING.md` and `app/README.md` may keep the entry path. `docs/ARCHITECTURE_MODULARITY.md` split-candidate row: point it at this plan and say the orchestrator thinning is the `board/` extraction, not a Modules change. `docs/PERSON_DETAIL_REDESIGN.md` orb-picker example: `applyIcon` lives in `useListsIconChrome` after step 9. |
| Files exist | Doc sync only (`.cursor/rules/doc-sync.mdc`), not this step. The Lists README architecture tree names `board/` and the new hooks. Do not hand-edit `docs/tree.txt`. |
| This plan, when the split is done | Mark the top of this file as shipped and name the entry line count. Until then it stays a plan. |

Add one index row to `docs/README.md` for `modular-splits/` when the folder is first introduced: structural split plans, no product change. Do not add a feature-ideas entry.

`components/Lists/README.md` “Plans for Lists chrome” stays as it is. This split is not one of those plans.

## 7. Risks

- **A second store subscription** in a child re-renders a subtree without the parent, or skips the maintenance effect’s `modules` dep. Keep selectors in the orchestrator.
- **`React.memo` or a broken prop** on `lists-main-pane.tsx` drops a display update (search hits, select ticks, gravity epoch). No memo. Pass epochs as numbers, same as today.
- **Two copies of placement or search state** after the create hook and the selection hook both compute `effectiveItemPlacement`. One source.
- **Maintenance publishes a new `folders` or `lists` array** because `sameFolderTree` / `sameListShelf` were inlined wrong or the `mut` object started writing through the live store. The whole idle callback moves as a block.
- **Idle callback identity.** `requestIdleCallback` vs `setTimeout(32)`, cancel on cleanup, `cancelled` flag, `startTransition`. A `useEffect` with a missing dep either reruns every task title edit (vault rewrite) or skips a module list sync.
- **Task index ref** moves but is reset every render, so `buildListsTaskIndex` never reuses the previous object and every keystroke rebuilds list membership. The ref lives inside `useListsShelf` and is updated the way the component updates it today.
- **Caption search reset** moves without the effect that clears query on `openKeyForSearch`. Opening another list would keep the previous filter. That effect moves with the state.
- **Select-band first paint** reports 0 then the real height. Preserve the closed-strip `setSelectBandPx(0)` and the `prev === next` bail so a toggle does not loop.
- **Stamp test** goes red if the inspector moves and the path in `ui-names-stamps.test.ts` does not. That update is allowed. Changing the name or docs string is not.
- **CSS import** dropped during a re-export. Keep it on `enhanced-list-view.tsx`.
- **`onTaskSelect` “cleanup”.** Leaving it unused looks like dead code. It is the public prop. Leave it.
- **Dirty tree.** Session and tracking files are already modified. A broad `git checkout` or a formatter pass on the repo will destroy that work. Touch only the files this plan names.
- **Line-number comments** in READMEs (`~414`, `applyIcon` ~1220). Update the pointer in the same step. Do not leave the old line as if the effect were still there.

Out of scope: changing when maintenance runs, virtualizing new lists, splitting `ListContentPanel`, merging the three task editors, and any edit under `components/Modules/`.
