# Kanban board display (Feature 6)

A Kanban board view for list items, available in two places:

- **Lists display mode** — `ListContentKanban.tsx`, selectable from the Lists
  toolbar "Display:" row (alongside Default / Checklist / Icons / Details /
  Spreadsheet). Wired through `ListContentPanel.tsx`.
- **Module workspace view kind** — the `"kanban"` `ModuleViewKind`
  (`module-view-bodies.tsx` → `KanbanView`, configured in `ModuleViewEditor.tsx`).

## How columns work

Columns are derived from a chosen **selection/status attribute** of the list:

1. The attribute's manual `options` (in order) — so empty columns still show.
2. Plus any additional values found on items but not in `options`.
3. Plus a trailing **backlog** column ("No &lt;attr&gt;") when some items have no
   value for the attribute.

Only selection-like / textual attributes are offered as the grouping field
(`isKanbanGroupable`: `selection`, `string`, `multistring`, `boolean`, `list`).

## Moving cards

Items move between columns by **drag-and-drop** or with the **◀ ▶ buttons** on
each card (Lists mode). Either path writes the column's value back onto the item
via `useTaskStore.updateTask` (`statusValueToWrite` decides the concrete value:
the column key for single-value attributes, a one-element array for
multi-valued attributes, or `undefined`/cleared for the backlog column).
Clicking a card's title opens the item detail.

## State

- **Lists mode:** the chosen status attribute is stored per-list in
  `lib/lists-ui-store.ts` (`kanbanStatusAttrId[listKey]`,
  `setKanbanStatusAttrId`). The `"kanban"` value is part of `ListDisplay`.
- **Module view:** stored on the view's config (`ModuleViewConfig.statusAttrId`
  in `lib/modules-store.ts`).

## Pure logic & tests

Column derivation and value-writing are pure functions in `kanban-utils.ts`
(no React/store imports), unit-tested in `kanban-utils.test.ts`.
