# `components/ItemTypes/`

UI for managing **item types** — the user-definable `ItemTypeDefinition`s
(`lib/types.ts`) that give every item its attributes, behaviors, and rules. This
is a headline second-brain / module-platform surface: types are first-class and
fully user-editable.

| File | Purpose |
|------|---------|
| `ItemTypeList.tsx` | The manager. Lists every type from `useItemTypeStore` (built-in + user), with a color dot, a **Built-in** badge, an attribute count, and edit/delete actions. Built-ins open read-only and can't be deleted; user types route saves through the store's `addType`/`updateType` and deletes through `deleteType`. Mounted from `components/Settings/SettingsDialog.tsx` ("Manage Item Types"). |
| `ItemTypeEditor.tsx` | The create/edit dialog for one type: name + plural/item labels, description, color, the **attribute schema** (reuses `components/Lists/attributes/AttributeSchemaEditor` — including the new `file`/`multifile` attribute types), behavioral **capability** flags (`ItemTypeCapabilities`), and declarative **rules** (the existing `ItemRule*` shapes: `require` / `block` / `setDefault` / `setAttribute` / `addTag` / `addToNextActions`, each on a lifecycle `trigger`). Built-in types render disabled. |
| `ItemTypeEditor.test.tsx` | Component test driving the real `useItemTypeStore` (reset to built-ins per test): lists built-ins, creates a new user type through the editor, and deletes a user type. |

## Notes

- **Built-in vs. user types.** `builtin: true` types (Task, Note, Operation,
  Book, Flight) are re-seeded on load by the store and cannot be edited or
  deleted here. Everything else is a user type.
- **Rules** are evaluated by `applyRulesFor` / `validateItem` in
  `lib/item-types.ts`; this editor only authors the serializable definitions.
- **Attribute schema** editing is shared with the Lists schema editor so the two
  surfaces never drift, and both pick up new attribute primitives automatically.
