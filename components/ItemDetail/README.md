# ItemDetail

The consolidated **Brain2** item-detail surface (Spec §5.5 / docs/SPEC_MAPPING.md §5). This is
where one record shows every honest join — tags, typed links, lists, schedule,
body, history — so the same item can be **used in as many rooms as possible**
(Lists, Scheduler, Tracking, Modules, Reviews, Analytics). Isolation is a bug.

> Every way out is guarded. See **Unsaved guard and known gaps**.
>
> The Links tab is in `links/` (composer, ledger, radial plate, matrix, path).
> What that redesign still leaves open is the status board in
> [`docs/LINKS_REDESIGN.md`](../../docs/LINKS_REDESIGN.md).

## Unsaved guard and known gaps

_Last mapped: 2026-10-24_

- Every way out is guarded (plan steps 0.1–0.3). `useUnsavedGuard` takes
  `isDirty` as a function (`isDraftDirty` from the draft hook, read at call
  time) and returns `guardAction(action)`. The page routes opening another
  item, the list-badge jump, Back, and habit settings through it. The popup
  routes opening another item through it. A list-badge jump or the minimize
  key on the popup leaves the draft mounted on the dock instead of closing.
  Close on that dock still asks. `useItemDetailUnloadGuard` asks the browser
  before a dirty window closes.
- Nothing else changes room under an open popup: only the shells call
  `requestNavigateToListAfterPaint`, so there is no global leave guard.
- Person text fields are isolated (step 1.1): keys go to `touchDraft`, blur
  commits, so typing does not re-render the popup.
- Render diet (step 1.2): the popup's `detailView` memo keys on the item's
  `type` and `lists` only. Attribute editors were already isolated; their
  keys now reach the draft through `onLiveValue` → `touchDraft`.
- The person block passes the Company pens editor into `PersonDetail`'s
  `pipelines` slot and its guarded `handleNavigateToList` (step 3.1).

## Undo and automatic structure links

_Last mapped: 2026-10-20_

- **Cmd/Ctrl+Z** undoes the last edit to the open draft; Shift+Z or Ctrl+Y redoes
  it (`useItemDetailUndoHotkey`, both shells). `useItemDetailDraft.setTask` keeps
  the history: bursts within 500 ms are one step, capped at 50, and loading an
  item or saving starts fresh. Text fields keep the browser's own undo, a dialog
  above keeps the chord, and with nothing to undo here the chord falls through to
  the app-wide stack (`hooks/useUndoHotkey.ts`). The page writes subtask edits
  straight to the store, so undo writes the restored subtasks back there too.
  **Planned:** the keystroke fields (`touchDraft`) are not stepped.
- **Links tab, structure edges.** `lib/structure-edges.ts` derives edges from
  `parentTaskId`, `stepOf`, `subtasks`, `penLinks` and `lists`: parent task and
  enclosing steps (`part-of`), each subtask (`has-part`), tracking pens (own or
  inherited by a step), and lists. Always on, never stored, no Pin. Pens, lists
  and steps with no item yet are virtual nodes (`pen:`, `list:`, `step:`);
  `useLinkItems.factsFor` names them. A step node opens by making its item. Pens
  and lists have nothing to open. Dismiss still hides one.

## Public door

_Last mapped: 2026-10-24_

Popup and page are both public entries.

- **Popup** — `TaskDetailPopup` from `@/components/ItemDetail/ItemDetailPopup`. Callers: the app shell (`app/page.tsx`), Lists, Scheduler, Home, Plan, To Do, Mobile, the friend mission sheet, and friend mission detail.
- **Page** — `EnhancedTaskDetail` from `@/components/ItemDetail/ItemDetailPage`. Callers: the app shell, the module popout, and the sheet popout.

`useItemDetailDraft` is an interior. Its callers are the popup and the page.

Interiors (imported from this folder): `useItemDetailDraft`, `ItemSaveFlag`, `useItemDetailSaveHotkey`, `BodyPanel`, `HabitLinkedDetail`, `TodoCommitmentFields`, `ItemEstimateField`, `ItemScheduleFlags`, `ReminderScheduleFields`, `ItemAttributesSection`, `AttributeCreator`, `TagInput`, `links/RichLinksPanel` (and its parts), `ItemActivityPanel`, `ItemSettingsPanel`, `AttributeSettingsDialog`, `ItemDetailDock`, `useItemDetailUnloadGuard`, `CycleConfirmDialog`, `SubtaskTree`, `InboxClarifyKey`, `item-detail-chrome.css`.

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
surface is in front. A dialog stacked on top keeps the chord. An inbox item (stage chip INBOX, not completed) gets a smaller **Clarify** key beside that chip. It commits the live draft (including uncommitted keystrokes) through `clarifyInboxItems`, the same leave-inbox path as inbox Save & Clarify. Hover is pale cyber blue. Velvet / orb
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

_Last mapped: 2026-10-24_

Identity leads: the fascia holds the CRT title, then the item's **type plates**
(lamp in the type color; double-click opens the type editor) and the stage
chip, then the keys. Details is two regions: the main column starts with the
**Attributes** instrument (`ItemAttributesSection`), then the description and
task fields. The Detailed Description field keeps the height you drag it to while you switch tabs or reopen that item in this session (`sizeKey` on `IsolatedTextarea`, `brain2-textarea-h`). The rail beside it is where the item lives: Lists, Tags, a
**Notes** peek (one-line add for today plus the latest entries), Sent, Status.

Every item, not only tasks, gets these tabs:

- **Notes** — a dated log (`ItemNotesLog`, `Task.noteLog`). _Last mapped:
  2026-10-16:_ for a person the tab is `PersonNotes`
  (`components/People/person-notes.tsx`): the standing note is the `notes`
  attribute, old `personProfile.noteLog` entries fold in (persist v19), and
  ingest text on `Task.notes` shows as **Captured**. The tab count counts
  folded entries. Each entry has a
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
  On desktop a file or folder can be **linked** instead of copied (see
  Linked resources below).
- **Links** — the Related picker and backlinks (moved out of the rail).

Notes and Resources are `ItemDetailPanel`s that `resolveDetailView` adds to
every item; a list can hide them (List Settings → detail panels). This item can hide or show its own tabs from **Item settings** (`hiddenDetailPanels` / `shownDetailPanels` on the item). **Details** stays. Links and History are shell tabs and can be hidden on this item. Item settings is not a tab. The gear opens it as a dialog (`data-ui-name="Item settings"`). On the popup the gear and the minimize key sit in the upper right, beside Close. Opening a list from the popup minimizes it and keeps the draft. That dialog can hide an attribute on this item (`hiddenAttributeIds`) and open **Attribute settings** for the shared definition. Tab keys carry phosphor counts. Notes, resources, and
attribute edits all go through the draft, so Save and the lamp cover them,
and `commitItemEdit` keeps `noteLog` / `resources` as item fields. Search reads
note text, resource names, captions, and extracted text.

**Attributes** sit at the top of Details with a count of filled cells and an
**Add attribute** key that opens `AttributeCreator` right there. **Add attribute** is a pale silver keycap (`.id-keycap`), the same cap as To do word keys. Each cell
shows a type glyph, the name, and where it comes from (the type, a list, or
"This item only" with a remove key). Every type has a readable editor in
`components/Lists/attributes/AttributeValueField.tsx` (option keys, toggle
chips with lamps, chip entry, goal meter, formula readout, Today / Now with
"in 3 days", link host key, searchable item reference, list chip, galleries,
file chips with kind plates). `lib/attribute-type-catalog.ts` holds each
type's glyph, one-line description, and example.

_Last mapped: 2026-10-24._ A **text list** (`multistring`) can show **Bubbles** (chips; drag to reorder) or **Lines** (one entry per line; the cell header already names the attribute). The choice is remembered per attribute id (`brain2-text-list-view`). Double-click an entry to edit it in a white box that grows with the text. Enter commits. **Make Brain2 List** creates a list whose default name is the attribute name, plus one item per line, then turns an item-only text list into a **list reference** (`asListReference` in `lib/text-list-to-list.ts`). A shared definition stays a text list and keeps `textListIds`, and the cell shows that list's items instead of the old lines. A **list reference** uses the same Bubbles and Lines face for that list's items. In Bubbles, a click opens that item in a popup over this one. In Lines, double-click renames the item. The list title is a card with that list's orb. Double-click it to open the list. In Bubbles, each item is a card with its own orb. An item reference uses the list's orb in place of a color dot. Renaming the list or the attribute does not rename the other.

**Attribute Demo.** `lib/attribute-demo.ts` seeds an "Attribute Demo" list
with one attribute of every type and one item, "Cybernetics (attribute
demo)", with every value filled, an item-only attribute, three dated notes,
and three resources. In the creator, **See every type filled in on the
Attribute Demo item →** creates it if missing and opens it.

## Files

_Last mapped: 2026-10-24._

| File | Purpose |
|------|---------|
| `useItemDetailDraft.ts` | The de-duplication seam: subscribes to the task store, loads the selected task into local draft state, and exposes the shared mutators (`addToCategory`, `removeFromCategory`, `setLists`, `addDependency`, `removeDependency`, `addTag`, `removeTag`, `addLink`, `removeLink`) plus store actions (`updateTask`, `addTask`, `deleteTask`) and `commitDraft` (ItemDetail save door → `commitItemEdit`). `getDraft` / `touchDraft` hold keystrokes that have not re-rendered the tree; `subscribeDraft` lets the save lamp follow those writes. `setTask` applies functional updates to that same ref, so a later field write keeps uncommitted keystrokes. `addDependency` returns `{ ok: false, cycleLabel }` instead of writing when `findCyclePath` would loop. Tag/link mutators delegate to the pure helpers in `lib/links.ts` and operate on the draft. |
| `ItemSaveFlag.tsx` | Fascia lamp beside Save Changes (popup) and beside Edit / Save Changes (page). Always visible. **Saved** (green) when the live draft matches the stored item; **Unsaved changes** (pink) otherwise. `role="status"`. |
| `InboxClarifyKey.tsx` | Small **Clarify** key beside the INBOX stage chip when the open item is not completed. Commits the live draft through `clarifyInboxItems`. |
| `ItemSettingsPanel.tsx` | The body of the Item settings dialog (fascia gear on the page and the popup). Copyable item id, which attributes show on Details, this item's display names, and which tabs this item shows. A name opens attribute settings. |
| `useItemDetailSaveHotkey.ts` | **Cmd/Ctrl+S** calls the shell’s save while that item-detail root is in front. Skips the chord when another open dialog sits above it. Prevents the browser page-save dialog. |
| `useItemDetailDraft.test.tsx` | Cycle guard: refuse a reverse edge; accept an acyclic add. |
| `AttributeSettingsDialog.tsx` | Popup over item detail for one attribute: the shared name, a copyable id, the type, when it was created, where it is defined, and the values items currently hold. Delete removes that definition from every list, type, and item. The display name on one item stays in Item settings. A new definition stores `createdAt`. Older ones say not recorded. |
| `ItemDetailDock.tsx` | Where a minimized popup waits. A short bar (title and close) or the item's icon. The popup stays mounted, so the draft stays. Click the title or the icon to open it again. Close still asks about unsaved changes. |
| `ItemActivityPanel.tsx` | Explorer sunken History well: when / what changed. Empty until the first recorded save. |
| `item-detail-chrome.css` | Milled fascia for page + popup (`.id95` / `.id95-dialog`): brushed bays, CRT title, metal keys, equal-fill tab bay with power lamps, History well + cycle path. |
| `CycleConfirmDialog.tsx` | Win95 `fm98-dialog`: “This would loop”, the cycle path, OK only (dependency already refused). |
| `CycleConfirmDialog.test.tsx` | Dialog copy; no add-anyway. |
| `TodoCommitmentFields.tsx` | Scheduling switches for Required / Prioritized on each period the item is already assigned to. Writes `todoMarks` immediately without saving the rest of the draft. |
| `ItemScheduleFlags.tsx` | Shared **Send to Scheduler** + **Auto-push** switches (same copy, same `scheduleable` / `autoPush` draft writes). Page passes `disabled={!isEditing}`; popup always editable. Date / week / month / year / deadline fields stay in each shell — popup clears sibling schedule fields and uses a week date-picker; page patches one field and gates edits. |
| `ItemEstimateField.tsx` | Shared Details-tab estimated-duration LiveInput (`touchDraft` + `setTask`, empty→`0`). `variant="popup"` keeps the Clock label + `min` suffix; `variant="page"` keeps “(minutes)” + read-only when not editing. Popup Time-tab estimate (`|| undefined`) stays popup-only. |
| `ReminderScheduleFields.tsx` | When / Repeat / Text me / Persistent on the Details tab for an item on the Reminders list. Repeat is once, every day, weekdays, every week, every month, every year, each new moon, or each full moon. Lunar picks fill the next 18:00 phase evening. Writes `scheduledDate`, `scheduledTime`, and `reminder`. Text me and Persistent default on (a missing flag stays on). A changed clock clears the sent and dismissed marks. The two switches do not. Shows “Sent to Inbox.” and a skipped-text note when those are set. The page and the popup commit this patch immediately so the header bell and the next delivery see it; the rest of the item still uses Save. |
| `ReminderScheduleFields.test.tsx` | Omitted flags read as on. Text me off and Persistent off keep the sent mark. |
| `ItemDetailPopup.tsx` | Compact modal/popover detail view used inline by Scheduler, Plan, To-Do, and the friend mission sheet. `data-ui-name="Item detail"` on `DialogContent`. Tabs are `resolveDetailView` output (type + lists + capabilities). A Reminders-list item shows When / Repeat / Text me / Persistent at the top of Details; those fields write through immediately. A People I Know person (catalog type person, or an item on that list) shows the biography first (`PersonDetail`: full name, nicknames, optional relation, date met with Est., how long known, time since last seen, Instagram, address precision, interactions, gift notes, Close, and days until the next birthday; standing and dated notes are on the Notes tab). Close creates the Gift ideas list; the folder list and the gift notes are labeled apart. The plaque draws a pixel cake that matches the milled fascia and the phosphor candle. A later folder of cute cake PNGs, the same idea as willpower gemstones and list orbs, is not built in this step, and this plaque does not load images. **Pipelines** follow (a Company pen; Company time is the blocks painted with that pen). Birthday and standing notes are edited in the biography, so Attributes omits those two ids. Includes the in-popup completion flow when the type is completable. Exports `TaskDetailPopup`. `stackAbove` paints it over another open dialog (the mission sheet stays underneath). Last tab per item is restored. Minimize leaves `ItemDetailDock` (a bar or the item icon) and keeps the draft mounted. The fascia gear opens Item settings as a dialog, not a tab. The fascia lamp shows **Saved** or **Unsaved changes** the whole time the popup is open. Every way out (close, list badge, opening another item) goes through the house unsaved-changes guard (`guardAction`). Double-click a list badge minimizes the popup onto `ItemDetailDock` (the draft stays, including keystrokes not yet blurred), then `requestNavigateToListAfterPaint` jumps Lists on the next frame so a large list does not freeze the detail view. Close on the dock still asks about unsaved changes. Save / complete / missed / delete / subtasks handlers stay here (complete closes; subtasks are draft-only, edited in `SubtaskTree`). |
| `HabitLinkedDetail.tsx` | Details main pane for an item whose `sourceHabitId` attribute is set. Notes editor (`task.notes`) plus a read-only habit summary, including **Counts:** / **Minutes:** tag wiring (names only). **Habit settings** returns to that habit’s edit window. |
| `SubtaskTree.tsx` | Subtasks tab for both shells. Its own small outline (nested `ul.id-sub-list`, `li.id-sub-item`), not the shared `StepTree` the To Do lid uses; names and nesting match the lid, the markup and keys do not. Each row: name (edit in place), parts (`n/m`), minutes (edit in place), the sum of the steps inside, **+** (add a step inside) and delete. A name field adds a step on Enter. Phase 11: `onOpenStep` (dot click and ↗ open the step's item on top) and `StepItemSubtasks` (a step item's Subtasks tab). **Planned** here (they exist only in `StepTree`): drag and Alt+↑/↓ / Tab moves, Shift/Cmd multi-select, remembered folds, Hide locked and Show next only. |
| `ItemDetailPage.tsx` | Full-screen detail/editor opened from the app shell (`data-ui-name="Item detail"` on the page root). Names still runs via the layout host. Task-only chrome (duration, urgency, molecular breakdown) is gated; other types get an adapted details view. A Reminders-list item shows When / Repeat / Text me / Persistent on Details; those fields write through immediately. A People I Know person shows the biography (optional relation, Close, gift notes, and the Gift ideas list when that list exists), then **Pipelines** (Company time follows the joined pen), on Details. Birthday and standing notes are edited in the biography. The birthday plaque draws a pixel cake; a later PNG folder is not loaded. Exports `EnhancedTaskDetail`. Open item + last tab persist across refresh. Double-click a list badge calls `requestNavigateToListAfterPaint` with that badge’s list id (the parent folder when the list is filed). The shell’s navigate event closes the page. When the screen was opened from a habit, that double-click does **not** take Back’s return to habit settings — Back and **Habit settings** still do. The desk stays mounted underneath; long lists window their rows so the jump can paint. The fascia lamp shows **Saved** or **Unsaved changes** the whole time the page is open, including while Edit is the action (a clean item reads Saved). Save / complete (with `actualDuration`) / missed / delete / `SplitStepsComposer` stay page-only. Subtasks are the `SubtaskTree` on `task.subtasks` and save as you edit; deleting a step also deletes an older Task-backed subtask with the same id. |
| `ItemNotesLog.tsx` | Notes tab: composer (day, time stamp, Cmd/Ctrl+Enter), pinned standing note (`Task.notes`), dated entries grouped by day. `NotesPeek` is the rail face. |
| `ItemResourcesPanel.tsx` | Resources tab: drop tray with Auto / Copy / Link (desktop), cards, viewer (image / PDF / audio / video / text / folder), caption, Open / Download / Remove; linked files add Show in Finder and Locate…. |
| `ItemResourcesPanel.test.tsx` | Linking on drop and from the folder picker, following a move, Missing and Locate, and the web fallback, with a mocked `fileLinks` bridge. |
| `ItemAttributesSection.tsx` | Shared attributes surface. When the type has `detailLayout`, renders a large hero image and featured fields above the rest of the schema, then list-defined attributes, item-only leftovers, and `AttributeCreator`. `omitAttributeIds` hides fields edited on another panel of the same view. On a person, birthday and standing notes are omitted so the biography is their only editor. _Last mapped: 2026-10-24:_ `onLiveValue(id, value)` gets text, number and link keys before blur; both shells write it with `touchDraft`, so Cmd+S keeps unblurred text. Text lists and list references pass `textListIds`, `attributeLabels`, `onBindTextList`, and `onOpenTextList`. The cell name uses `attributeLabels` when this item set one. **Add attribute** is `.id-keycap`. |
| `item-attributes.test.tsx` | Hero/featured layout + attribute creator for catalog-style types. |
| `BodyPanel.tsx` | The `"body"` detail panel for document-type items. Default face is **rendered prose** (HTML stripped to plain when the body looks like markup); an explicit **Source** / **Rendered** toggle reveals the raw editor — never a raw-HTML face by default. Markdown still uses `RichTextEditor`. Persists through `useTaskStore.updateTask`, debounced (default 500ms) with a flush on blur/unmount. Props: `taskId`, `readOnly?`, `debounceMs?`. |
| `AttributeCreator.tsx` | Inline control for defining a brand-new typed attribute: a type palette grouped by Words / Numbers / Choices / Time / Media / References with a description of the chosen type, its settings (options, unit, labels, formula, scope), name, target, and initial value. **Scope list** on a list or item attribute, and **Source list** on a selection, are the searchable list picker (`SingleListPicker`: search, **Any list** or **Choose a list**, **New list**). **Add to** stays a short menu of the lists this item already belongs to. The attribute can be added to one of those lists — persisted onto that list's `itemAttributes` schema so every item in the list gains it — or kept on just this item. Props: `categories`, `itemCategoryIds`, `existingIds`, `onCreate(def, value, listId)`. |
| `ItemTagChip.tsx` | One item-tag chip. Value is the string name. When `normalizeTag(name)` matches a Tracking catalog tag, shows that tag’s color bead. Double-click opens `openTagSettings(id)` or `openTagSettingsFromName(name)`. Used by `TagInput` and Item Detail view-mode badges. |
| `TagInput.tsx` | Presentational chip/token tag editor. Renders applied tags as removable `ItemTagChip`s and a text field that adds a tag on Enter/comma, with autocomplete suggestions drawn from all tags in use across `taskRepository.getAll()` (catalog matches show a bead in the list). Normalization via `lib/links.ts`. Props: `tags`, `onAdd`, `onRemove`. Chips stay strings. They are not Tracking tag ids. A Tracking catalog rename follows a string that used the old normalized name (`lib/catalog-tag.ts`). |
| `links/` | The Links tab. See **Links tab** above. _Last mapped: 2026-10-16._ The target search ends with Create "<query>": it adds the item to the task store at once (type = the relation's first `toTypes`, else item). The link itself stays a draft. Type selects use `NativeSelect`. _Last mapped: 2026-10-16_ ([`LINKS_REDESIGN.md`](../../docs/LINKS_REDESIGN.md) L3–L6): `use-links-graph.ts` computes derived edges (only with **with derived** on), the shelf, density and checks for the open draft. The panel adds a readout row and a view switch: Radial (`LinkConstellation.tsx`), Matrix (`LinkMatrix.tsx`), Path (`LinkPath.tsx`), Ledger (`LinkLedger.tsx`). `LinkComposer.tsx` is the sentence that adds a link. `relation-phrase.ts` guesses the reverse of a new relation phrase for `NewRelationForm`. `SuggestionShelf.tsx` accepts a draft link, dismisses one (`dismissedLinkSuggestions`), or mutes it for this viewer. `EdgeInspector.tsx` is the proof card on **why?**. The composer pre-checks a new link: an acyclic loop asks `window.confirm`; other checks show as a note. Ledger rows show a neutral **check** tag and hide Confirm on `quiet` relations. |
| `ItemDetail.test.tsx` | Vitest coverage for the presentational pieces: `TagInput` (add/remove, catalog bead, double-click → tag settings), and `RichLinksPanel` (sentence add, remove, inverse-labelled incoming links with Confirm, one mutual row, Create a relation, a suggested edge with Dismiss). |
| `ItemDetailPopup.test.tsx` | Popup hides scheduling / Complete / scheduler chrome for non-task types (e.g. Furniture). History tab; save records the ledger. |
| `ItemDetailPage.test.tsx` | Full-screen detail follows `resolveDetailView`; Task chrome gated. History tab; save records estimated-duration changes. A habit-linked item shows notes, a completion summary, and **Habit settings**. A generic item does not. The list chip opens that list id. |

## Linked resources

_Last mapped: 2026-10-16_

Desktop only. A linked resource keeps the file's path, not its bytes
(`ItemResource.link`, `uri` = `link:<id>`, helpers in `lib/resource-links.ts`).
Plan and limits: [`docs/RESOURCE_LINKS.md`](../../docs/RESOURCE_LINKS.md).

- The tray has **Auto / Copy / Link**. It decides for drops and Attach files.
  Auto links folders and files of 50 MB or more. A folder is always linked.
  **Link folder** opens the system picker. The switch is not remembered.
- Cards and the viewer carry a **Linked** or **Missing** lamp. The viewer shows
  the path (`~/…`), Open (the file's own app), Show in Finder, Locate…, and
  Remove. Images, PDFs, audio, video, and text preview from disk through
  `brain2-link://`. A folder shows its file count and file list.
- When the tab opens, each link is checked once (`fileLinks.resolve`). A moved
  file is followed and the new path goes through the draft, so Save keeps it.
  Missing is shown only; it does not dirty the draft.
- Search reads the text pulled out once at link time: PDF text, a text file's
  head, or a folder's file list.
- On the web and the phone a link shows its name, size, and text, with a note
  that it lives on another computer.
- `write` sets `latest.current` before `onChange`. Extraction can land before
  the parent re-renders, and reading the prop then would drop the new card.

**Planned:** check every link at app start, not only when the tab opens.

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

_Last mapped: 2026-10-16._ The popup's **Time** tab (`ItemDetailPopup.tsx` ~1395) shows estimated vs actual, the `timeLogs` list, then **Pens and tracked time** (`ItemPenTime.tsx`). The page shows the same bay at the foot of **Scheduling** (tasks only, read-only when not editing). `ItemPenLinksField` edits `Task.penLinks` through the shell's draft (`touchDraft` + `setTask`); the first link is the clock pen. `ItemTrackedTime` reads `trackedTimeForItem`: total, est-left or past-est, a thin bar, for items with steps an est · parts · spent line (`timeTrio`, `partsMinutes` from `lib/tracked-time.ts`; Phase 6 slice L), the split (by pen · on the clock · logged), and the counted blocks (12, then "+ N more"). Pen settings edits the same field (**Linked items**). Built for [`docs/TODO_REDESIGN.md`](../../docs/TODO_REDESIGN.md) Phase 5 (slice E). Operations totals read the same function (slice F). The To Do rows and lid read it too (Phase 6, slice L; [To Do README](../Home/ToDo/README.md)).

## Planned — steps as items, stacked popups, one step tree

_Last mapped: 2026-10-16._ Today a step is a `Subtask` in `task.subtasks` with no notes, files or links. **Planned** in [`docs/TODO_REDESIGN.md`](../../docs/TODO_REDESIGN.md):
- **Phase 9.** _Last mapped: 2026-10-16._ **Built (slice K), not committed:** `SubtaskTree.tsx` and the To Do lid's `TodoBreakdown.tsx` host one shared `components/steps/StepTree.tsx`, with drag and multi-select. Still **Planned** here: spent on each row and the ↗ (Phase 11).
- **Phase 10.** Steps carry a Bare minimum / Goal / Exceptional tag. The Subtasks tab and Time tab show the task's B / G / E percent (weighted by the tree, each child an equal share of its parent) and the level it is completed to. The step readout's percent changes from a flat leaf count to the weighted one.
- **Phase 11.** _Last mapped: 2026-10-16._ **Built (slice M), not committed.** A step becomes an item the first time it opens (`Subtask.itemId`; the item has `parentTaskId` and `stepOf`; `lib/step-items.ts`). The tree stays the source of truth for order, done, estimate, needs, tier and points; the item keeps a read mirror of name and estimate, and edits to them go back to the step (`updateStepField`, via `components/steps/StepItemStack.tsx`). `TaskDetailPopup` takes `layerHeader` and `onStepComplete`, and marks a layered popup `data-item-layer`; a popup underneath ignores clicks inside it (`layerSafeDismiss`). On a step item: Complete ticks the step and closes the layer; Missed and the Status picker are hidden; Subtasks shows the steps inside that step, written to the parent's tree (`StepItemSubtasks`). `SubtaskTree` rows get the dot click and **↗** (`onOpenStep`) on a stored task, and the tier tags (`tierTags`). Step item ids are `step-item-…`, never a step id, so the page's legacy delete of a Task-backed subtask with the step's id (above) never hits one. **Card** on a step item is built (Phase 12). **Planned:** the gauge on its bar (slice N).
- **Phase 12.** _Last mapped: 2026-10-16._ **Built (slice O), not committed.** A **Card** key (key row, after Missed) opens the To Do task card while a To Do panel is mounted (`useTaskCardStore` `hosts`) and the task is open and on today / this week / this month (`onCurrentPeriod`). A step item's **Card** opens the parent's card at the step. It closes item detail first (or clears the step layers). The card's **↗ Item** opens item detail back on top.
- **Phase 10 / 15.** Steps can carry a spark mark (`Subtask.sparkedAt`). A notice note from the To Do row lands in `noteLog`, tagged `notice`.
- **Phase 14.** The Dependencies tab gains an **Unlocks** list (what waits on this item) beside what it needs. Parts stay on Subtasks: an open step makes the item incomplete, never locked. A task cannot list its own part or parent as a prerequisite.

## Dependencies

Dependencies on the page and the popup are `ItemPicker` in multi mode (search, tick the items that must finish first). A loop still refuses. `addDependency` on the shared hook walks `findCyclePath`. A loop opens `CycleConfirmDialog` (“This would loop”) and does **not** write the edge.

## Tags & Links

Relation logic lives in `lib/links.ts` (pure, tested). Item tags are the same
string list: `TagInput` / `ItemTagChip` add and remove them; a catalog match
shows a bead; double-click opens tag settings (create-from-name when unmatched).
A Tracking catalog rename can rewrite a string that used the old normalized name.
Context badges are not Tags and never open tag settings. The detail view does not
grow a second habit-tag editor and does not store `TrackTag` ids on `task.tags`.
Both detail variants mount a "Tags" section (`TagInput` in edit; matching chips
in page view mode) and related items (`RichLinksPanel`: the
popup's **Links** tab, the page's Related card) wired to the shared draft mutators. "Open item" navigation is handled in-place:
each variant keeps a local `overrideId` so opening a linked row (through
the unsaved guard) swaps the detail view to that item without leaving the surface (reset when the
host opens a new item).

## Import paths

Import the surfaces directly:

- `@/components/ItemDetail/ItemDetailPopup` → `TaskDetailPopup`
- `@/components/ItemDetail/ItemDetailPage` → `EnhancedTaskDetail`
