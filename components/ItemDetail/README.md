# ItemDetail

The consolidated item-detail surface (Spec §5.5 / docs/SPEC_MAPPING.md §5). Both
detail variants share their load/draft state and the category/dependency mutators
through a single hook, so the only differences between them are presentation and
variant-specific UX (popup completion flow vs. full-page editing/subtasks).

## Files

| File | Purpose |
|------|---------|
| `useItemDetailDraft.ts` | The de-duplication seam: subscribes to the task store, loads the selected task into local draft state, and exposes the shared mutators (`addToCategory`, `removeFromCategory`, `setCategories`, `removeDependency`, `addTag`, `removeTag`, `addLink`, `removeLink`) plus store actions (`updateTask`, `addTask`, `deleteTask`). Tag/link mutators delegate to the pure helpers in `lib/links.ts` and operate on the draft; both detail variants persist via the existing save path. |
| `ItemDetailPopup.tsx` | Compact modal/popover detail view used inline by Scheduler, Plan, and To-Do panels. Tabs (Details / Scheduling / Dependencies / Subtasks / Analysis / Time) are filtered per item via `taskIsNextAction` (`lib/item-utils.ts`) and each list's `detailPanels`. Includes the in-popup completion-review flow. Exports `TaskDetailPopup`. |
| `ItemDetailPage.tsx` | Full-screen detail/editor opened from the app shell. Exposes all task attributes plus a **Molecular Breakdown** step editor backed by `lib/molecular.ts` (`parseSteps`, `addStepsAsSubtasks`, `toggleSubtaskComplete`, `toggleMolecular`, `setSubtaskContext`, `removeSubtask`). Exports `EnhancedTaskDetail`. |
| `BodyPanel.tsx` | The `"body"` detail panel for document-type items: mounts the `RichTextEditor` (`components/Editor`) over an item's `Item.body` markdown and persists edits through `useTaskStore.updateTask`, debounced (default 500ms) with a flush on blur/unmount. Props: `taskId`, `readOnly?`, `debounceMs?`. |
| `ItemAttributesSection.tsx` | The shared "Attributes" surface for both detail variants. Composes the schema-driven `AttributeValuesEditor` (list-defined attributes), an "Other attributes" editor for values kept on just this item (or left over from a removed list), and the `AttributeCreator`. Props: `attributes`, `itemCategoryIds`, `categories`, `onChangeValues`, `onCreateAttribute`. |
| `AttributeCreator.tsx` | Inline control for defining a brand-new typed attribute (name + type + initial value). The attribute can be added to one of the item's lists — persisted onto that list's `itemAttributes` schema so every item in the list gains it — or kept on just this item. Props: `categories`, `itemCategoryIds`, `existingIds`, `onCreate(def, value, listId)`. |
| `TagInput.tsx` | Presentational chip/token tag editor. Renders applied tags as removable chips and a text field that adds a tag on Enter/comma, with autocomplete suggestions drawn from all tags in use across `taskRepository.getAll()`. Normalization via `lib/links.ts`. Props: `tags`, `onAdd`, `onRemove`. |
| `LinkPicker.tsx` | Presentational control for adding a typed link: a relation `Select` from the `lib/links.ts` `RELATIONS` catalog plus a target-item typeahead searching the repository by title/description (excluding the current item). Props: `sourceId`, `onAdd(relation, targetId)`. |
| `RelatedItemsPanel.tsx` | Shows an item's relationships: outgoing links grouped by relation (each removable) and discovered backlinks labelled with the inverse relation (e.g. "Y blocks X" surfaces as "blocked by Y" on X) via `useTaskStore.getBacklinks`. Rows open the linked item. Props: `task`, `onOpenItem(id)`, `onRemoveLink(linkId)`. |
| `ItemDetail.test.tsx` | Vitest coverage for the presentational pieces: `TagInput` (add/remove), `LinkPicker` (search + add link), and `RelatedItemsPanel` (forward links, removal, inverse-labelled backlinks). |

## Tags & Links

The tag and relation logic lives entirely in `lib/links.ts` (pure, tested); the
components above are presentational. Both detail variants mount a "Tags" section
(`TagInput`) and a "Related" section (`LinkPicker` + `RelatedItemsPanel`) wired to
the shared draft mutators, alongside a visual `LinkGraph`
(`components/Graph/LinkGraph`) focused on the current item. "Open item"
navigation is handled in-place: each variant keeps a local `overrideId` so
clicking a related/backlinked row (or a graph node) swaps the detail view to that
item without leaving the surface (reset when the host opens a new item).

## Import paths

App code keeps importing from the original paths, which are now thin re-export
barrels:

- `@/components/task-detail-popup` → `ItemDetailPopup` (`TaskDetailPopup`)
- `@/components/enhanced-task-detail` → `ItemDetailPage` (`EnhancedTaskDetail`)

New code should import directly from `@/components/ItemDetail/*`.
