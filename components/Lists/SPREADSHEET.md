# Spreadsheet display

Lists **Spreadsheet** is the Google-Sheets-style grid of a list’s items
(`components/spreadsheet/SheetGrid`, wrapped by
`list-content/ListContentSpreadsheet.tsx`). Per-list layout lives on
**`List.sheetConfig`**.

Column catalog, Add column, and Sheets keyboard are owned with the attribute
column work. In-app **□ Fullscreen** is a sibling Win95 child window around the
same live grid (not OS fullscreen, not `/popout/?sheet=`). This note also
covers **header chrome**, **blank sort**, and **persisted column widths**.

## Columns and Add column

Visible extra columns are `sheetConfig.columnIds` (name is always first).
Unset = on-this-list default from `lib/spreadsheet-catalog.ts` (held attributes
+ default built-ins). List Settings → View mode settings → Spreadsheet view
mode settings (`SpreadsheetViewSettings`) is the picker: on-this-list first,
searchable, vault attrs and built-ins available. Unchecking hides the column
on this list only — it does not destroy the attribute. Folder **All Items**
persists `sheetConfig` on `__all-items__{folderId}`; Home All uses
`__all-items__root` ([`FOLDER_ALL_ITEMS.md`](FOLDER_ALL_ITEMS.md)).

**Add column** (`+` pinned to the top-right of the grid viewport, outside the
table so a wide frozen Name column cannot intercept the click) suggests
associated attributes, then vault, or create a new attribute and assign it to
every item on the list. Column widths are capped (`max-width` = the stored
width; `table-layout: fixed`) so Name cannot balloon across the sheet.

## Header menu

Each extra column’s ⋮ menu (and the name column’s menu):

| Item | Behavior |
|------|----------|
| **Sort** | Same as clicking the header (A→Z). |
| **Attribute settings** | Opens the existing List Settings schema editor (`AttributeSettingsDialog` → `AttributeSchemaEditor`) for **that column’s attribute id**. Custom attributes, tidy mapped fields (`actualSec` / Actual (s), `estMin`, …), and other catalog attrs with a `def` open it. |
| **Insert left / right** | Add-column dialog at that index. |
| **Move left / right** | Reorder `sheetConfig.columnIds`. |
| **Hide column** | Removes the id from **`List.sheetConfig.columnIds`** — the same persist field as Spreadsheet view mode settings. The grid drops the column; the picker shows it unchecked. Reload / switch lists keeps it hidden. Checking it again in settings brings it back. Does **not** delete the attribute. |

**Item name** (`__name__`): Attribute settings is **disabled** with
“Item name is always the first column — it is not a custom attribute.” Hide is
not offered (name stays first). Built-in Task fields (`__field_*__`, e.g.
Importance, Actual (min)) disable Attribute settings with “Built-in item field
— not a custom attribute.” Prefer the real editor whenever an `attributeId`
exists.

Hide writes `columnIds` on the list via `persistSheetViewConfig` (and the
grid’s `patchConfig` / `onViewConfigChange` path) so a resize cannot drop that
set, and add-column cannot drop widths.

## Keyboard

Arrows move the active cell. Tab / Enter commit and move. Type-to-replace
starts an edit. F2 / double-click edit in place. Escape cancels the in-cell
editor. Delete / Backspace clears the selection when not editing.

## In-app fullscreen

**□ Fullscreen** above the formula bar lifts the same `SheetGrid` instance
into a near-viewport Win95 child window (`SheetFullscreen.tsx`). Esc / restore
/ close / minimize exit and commit in-progress edits (`commitFocusedSheetEdit`).
One live grid — never an in-pane copy plus a popup copy. Default is in-pane.

## Header treatment

Headers are crafted sheet chrome, not squeezed Win95 buttons
(`components/spreadsheet/sheet-chrome.css`, classes on `th.sheet-th`):

- **Padding** — `--sheet-th-pad-x: 14px` and `--sheet-th-pad-y: 7px`, plus a
  consistent 42px header height.
- **Centered titles** — `.sheet-th-sort` / `.sheet-th-label` center the column
  name (and unit, e.g. Est `(min)`).
- **Sort caret** — reserved right slot `.sheet-th-slot-end` so the caret never
  collides with the label; the label stays centered whether the column is
  sorted or not. The column menu sits in a reserved left slot and appears on
  hover.
- **Hairline borders** — right + bottom 1px `--sheet-hairline`; no chunky
  bevel on header cells.
- **Active column** — `.sheet-th-active` when a cell in that column is
  selected: a light primary wash and a 2px primary underline, related to the
  cell’s blue ring.

Click-to-sort, drag-resize, and the column menu keep working. Sort buttons
keep `aria-label="Sort {name}"`.

## Sort-blank rule

Google Sheets placement: **blanks always sort last** (`BLANK_CELLS_SORT =
"end"` in `lib/spreadsheet-contract.ts`).

- A→Z / smallest-first → filled values, then blanks at the **end**.
- Z→A / largest-first → filled values reversed, blanks still at the **end**.
- Blanks never sit in the middle of filled rows.

A cell is blank when it is empty, null, whitespace, a placeholder dash
(`—` / `–` / `-`), an empty array, a non-finite number, or an invalid date.
`0` and `false` are values. Display `—` is the empty placeholder, not a
sortable string. Applies to text, numbers (Est min), enums (Priority labels),
dates, and builtin fields (`estimatedDuration`, …).

## Width persist key

Per-list map: **`List.sheetConfig.columnWidths`** → `columnId → pixel width`.

- Dragging a column **immediately** updates the grid and writes that key
  (`persistSheetViewConfig` merges onto the current list).
- Survives reload, leaving Spreadsheet, and switching lists (each list has
  its own `sheetConfig`).
- Never-resized columns are **omitted** from the map and keep grid defaults
  (name 200px, others 160px). Floor is `MIN_SHEET_COL_WIDTH` (60).

`columnWidthsByList(lists)` is the test helper: `listId → columnId → width`.

## Fullscreen

Default is **in-pane**. **□ Fullscreen** (toolbar above the formula bar, near
Bulk add / Add item) opens a near-viewport Win95 **child window** over the
Brain2 app — dimmed desktop around the frame, list name in the title bar, min /
restore-down / close. It does **not** call the OS fullscreen API.

| Enter | □ Fullscreen in the spreadsheet toolbar |
| Exit | **Esc** (when not typing in a cell or the formula bar), **❐ Exit fullscreen**, title-bar **Restore down**, **Minimize**, or **Close** (×) |

In-progress cell and formula-bar drafts **commit on close** (the focused field
blurs so `SheetGrid`’s existing `onBlur` writes). Formula bar, sort, filter,
frozen item column, add-column, and add-row all keep working at the large size.
Only one `SheetGrid` is mounted — never an in-pane copy plus a popup copy.
Fullscreen is not remembered across visits.

**Future:** true OS fullscreen (`element.requestFullscreen()` / Electron
`setFullScreen`). Today the window covers app content only. The OS-level pop-out
(`/popout/?sheet=`) is a different window, not this maximized child.

## What’s not Google Sheets

Not in this pass (keep Win95/Cogs, don’t clone the product):

- Formulas as a first-class language beyond per-cell `=A1` and column `formula` attributes
- Fill-down from the keyboard (the fill handle already exists)
- Column filters / filter views
- Multiple sheets / tabs inside one list
- Undo stack
- Virtualized rows for tens of thousands of items (hundreds are fine)

This is a Brain2 grid over items × attributes, not a workbook file.
Details / Default / Checklist view settings do not share `sheetConfig.columnIds`.

| File | Role |
|------|------|
| `lib/spreadsheet-catalog.ts` | Attribute → column map, defaults, hide/insert, assign-to-list |
| `dialogs/SpreadsheetViewSettings.tsx` | Per-list column picker |
| `components/spreadsheet/AddColumnDialog.tsx` | Add-column flow |
| `list-content/SheetFullscreen.tsx` | Win95 overlay around the live grid |
| `list-content/sheet-fullscreen.ts` | `commitFocusedSheetEdit` / `isEditingField` |
| `list-content/sheet-fullscreen.css` | Near-viewport layer; fill-height scroller |
| `list-content/SheetFullscreen.test.tsx` | Enter / exit / Esc / one formula bar / commit on close |

