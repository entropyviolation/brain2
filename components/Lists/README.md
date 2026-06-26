# `components/Lists/` — Lists (File Manager)

The **Lists** top-level tab. A Windows 95/98–styled file manager for folders, lists (categories), and items (tasks). All item data flows through **`lib/task-store.ts`**.

## Architecture

`enhanced-category-view.tsx` is a thin **orchestrator** (~650 lines) that composes hooks, views, dialogs, and navigation. State logic and UI are split into focused, testable modules:

```
components/Lists/
├── enhanced-category-view.tsx     # Orchestrator — layout, store wiring, dialog mounting
├── types.ts                       # OpenTarget, GridEntry, CsvImportState, …
├── constants.ts                   # SMART_LISTS, LIST_TEMPLATES, PRESET_ICON_POSITIONS
├── open-target.ts                 # openTargetReducer + openTargetKey helpers
├── lib/icon-utils.tsx             # orbFor, iconFor, FolderGlyph
├── attributes/
│   ├── helpers.ts                 # value coercion, effectiveDef, mergeListAttributes, formatAttributeValue
│   ├── AttributeSchemaEditor.tsx  # Define a list's attribute schema
│   ├── AttributeValueField.tsx    # Per-type single-value input
│   └── AttributeValuesEditor.tsx  # Schema-driven + ad-hoc value editors
├── hooks/
│   ├── useListsNavigation.ts      # Location, openTarget reducer, navTo, openEntry
│   ├── useListsSearch.ts          # Search term + filtered folders/lists/tasks
│   ├── useListsDragDrop.ts        # Drag-and-drop state and handlers
│   ├── useListsSelection.ts       # Select mode + bulk list selection
│   └── useListsTaskActions.ts     # Task create, complete, bulk-add helpers
├── navigation/
│   ├── FolderTree.tsx             # Sidebar: Home, All, folder tree
│   └── BreadcrumbNav.tsx          # Address bar breadcrumb text
├── views/
│   ├── FolderViewIcons.tsx        # Velvet desktop icon grid (freeform layout)
│   ├── FolderViewList.tsx         # List view for folders
│   ├── FolderViewDetails.tsx      # Details table for folders
│   ├── FolderViewCards.tsx        # Classic cards board
│   └── SearchResultsView.tsx      # Global search results panel
├── list-content/
│   ├── ListContentPanel.tsx       # Wrapper: quick-add, bulk-add, display switch
│   ├── ListContentDefault.tsx     # Default list rows
│   ├── ListContentChecklist.tsx   # Checklist with complete checkbox
│   ├── ListContentIcons.tsx       # Per-item icon grid
│   ├── ListContentDetails.tsx     # Table/details mode with attributes
│   ├── ListContentKanban.tsx      # Kanban board grouped by a status attribute
│   ├── ListContentSpreadsheet.tsx # Spreadsheet grid (wraps components/spreadsheet/SheetGrid)
│   ├── kanban-utils.ts            # Pure column derivation + value-write helpers (see kanban.README.md)
│   └── types.ts                   # Shared list-content prop interfaces
├── dialogs/
│   ├── NewListDialog.tsx          # Create list
│   ├── NewFolderDialog.tsx        # Create folder
│   ├── EditListDialog.tsx         # List settings (attributes, display, pin)
│   ├── EditFolderDialog.tsx       # Folder settings
│   ├── CsvImportDialog.tsx        # CSV import wizard
│   ├── OrbPickerDialog.tsx        # Orb gallery + upload + search
│   └── CompletedTasksDialog.tsx   # Completed tasks browser
├── toolbar/
│   ├── ListsToolbar.tsx           # Main toolbar (search, actions, view toggles)
│   └── ViewModeControls.tsx       # Folder view / list display mode buttons
├── __tests__/                     # Integration + open-target reducer tests
├── filemanager98.css              # Scoped Win98 skin (`.fm98` root)
└── …                              # attribute-editor, settings-dialog, list-picker, daily-habits-list
```

Related pure helpers in `lib/`:

| File | Purpose |
|------|---------|
| `lib/lists-grid-entries.ts` | `buildGridEntries()` — folder/list grid entries (Map-keyed, no duplicate entries) |
| `lib/string-utils.ts` | `hashString`, `hashIconSlot` — stable orb/slot indexing |
| `lib/folder-all-items.ts` | Per-folder **All Items** category sync |
| `lib/scheduled-lists-sync.ts` | Next Actions smart lists + scheduled folder hierarchy |

## Top-level files (not in subfolders)

| File | Purpose |
|------|---------|
| `attribute-editor.tsx` | Barrel re-exporting the attribute editor suite under `attributes/` (preserves the original import surface) |
| `attributes/helpers.ts` | Value coercion (`asGoal`/`asArray`), `effectiveDef`, `slugId`, `mergeListAttributes`, `formatAttributeValue` |
| `attributes/AttributeSchemaEditor.tsx` | Define a list's attribute schema (add/remove/reorder, per-type options) |
| `attributes/AttributeValueField.tsx` | Per-type single-value input (string, boolean, color, datetime, list, item, selection, image, link, goal, number) |
| `attributes/AttributeValuesEditor.tsx` | Schema-driven `AttributeValuesEditor` + ad-hoc `AdHocAttributesEditor` |
| `settings-dialog.tsx` | Global Lists settings: reorder lists, import/export JSON (`NextActionsSettingsDialog`) |
| `list-picker.tsx` | Folder-aware list selector (Inbox clarification, attribute fields) |
| `daily-habits-list.tsx` | Daily / weekly / monthly habit views embedded in Lists (uses `lib/habits-store.ts`) |

## Navigation model

| Location | Contents |
|----------|----------|
| **Home** | Pinned folders/lists + smart to-do lists + habit shortcuts |
| **All** | Every folder and list |
| **Folder** | Subfolders, **All Items**, and lists in that folder |

### Folder views (when browsing, not inside a list)

Icons (velvet desktop), List, Details, Cards — persisted in `lib/lists-ui-store.ts`. Implemented in `views/FolderView*.tsx`.

### List content displays (when a list is open)

Default, Checklist, Icons, Details (table), **Kanban**, and **Spreadsheet** — per-list setting in the UI store. Implemented in `list-content/ListContent*.tsx`, orchestrated by `ListContentPanel.tsx`.

- **Kanban**: board grouped by a chosen selection/status attribute; drag cards or use ◀ ▶ to move between columns (writes the attribute value back). Pure column logic in `kanban-utils.ts`; details in `list-content/kanban.README.md`.
- **Spreadsheet**: editable Google-Sheets-style grid of items × attribute columns, reusing `components/spreadsheet/SheetGrid` (inline editing, A1 headers + row gutter, drag/shift-click range selection with a Sum/Avg/Min/Max/Count bar, per-cell `=A1` formulas + fill handle, row/column resize, column totals, add-row/column).

## Key features

- **Smart lists**: Daily / Weekly / Monthly To Do — live views over `task-store` scheduling (same data as Home To Do).
- **All Items per folder**: Auto-managed category (`__all-items__{folderId}`). Shows union of all folder items; add here for uncategorized folder membership. Toggle **Show uncategorized only** to filter.
- **Drag-and-drop**: Tasks onto lists; lists onto folders; tasks onto folder sidebar → uncategorized in that folder. Logic in `hooks/useListsDragDrop.ts`.
- **Attributes**: Per-list schema (number, string, selection, goal, etc.); reorderable in list settings (`EditListDialog.tsx`).
- **Next Actions points**: Completing a task in the Next Actions folder awards **1 point** by default, or the list's **Points** number attribute if defined.
- **Orb gallery**: 1000+ orbs from `lib/orbs-manifest.ts`; edit mode to hide orbs; custom upload with background removal (`OrbPickerDialog.tsx`).
- **Icon layout**: Freeform positions per location; auto-organize grid (`FolderViewIcons.tsx` + `lists-ui-store`).

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

## Stores

| Store | Role |
|-------|------|
| `task-store` | Tasks, categories, folders |
| `lists-ui-store` | Home pins, folder view, icon positions, hidden orbs, uncategorized filter |
| `habits-store` | Habits lists (`daily-habits-list.tsx`) |
| `folder-all-items` helpers | `lib/folder-all-items.ts` — All Items category sync |

## Tests

| Location | Coverage |
|----------|----------|
| `hooks/__tests__/` | `useListsNavigation`, `useListsSearch`, `useListsSelection` |
| `navigation/__tests__/` | `FolderTree` |
| `dialogs/__tests__/` | `OrbPickerDialog` |
| `__tests__/open-target.test.ts` | Reducer transitions |
| `__tests__/enhanced-category-view.integration.test.tsx` | Open list, search, quick-add, complete |
| `enhanced-category-view.test.tsx` | Smoke tests (title bar, search, settings) |
| `e2e/lists.spec.ts` | Playwright critical paths (`npm run test:e2e`) |

Also: `lib/string-utils.test.ts` for hash helpers used by icon layout and orb selection.

Run unit/integration tests: `npm test`. E2E requires dev server (started automatically by `playwright.config.ts`).

## Related sync

`lib/scheduled-lists-sync.ts` keeps Next Actions smart lists and scheduled-folder hierarchy in sync with tasks.
