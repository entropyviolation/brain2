# ItemDetail

The consolidated **Brain2** item-detail surface (Spec §5.5 / docs/SPEC_MAPPING.md §5). This is
where one record shows every honest join — tags, typed links, lists, schedule,
body, history — so the same item can be **used in as many rooms as possible**
(Lists, Scheduler, Tracking, Modules, Reviews, Analytics). Isolation is a bug.

## Public door

Popup and page are both public entries.

- **Popup** — `TaskDetailPopup` from `@/components/ItemDetail/ItemDetailPopup`. Callers: the app shell (`app/page.tsx`), Lists, Scheduler, Home, Plan, To Do, Mobile, the friend mission sheet, and friend mission detail.
- **Page** — `EnhancedTaskDetail` from `@/components/ItemDetail/ItemDetailPage`. Callers: the app shell, the module popout, and the sheet popout.

`useItemDetailDraft` is an interior. Its callers are the popup and the page.

Interiors (imported from this folder): `useItemDetailDraft`, `BodyPanel`, `HabitLinkedDetail`, `TodoCommitmentFields`, `ItemEstimateField`, `ItemScheduleFlags`, `ItemAttributesSection`, `AttributeCreator`, `TagInput`, `LinkPicker`, `RelatedItemsPanel`, `ItemActivityPanel`, `CycleConfirmDialog`, `SubtaskComposer`, `item-detail-chrome.css`.

Item writes call the task store. `useItemDetailDraft` forwards `useTaskStore`'s `updateTask`, `addTask`, and `deleteTask`. Save, complete, and status call `updateTask`. The page calls `addTask` and `deleteTask` for Task-backed subtasks; both shells call `deleteTask` to delete the open item. A list-scoped attribute calls `updateList`. `BodyPanel` calls `updateTask` for `body`. `TodoCommitmentFields` calls `useTaskStore.getState().updateTask` for `todoMarks`. Missed calls `markMissedOpportunity` (`taskRepository.update`). Tag, link, list, and dependency helpers patch the draft until `updateTask`.

Chrome is the house [milled fascia](../../docs/DESIGN_STYLE.md#milled-fascia)
(`.id95` / `.id95-dialog` in `item-detail-chrome.css`): brushed silver bays,
engraved nameplates, CRT title readout (`#7dffc4`), raised metal action keys,
and sibling detail tabs as equal keys in one bay (active = CRT + round power
lamp). Looks only — fields, save / complete / delete, tab meaning, and
persistence are unchanged. Velvet / orb contents inside the panel are not
flattened.

Both
detail variants share their load/draft state and the category/dependency mutators
through a single hook, plus small shared sections (`ItemEstimateField`,
`ItemScheduleFlags`, `TodoCommitmentFields`, …) that only hoist wiring that is
literally the same. Popup chrome and page layout stay separate; save / complete /
missed / delete handlers are not merged. **Which tabs and chrome appear is resolved from the item
type + list settings**, not assumed to be Task. A **History** tab is always
offered (append-only ledger in `lib/item-activity.ts` — not last-write undo).
Adding a dependency that would loop is refused with a Win95 confirm.

A habit’s standing item is a generic item (`sourceHabitId` on `attributes`). Its Details main column would otherwise be empty, because Task Information only renders for tasks. That column instead shows the item’s existing **Notes** field (`task.notes`, the same editor the Analysis tab uses) and a read-only completion summary from the source habit: name, frequency, goal, how this period stands, and recent completions (`HabitLinkedDetail`, `lib/habit-completion-summary.ts`). **Habit settings** arms that habit id and leaves through Back, which reopens the habit edit window. The button is hidden when `sourceHabitId` is missing. Other items do not get this panel.

`resolveDetailView` (`lib/item-types.ts`) starts from the type's `detailPanels`
(or infers them from capabilities), unions list `detailPanels`, then filters by
capabilities and list `hiddenDetailPanels`. Next Actions membership still treats
an item as a Task (full hardcoded Task surface). A generic `item` or catalog
type such as Book / Furniture shows Details (and a cover / featured fields when
`detailLayout` is set) without Scheduling unless you opt in.

Complete / duration / status chrome is gated on
`capabilities.completable`, `capabilities.duration`, and
`capabilities.scheduleable` (**Scheduling fields**: the type may use dates and
deadlines; it does not send the item to the Scheduler). The Scheduling tab
offers **Send to Scheduler** (checked = currently appears in the Scheduler via
`isTaskScheduleable`): off forces `scheduleable: false`; on inherits
(`undefined`) when a list is already sent, else forces `true`. Dates, a
deadline, and a trip itinerary do not turn it on. Date inputs store the local calendar day (`parseLocalDate` / `dateInputValue`), so a picked Monday stays Monday west of UTC. A list of tasks does not
include its items unless that list is sent. **Auto-push** sits beside it
and is off unless turned on (`autoPush: true`). **Required and prioritized**
(`TodoCommitmentFields.tsx`) sits with it: one row per day, week, and month the
item is already assigned to. Required must be done (its own To Do list).
Prioritized stays on Assigned and is marked. Scheduling still assigns the item. It is a To Do setting, not a
Scheduler setting: when a day, week, or month ends unfinished, that period stays
Undone and the task is scheduled on the next one (`scheduledDate` /
`scheduledWeek` / `scheduledMonth`). It does not mark the item schedulable. Completable items offer **Complete** and **Missed
opportunity** (too late) side by side; missed files the row on the automatic
Missed Opportunities list instead of Completed. When one of the item’s lists has **Sent this week** on, Details shows a **Sent** control. Sent is not complete and not delete. Lists that leave the option off have no Sent control.

## Files

| File | Purpose |
|------|---------|
| `useItemDetailDraft.ts` | The de-duplication seam: subscribes to the task store, loads the selected task into local draft state, and exposes the shared mutators (`addToCategory`, `removeFromCategory`, `setLists`, `addDependency`, `removeDependency`, `addTag`, `removeTag`, `addLink`, `removeLink`) plus store actions (`updateTask`, `addTask`, `deleteTask`). `addDependency` returns `{ ok: false, cycleLabel }` instead of writing when `findCyclePath` would loop. Tag/link mutators delegate to the pure helpers in `lib/links.ts` and operate on the draft; both detail variants persist via the existing save path and append a History row via `recordItemWrite`. |
| `useItemDetailDraft.test.tsx` | Cycle guard: refuse a reverse edge; accept an acyclic add. |
| `ItemActivityPanel.tsx` | Explorer sunken History well: when / what changed. Empty until the first recorded save. |
| `item-detail-chrome.css` | Milled fascia for page + popup (`.id95` / `.id95-dialog`): brushed bays, CRT title, metal keys, equal-fill tab bay with power lamps, History well + cycle path. |
| `CycleConfirmDialog.tsx` | Win95 `fm98-dialog`: “This would loop”, the cycle path, OK only (dependency already refused). |
| `CycleConfirmDialog.test.tsx` | Dialog copy; no add-anyway. |
| `TodoCommitmentFields.tsx` | Scheduling switches for Required / Prioritized on each period the item is already assigned to. Writes `todoMarks` immediately without saving the rest of the draft. |
| `ItemScheduleFlags.tsx` | Shared **Send to Scheduler** + **Auto-push** switches (same copy, same `scheduleable` / `autoPush` draft writes). Page passes `disabled={!isEditing}`; popup always editable. Date / week / month / year / deadline fields stay in each shell — popup clears sibling schedule fields and uses a week date-picker; page patches one field and gates edits. |
| `ItemEstimateField.tsx` | Shared Details-tab estimated-duration LiveInput (`touchDraft` + `setTask`, empty→`0`). `variant="popup"` keeps the Clock label + `min` suffix; `variant="page"` keeps “(minutes)” + read-only when not editing. Popup Time-tab estimate (`|| undefined`) stays popup-only. |
| `ItemDetailPopup.tsx` | Compact modal/popover detail view used inline by Scheduler, Plan, To-Do, and the friend mission sheet. `data-ui-name="Item detail"` on `DialogContent`. Tabs are `resolveDetailView` output (type + lists + capabilities). Includes the in-popup completion flow when the type is completable. Exports `TaskDetailPopup`. `stackAbove` paints it over another open dialog (the mission sheet stays underneath). Last tab per item is restored. Dirty close (draft vs stored task) uses the house unsaved-changes guard. Double-click a list badge closes the popup, then `requestNavigateToListAfterPaint` jumps Lists on the next frame so a large list does not freeze the detail view. Save / complete / missed / delete / subtasks handlers stay here (complete closes; subtasks are draft-only). |
| `HabitLinkedDetail.tsx` | Details main pane for an item whose `sourceHabitId` attribute is set. Notes editor (`task.notes`) plus a read-only habit summary. **Habit settings** returns to that habit’s edit window. |
| `ItemDetailPage.tsx` | Full-screen detail/editor opened from the app shell (`data-ui-name="Item detail"` on the page root). Names still runs via the layout host. Task-only chrome (duration, urgency, molecular breakdown) is gated; other types get an adapted details view. Exports `EnhancedTaskDetail`. Open item + last tab persist across refresh. Double-click a list badge calls `requestNavigateToListAfterPaint` with that badge’s list id (the parent folder when the list is filed). The shell’s navigate event closes the page. When the screen was opened from a habit, that double-click does **not** take Back’s return to habit settings — Back and **Habit settings** still do. The desk stays mounted underneath; long lists window their rows so the jump can paint. Save / complete (with `actualDuration`) / missed / delete / Task-backed subtasks / `SplitStepsComposer` stay page-only. |
| `ItemAttributesSection.tsx` | Shared attributes surface. When the type has `detailLayout`, renders a large hero image and featured fields above the rest of the schema, then list-defined attributes, item-only leftovers, and `AttributeCreator`. |
| `item-attributes.test.tsx` | Hero/featured layout + attribute creator for catalog-style types. |
| `BodyPanel.tsx` | The `"body"` detail panel for document-type items: mounts the `RichTextEditor` (`components/Editor`) over an item's `Item.body` markdown and persists edits through `useTaskStore.updateTask`, debounced (default 500ms) with a flush on blur/unmount. Props: `taskId`, `readOnly?`, `debounceMs?`. |
| `AttributeCreator.tsx` | Inline control for defining a brand-new typed attribute (name + type + initial value). The attribute can be added to one of the item's lists — persisted onto that list's `itemAttributes` schema so every item in the list gains it — or kept on just this item. Props: `categories`, `itemCategoryIds`, `existingIds`, `onCreate(def, value, listId)`. |
| `TagInput.tsx` | Presentational chip/token tag editor. Renders applied tags as removable chips and a text field that adds a tag on Enter/comma, with autocomplete suggestions drawn from all tags in use across `taskRepository.getAll()`. Normalization via `lib/links.ts`. Props: `tags`, `onAdd`, `onRemove`. |
| `LinkPicker.tsx` | Presentational control for adding a typed link: a relation `Select` from the `lib/links.ts` `RELATIONS` catalog plus a target-item typeahead searching the repository by title/description (excluding the current item). Props: `sourceId`, `onAdd(relation, targetId)`. |
| `RelatedItemsPanel.tsx` | Shows an item's relationships: outgoing links grouped by relation (each removable) and discovered backlinks labelled with the inverse relation (e.g. "Y blocks X" surfaces as "blocked by Y" on X) via `useTaskStore.getBacklinks`. Rows open the linked item. Props: `task`, `onOpenItem(id)`, `onRemoveLink(linkId)`. |
| `ItemDetail.test.tsx` | Vitest coverage for the presentational pieces: `TagInput` (add/remove), `LinkPicker` (search + add link), and `RelatedItemsPanel` (forward links, removal, inverse-labelled backlinks). |
| `ItemDetailPopup.test.tsx` | Popup hides scheduling / Complete / scheduler chrome for non-task types (e.g. Furniture). History tab; save records the ledger. |
| `ItemDetailPage.test.tsx` | Full-screen detail follows `resolveDetailView`; Task chrome gated. History tab; save records estimated-duration changes. A habit-linked item shows notes, a completion summary, and **Habit settings**. A generic item does not. The list chip opens that list id. |

## History

Both surfaces always offer a **History** tab (`ItemActivityPanel`). Saves,
Complete, and status changes append to `lib/item-activity.ts` (`cogs-item-activity`).
`commitItemEdit` appends there too, with source and an optional order; lines
written before that field still load.
This is a ledger, not Cmd-Z. Settings selective restore is a different lane.

## Planned — differential and formulations (Wave 13)

Not built. A Differential tab will show one record as event, object, label,
and higher labels, with strings for characteristics left out (GS-7). Dated
formulation wording lives on this same ledger and shows as a timeline (GS-10).
[`docs/ScienceandSanityBrain2.md`](../../docs/ScienceandSanityBrain2.md) Part 3.

## Dependencies

`addDependency` on the shared hook walks `findCyclePath`. A loop opens
`CycleConfirmDialog` (“This would loop”) and does **not** write the edge.

## Tags & Links

The tag and relation logic lives entirely in `lib/links.ts` (pure, tested); the
components above are presentational. Both detail variants mount a "Tags" section
(`TagInput`) and a "Related" section (`LinkPicker` + `RelatedItemsPanel`) wired to
the shared draft mutators. "Open item" navigation is handled in-place: each
variant keeps a local `overrideId` so clicking a related/backlinked row swaps the
detail view to that item without leaving the surface (reset when the host opens a
new item).

## Import paths

Import the surfaces directly:

- `@/components/ItemDetail/ItemDetailPopup` → `TaskDetailPopup`
- `@/components/ItemDetail/ItemDetailPage` → `EnhancedTaskDetail`
