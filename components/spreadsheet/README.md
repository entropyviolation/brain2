# `components/spreadsheet/` — Editable grid

A reusable **Google-Sheets-style** grid over COGS items (`Task[]`), where columns
are the effective attribute schema (spec §5). One component, two consumers, one
shared contract.

| File | Purpose |
|------|---------|
| `SheetGrid.tsx` | The grid (v3): sticky header with **A1 column letters** + a **row-number gutter**, **click-to-sort** headers (asc → desc → none; shift-click for multi-sort), a **free-text filter**, **drag-to-resize columns** and **drag-to-resize rows**, config-driven **frozen leading columns**, a **formula bar** showing the active cell's **A1 address** (e.g. `B2`), **drag + shift-click range selection** with a Google-Sheets-style **selection summary** (Sum / Avg / Min / Max / Count), a **fill handle** for relative copy-down, **Delete/Backspace** to clear the selection, inline cell editing (Sheets-style text inputs / boolean / selection / date / color / link), a currency-aware numeric **footer with totals**, **add-row**, and **add-column** (extends the list's attribute schema). Two flavors of formula are supported: column-level computed (`formula`) columns are read-only; **per-cell `=A1` formulas** can be typed into any ordinary cell (stored verbatim, displayed as the computed value). Complex types (image / goal / reference) open the item to edit. |
| `SheetGrid.test.tsx` | Cell commit, formula read-only/write-rejection, sort, filter, footer totals, add-column, per-cell `=A1` formulas, formula-bar entry, range-selection summary, and fill-drag relative references. |

## Spreadsheet engine (pure, shared)

| Module | Purpose |
|--------|---------|
| `lib/sheet-a1.ts` | A1-notation math: `columnToLetters` / `lettersToColumn`, `parseA1` / `formatA1`, `isCellFormula`, `extractA1Refs`, and `shiftFormula` (relative-reference rewriting for fill-drag, honoring `$` absolutes). |
| `lib/sheet-eval.ts` | Evaluates a per-cell `=` formula against a `RawCellAccessor` over the grid: reuses the safe `lib/formula` engine, resolves A1 refs to other cells (recursively, with cycle detection), and formats the result. |
| `lib/spreadsheet-keys.ts` | Grid interaction model: cell navigation, range math (`normalizeRange` / `isWithinRange` / `rangeArea`), clipboard TSV, and `selectionStats` for the status bar. |

## Shared contract

All read/write/sort/filter semantics live in **`lib/spreadsheet-contract.ts`**
(pure, no React, no store imports) so every consumer behaves identically:

- `SheetColumn` — a column derived from an `AttributeDefinition` or the synthetic
  name column (`NAME_COLUMN_ID`). Carries `isName` / `isFormula` / `readOnly`.
- `SheetViewConfig` — serializable view state: `{ sort?, filterText?, frozenColCount?, columnWidths?, rowHeights? }`.
  `frozenColCount` counts the name column as 1. Persist this on a module view
  config (or list UI prefs) to remember sort/filter/freeze/column-widths/row-heights.
- Helpers: `buildSheetColumns`, `readCellValue`, `cellSortValue`, `cellText`,
  `sortRows`, `filterRows`, `cycleColumnSort`, `sortDirFor`, and the write guard
  `canWriteCell` / `isWritableColumn` (rejects formula columns).

## Consumers

- **Lists** — the **Spreadsheet** display mode
  (`components/Lists/list-content/ListContentSpreadsheet.tsx`). Pass an optional
  `viewConfig` / `onViewConfigChange`; omit for default behavior.
- **Modules** — the workspace **spreadsheet** view
  (`components/Modules/workspace/module-view-bodies.tsx`).

## Data

`SheetGrid` reads/writes the `task-store` directly (cells → `updateTask`,
add-row → `addTask`, add-column → `updateCategory`), so callers only pass the
`categoryId` (schema + new-row target) and the `tasks` to display. Sort/filter
are applied on top of the passed `tasks`, so an empty config renders them as-is.
Column math (totals, rollups, conditional `includeInCalc` aggregation) lives in
`lib/spreadsheet-utils.ts`.
