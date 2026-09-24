# `components/spreadsheet/` — Editable grid

A reusable **Google-Sheets-style** grid over Brain2 items (`Task[]`), where columns
are the effective attribute schema (spec §5). One component, two consumers, one
shared contract.

| File | Purpose |
|------|---------|
| `SheetGrid.tsx` | The grid: sticky A1 headers + row gutter, **centered padded headers** (`.sheet-th` / `.sheet-th-sort`, reserved caret slot, `.sheet-th-active`), frozen name column, click-to-sort (blanks always last), header menu (Sort, **Attribute settings**, hide / insert / move), filter, resize (persisted `columnWidths`), formula bar, range selection + Sum/Avg bar, fill handle, Delete to clear, TSV copy/paste, type-to-replace / arrows / Tab / Enter / Escape, numeric footer, add-row, add-column. Hide writes `List.sheetConfig.columnIds`. Attribute settings reuses `AttributeSettingsDialog` / `AttributeSchemaEditor` for that column’s attr id (name / built-in fields stay disabled). Column-level `formula` attrs are read-only; per-cell `=A1` formulas are editable. Complex types open the item. |
| `sheet-chrome.css` | Header chrome: padding, centered labels, reserved caret slot, hairline borders, active-column highlight, capped column widths, pinned Add-column control. |
| `AddColumnDialog.tsx` | Add a column: on-this-list attrs first, then vault, or create a new attribute and assign it to every item on the list. |
| `SheetPopoutView.tsx` | Standalone spreadsheet window (`/popout/?sheet=<id>`) — no app header/tabs |
| `sheet-popout.ts` | Path/hash helpers + `openSheetPopout` |
| `sheet-popout.test.ts` | Path + hash round-trip tests |

## Spreadsheet engine (pure, shared)

| Module | Purpose |
|--------|---------|
| `lib/sheet-a1.ts` | A1-notation math: `columnToLetters` / `lettersToColumn`, `parseA1` / `formatA1`, `isCellFormula`, `extractA1Refs`, and `shiftFormula` (relative-reference rewriting for fill-drag, honoring `$` absolutes). |
| `lib/sheet-eval.ts` | Evaluates a per-cell `=` formula against a `RawCellAccessor` over the grid: reuses the safe `lib/formula` engine, resolves A1 refs to other cells (recursively, with cycle detection), and formats the result. |
| `lib/spreadsheet-keys.ts` | Grid interaction model: cell navigation, range math (`normalizeRange` / `isWithinRange` / `rangeArea`), clipboard TSV, and `selectionStats` for the status bar. |
| `lib/spreadsheet-catalog.ts` | Attribute → column catalog: on-this-list first, vault attrs, built-in fields, per-list `columnIds`, assign-to-list. |
| `lib/spreadsheet-paste.ts` | Expand a pasted TSV grid into cell writes (block paste vs single-value tiling). |
| `lib/spreadsheet-file.ts` | Load CSV/TSV/TXT or Excel uploads into headers + rows (Lists import). |

## Shared contract

All read/write/sort/filter semantics live in **`lib/spreadsheet-contract.ts`**
(pure, no React, no store imports) so every consumer behaves identically:

- `SheetColumn` — a column derived from an `AttributeDefinition`, a built-in Task field (`builtin`), or the synthetic name column (`NAME_COLUMN_ID`).
- `SheetViewConfig` — serializable view state: `{ sort?, filterText?, frozenColCount?, columnWidths?, rowHeights?, columnIds? }`.
  `columnIds` is the per-list extra-column layout (`undefined` = lean schema
  default: list `itemAttributes` / `displayedAttributes` only; empty schema →
  Name-only). Persist on `List.sheetConfig` or a module view config.

- Helpers: `buildSheetColumns`, `readCellValue`, `cellSortValue`, `isBlankSortValue`, `cellText`,
  `sortRows` (blanks last on A→Z and Z→A), `filterRows`, `cycleColumnSort`, `sortDirFor`,
  `persistSheetViewConfig` / `applyColumnWidth` / `columnWidthsByList` (`List.sheetConfig.columnWidths`),
  and the write guard `canWriteCell` / `isWritableColumn` (rejects formula columns).

## Consumers

- **Lists** — the **Spreadsheet** display mode
  (`components/Lists/list-content/ListContentSpreadsheet.tsx`). Persists
  `List.sheetConfig`. **□ Fullscreen** is an in-app Win95 child window around
  this same `SheetGrid` instance (not OS fullscreen; not `/popout/?sheet=`).
  See [`components/Lists/SPREADSHEET.md`](../Lists/SPREADSHEET.md).
- **Modules** — the workspace **spreadsheet** view
  (`components/Modules/workspace/module-view-bodies.tsx`).

## Data

`SheetGrid` reads/writes the `task-store` directly (cells → `updateTask`,
add-row → `addTask`, add-column → `updateCategory`), so callers only pass the
`categoryId` (schema + new-row target) and the `tasks` to display. Sort/filter
are applied on top of the passed `tasks`, so an empty config renders them as-is.
Column math (totals, rollups, conditional `includeInCalc` aggregation) lives in
`lib/spreadsheet-utils.ts`.
