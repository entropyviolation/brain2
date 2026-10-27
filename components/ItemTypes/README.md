# `components/ItemTypes/`

UI for managing **Brain2** item types — the user-definable `ItemTypeDefinition`s
(`lib/types.ts`) that give every item its attributes, capabilities, detail
layout, and rules. Types (plus list settings) own the item-detail view: a Book
shows a cover and pages-read; a wishlist rug does not grow a Schedule tab.

| File | Purpose |
|------|---------|
| `ItemTypeList.tsx` | Thin wrapper around `ItemTypesPanel` for Settings. |
| `ItemTypesPanel.tsx` | Lists every type (system / catalog / user). System types cannot be deleted; catalog types (Book, Furniture, Resource, Shopping, Flight) are editable and persist. |
| `ItemTypeEditor.tsx` | Create/edit dialog: name + labels, attribute schema, **capabilities** (they gate detail tabs), **detail panels**, **detail layout** (hero image + featured attributes), and **rules** including implied actions (`logAction`, `incrementHabit`) with editable `when` conditions. Starter **recipe/hint cards** (Book, Furniture, Resource, Shopping, Film, Progress → Done) apply onto a *new* user type. System types (Task, Note, Operation, Item) are read-only. Also opened from List Settings → **New type…**. |
| `ItemTypeEditor.test.tsx` | Component tests: system/catalog badges, create/delete user types, Book editor (layout + implied-action `when`), Furniture starter recipe. |

## Notes

- **Data library.** Data → Library → **Item Types**
  (`components/Analytics/library/ItemTypesLibrary.tsx`) is the browse / sort / count /
  drill surface. This panel remains the Settings editor.
- **System vs catalog vs user.** `kind: "system"` (Task, Item, Note, Operation)
  is always re-seeded from code and locked in the editor. `kind: "catalog"`
  (Book, Flight, Film, Furniture, Resource, Shopping) is seeded once if missing;
  customizations persist. User types have no `kind`. Persist **v2** in
  `lib/item-type-store.ts` migrates older `cogs-item-types-store` snapshots
  through `mergeTypeRegistry` so a version bump cannot drop the registry.
- **List assignment.** Lists carry `itemTypeIds` (allowlist) and `itemTypeId`
  (default for new rows). List Settings edits both; schema composition unions
  allowlisted type attributes (`lib/list-item-types.ts`, `composeListAttributes`).
- **Task is special.** It remains the hardcoded work surface (scheduling, next
  actions, time, molecular subtasks). Other types *opt into* slices via
  capabilities instead of reconstructing Task.
- **Rules** run through `applyRules` in `lib/item-types.ts`. Implied-action
  side effects (`logAction` / `incrementHabit`) execute from the mutation
  seam (`lib/implied-actions.ts`).
- Recipe hints explain how to wire “pages read increased → log Done + increment
  a pages/day habit” generically for any numeric field.

<a id="toward-a-type-that-models-thought"></a>

## Toward a type that models thought

The direction: an item type flexible enough to model how a mind actually
files things — not just "Book" or "Task", but a thought, a want, a worry, a
category that is itself still forming. A type is a set of dimensions (its
attributes); a list is a population of things measured along them. What makes
that a *model* rather than a form is being able to look at the population
along any dimension.

Shipped steps toward that:

- **Attributes compose** from the item's types, its lists, and item-only
  definitions (`composeListAttributes`), so one thing can carry the dimensions
  of every category it belongs to at once.
- **Lists can be read along any attribute.** Default view **Sort** offers
  every sortable attribute on the list beside the built-in fields
  ([`DEFAULT_VIEW.md`](../Lists/DEFAULT_VIEW.md#sort)).
- **Membership has a history.** `Task.listAddedAt` records when an item joined
  each list, so "when did I start thinking of this as X" is answerable
  (Sort → Date added to list).
- **Search reads the whole item.** The open list's caption search can match
  any attribute value and the text of notes, not just names.

Next: per-type default sort, sort on derived values (time since added,
rate of change of a numeric attribute), and a secondary sort.

