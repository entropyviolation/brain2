# `components/Lists/` — Lists (File Manager)

The **Lists** top-level tab. A Windows 95/98–styled file manager for folders, lists (categories), and items — the Explorer face of the **second brain**, not a silo. A row here is the same item Scheduler, Tracking, Modules, Reviews, and **Analytics** (the heart) can use. New rows default to generic `item` (or the list’s `itemTypeId`); they are not Tasks unless created as Next Actions. All item data flows through **`lib/task-store.ts`**.

## Public door

Other rooms may import the orchestrator `EnhancedCategoryView` from `enhanced-list-view.tsx`. The shell (`app/page.tsx`) and Mobile (`components/Mobile/MobileApp.tsx`) already do. No hook in `hooks/` is imported outside this folder.

This room writes items and lists through `lib/task-store.ts`, and view prefs through `lib/lists-ui-store.ts`.

`views/`, `dialogs/`, and CSS are interior. Current practice: Inbox (`components/inbox.tsx`) imports `MergeItemsConfirmDialog` and `MergeItemsDialog` from `dialogs/`. The app shell (`app/layout.tsx`) and Operations (`components/Operations/OperationTasksPanel.tsx`) import `filemanager98.css`.

**Visual gold standard.** Lists is the reference for Brain2 look-and-feel: milled
Explorer **frame** (brushed silver toolbars, Display/View mode deck with reserved
LED gutters and container-query short↔full labels, engraved nameplates, CRT title /
status counts — `filemanager98.css`), velvet desktop, photographed orb “trinkets,”
photographed folder cut-outs (assigned like orbs),
and useful motion such as auto-organize. Velvet and orbs are the cabinet; do not
sand them into gray metal.
Text-field focus is navy `#000080` (never WebKit orange), matching `win95.css`
app-wide. Other tabs should match both halves of that tension — never prettier
chrome, never plainer contents. See [`docs/DESIGN_STYLE.md`](../../docs/DESIGN_STYLE.md).

## Architecture

`enhanced-list-view.tsx` (`EnhancedCategoryView`) is the single client **orchestrator** (1,843 lines). It subscribes to the task vault (`tasks`, `lists`, `folders`), item types, goals count, modules, and a wide slice of `lists-ui-store`. Any of those updates re-renders the toolbar, folder tree, open view, inspector, and dialogs that stay mounted. It composes hooks, views, dialogs, and navigation. The `.fm-window` root is `data-ui-name="Lists"` with a one-line `data-ui-help` and `data-ui-docs` pointing here (Names overlay). Dialog roots (`List settings`, `Lists settings`, `Folder settings`, `New list`, `New folder`) and the right-rail **List inspector** / **Sheet fullscreen** overlay carry the same docs path so Names can read them on popups. State logic and UI are split into focused, testable modules:

```
components/Lists/
├── enhanced-list-view.tsx         # Orchestrator — layout, store wiring, dialog mounting
├── MODULE_LISTS.md                # Module Lists import: Tidy/Trip field map, merge, plans
├── LIST_LINKS.md                  # Connected lists: membership links, exclusions, unlink
├── LIST_FOLDERS.md                # List↔folder filing: many folders, Show nested, cycle guard
├── FOLDER_ALL_ITEMS.md            # Folder All Items aggregate + List Settings view prefs
├── SPREADSHEET.md                 # Columns, add-column, keyboard, fullscreen, header chrome, blank sort, width persist
├── CHECKLIST.md                   # Checklist ticks + Next Actions Completed / Missed lists
├── DETAILS.md                     # Details table columns (`List.detailsColumns`)
├── DEFAULT_VIEW.md                # Default reading-row chrome + per-list Default view settings
├── types.ts                       # OpenTarget, GridEntry, CsvImportState, …
├── constants.ts                   # SMART_LISTS, LIST_TEMPLATES, PRESET_ICON_POSITIONS
├── open-target.ts                 # openTargetReducer + openTargetKey helpers
├── lib/icon-utils.tsx             # orbFor, iconFor, folderFor, FolderGlyph, entryIconSrc
├── lib/velvet-icon-grid.ts        # Pack-to-width grid, freeze-on-drag, auto vs freeform, listDisplayCaption
├── lib/lists-location-choice.ts   # Clear search when the user chooses a folder location
├── attributes/
│   ├── helpers.ts                 # value coercion, effectiveDef, mergeListAttributes, formatAttributeValue
│   ├── AttributeSchemaEditor.tsx  # Define a list's attribute schema
│   ├── AttributeSettingsDialog.tsx # One-attribute popup (spreadsheet header; reuses schema editor)
│   ├── AttributeValueField.tsx    # Per-type single-value input
│   └── AttributeValuesEditor.tsx  # Schema-driven + ad-hoc value editors
├── hooks/
│   ├── useListsNavigation.ts      # Location, openTarget reducer, navTo, openEntry; syncs `cogs-navigate-to-list` in place (no remount)
│   ├── useListsSearch.ts          # Search term + reset key + filtered folders/lists/tasks (item hits capped)
│   ├── useListsDragDrop.ts        # Drag-and-drop state and handlers
│   ├── useListsSelection.ts       # Select mode + bulk list selection
│   └── useListsTaskActions.ts     # Task create, complete, missed-opportunity, bulk-add helpers
├── navigation/
│   ├── FolderTree.tsx             # Sidebar: Quick Access (Home / All / Module Lists) + folder tree
│   └── BreadcrumbNav.tsx          # Address bar breadcrumb text
├── views/
│   ├── FolderViewIcons.tsx        # Velvet desktop: JS pack-to-width until a drag; then freeform freeze. Drag offset is a transform; positions are left/top. Under 60 icons, all paint; at 60 or more, a scroll band
│   ├── folder-view-icons-trail.css # Auto-organize: fading cursor/snowflake stamps along the sweep
│   ├── FolderViewIcons.test.tsx   # Drag one icon → siblings stay; auto still packs; reduced-motion skips trail
│   ├── FolderViewList.tsx         # List view for folders
│   ├── FolderContextMenu.tsx      # Folder right-click menu + in-place rename input
│   ├── FolderViewDetails.tsx      # Details table for folders
│   ├── FolderViewCards.tsx        # Classic cards board
│   └── SearchResultsView.tsx      # Global search results; Select mode for merge/move/all
├── list-content/
│   ├── ListContentPanel.tsx       # Wrapper: add-item, bulk-add, display switch
│   ├── AllViewCheckboxFilter.tsx # Folder/global All Items checkbox filter + Select all / Deselect all
│   ├── use-windowed-slice.ts      # Visible-row window for long lists (default, checklist)
│   ├── ListContentDefault.tsx     # Default: reading rows (pip + orb + name + type/meta; honors List.defaultView)
│   ├── ListContentChecklist.tsx   # Checklist with complete checkbox
│   ├── ListContentIcons.tsx       # Per-item icon grid (✎ change icon)
│   ├── ListContentDetails.tsx     # Table/details mode; columns from List.detailsColumns
│   ├── ListContentSpreadsheet.tsx # Spreadsheet grid (wraps SheetGrid + in-app fullscreen)
│   ├── ListContentSpreadsheet.test.tsx # Width persist + centered header chrome
│   ├── SheetFullscreen.tsx        # Win95 maximized child window (`data-ui-name="Sheet fullscreen"`) around the live grid
│   ├── SheetFullscreen.test.tsx   # Fullscreen enter/exit, Esc, one grid, commit on close
│   ├── sheet-fullscreen.ts        # commitFocusedSheetEdit / isEditingField
│   ├── sheet-fullscreen.css       # Near-viewport overlay (not OS fullscreen)
│   ├── sheet-fullscreen.test.ts   # Blur-to-commit helper
│   ├── ListMissedButton.tsx       # Too-late control beside complete
│   ├── kanban-utils.ts            # Pure column helpers for the Modules Kanban view (see kanban.README.md)
│   └── types.ts                   # Shared list-content prop interfaces
├── dialogs/
│   ├── NewListDialog.tsx          # Create list (`data-ui-name="New list"`); optional bulk create lists (one name/line)
│   ├── NewFolderDialog.tsx        # Create folder (`data-ui-name="New folder"`); optional bulk create folders
│   ├── new-dialog-fields.tsx      # Shared New List/Folder chrome: BulkNamesField, ScheduleableSwitch, PlacementModeRadios
│   ├── EditListDialog.tsx         # List settings (~600px): In folders, child lists, connected lists, Duplicate list, Clear/Delete; All Items view-prefs only
│   ├── EditFolderDialog.tsx       # Folder settings: parent/children editor, Duplicate folder, pin/All/scheduler
│   ├── FolderRelationsEditor.tsx  # Folder parent + child folders/lists; faint “auto” on auto-created rows
│   ├── ListChildrenEditor.tsx     # Nested child lists (`parentListId`) in List settings
│   ├── DuplicateSelectionDialog.tsx # Settings only vs settings+contents (select strip + settings)
│   ├── PasteSelectionDialog.tsx   # Cmd/Ctrl+V: Copies vs Same lists / folders
│   ├── MergeConfirmDialog.tsx     # Shared merge confirm copy (items vs lists); wrappers keep stable imports
│   ├── MergeItemsConfirmDialog.tsx # Thin wrapper → MergeConfirmDialog(entityLabel="items")
│   ├── MergeListsConfirmDialog.tsx # Thin wrapper → MergeConfirmDialog(entityLabel="lists")
│   ├── MergeFieldGroup.tsx        # Shared merge radios / keep-all / membership toggles (plans stay in dialogs)
│   ├── MergeItemsDialog.tsx       # Item merge plan UI (ItemMergePlan)
│   ├── MergeListsDialog.tsx       # List merge plan UI (ListMergePlan)
│   ├── ChecklistViewSettings.tsx  # View mode settings host (Default + Checklist + Details + Spreadsheet)
│   ├── DefaultViewSettings.tsx    # Default view mode settings → List.defaultView
│   ├── ColumnPickerPanel.tsx      # Shared searchable column checklist shell (Details + Spreadsheet)
│   ├── DetailsViewSettings.tsx    # Details column picker → List.detailsColumns (not spreadsheet)
│   ├── SpreadsheetViewSettings.tsx # Spreadsheet columns → List.sheetConfig.columnIds
│   ├── InFoldersEditor.tsx        # Searchable folder membership + Show nested (direct vs inherited); faint “auto”
│   ├── ConnectedListsEditor.tsx   # Membership links: pick a list + direction (not nesting)
│   ├── ListRulesEditor.tsx        # Per-list rules + implied actions (logAction / incrementHabit)
│   └── CsvImportDialog.tsx        # Spreadsheet import wizard (CSV/TSV/Excel)
├── toolbar/
│   ├── ListsToolbar.tsx           # Main toolbar — New / View / Organize (no archive buttons)
│   ├── ToolbarSearch.tsx          # Local search field — never overwritten by filter results
│   ├── SelectModeActionChrome.tsx # Shared select strip actions (count, keep/move, merge/delete); dest picker slotted
│   ├── SelectionToolbar.tsx       # Select mode control strip (beside Add to folder; Duplicate selection)
│   ├── ItemSelectionToolbar.tsx   # Item select: merge, move, add to lists
│   └── ViewModeControls.tsx       # Display/View mode deck (LED keys; captions via listDisplayCaption)
├── __tests__/                     # Integration + open-target reducer tests
├── filemanager98.css              # Scoped Lists Explorer skin (`.fm98`): milled fascia frame; velvet/orbs untouched; type floor 10px, reading chrome 11–13px
└── …                              # attribute-editor, settings-dialog, list-picker (+ css), daily-habits-list
```

Related pure helpers in `lib/`:

| File | Purpose |
|------|---------|
| `lib/lists-grid-entries.ts` | `buildGridEntries()` — folder/list grid entries (Map-keyed, no duplicate entries) |
| `lib/folder-tree.ts` | Nested folder sidebar tree (`buildFolderTree` / `flattenFolderTree`), editable-folder guards, scheduled-folder sort |
| `lib/folder-membership.ts` | Direct `Folder.listIds` (a list may be in many folders) + inherited ancestors for **Show nested** |
| `lib/string-utils.ts` | `hashString`, `hashIconSlot` — stable orb/slot indexing |
| `lib/folder-all-items.ts` | Per-folder **All Items** category sync |
| `lib/scheduled-lists-sync.ts` | Next Actions period To Do smart lists, nested scheduled folders, and per-period To do / Done / Undone lists (`To do 8/31-9/6`, `Done 8/31`, `Undone 8/31`) |
| `lib/archive-lists.ts` | Completed / Missed Opportunities real-list membership |
| `lib/checklist-checkbox-vars.ts` | Default Completed-only checklist columns; extra ticks sanitize |
| `lib/details-columns.ts` | Details table column ids (`List.detailsColumns`); catalog shared with spreadsheet, persist is not |
| `lib/default-view-prefs.ts` | Default reading-row chrome: unset = built-in layout; `List.defaultView` custom show/hide + extra meta |
| `lib/list-links.ts` | Connected-list membership (`List.linkedTargetListIds`) — not nesting |
| `lib/lists-duplicate.ts` | Duplicate folder/list plans (settings vs settings+contents), bulk name parse, faint-auto helpers |
| `lib/lists-clipboard.ts` | In-app select-mode clipboard payload + paste (Copies vs Same); keyboard guard (text fields/dialogs only — not checkboxes/radios); visible-surface gate |
| `lib/folder-selection.ts` | Destination folders for select strip (sibling-first when a folder is open) |

`buildListsTaskIndex` in `lib/lists-task-index.ts` returns the previous index object when every per-list array and every smart-list array was reused and the totals and active count still match. A title edit keeps that same index object when the edited task is not a member of those arrays; replacing a listed task returns a new index even though its list ids are unchanged.

### What mounts

Each display mounts a different slice of the open folder or list. **Select All** uses the full data arrays (`openTasks`, `entries`, `searchResults`), not the mounted slice. A hidden desk collapses the Default and Checklist window to the overscan, so a long list under item detail keeps that overscan mounted.

| Display | What mounts |
|---------|-------------|
| Default, Checklist | `useWindowedSlice` — fixed row height, overscan, spacers. Scroll listener is passive. |
| Spreadsheet | `SheetGrid` windows rows and keeps the editing or active row mounted. Filter and sort run on the full task array. |
| Icons (inside a list) | Every task. No window. |
| Details | Every task × every column. No window. |
| Folder Icons | All icons under 60. At 60 or more, a scroll band. Drag offset is a transform; positions are `left` / `top`. |
| Folder List, Folder Details | Every entry. |
| Folder Cards | First 12, then more per frame. Off-screen cards use `content-visibility: auto`. |

## Top-level files (not in subfolders)

| File | Purpose |
|------|---------|
| `attribute-editor.tsx` | Barrel re-exporting the attribute editor suite under `attributes/` (preserves the original import surface) |
| `attributes/helpers.ts` | Value coercion (`asGoal`/`asArray`), `effectiveDef`, `slugId`, `mergeListAttributes`, `formatAttributeValue` |
| `attributes/AttributeSchemaEditor.tsx` | Define a list's attribute schema (add/remove/reorder, per-type options) |
| `attributes/AttributeSettingsDialog.tsx` | One-attribute popup titled **Attribute settings**; spreadsheet column menu reuses `AttributeSchemaEditor` |
| `attributes/AttributeValueField.tsx` | Per-type single-value input (string, boolean, color, datetime, list, item, selection, image, link, goal, number). A picked `image` / `multiimage` file goes to the attachments IndexedDB (`lib/attachments.ts`) and the cell keeps `idb:<id>`; thumbnails resolve it through `useAttachmentSrcList`. It used to keep the whole data URL, which put picture bytes in the Lists vault and filled the origin for every other store. |
| `attributes/AttributeValuesEditor.tsx` | Schema-driven `AttributeValuesEditor` + ad-hoc `AdHocAttributesEditor` |
| `settings-dialog.tsx` | Global Lists settings (`data-ui-name="Lists settings"`): reorder lists, import/export JSON (`NextActionsSettingsDialog`). Dirty order / staged import uses the house unsaved-changes guard. |
| `list-picker.tsx` | Searchable list selector (Inbox **in lists**, item detail, Connected lists, attribute fields). One name per row with folder-colored glyphs; optional selected chips (`showSelectedChips`); optional `suggestedIds` pin a **Recent** strip at the top (Inbox walk). Multi-select rows are a `<label>` + checkbox (not a `<button>` wrapping Checkbox — invalid nested buttons / hydration). Single-select rows stay plain buttons. Whole-row click still toggles. **New list** copies the search text into the name when no list already has that exact name (still editable). `list-picker.css` keeps rows full-width so names never wrap as a chip soup. |
| `daily-habits-list.tsx` | Daily / weekly / monthly / season habit views embedded in Lists (uses `lib/habits-store.ts`). Season Habits is `season-habits`. The sheet waits until that vault has hydrated so a seed grid is not edited and then thrown away. Climb habits log a number vs the derived daily/weekly target; goal and text cells keep the typed draft (`habit-value-field.tsx`). Completing a habit also writes a To-Do Done log. Habits auto-filled from Tracking tags stay in sync here too (`useHabitTrackingSync`), including weekly/monthly Goal / Yes-No habits whose minutes are summed across the period. Daily Settings edits the same **completion to feel accomplished** / **accomplishment bonus** as Home Habits. Weekly/monthly lists show a done count for the current period. Exempt periods leave that fraction (the row reads “exempt”) and stay out of Home’s remaining-habit lists. |

## Navigation model

| Location | Contents |
|----------|----------|
| **Home** | Pinned folders/lists + smart to-do lists + habit shortcuts |
| **All** | Every folder and list |
| **Folder** | Nested subfolders (sidebar tree via `FolderTree` + `lib/folder-tree.ts`), **All Items**, and lists in that folder |

### Folder views (when browsing, not inside a list)

Icons (velvet desktop), List, Details, Cards — persisted in `lib/lists-ui-store.ts`. Implemented in `views/FolderView*.tsx`. Cards that are still revealing lists show the pip scope (`machine-loading.tsx`) beside the count.

### List content displays (when a list is open)

Default, Checklist, Icons, Details (table), and **Spreadsheet** — per-list setting in the UI store. Implemented in `list-content/ListContent*.tsx`, orchestrated by `ListContentPanel.tsx`.

- **Default**: a reading/working list, distinct from Checklist / Details / Icons. Each row is a round status **pip** (a lamp, not a checkbox) + tiny orb + name (strikethrough when done) + type / U·I / date / attribute chips. **No complete checkboxes** and **no `<input type="checkbox">` unless Select mode is on** — that was the “two random ticks” leak (complete/missed boxes on a few completed orbs). Open pips are navy circles; done is gray; missed is rust. Click a row to open it. Inner caption bar reads **Default**, not the list name again. Per-list chrome is optional in List Settings → View mode settings → **Default view mode settings** (`List.defaultView`; unset = this built-in look). Compact density and extra attribute chips are custom-only. See [`DEFAULT_VIEW.md`](DEFAULT_VIEW.md).
- **Icons**: photographed orbs with ✎ to change the picture.
- **Checklist**: the only display whose *point* is complete checkboxes (plus optional Select ticks). Default is **one labeled Completed column**. Extra ticks (Missed opportunity) are opt-in in List Settings → View mode settings → Checklist view mode settings (`List.checklistCheckboxVars`). Ticking Completed opens the same reflection dialog as any other completion; Undo / dismiss leave the item incomplete. See [`CHECKLIST.md`](CHECKLIST.md).
- **Details**: table of items with Name plus chosen columns — for scanning detail factors, opening an item, Select-mode selection, and sorting by those columns. **No complete or missed ticks** (those live only in Checklist). List Settings → View mode settings → Details view mode settings persists `List.detailsColumns` (on-this-list first, searchable; built-ins available). Independent of Spreadsheet `sheetConfig.columnIds`. Unset = current Details columns. See [`DETAILS.md`](DETAILS.md).
- **Select mode**: overlays selection checkboxes on whichever display you are in, including Default. The same **Select** button works on **toolbar search results**: tick any single **folder**, **list**, or **item** hit, or multi-select several **items** (e.g. duplicates) and **Merge items**; **Merge lists** when 2+ lists are ticked; **Select All** takes the full hit set; keep/move + searchable **Add to folder** / **Add to lists** are the same toolbars as normal select. From search, **Move to destination** is on for items (drops other real-list memberships), lists (leaves other folders), and folders (reparents). **Merge replaces** (search hits and open-list Select share one write path — `handleApplyItemMerge` / `handleApplyMerge`): one survivor keeps the **union of every attribute** the originals carried (tags, lists, custom `attributes`, per-item definitions, links, subtasks, deps, body / notes / why when Keep all details, built-in priority / date / context / type fields, time logs, schedule placements, …). Differing text attributes append (survivor first). Differing numbers stay numbers and take the max. One live schedule period remains (day, else week, else month, else year — survivor first); any other period is kept on `schedulePlacements`. Links and dependencies that only pointed at a merged sibling are dropped. Discarded ids are removed and stamped into `removedTaskIds` / `removedListIds` so vault hub union cannot resurrect originals beside the survivor (`lib/item-merge.ts`, `lib/list-merge.ts`, `task-store.setTasks` / `setLists` tombstone opts). Dialog radios pick the title and the lists. With Keep all details on, every note and why is kept and the selected line is placed first. With it off, those radios are exclusive, including None. A later search reads the live store and must not show discarded rows.
- **Select mode control strip** (`SelectionToolbar`, `data-ui-name="Select mode control strip"`): when list/folder select is on, **one horizontal band** under the address bar — searchable **Add to folder** chip bay on the left, selection actions on the right (count, Select All / Deselect All, Keep vs Move, Add to New Folder, Merge lists, **Duplicate selection**, Delete selected). Destinations use `destinationFoldersForSelection`: when a real folder is open (or a list inside it), **sibling folders first** (same `parentFolderId` as the viewed folder), then the rest in their prior order. All / Home / search keep the existing order. Bay search filters that already-ordered list. The file manager’s height is `calc(100vh - 150px)` (floor 560px). That band is measured and added to the window, so `.fm-split` (folder tree + content) stays the same height as with select mode off. **Cancel Select** stays on the top toolbar. Item select still uses `ItemSelectionToolbar` (separate strip for open-list / search items); that strip grows the window the same way.
- **Copy / paste selection** (Cmd/Ctrl+C / V while the Lists file manager is the visible desk surface — not a warm hidden tab — and focus is not in a text field, rename input, search box, or dialog): with select mode and a non-empty list/folder selection, **Copy** stores an in-app clipboard. Select-mode checkboxes and Keep/Move radios do **not** block the shortcut (native copy/paste stays for real text entry only). After navigating, **Paste** opens `PasteSelectionDialog` **before any write** — **Copies** (settings+contents duplicates via `lib/lists-duplicate.ts`, filed/parented into the folder being viewed) or **Same lists / folders** (lists gain multi-folder membership in the destination; folders keep a single `parentFolderId` and are not reparented). Same is disabled when there is no real destination folder or the clipboard has no lists. Empty clipboard / empty selection are no-ops.
- **Folder context menu**: right-click a folder icon (Icons) or folder row (List) for a small milled menu — **Open**, **Rename** (when `isEditableFolder`), **Folder settings**. Rename edits the caption/row name in place (Enter / blur commit; Escape / empty cancel). Auto period folders get Open only.
- **Spreadsheet**: editable Google-Sheets-style grid of items × columns from the attribute catalog (on-this-list attrs + built-ins + vault). Per-list `List.sheetConfig` (column ids, sort, filter, freeze, widths). Filter text stays in the grid and is written to `sheetConfig` on blur and a short idle, so a keystroke does not save the list. **Unset `columnIds` defaults to list schema / `displayedAttributes` only** (Name-only when the schema is empty — e.g. All Items) so huge lists stay calm; held-only attributes and built-ins are opt-in via Spreadsheet view mode settings, header Hide, or Add column. Add column (`+` pinned on the grid viewport) suggests associated attrs, then vault, or create + assign-to-all. Header ⋮: Sort, **Attribute settings** (existing schema editor for that attr id), insert / move, **Hide column**. Hide writes `sheetConfig.columnIds` — the same list as Spreadsheet view mode settings (unchecked there; not a global delete). Item name disables Attribute settings (not a custom attribute). Keyboard: arrows / Tab / Enter / type-to-replace / Escape. **□ Fullscreen** lifts the same live grid into a near-viewport Win95 child window (Esc / restore / close; commits in-progress edits). Default is in-pane. Headers are **centered** with roomy padding and a reserved sort-caret slot. Blanks (`empty` / `—`) always sort **last**. Widths persist at `sheetConfig.columnWidths` and are capped so columns cannot stretch over neighbors. See [`SPREADSHEET.md`](SPREADSHEET.md).

## Key features

- **Send to Scheduler**: off unless turned on (`scheduleable: true`). List Settings → **Send to Scheduler** puts every item on that list in the Scheduler, the tool that sorts to-do lists into year, month, week, and day. A list can be scheduled — a trip itinerary with dates — without being sent there. New lists and new folders start off; a folder's switch only changes the default for lists created in the New List dialog (and the list picker) inside it. A list created by `list: item` — Quick Add, Bulk Add, or the Telegram bot — stays off even in a folder that is sent. Turn **Send to Scheduler** on in List Settings to include it. An item filed onto a list that is already sent still follows that list. A task, a next action, and a list of tasks are not sent just for being those. Next Actions to-do lists are created off. The `eventually` list is the one created on, so a Scheduler drop can hold items with no period. Lists a person already sent stay on (persist v14 turns folder defaults off and does not clear those lists). Persist v15 turns the flag off on module-created lists.
- **Smart lists**: Daily / Weekly / Monthly / **Season To Do** — live views over `task-store` scheduling (same data as Home To Do). Season (`smart-quarterly`) is tasks whose day, week, or month touches the current quarter. Adding into Monthly, and the monthly bucket itself, use the local month (`formatLocalMonthKey`). Next Actions also auto-creates **Completed** and **Missed Opportunities** (`na-smart-completed` / `na-smart-missed`) as **real lists** in that folder (membership on `Task.lists`, not a toolbar filter). Completing files the item on Completed; **Missed opportunity** files it on Missed Opportunities instead. Manual remove stays off (`listMembershipExclusions`). See [`CHECKLIST.md`](CHECKLIST.md).
- **Period lists**: under Scheduled, each year / month / week / day that has work (or that you opened) gets three views, not membership lists. **To do** is what is scheduled for that period now (`To do 8/31`, `To do 8/31-9/6`, `To do September 2026`). **Done** is what was completed during it (`Done 8/31`). **Undone**, only once the period has ended, is what was assigned then and still incomplete when the next period started (`Undone 8/31`). A past period's To do list does not repeat those Undone rows. The three sets match Home → To Do. Adding a row on any of them schedules it on that period, so it shows on To do until it is finished. Scheduler card detail and Home → To Do **Open list** open the To do list, on the file manager's List view. A week folder stays under the month of its Monday (the week of Aug 31–Sep 6 lives in August), so a day in the next month does not move that week on the next sync. In **global All** only, the status bar checkbox **Show to do / done / undone** (default on, persisted with Smart lists in `lists-ui-store`) hides those period ledger lists (`isPeriodLedgerListId`) — ordinary lists whose names happen to contain those words stay visible.
- **All Items per folder**: Auto-managed category (`__all-items__{folderId}`). Shows union of all folder items; add here for uncategorized folder membership. List checkboxes in the right inspector filter which lists are shown; **Select all** / **Deselect all** mass-toggle those checkboxes plus **Uncategorized**. **Show uncategorized only** at the top of the list overrides those filters until unchecked. **List Settings** in that inspector edits view modes on the backing All Items record (Default / Checklist / Details / Spreadsheet). Delete, Clear, In folders, and Connected lists are omitted so the folder and child lists stay safe. **Home / global All** (Quick Access All) uses the same inspector, backing id `__all-items__root`, and folder-inclusion checkboxes in that panel (not a floating column). See [`FOLDER_ALL_ITEMS.md`](FOLDER_ALL_ITEMS.md).
- **Drag-and-drop**: Tasks onto lists; lists onto folders; tasks onto folder sidebar → uncategorized in that folder. Logic in `hooks/useListsDragDrop.ts`.
- **Nested folders**: Sidebar renders a collapsible tree (`navigation/FolderTree.tsx`); rename/recolor/delete via `EditFolderDialog` for non-auto scheduled folders (`isEditableFolder`). Quick Access is Explorer-shaped but readable: 13px labels, 24px hit rows, navy section heads, antialiased type (the rest of `.fm98` stays unsmoothed). Home / All / Module Lists stay pinned above Folders; gear still appears on the selected folder; **+ New Folder** still sits under the tree. Left-nav rows are **icon + name only** (no colored square swatch beside the folder photo).
- **Folder settings**: `EditFolderDialog` edits name/color/icon/scheduler/Home/All, plus **Parent and children** (`FolderRelationsEditor`: one `parentFolderId`, child folders, lists in `listIds`). Auto-created folders/lists (module / scheduled / All Items) show a faint **auto** label. **Duplicate folder** opens the same scope dialog as the select strip.
- **List settings**: keeps **In folders** (parents, including inherited via Show nested) and adds **Child lists** (`ListChildrenEditor` / `parentListId`). Faint **auto** on auto-created membership rows. **Duplicate list** uses the same scope dialog. Under the title, the list id is a small gray line with **Copy** (`data-testid="list-id-line"`). It is not a banner. **Sent this week** is off unless turned on (`List.sentThisWeek`; missing means off). On, each item’s detail gets a **Sent** control. Sent is not delete and not complete. Sent items hide in that list until a quiet **Show sent**. At the next week, items marked sent in a previous week leave this list only; the item stays in the vault, and unsent items stay on the list. The weekly habit “respond to all missing texts” reads **texts I need to send** (`1791346611510`) this way — see Habits README.
- **Duplicate** (`lib/lists-duplicate.ts`): **Settings only** → new empty folder/list with disambiguated name (`Name copy`), same settings, no `createdByModuleId`, filed in the same parent context. **Settings and contents** → also new nested folders/lists/items (new ids; items get only the new list membership; inter-item links/deps are dropped so originals are not aliased). Entry points: select mode control strip **Duplicate selection**, Folder settings, List settings. Mixed folder+list selection gets one clear choice for both.
- **Bulk create**: optional checkbox inside **New Folder** / **New List** (not a separate toolbar path). One name per line; trim; skip blanks; create in the current parent. Single-create remains the default.
- **In folders**: A list may live in many folders (`Folder.listIds`). List Settings → **In folders** (`InFoldersEditor`) is a searchable multiselect with chips, **Show nested** (inherited ancestor chips are dimmed and not removable), + New folder, and a cycle guard. See [`LIST_FOLDERS.md`](LIST_FOLDERS.md). List Settings is ~600px wide so pickers and radios have room.
- **Attributes**: Per-list schema (number, string, selection, goal, etc.); reorderable in list settings (`EditListDialog.tsx`).
- **Detail view overlays**: Extra `detailPanels` (additive) and `hiddenDetailPanels` so a list can add or hide tabs on top of the item type. Implied-action rules (`ListRulesEditor`) can log Done items or increment habits when an attribute changes.
- **Next Actions points**: Completing a task in the Next Actions folder awards **1 point** by default, or the list's **Points** number attribute if defined. The header **today's friend** also picks from this whole open set when the worn friend leans Next Actions (`lib/friend-suggestion.ts`), not only Home → To Do's day slice. Habit-leaning friends prefer unmet daily habits instead. **Later:** listBias UI, clock, **trinket or point rewards** — [`docs/FRIEND_COMPANION.md`](../../docs/FRIEND_COMPANION.md).
- **Orb gallery**: 1000+ orbs from `lib/orbs-manifest.ts`; edit mode to hide orbs; custom upload with background removal (`components/Icons/OrbPicker.tsx`).
- **Folder photographs**: Folders (Icons, List, Cards, search, sidebar tree, folder settings, In folders) use cut-out photos from `public/folders-removebackground/` (`folderFor`, same stable hash as orbs). A custom folder icon still wins. The left folder tree no longer shows a color square beside the photo (color remains on folder settings / other chrome). Source plates live in `folders/`; `python3 scripts/process-folders.py` refreshes the cut-outs.
- **Icon layout**: One layout system — absolute JS positions, never a CSS `auto-fill` grid fighting them. A folder that has **never been dragged** (`iconLayoutMode: auto`, or no saved coords) **packs to the live canvas width** — `cols = floor((W − pad) / cell)` (`112×118` cells, `lib/velvet-icon-grid.ts`). Resize may re-flow only while auto. The **first real drag** freezes every icon at its current slot, sets `freeform`, and moves **only** that icon: siblings do not crunch, slide, or reflow during drag or after drop, and a single drag does not invent an empty right-hand column. **Auto-organize** is an explicit button: it writes the same pack and sets mode back to `auto`. While icons sweep, a short canvas trail of classic pixel cursors and snowflake pads fades behind them (`folder-view-icons-trail.css`); final grid slots, drag behavior, and which icons exist are unchanged. `prefers-reduced-motion: reduce` skips the trail and still organizes. A 1px drag that happens to land on a lattice cell still stays freeform because the store flag wins over lattice detection.
- **Toolbar**: Two brushed bays. Top: **New** (list/folder/import), Settings, Select, Search. Bottom: the **View / Display** mode deck alone (Icons/List/Details/Cards or Default/Checklist/Icons/Details/Spreadsheet) so keys always own a full row — reserved LED gutter, container-query short codes when narrow, equal-fill full words when wide. Archive browsing is the Completed / Missed Opportunities lists under Next Actions — those toolbar buttons are gone.
- **Status bar**: two counts, labeled. Left is **This folder** (open location); right is **Tree** (all folders and lists). Do not drop one as a duplicate. Type is 12px so the counts stay readable. **Smart lists** sits beside the counts; in global All, **Show to do / done / undone** sits next to it.
- **Inspector** (`data-ui-name="List inspector"`): facts first (count, type, last touched — 12px), then actions. **Delete List lives only in List Settings** (red **Delete** in **Dangerous actions**, beside **Clear list**). The right rail does not offer Delete. Folder **All Items** and Home **All** still get **List Settings** for view prefs; those dialogs have no Delete / Clear. Inclusion checkboxes (lists in a folder All, folders in Home All) live on this rail.
- **Clear list**: List Settings → Dangerous actions → **Clear list** → Win95 **Are you sure?** confirm. Confirm empties membership on this list (`removeTaskFromList` via `updateTask`, so connected-list exclusions stick). Items are not deleted; other lists keep them; the empty list remains. Cancel is a no-op.
- **Type scale**: smallest Lists type is 10px (title glyphs, tree ±, orb badges, toolbar `.fm-btn-sm` left alone). Reading chrome is 11–13px: Default names / inspector facts / status 12px; U·I meta and inspector buttons 11px; Quick Access labels stay 13px.
- **Toolbar search**: The field owns keystrokes (`ToolbarSearch`) and filters through `useListsSearch` (folders, lists, and items; item hits capped). Parent filter state is updated from the field, never written back into it (that write-back is what skipped letters). Clear / opening a hit bumps `searchResetKey` to wipe the field. The toolbar vault scan is deferred with `useDeferredValue` the same way Folder List view defers its local search, so hits may follow the field by a frame. **Choosing a location** (Quick Access, folder tree, Up, opening a folder icon) calls `chooseListsLocation` so search clears and the folder's real contents show — you are not trapped in the previous query. Typing still searches; only a location choice clears. Select mode on the results panel is described under **Select mode** above. The **select mode control strip**’s Add to folder bay has its own folder search (empty = all destinations; no-match empty state; scroll when many).

## Open-target state machine

List/folder/habit/smart views are opened via a reducer in `open-target.ts`:

| Action | Result |
|--------|--------|
| `OPEN_CATEGORY` | Open a list by id |
| `OPEN_SMART` | Open Daily/Weekly/Monthly smart list |
| `OPEN_HABITS` | Open habit shortcut |
| `OPEN_FOLDER_ALL` | Open folder All Items view |
| `CLOSE` | Return to folder browser |

Managed by `useListsNavigation`; auto-closes if the underlying category is deleted.
External jumps (item detail list chip, global search, Analytics) call
`applyListsNavigation` / `requestNavigateToList`, which persist state and fire
`cogs-navigate-to-list`. The hook applies `location` / `openTarget` in place — the
app shell no longer remounts `EnhancedCategoryView` via a nav key.

## Stores

| Store | Role |
|-------|------|
| `task-store` | Tasks, categories, folders |
| `lists-ui-store` | Home pins, folder view, icon positions, per-location `iconLayoutMode` (`auto` / `freeform`), hidden orbs, uncategorized filter |
| `habits-store` | Habits lists (`daily-habits-list.tsx`) |
| `folder-all-items` helpers | `lib/folder-all-items.ts` — All Items category sync; view prefs on the backing list, including Home All `__all-items__root` ([`FOLDER_ALL_ITEMS.md`](FOLDER_ALL_ITEMS.md)) |

## Tests

| Location | Coverage |
|----------|----------|
| `hooks/__tests__/` | `useListsNavigation`, `useListsSearch`, `useListsSelection` |
| `toolbar/ToolbarSearch.test.tsx` | Typed text is not clobbered; resetKey clears |
| `navigation/__tests__/` | `FolderTree` |
| `dialogs/__tests__/` | `OrbPickerDialog` |
| `dialogs/InFoldersEditor.test.tsx` | Add/remove folders, Show nested (direct vs inherited), cycle guard, + New folder |
| `dialogs/EditListDialog.test.tsx` | Wider shell (~600px), In folders section, Save still writes name/color; Clear list confirm cancel / yes empties membership; folder All Items and Home All omit Delete / Clear / filing / links |
| `dialogs/ConnectedListsEditor.test.tsx` | Connect A→B, mirror on B, unlink without mass-delete; searchable row picker + selected chip |
| `list-picker.test.tsx` | Rows, search, single/multi select, excludeIds, selected chips, Enter picks first hit, New list seeds from a search that names no list; multi checkbox is not nested in a button; row label click toggles |
| `__tests__/open-target.test.ts` | Reducer transitions |
| `list-content/ListContentPanel.test.tsx` | Default reading rows; no item checkboxes unless selectMode (mixed completed+open); checklist keeps labeled Completed; All Items filters live in the inspector, not the item pane; select mode |
| `list-content/ListContentDefault.test.tsx` | Unset = current chrome; custom hide type/date; Select ticks; no complete checkboxes |
| `list-content/ListContentChecklist.test.tsx` | Default = one Completed column; extra missed column only when configured |
| `dialogs/ChecklistViewSettings.test.tsx` | View mode settings host includes Default + checklist extra ticks |
| `dialogs/DefaultViewSettings.test.tsx` | Use default layout vs custom; hide type/date; extra attributes searchable / on-this-list first |
| `dialogs/DetailsViewSettings.test.tsx` | Details picker lists attrs; persist `detailsColumns` only; spreadsheet selection unchanged |
| `list-content/ListContentDetails.test.tsx` | Default schema columns; persisted order including built-ins; empty = Name only; no complete/missed ticks; Select checkboxes only when selectMode |
| `list-content/ListContentSpreadsheet.test.tsx` | Persist `sheetConfig.columnWidths` per list; header chrome |
| `list-content/SheetFullscreen.test.tsx` | Fullscreen enter/exit; Esc; one live grid; commit on close |
| `list-content/sheet-fullscreen.test.ts` | `commitFocusedSheetEdit` blurs a focused field |
| `toolbar/ListsToolbar.test.tsx` | Completed / Missed Opportunities buttons gone; New / Settings / Select remain |
| `toolbar/SelectionToolbar.test.tsx` | Select mode control strip beside Add to folder; Duplicate selection; folder search filters |
| `lib/lists-duplicate.test.ts` | Bulk name parse; copy naming; settings vs settings+contents plans |
| `lib/lists-clipboard.test.ts` | Clipboard payload filter; Same vs Copies paste; keyboard guard (checkbox/radio allowed); surface-active gate |
| `lib/folder-selection.test.ts` | Destination exclusions + sibling-first order |
| `views/SearchResultsView.test.tsx` | Select mode toggles folders/lists/items instead of navigating |
| `lib/velvet-icon-grid.test.ts` | Column count = floor((W−pad)/C); LTR fill; freeze moves one key; freeform does not re-pack siblings; auto still packs; sparse drag is not auto |
| `views/FolderViewIcons.test.tsx` | Drag one icon → sibling `left`/`top` unchanged; canvas stays freeform (not CSS flow); default pack fills width; reduced-motion skips organize trail canvas; motion mounts trail without changing packed coords |
| `views/FolderViewList.test.tsx` | Search pin; select mode; folder context rename |
| `lib/lists-location-choice.test.ts` | Search clears before folder navigation |
| `__tests__/enhanced-list-view.integration.test.tsx` | Open list, search, Quick Access clears search, quick-add, complete; Default reading rows + inner caption + inspector facts (no sidebar Delete); List Settings has Clear list + Delete; folder All Items List Settings persists view prefs without delete; item/list merge stamps tombstones (in-list and **search-result** Select) |
| `enhanced-list-view.test.tsx` | Smoke tests (title bar, search, settings); search-clear on Quick Access / folder tree; status This folder / Tree labels; toolbar separators |
| `e2e/lists.spec.ts` | Playwright critical paths (`npm run test:e2e`) |
| `e2e/item-types-detail.spec.ts` | Furniture/Book detail (no Schedule tab) + pages-read implied action |

Also: `lib/string-utils.test.ts` for hash helpers used by icon layout and orb selection.

Run unit/integration tests: `npm test`. E2E requires dev server (started automatically by `playwright.config.ts`).

## Plans for Lists chrome

- Clickable Address crumbs (and an Address / Search tab pair like Explorer) so the sunken path is a control, not only a label.
- Snap-to-grid while dragging with Shift, matching the packed cell size (freeform stays the default after a drag; snap is opt-in).
- A pip click that does **not** become a hidden complete checkbox (status lamp stays a lamp). See [`DEFAULT_VIEW.md`](DEFAULT_VIEW.md).
- More checklist checkbox variables (cancelled, deferred) if a list wants them — [`CHECKLIST.md`](CHECKLIST.md).
- Quick Access pins beyond Home / All / Module Lists (user-chosen folders) without growing the sidebar into a second tree.
- Badge in the folder tree when a list is filed in more than one folder (see [`LIST_FOLDERS.md`](LIST_FOLDERS.md)).

## Related sync

`lib/scheduled-lists-sync.ts` keeps Next Actions period To Do smart lists, the Scheduled folder hierarchy, and each period's To do, Done, and Undone lists in sync. `lib/archive-lists.ts` keeps **Completed** / **Missed Opportunities** membership on `Task.lists`. Details: [`CHECKLIST.md`](CHECKLIST.md).

Header **From Notes** can auto-create folder **Mac Notes** and list **notes to ingest** (`lib/apple-notes.ts` `ensureIphoneNotesIngestDestination`) when a note is parked for later bulk-add. Parked items store the full note body. Listing talks to Notes.app on this Mac (Electron IPC or localhost `/api/notes`), walking folders instead of one library-wide query. The ingest dialog can be closed while that first listing is still running; reopen **From Notes** to return to the same session.

<!-- MODULE LISTS IMPORT (data lane — merge-friendly; UI workers: do not rewrite this block) -->

## Module Lists import

Tidy chores, Trip days, and other module-created lists file under **Module Lists /
{Module} Lists**. Tidy areas become nested lists under **Whole house** with full
priority / estimate / actual / completed / subtask fields. Details, field map,
merge rules, and future plans: [`MODULE_LISTS.md`](MODULE_LISTS.md).

<!-- /MODULE LISTS IMPORT -->

<!-- LIST LINKS (settings lane — merge-friendly; icon/display workers: do not rewrite this block) -->

## Connected lists

Two lists can share **membership** without one being a child of the other
(`List.linkedTargetListIds`, not `parentListId`). In **List Settings**,
**Connected lists** uses the shared searchable `ListPicker` (same as item **in
lists** — rows, search, selected chip) plus a direction. Full model
(directions, exclusions, unlink, future plans): [`LIST_LINKS.md`](LIST_LINKS.md).

<!-- /LIST LINKS -->
