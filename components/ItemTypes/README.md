# `components/ItemTypes/`

UI for managing **Brain2** item types — the user-definable `ItemTypeDefinition`s
(`lib/types.ts`) that give every item its attributes, capabilities, detail
layout, and rules. Types (plus list settings) own the item-detail view: a Book
shows a cover and pages-read; a wishlist rug does not grow a Schedule tab.

| File | Purpose |
|------|---------|
| `ItemTypeList.tsx` | Thin wrapper around `ItemTypesPanel` for Settings. |
| `ItemTypesPanel.tsx` | Lists every type (system / catalog / user). System types cannot be deleted; catalog types (Book, Furniture, Resource, Shopping, Flight) are editable and persist. |
| `ItemTypeEditor.tsx` | Create/edit dialog: name + labels, attribute schema, **capabilities** (they gate detail tabs), **detail panels**, **detail layout** (hero image + featured attributes), and **rules** including implied actions (`logAction`, `incrementHabit`) with editable `when` conditions. Starter **recipe/hint cards** (Book, Furniture, Resource, Shopping, Progress → Done) apply onto a *new* user type. System types (Task, Note, Operation, Item) are read-only. |
| `ItemTypeEditor.test.tsx` | Component tests: system/catalog badges, create/delete user types, Book editor (layout + implied-action `when`), Furniture starter recipe. |

## Notes

- **Analytics library.** Analytics → Library → **Item Types**
  (`components/Analytics/ItemTypesLibrary.tsx`) is the browse / sort / count /
  drill surface. This panel remains the Settings editor.
- **System vs catalog vs user.** `kind: "system"` (Task, Item, Note, Operation)
  is always re-seeded from code and locked in the editor. `kind: "catalog"`
  (Book, Flight, Furniture, Resource, Shopping) is seeded once if missing;
  customizations persist. User types have no `kind`. Persist **v2** in
  `lib/item-type-store.ts` migrates older `cogs-item-types-store` snapshots
  through `mergeTypeRegistry` so a version bump cannot drop the registry.
- **Task is special.** It remains the hardcoded work surface (scheduling, next
  actions, time, molecular subtasks). Other types *opt into* slices via
  capabilities instead of reconstructing Task.
- **Rules** run through `applyRules` in `lib/item-types.ts`. Implied-action
  side effects (`logAction` / `incrementHabit`) execute from the mutation
  seam (`lib/implied-actions.ts`).
- Recipe hints explain how to wire “pages read increased → log Done + increment
  a pages/day habit” generically for any numeric field.
