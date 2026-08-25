# Kanban board (Modules workspace)

Kanban is a **Module workspace view kind** only — not a Lists-tab display mode.

The `"kanban"` `ModuleViewKind` is rendered by `KanbanView` in
`components/Modules/workspace/module-view-bodies.tsx` and configured in
`ModuleViewEditor.tsx`. Column helpers live here so the module view can group
items by a selection/status attribute without depending on Lists UI.

## How columns work

Columns are derived from a chosen **selection/status attribute** of the list:

1. The attribute's manual `options` (in order) — so empty columns still show.
2. Plus any additional values found on items but not in `options`.
3. Plus a trailing **backlog** column ("No &lt;attr&gt;") when some items have no
   value for the attribute.

Only selection-like / textual attributes are offered as the grouping field
(`isKanbanGroupable`: `selection`, `string`, `multistring`, `boolean`, `list`).

## State

Stored on the view's config (`ModuleViewConfig.statusAttrId` in
`lib/modules-store.ts`).

## Pure logic & tests

Column derivation and value-writing are pure functions in `kanban-utils.ts`
(no React/store imports), unit-tested in `kanban-utils.test.ts`.
