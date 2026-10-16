# ItemDetail

The consolidated **Brain2** item-detail surface (Spec §5.5 / docs/SPEC_MAPPING.md §5). This is
where one record shows every honest join — tags, typed links, lists, schedule,
body, history — so the same item can be **used in as many rooms as possible**
(Lists, Scheduler, Tracking, Modules, Reviews, Analytics). Isolation is a bug.

> **Planned.** Unsaved guard on every way out, and a rich Links tab for
> every item: [`docs/PERSON_DETAIL_REDESIGN.md`](../../docs/PERSON_DETAIL_REDESIGN.md).

## Known gaps

_Last mapped: 2026-10-16_

- The popup's list-badge double-click (`handleNavigateToList`) calls
  `onClose()` directly, so it skips the unsaved guard and drops edits.
  Opening a linked or referenced item (`setOverrideId`) skips it too.
- The popup computes `isDirty` at render with a deep compare. It can be
  stale after `touchDraft` keystrokes.
- The page (`EnhancedTaskDetail`) has no unsaved guard. Back leaves at once.

## Public door

Popup and page are both public entries.

- **Popup** — `TaskDetailPopup` from `@/components/ItemDetail/ItemDetailPopup`. Callers: the app shell (`app/page.tsx`), Lists, Scheduler, Home, Plan, To Do, Mobile, the friend mission sheet, and friend mission detail.
- **Page** — `EnhancedTaskDetail` from `@/components/ItemDetail/ItemDetailPage`. Callers: the app shell, the module popout, and the sheet popout.

`useItemDetailDraft` is an interior. Its callers are the popup and the page.

Interiors (imported from this folder): `useItemDetailDraft`, `ItemSaveFlag`, `useItemDetailSaveHotkey`, `BodyPanel`, `HabitLinkedDetail`, `TodoCommitmentFields`, `ItemEstimateField`, `ItemScheduleFlags`, `ReminderScheduleFields`, `ItemAttributesSection`, `AttributeCreator`, `TagInput`, `LinkPicker`, `RelatedItemsPanel`, `ItemActivityPanel`, `CycleConfirmDialog`, `SubtaskTree`, `item-detail-chrome.css`.

Item writes: save / complete / status / reminder / notes / Sent go through
`useItemDetailDraft.commitDraft` → `commitItemEdit` (patch + History line).
`useItemDetailDraft` still forwards `updateTask`, `addTask`, and `deleteTask`
for create, delete, and a few interiors. The page calls `addTask` and
`deleteTask` for Task-backed subtasks; both shells call `deleteTask` to delete
the open item. A list-scoped attribute calls `updateList`. `BodyPanel` calls
`updateTask` for `body`. `TodoCommitmentFields` calls
`useTaskStore.getState().updateTask` for `todoMarks`. Missed opens an optional
why (`MissReasonDialog`). Skip still calls `markMissedOpportunity`
(`taskRepository.update`) with no `missReason`. Save writes `Task.missReason`.
Tag, link, list, and dependency helpers patch the draft until `commitDraft`.

Chrome is the house [milled fascia](../../docs/DESIGN_STYLE.md#milled-fascia)
(`.id95` / `.id95-dialog` in `item-detail-chrome.css`): brushed silver bays,
engraved nameplates, CRT title readout (`#7dffc4`), raised metal action keys,
and sibling detail tabs as equal keys in one bay (active = CRT + round power
lamp). **Body** and **Scheduling** lead the bay; **Analysis** / **Time** /
**History** use quieter `.id-tab-secondary` keys (still real tabs — not a
separate “More” route that would break `resolveDetailView`). Action keys:
**Save** and **Complete** are primary (`.id-btn-primary`); **Missed** is
secondary; **Delete** is danger-quiet (`.id-btn-danger.id-btn-quiet`). A save
lamp sits with those keys on both shells (`ItemSaveFlag`): green **Saved**
while the live draft matches the stored item, pink **Unsaved changes** as soon
as it does not (including keystrokes that have not re-rendered the rest of the
view). It stays up the whole time the item is open, so Save is confirmed by
the lamp returning to Saved. **Cmd/Ctrl+S** saves that same draft while this
surface is in front. A dialog stacked on top keeps the chord. Velvet / orb
contents inside the panel are not flattened.

Both
detail variants share their load/draft state and the category/dependency mutators
through a single hook, plus small shared sections (`ItemEstimateField`,
`ItemScheduleFlags`, `TodoCommitmentFields`, …) that only hoist wiring that is
literally the same. Popup chrome and page layout stay separate; save / complete /
missed / delete handlers are not merged. **Which tabs and chrome appear is resolved from the item
type + list settings**, not assumed to be Task. A **History** tab is always
offered (append-only ledger in `lib/item-activity.ts` — not last-write undo).
Adding a dependency that would loop is refused with a Win95 confirm.

A habit’s standing item is a generic item (`sourceHabitId` on `attributes`). Its Details main column would otherwise be empty, because Task Information only renders for tasks. That column instead shows the item’s existing **Notes** field (`task.notes`, the same editor the Analysis tab uses) and a read-only completion summary from the source habit: name, frequency, goal, how this period stands, recent completions, and display-only tag wiring — **Counts:** the `taggedTaskTag` name, **Minutes:** catalog names from `trackingLink.tagIds` (`HabitLinkedDetail`, `lib/habit-completion-summary.ts`, `habitTagWiringSummary` in `lib/habit-source-square.ts`). No second habit-tag editor here. **Habit settings** arms that habit id and leaves through Back, which reopens the habit edit window. The button is hidden when `sourceHabitId` is missing. Other items do not get this panel.

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
`scheduledWeek` / `scheduledMonth`). It does not mark the item schedulable. Completable items offer **Complete** (primary) and **Missed**
(secondary, too late) side by side; missed files the row on the automatic
Missed Opportunities list instead of Completed. When one of the item’s lists has **Sent this week** on, Details shows a **Sent** control. Sent is not complete and not delete. Lists that leave the option off have no Sent control.

## Layout (Details, Notes, Resources, Links)

Identity leads: the fascia holds the CRT title, then the item's **type plates**
(lamp in the type color; double-click opens the type editor) and the stage
chip, then the keys. Details is two regions: the main column starts with the
**Attributes** instrument (`ItemAttributesSection`), then the description and
task fields; the rail beside it is where the item lives: Lists, Tags, a
**Notes** peek (one-line add for today plus the latest entries), Sent, Status.

Every item, not only tasks, gets these tabs:

- **Notes** — a dated log (`ItemNotesLog`, `Task.noteLog`). Each entry has a
  local day and optional clock, newest first under day plates; entries edit in
  place and can be removed. The old single `Task.notes` string stays as the
  pinned **Standing note** (ingest still appends there). Analysis no longer
  repeats it as "Additional Notes".
- **Resources** — any file attached to the item (`ItemResourcesPanel`,
  `Task.resources`): drop on the tray or Attach files. Bytes go to the
  attachments IndexedDB like `file` attributes; an image shows itself, PDFs /
  audio / video / text preview in the viewer well, with Open, Download, and a
  caption. Remove takes it off the draft and keeps the stored bytes so Discard
  can bring it back. Text is extracted in the background where possible.
- **Links** — the Related picker and backlinks (moved out of the rail).

Notes and Resources are `ItemDetailPanel`s that `resolveDetailView` adds to
every item; a list can hide them (List Settings → detail panels). Links and
History are shell tabs. Tab keys carry phosphor counts. Notes, resources, and
attribute edits all go through the draft, so Save and the lamp cover them,
and `commitItemEdit` keeps `noteLog` / `resources` as item fields. Search reads
note text, resource names, captions, and extracted text.

**Attributes** sit at the top of Details with a count of filled cells and an
**Add attribute** key that opens `AttributeCreator` right there. Each cell
shows a type glyph, the name, and where it comes from (the type, a list, or
"This item only" with a remove key). Every type has a readable editor in
`components/Lists/attributes/AttributeValueField.tsx` (option keys, toggle
chips with lamps, chip entry, goal meter, formula readout, Today / Now with
"in 3 days", link host key, searchable item reference, list chip, galleries,
file chips with kind plates). `lib/attribute-type-catalog.ts` holds each
type's glyph, one-line description, and example.

**Attribute Demo.** `lib/attribute-demo.ts` seeds an "Attribute Demo" list
with one attribute of every type and one item, "Cybernetics (attribute
demo)", with every value filled, an item-only attribute, three dated notes,
and three resources. In the creator, **See every type filled in on the
Attribute Demo item →** creates it if missing and opens it.

## Files

| File | Purpose |
|------|---------|
| `useItemDetailDraft.ts` | The de-duplication seam: subscribes to the task store, loads the selected task into local draft state, and exposes the shared mutators (`addToCategory`, `removeFromCategory`, `setLists`, `addDependency`, `removeDependency`, `addTag`, `removeTag`, `addLink`, `removeLink`) plus store actions (`updateTask`, `addTask`, `deleteTask`) and `commitDraft` (ItemDetail save door → `commitItemEdit`). `getDraft` / `touchDraft` hold keystrokes that have not re-rendered the tree; `subscribeDraft` lets the save lamp follow those writes. `setTask` applies functional updates to that same ref, so a later field write keeps uncommitted keystrokes. `addDependency` returns `{ ok: false, cycleLabel }` instead of writing when `findCyclePath` would loop. Tag/link mutators delegate to the pure helpers in `lib/links.ts` and operate on the draft. |
| `ItemSaveFlag.tsx` | Fascia lamp beside Save Changes (popup) and beside Edit / Save Changes (page). Always visible. **Saved** (green) when the live draft matches the stored item; **Unsaved changes** (pink) otherwise. `role="status"`. |
| `useItemDetailSaveHotkey.ts` | **Cmd/Ctrl+S** calls the shell’s save while that item-detail root is in front. Skips the chord when another open dialog sits above it. Prevents the browser page-save dialog. |
| `useItemDetailDraft.test.tsx` | Cycle guard: refuse a reverse edge; accept an acyclic add. |
| `ItemActivityPanel.tsx` | Explorer sunken History well: when / what changed. Empty until the first recorded save. |
| `item-detail-chrome.css` | Milled fascia for page + popup (`.id95` / `.id95-dialog`): brushed bays, CRT title, metal keys, equal-fill tab bay with power lamps, History well + cycle path. |
| `CycleConfirmDialog.tsx` | Win95 `fm98-dialog`: “This would loop”, the cycle path, OK only (dependency already refused). |
| `CycleConfirmDialog.test.tsx` | Dialog copy; no add-anyway. |
| `TodoCommitmentFields.tsx` | Scheduling switches for Required / Prioritized on each period the item is already assigned to. Writes `todoMarks` immediately without saving the rest of the draft. |
| `ItemScheduleFlags.tsx` | Shared **Send to Scheduler** + **Auto-push** switches (same copy, same `scheduleable` / `autoPush` draft writes). Page passes `disabled={!isEditing}`; popup always editable. Date / week / month / year / deadline fields stay in each shell — popup clears sibling schedule fields and uses a week date-picker; page patches one field and gates edits. |
| `ItemEstimateField.tsx` | Shared Details-tab estimated-duration LiveInput (`touchDraft` + `setTask`, empty→`0`). `variant="popup"` keeps the Clock label + `min` suffix; `variant="page"` keeps “(minutes)” + read-only when not editing. Popup Time-tab estimate (`|| undefined`) stays popup-only. |
| `ReminderScheduleFields.tsx` | When / Repeat / Text me / Persistent on the Details tab for an item on the Reminders list. Repeat is once, every day, weekdays, every week, every month, every year, each new moon, or each full moon. Lunar picks fill the next 18:00 phase evening. Writes `scheduledDate`, `scheduledTime`, and `reminder`. Text me and Persistent default on (a missing flag stays on). A changed clock clears the sent and dismissed marks. The two switches do not. Shows “Sent to Inbox.” and a skipped-text note when those are set. The page and the popup commit this patch immediately so the header bell and the next delivery see it; the rest of the item still uses Save. |
| `ReminderScheduleFields.test.tsx` | Omitted flags read as on. Text me off and Persistent off keep the sent mark. |
| `ItemDetailPopup.tsx` | Compact modal/popover detail view used inline by Scheduler, Plan, To-Do, and the friend mission sheet. `data-ui-name="Item detail"` on `DialogContent`. Tabs are `resolveDetailView` output (type + lists + capabilities). A Reminders-list item shows When / Repeat / Text me / Persistent at the top of Details; those fields write through immediately. A People I Know person (catalog type person, or an item on that list) shows the biography first (`PersonDetail`: full name, nicknames, optional relation, date met with Est., how long known, time since last seen, Instagram, address precision, standing notes, dated notes, interactions, gift notes, Close, and days until the next birthday). Close creates the Gift ideas list; the folder list and the gift notes are labeled apart. The plaque draws a pixel cake that matches the milled fascia and the phosphor candle. A later folder of cute cake PNGs, the same idea as willpower gemstones and list orbs, is not built in this step, and this plaque does not load images. **Pipelines** follow (a Company pen; Company time is the blocks painted with that pen). Birthday and standing notes are edited in the biography, so Attributes omits those two ids. Includes the in-popup completion flow when the type is completable. Exports `TaskDetailPopup`. `stackAbove` paints it over another open dialog (the mission sheet stays underneath). Last tab per item is restored. The fascia lamp shows **Saved** or **Unsaved changes** the whole time the popup is open. Dirty close (draft vs stored task) uses the house unsaved-changes guard. Double-click a list badge closes the popup, then `requestNavigateToListAfterPaint` jumps Lists on the next frame so a large list does not freeze the detail view. Save / complete / missed / delete / subtasks handlers stay here (complete closes; subtasks are draft-only, edited in `SubtaskTree`). |
| `HabitLinkedDetail.tsx` | Details main pane for an item whose `sourceHabitId` attribute is set. Notes editor (`task.notes`) plus a read-only habit summary, including **Counts:** / **Minutes:** tag wiring (names only). **Habit settings** returns to that habit’s edit window. |
| `SubtaskTree.tsx` | Subtasks tab editor for both shells, shaped like Tidy's breakdown: add a step with minutes, then + on any step adds steps inside it, as deep as you like. Each add row stays open after Add. Rename and minutes edit in place. A step's minutes count as its own estimate or the sum inside (`lib/todo-steps`), shown as `=Nm`. Checking a step does not check its parent. Fold state is local. |
| `ItemDetailPage.tsx` | Full-screen detail/editor opened from the app shell (`data-ui-name="Item detail"` on the page root). Names still runs via the layout host. Task-only chrome (duration, urgency, molecular breakdown) is gated; other types get an adapted details view. A Reminders-list item shows When / Repeat / Text me / Persistent on Details; those fields write through immediately. A People I Know person shows the biography (optional relation, Close, gift notes, and the Gift ideas list when that list exists), then **Pipelines** (Company time follows the joined pen), on Details. Birthday and standing notes are edited in the biography. The birthday plaque draws a pixel cake; a later PNG folder is not loaded. Exports `EnhancedTaskDetail`. Open item + last tab persist across refresh. Double-click a list badge calls `requestNavigateToListAfterPaint` with that badge’s list id (the parent folder when the list is filed). The shell’s navigate event closes the page. When the screen was opened from a habit, that double-click does **not** take Back’s return to habit settings — Back and **Habit settings** still do. The desk stays mounted underneath; long lists window their rows so the jump can paint. The fascia lamp shows **Saved** or **Unsaved changes** the whole time the page is open, including while Edit is the action (a clean item reads Saved). Save / complete (with `actualDuration`) / missed / delete / `SplitStepsComposer` stay page-only. Subtasks are the `SubtaskTree` on `task.subtasks` and save as you edit; deleting a step also deletes an older Task-backed subtask with the same id. |
| `ItemNotesLog.tsx` | Notes tab: composer (day, time stamp, Cmd/Ctrl+Enter), pinned standing note (`Task.notes`), dated entries grouped by day. `NotesPeek` is the rail face. |
| `ItemResourcesPanel.tsx` | Resources tab: drop tray, cards, viewer (image / PDF / audio / video / text), caption, Open / Download / Remove. |
| `ItemAttributesSection.tsx` | Shared attributes surface. When the type has `detailLayout`, renders a large hero image and featured fields above the rest of the schema, then list-defined attributes, item-only leftovers, and `AttributeCreator`. `omitAttributeIds` hides fields edited on another panel of the same view. On a person, birthday and standing notes are omitted so the biography is their only editor. |
| `item-attributes.test.tsx` | Hero/featured layout + attribute creator for catalog-style types. |
| `BodyPanel.tsx` | The `"body"` detail panel for document-type items. Default face is **rendered prose** (HTML stripped to plain when the body looks like markup); an explicit **Source** / **Rendered** toggle reveals the raw editor — never a raw-HTML face by default. Markdown still uses `RichTextEditor`. Persists through `useTaskStore.updateTask`, debounced (default 500ms) with a flush on blur/unmount. Props: `taskId`, `readOnly?`, `debounceMs?`. |
| `AttributeCreator.tsx` | Inline control for defining a brand-new typed attribute: a type palette grouped by Words / Numbers / Choices / Time / Media / References with a description of the chosen type, its settings (options, unit, labels, formula, scope), name, target, and initial value. The attribute can be added to one of the item's lists — persisted onto that list's `itemAttributes` schema so every item in the list gains it — or kept on just this item. Props: `categories`, `itemCategoryIds`, `existingIds`, `onCreate(def, value, listId)`. |
| `ItemTagChip.tsx` | One item-tag chip. Value is the string name. When `normalizeTag(name)` matches a Tracking catalog tag, shows that tag’s color bead. Double-click opens `openTagSettings(id)` or `openTagSettingsFromName(name)`. Used by `TagInput` and Item Detail view-mode badges. |
| `TagInput.tsx` | Presentational chip/token tag editor. Renders applied tags as removable `ItemTagChip`s and a text field that adds a tag on Enter/comma, with autocomplete suggestions drawn from all tags in use across `taskRepository.getAll()` (catalog matches show a bead in the list). Normalization via `lib/links.ts`. Props: `tags`, `onAdd`, `onRemove`. Chips stay strings. They are not Tracking tag ids. A Tracking catalog rename follows a string that used the old normalized name (`lib/catalog-tag.ts`). |
| `LinkPicker.tsx` | Presentational control for adding a typed link: a relation `Select` from the `lib/links.ts` `RELATIONS` catalog plus a target-item typeahead searching the repository by title/description (excluding the current item). Props: `sourceId`, `onAdd(relation, targetId)`. |
| `RelatedItemsPanel.tsx` | Shows an item's relationships: outgoing links grouped by relation (each removable) and discovered backlinks labelled with the inverse relation (e.g. "Y blocks X" surfaces as "blocked by Y" on X) via `useTaskStore.getBacklinks`. Rows open the linked item. Props: `task`, `onOpenItem(id)`, `onRemoveLink(linkId)`. |
| `ItemDetail.test.tsx` | Vitest coverage for the presentational pieces: `TagInput` (add/remove, catalog bead, double-click → tag settings), `LinkPicker` (search + add link), and `RelatedItemsPanel` (forward links, removal, inverse-labelled backlinks). |
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

## Time and pens

_Last mapped: 2026-10-16._ The popup's **Time** tab (`ItemDetailPopup.tsx` ~1395) shows estimated vs actual, the `timeLogs` list, then **Pens and tracked time** (`ItemPenTime.tsx`). The page shows the same bay at the foot of **Scheduling** (tasks only, read-only when not editing). `ItemPenLinksField` edits `Task.penLinks` through the shell's draft (`touchDraft` + `setTask`); the first link is the clock pen. `ItemTrackedTime` reads `trackedTimeForItem`: total, est-left or past-est, a thin bar, the split (by pen · on the clock · logged), and the counted blocks (12, then "+ N more"). Pen settings edits the same field (**Linked items**). Built for [`docs/TODO_REDESIGN.md`](../../docs/TODO_REDESIGN.md) Phase 5 (slice E). Operations totals read the same function (slice F). **Planned:** the To Do lid reads it too (Phase 6, slice L).

## Planned — steps as items, stacked popups, one step tree

_Last mapped: 2026-10-16._ Today a step is a `Subtask` in `task.subtasks` with no notes, files or links. **Planned** in [`docs/TODO_REDESIGN.md`](../../docs/TODO_REDESIGN.md):
- **Phase 9.** `SubtaskTree.tsx` and the To Do lid's `TodoBreakdown.tsx` become hosts of one shared `components/steps/StepTree.tsx`, with drag, multi-select and `est · parts · spent` (Phase 6).
- **Phase 10.** Steps carry a Bare minimum / Goal / Exceptional tag. The Subtasks tab and Time tab show the task's B / G / E percent (weighted by the tree, each child an equal share of its parent) and the level it is completed to. The step readout's percent changes from a flat leaf count to the weighted one.
- **Phase 11.** A step becomes an item when needed (`Subtask.itemId`, the item has `parentTaskId` and `stepOf`). The tree stays the source of truth for order, done, estimate, needs, tier and points. `TaskDetailPopup` gains a stack: opening a step's item pushes a layer with a breadcrumb and Back, and Esc closes only the top. `SubtaskTree` rows get **↗**. The older Task-backed subtask that a step delete also removes (above) is a separate, legacy path; Phase 11 maps it before reusing `parentTaskId`.
- **Phase 12.** A **Card** key opens the To Do task card when the task is on the current period.
- **Phase 10 / 15.** Steps can carry a spark mark (`Subtask.sparkedAt`). A notice note from the To Do row lands in `noteLog`, tagged `notice`.
- **Phase 14.** The Dependencies tab gains an **Unlocks** list (what waits on this item) beside what it needs. Parts stay on Subtasks: an open step makes the item incomplete, never locked. A task cannot list its own part or parent as a prerequisite.

## Dependencies

`addDependency` on the shared hook walks `findCyclePath`. A loop opens
`CycleConfirmDialog` (“This would loop”) and does **not** write the edge.

## Tags & Links

Relation logic lives in `lib/links.ts` (pure, tested). Item tags are the same
string list: `TagInput` / `ItemTagChip` add and remove them; a catalog match
shows a bead; double-click opens tag settings (create-from-name when unmatched).
A Tracking catalog rename can rewrite a string that used the old normalized name.
Context badges are not Tags and never open tag settings. The detail view does not
grow a second habit-tag editor and does not store `TrackTag` ids on `task.tags`.
Both detail variants mount a "Tags" section (`TagInput` in edit; matching chips
in page view mode) and related items (`LinkPicker` + `RelatedItemsPanel`: the
popup's **Links** tab, the page's Related card) wired to the shared draft mutators. "Open item" navigation is handled in-place:
each variant keeps a local `overrideId` so clicking a related/backlinked row
swaps the detail view to that item without leaving the surface (reset when the
host opens a new item).

## Import paths

Import the surfaces directly:

- `@/components/ItemDetail/ItemDetailPopup` → `TaskDetailPopup`
- `@/components/ItemDetail/ItemDetailPage` → `EnhancedTaskDetail`
