## Agent card

_Last mapped: 2026-10-28_

This room shows one item with its tags, typed links, lists, schedule, body, and history. On a phone (`max-width: 767px`) the tab keys are content-wide keycaps in normal flow, so a wrapped key sits above the panel instead of covering it. The fascia word keys (type, stage, Saved, Save, Complete, Missed, Delete) use that same silver skirt. Fields are 16px, and the popup is a sheet that starts below the status bar so Close can be tapped. In the iOS shell that offset is `--phone-sheet-top`. A click on the dimmed page still saves and minimizes. Desktop chrome is unchanged. Item detail → Subtasks is one of the three task editors, and it is the whole record. The drawer and the task card stay in To do. See `components/Home/ToDo/README.md`, section "Three ways to edit a task stay separate".

Write door: `task-store.ts` persists items (`useTaskStore`). Saves of an existing item go through `commitItemEdit` (`lib/commit-item-edit.ts`), from `useItemDetailDraft.commitDraft`, and land in `updateTask`. When a finish spans stores, `action-history.rememberWorld` takes one undo snapshot first. Public door: `TaskDetailPopup` from `ItemDetailPopup.tsx`, and `EnhancedTaskDetail` from `ItemDetailPage.tsx`.

Readers that must stay in step: Lists, Scheduler, Tracking, and the To do drawer and task card.

Test: `npx vitest run components/ItemDetail/ItemDetailPage.test.tsx`

Plan: `docs/TODO_REDESIGN.md` (resolved). `docs/LINKS_REDESIGN.md` (links still open). `docs/RESOURCE_LINKS.md` (linked files).

Do not touch: the three task editors stay separate. Do not rebuild the To do drawer or the task card. Do not merge the popup and the page. Do not add an item writer in this folder.

# ItemDetail

_Last mapped: 2026-10-27_

Purpose. This room shows one item with its tags, typed links, lists, schedule, body, and history, so Lists, Scheduler, Tracking, Modules, Reviews, and Data can use the same record. _Last mapped: 2026-10-27._ DM Mono (`--font-dmmono`) loads with the page and the popup (`lib/fonts/dm-mono.ts`), on `.id95` and on `<html>`.

Invariants. Item detail → Subtasks is one of three task editors. It stays separate from the To do drawer and the To do task card (`components/Home/ToDo/README.md`). The popup (`ItemDetailPopup.tsx`) and the page (`ItemDetailPage.tsx`) stay two shells. `popup/` and `page/` stay private to each. Shared tab bodies live in `tabs/`. Type desks live in `type-views/`.

Write door. The item graph’s public door is in `lib`. `task-store.ts` persists items (`useTaskStore`). Saves of an existing item go through `commitItemEdit` (`lib/commit-item-edit.ts`). When a finish spans stores, `action-history.rememberWorld` takes one undo snapshot first.

Readers. The popup and the page read the vault through `useItemDetailDraft`. History (`ItemActivityPanel`, `lib/item-activity.ts`) only reads. Lists, Scheduler, Tracking, and the To do drawer and task card read the same items and must stay in step.

Tests. `npx vitest run components/ItemDetail/ItemDetailPage.test.tsx`

Plan. `docs/TODO_REDESIGN.md` (resolved). `docs/LINKS_REDESIGN.md` (links still open). `docs/RESOURCE_LINKS.md` (linked files).

Do not touch. Do not merge the three task editors. Do not merge the popup and the page. Do not add an item writer in this folder.

The consolidated **Brain2** item-detail surface (Spec §5.5 / docs/SPEC_MAPPING.md §5). This is
where one record shows every honest join — tags, typed links, lists, schedule,
body, history — so the same item can be **used in as many rooms as possible**
(Lists, Scheduler, Tracking, Modules, Reviews, Data). Isolation is a bug.

> Every way out is guarded. See **Unsaved guard and known gaps**.
>
> The Links tab is in `tabs/links/` (composer, ledger, radial plate, matrix, path).
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
  Close on that dock still asks. A click on the dimmed page behind an open
  popup saves the draft and minimizes onto that dock; the × still asks.
  Refresh or a closed window does the same save, and the next load opens
  the dock (`useItemDetailSession` in `draft/useItemDetailUnloadGuard.ts`, pin
  `brain2-item-detail-dock`) instead of the full editor or a browser
  leave prompt. Back on the page, and × on the popup, drop the pin.
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

_Last mapped: 2026-10-27_

Popup and page are both public entries.

- **Popup** — `TaskDetailPopup` from `@/components/ItemDetail/ItemDetailPopup`. Callers: the app shell (`app/page.tsx`), Lists, Scheduler, Home, Plan, To Do, Mobile, Operations Home (**Open item detail**, over the operation page), the friend mission sheet, and friend mission detail. _Last mapped: 2026-10-27_
- **Page** — `EnhancedTaskDetail` from `@/components/ItemDetail/ItemDetailPage`. Callers: the app shell, the module popout, and the sheet popout. _Last mapped: 2026-10-27_

`useItemDetailDraft` is an interior. Its callers are the popup and the page.

Popup panels are private modules in `popup/`, imported only by `ItemDetailPopup.tsx`, so that file can be read in pieces. They are not a shared density mode with `ItemDetailPage`. Date fields, analysis, dependencies, and the rail stay duplicated on purpose. The page, the To do drawer, and the task card do not import them.

Page panels are private modules in `page/`, imported only by `ItemDetailPage.tsx`. The popup and To do do not import them. `EnhancedTaskDetail` stays the export. `data-ui-name="Item detail"` stays on that door. A `page` | `popover` density mode is declined, because it would merge the two shells.

Interiors (imported from this folder): `useItemDetailDraft`, `ItemSaveFlag`, `useItemDetailSaveHotkey`, `BodyPanel`, `HabitLinkedDetail`, `TodoCommitmentFields`, `ItemEstimateField`, `ItemRewardField`, `ItemScheduleFlags`, `ReminderScheduleFields`, `ItemAttributesSection`, `AttributeCreator`, `TagInput`, `tabs/links/RichLinksPanel` (and its parts), `ItemActivityPanel`, `ItemSettingsKey`, `ItemSettingsPanel`, `ItemTaskCardKey`, `WorkingNowBanner`, `ItemTimeLedger`, `AttributeSettingsDialog`, `ItemDetailDock`, `useItemDetailUnloadGuard`, `CycleConfirmDialog`, `SubtaskTree`, `InboxClarifyKey`, `chrome/item-detail-chrome.css`.

Item writes: save / complete / status / reminder / notes / Sent go through
`useItemDetailDraft.commitDraft` → `commitItemEdit`. That save lands in
`updateTask`, which appends one History line per field that changed.
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
(`.id95` / `.id95-dialog` in `chrome/item-detail-chrome.css`): brushed silver bays,
engraved nameplates, CRT title readout (`#7dffc4`), raised metal action keys,
and sibling detail tabs as latching keycaps in one bay (silver skirt at rest;
active = CRT + round power lamp, dim when off). _Last mapped: 2026-10-27._ **Body** and **Scheduling** lead the bay; **Analysis** / **Time** /
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
`ItemRewardField`, `ItemScheduleFlags`, `TodoCommitmentFields`, …) that only hoist wiring that is
literally the same. Popup chrome and page layout stay separate; save / complete /
missed / delete handlers are not merged. **Which tabs and chrome appear is resolved from the item
type + list settings**, not assumed to be Task. A **History** tab is always
offered (append-only ledger in `lib/item-activity.ts` — not last-write undo).
Adding a dependency that would loop is refused with a Win95 confirm.

A habit’s standing item is a generic item (`sourceHabitId` on `attributes`). Its Details main column would otherwise be empty, because Task Information only renders for tasks. That column instead shows the item’s existing **Notes** field (`task.notes`, the same editor the Analysis tab uses) and a read-only completion summary from the source habit: name, frequency, goal, how this period stands, recent completions, and display-only tag wiring — **Counts:** the `taggedTaskTag` name, **Minutes:** catalog names from `trackingLink.tagIds` (`HabitLinkedDetail`, `lib/habit-completion-summary.ts`, `habitTagWiringSummary` in `lib/habit-source-square.ts`). No second habit-tag editor here. **Habit settings** arms that habit id and leaves through Back, which reopens the habit edit window. The button is hidden when `sourceHabitId` is missing. Other items do not get this panel.

`resolveDetailView` (`lib/item-types.ts`) starts from the type's `detailPanels`
(or infers them from capabilities), unions list `detailPanels`, then filters by
capabilities and list `hiddenDetailPanels`. Next Actions membership still treats
an item as a Task (full hardcoded Task surface) until you switch the view.
_Last mapped: 2026-10-27._ When an item is assigned more than one type — its
own type, a parent type such as Operation on a Computer Project, or a type
pinned by a list — the fascia shows type cards (`ItemTypeViewCards`). Clicking
a card passes `viewAsTypeId` and the panels, capabilities, and layout become
that type's. The item's stored type does not change. The primary type is the
default. A pick that is not assigned is ignored (`activeDetailTypeId`).
Double-click still opens the type editor. A generic `item` or catalog
type such as Book / Furniture shows Details (and a cover / featured fields when
`detailLayout` is set) without Scheduling unless you opt in. **Computer Project**
(`lib/computer-project-types.ts`, parent Operation) opens on a desk
(`ComputerProjectDetail`): status, mission, repository, branch, local path,
stack, next milestone, linked next actions (`has-part`), phases as milestones
(`has-phase`), project notes (the item note log, `Task.noteLog`), tracked time, and **Open in Operations**.
A phase is not listed again under next actions. Those fields
are real attributes, links, and tracked minutes.
The Subtasks tab stays the existing item-detail tree. Switching the card to
Operation shows the operation profile instead of that desk.
_Last mapped: 2026-10-28._ **Log**, **Thought Process**, and the log subtypes except Count
(`LogItemDetail`) stay on the item for `trackingEntryId`. A missing entry says it is no longer on the grid and is not recreated. **Edit the clock** opens EntryDialog, and Close dismisses that editor so the item close stays reachable. **Food** (`log-food`) opens FoodDetailDialog from **Food**. Line edits stay on EntryDialog. **Count** (`log-count`) is a read of the count name and ticks. Editing stays on the Tracking count shelf. TickEditor is not mounted. A log entry pointer also has **Count toward** and **Attach** on the item. While the clock editor is open they sit inside it, because that dialog is modal. Count toward lists counts that already have a tick for this entry (`sourceEntryId`) and adds or removes it with `incrementCountForEntry` and `removeCountTickForEntry`. Attach copies or moves another log onto this one. The other log is the child: that item stores `related` pointing at this log. Copy calls `duplicateLogEntry` and links the new pointer. Move links the existing pointer and does not change that entry's date or `startMin`. **Timeblock** (`TimeblockItemDetail`) opens EntryDialog only when the entry exists and is not an instant. Close dismisses the editor and leaves **Edit the clock** on the item. The page and the popup gate these desks the same way as Computer Project. These desks do not write spend, clocks, or intake back onto the task. Records stay in the time grid and the count store. The item is a pointer. Timeblock is an item type whose detail view is the existing block editor. Painted blocks are not copied into the task vault.

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
(`tabs/scheduling/TodoCommitmentFields.tsx`) sits with it: one row per day, week, and month the
item is already assigned to. Required must be done (its own To Do list).
Prioritized stays on Assigned and is marked. A task-card star that has not been reaffirmed for 14 days is cleared on read here too (`components/Home/ToDo/priority-star-sweep.ts`). _Last mapped: 2026-10-25._ Scheduling still assigns the item. It is a To Do setting, not a
Scheduler setting: when a day, week, or month ends unfinished, that period stays
Undone and the task is scheduled on the next one (`scheduledDate` /
`scheduledWeek` / `scheduledMonth`). It does not mark the item schedulable. Completable items offer **Complete** (primary) and **Missed**
(secondary, too late) side by side; missed files the row on the automatic
Missed Opportunities list instead of Completed. When one of the item’s lists has **Sent this week** on, Details shows a **Sent** control. Sent is not complete and not delete. Lists that leave the option off have no Sent control.

## Layout (Details, Notes, Resources, Links)

_Last mapped: 2026-10-24._ While the pen clock is on this item, or on a descendant of it, the fascia leads with a small electric-blue strip (`WorkingNowBanner`, `lib/working-now-banner.ts`). The lamp is the one electric-blue accent for that live clock. On the item itself it reads **Working on this now**. On a parent it names the item the clock is on. A sibling, a child of the clock task, and an unrelated item stay quiet. The rule is pure: the clock's step item when that step has one, otherwise the clock's task, plus every ancestor (`parentTaskId`, the owning task, and ancestor step items).

Identity leads: the fascia holds the CRT title, then the item's **type plates**
(lamp in the type color; double-click opens the type editor) and the stage
chip, then the keys. Details is two regions: the main column starts with the
**Attributes** instrument (`ItemAttributesSection`), then the description and
task fields. The Detailed Description field keeps the height you drag it to while you switch tabs or reopen that item in this session (`sizeKey` on `IsolatedTextarea`, `brain2-textarea-h`). The rail beside it is where the item lives: for a task, **Open task card** first (`ItemTaskCardKey`), then Lists, Tags, a
**Notes** peek (one-line add for today plus the latest entries), Sent, Status. The page's right column leads with the same key.

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
  caption. **What this is for here** is `ItemResource.useNote` — the same
  field the operation Resources tab writes, because both edit this list. A
  web link is the same record with `url` set (`uri` is `url:<id>`). Remove
  takes it off the draft and keeps the stored bytes so Discard can bring it
  back. Text is extracted in the background where possible.
  On desktop a file or folder can be **linked** instead of copied (see
  Linked resources below). _Last mapped: 2026-10-27._
- **Links** — the Related picker and backlinks (moved out of the rail).

Notes and Resources are `ItemDetailPanel`s that `resolveDetailView` adds to
every item; a list can hide them (List Settings → detail panels). This item can hide or show its own tabs from **Item settings** (`hiddenDetailPanels` / `shownDetailPanels` on the item). **Details** stays. Links and History are shell tabs and can be hidden on this item. Item settings is not a tab. The chrome gear (`ItemSettingsKey`) is the brushed gear with no keycap, the same 26px hit target as Minimize. It opens Settings as a dialog on top of the item (`data-ui-name="Item settings"`). The popup keeps that dialog inside the item, so the gear does not close the item. On the popup the gear, minimize, and close sit in the title row beside the CRT, under a step item's breadcrumb bar so they do not cover the readout. Settings has a header and plates for the item id, attributes, and tabs, with room for later controls. Opening a list from the popup minimizes it and keeps the draft. That dialog can hide an attribute on this item (`hiddenAttributeIds`) and open **Attribute settings** for the shared definition. Tab keys carry phosphor counts. Notes, resources, and
attribute edits all go through the draft, so Save and the lamp cover them,
and `commitItemEdit` keeps `noteLog` / `resources` as item fields. Search reads
note text, resource names, captions, use notes, web addresses, and extracted text.

**Attributes** sit at the top of Details with a count of filled cells and an
**Add attribute** key that opens `AttributeCreator` right there. **Add attribute** is a pale silver keycap (`.id-keycap`), the same cap as To do word keys. Each cell
shows a type glyph, the name, and where it comes from (the type, a list, or
"This item only" with a remove key). Every type has a readable editor in
`components/Lists/attributes/AttributeValueField.tsx` (option keys, toggle
chips with lamps, chip entry, goal meter, formula readout, Today / Now with
"in 3 days", link host key, searchable item reference, list chip, galleries,
file chips with kind plates). `lib/attribute-type-catalog.ts` holds each
type's glyph, one-line description, and example.

_Last mapped: 2026-10-24._ A **text list** (`multistring`) can show **Bubbles** (chips; drag to reorder) or **Lines** (one entry per line; the cell header already names the attribute). The choice is remembered per attribute id (`brain2-text-list-view`). Double-click an entry to edit it in a white box that grows with the text. Enter commits. **Make Brain2 List** creates a list whose default name is the attribute name, plus one item per line, then turns an item-only text list into a **list reference** (`asListReference` in `lib/text-list-to-list.ts`). A shared definition stays a text list and keeps `textListIds`, and the cell shows that list's items instead of the old lines. A **list reference** uses the same Bubbles and Lines face for that list's items. In Bubbles, a click opens that item in a popup over this one. In Lines, double-click renames the item. The list title is a card with that list's orb. Double-click it to open the list. In Bubbles, each item is a card with its own orb. An item reference searches the whole vault, can create an item, and uses the list's orb in place of a color dot. Renaming the list or the attribute does not rename the other.

**Attribute Demo.** `lib/attribute-demo.ts` seeds an "Attribute Demo" list
with one attribute of every type and one item, "Cybernetics (attribute
demo)", with every value filled, an item-only attribute, three dated notes,
and three resources. In the creator, **See every type filled in on the
Attribute Demo item →** creates it if missing and opens it.

## Files

_Last mapped: 2026-10-27._

The two doors stay in this folder: `ItemDetailPopup.tsx` and `ItemDetailPage.tsx`. Their private shells stay `popup/` and `page/`. Everything else is grouped:

- `tabs/` — the body of a tab, shared by both shells. One folder per tab: `notes`, `resources`, `history`, `time`, `body`, `subtasks`, `scheduling`, `details` (estimate, reward, reminders), and `links`.
- `type-views/` — _Last mapped: 2026-10-28._ The Details desk for an item type: Computer Project, Log (`LogItemDetail`), Timeblock (`TimeblockItemDetail`), a habit-linked item, and the fascia type cards that switch the view.
- `chrome/` — fascia, dock, save lamp, banners, the task-card key, and `item-detail-chrome.css`.
- `attributes/` — the attributes instrument, the creator, and attribute settings.
- `draft/` — the shared draft, the save and undo chords, and the reload pin.
- `tags/` — the tag chip and the tag field.
- `dialogs/` — item settings and the cycle confirm.


| File | Purpose |
|------|---------|
| `draft/useItemDetailDraft.ts` | The de-duplication seam: subscribes to the task store, loads the selected task into local draft state, and exposes the shared mutators (`addToCategory`, `removeFromCategory`, `setLists`, `addDependency`, `removeDependency`, `addTag`, `removeTag`, `addLink`, `removeLink`) plus store actions (`updateTask`, `addTask`, `deleteTask`) and `commitDraft` (ItemDetail save door → `commitItemEdit`). `getDraft` / `touchDraft` hold keystrokes that have not re-rendered the tree; `subscribeDraft` lets the save lamp follow those writes. `setTask` applies functional updates to that same ref, so a later field write keeps uncommitted keystrokes. A clean draft follows the store, so a task-card write shows on the open item. An unsaved draft stays. `addDependency` returns `{ ok: false, cycleLabel }` instead of writing when `findCyclePath` would loop. Tag/link mutators delegate to the pure helpers in `lib/links.ts` and operate on the draft. |
| `chrome/ItemSaveFlag.tsx` | Fascia lamp beside Save Changes (popup) and beside Edit / Save Changes (page). Always visible. **Saved** (green) when the live draft matches the stored item; **Unsaved changes** (pink) otherwise. `role="status"`. |
| `chrome/InboxClarifyKey.tsx` | Small **Clarify** key beside the INBOX stage chip when the open item is not completed. Commits the live draft through `clarifyInboxItems`. |
| `chrome/ItemSettingsKey.tsx` | Brushed gear, no keycap, 26px like the window keys. Opens Settings. On the popup it sits in the title row with Minimize and Close, beside the CRT, so a step item's breadcrumb bar stays clear. The page puts it on the fascia. Image: `public/ui/settings-gear.png`. |
| `chrome/ItemTaskCardKey.tsx` | **Open task card** in the Details rail and the page's right column, for every task. A step item opens the parent's card at that step. Closes item detail first. If To Do is not mounted, Home switches to To Do so the card has a host. `openTodoTaskCard` is that same door; the shell now row uses it for the task already on the pen clock. |
| `dialogs/ItemSettingsPanel.tsx` | Settings. Header, then plates: copyable item id, which attributes show on Details, this item's display names, and which tabs this item shows. A name opens attribute settings. |
| `tabs/time/ItemTimeLedger.tsx` | _Last mapped: 2026-10-24._ Task Time tab. Each block is a plate: when, step, label, notes, then objectives on their own rows. The total is time indicated on this item plus each direct part. Under it: minutes on this step only, then each direct part. A saved actual counts only when it exceeds those minutes. A block that names the step only through an objective with no worked minutes still says so. A pen-clock block's notes say it was added from Working On Now, with the task and the subtasks and objectives that sitting finished. _Last mapped: 2026-10-27._ A pause adds a timeline under that note (or under a note you rewrote): work session, paused for a reason, restarted, stopped. The same lines are the time-log note. A multiline note uses a taller field so the timeline stays readable. `pauseSpans` on the block and the log are the structured copy. Add time takes an optional start, end, and duration: any two fill in the third, and changing one asks which of the others to move. Start and end use the house clock. Objectives are a list for that block. _Last mapped: 2026-10-27._ The when-line on each objective is `formatObjectiveWhen` (`objectiveWorkedMs`), the same words as the Working on now popup. The clocks on the row stay. A start and an end paint on the linked pen; a duration alone, or no pen, writes a log. |
| `draft/useItemDetailSaveHotkey.ts` | **Cmd/Ctrl+S** calls the shell’s save while that item-detail root is in front. Skips the chord when another open dialog sits above it. Prevents the browser page-save dialog. |
| `draft/useItemDetailUnloadGuard.ts` | _Last mapped: 2026-10-24._ `useItemDetailSession` pins the open item (`brain2-item-detail-dock`) and writes the draft on `pagehide` / `beforeunload`. The browser does not ask to leave. The shell reads the pin after mount and opens `TaskDetailPopup` with `startMinimized`. Closing the surface drops the pin when it was the last one open. |
| `draft/useItemDetailDraft.test.tsx` | Cycle guard: refuse a reverse edge; accept an acyclic add. |
| `attributes/AttributeSettingsDialog.tsx` | Popup over item detail for one attribute: the shared name, a copyable id, the type, when it was created, where it is defined, and the values items currently hold. Delete removes that definition from every list, type, and item. The display name on one item stays in Item settings. A new definition stores `createdAt`. Older ones say not recorded. |
| `chrome/ItemDetailDock.tsx` | Where a minimized popup waits. A short bar (title and close) or the item's icon. The popup stays mounted, so the draft stays. Click the title or the icon to open it again. Close still asks about unsaved changes. A click on the page behind the open popup saves, then lands here. A reload that left detail open comes back here with that save already written. |
| `tabs/history/ItemActivityPanel.tsx` | _Last mapped: 2026-10-27._ Explorer sunken History well. One console line per change, newest first: `{date time} — {event} — {detail}`. A Working-on-now sitting is `Worked on — {duration} — {date}`, plus a substep line when a step was on the clock. Empty until the first recorded save. |
| `chrome/item-detail-chrome.css` | Milled fascia for page + popup (`.id95` / `.id95-dialog`): brushed bays, CRT title, metal keys, equal-fill tab bay with power lamps, History well + cycle path. |
| `dialogs/CycleConfirmDialog.tsx` | Win95 `fm98-dialog`: “This would loop”, the cycle path, OK only (dependency already refused). |
| `dialogs/CycleConfirmDialog.test.tsx` | Dialog copy; no add-anyway. |
| `tabs/scheduling/TodoCommitmentFields.tsx` | Scheduling switches for Required / Prioritized on each period the item is already assigned to. Writes `todoMarks` immediately without saving the rest of the draft. |
| `tabs/scheduling/ItemScheduleFlags.tsx` | Shared **Send to Scheduler** + **Auto-push** switches (same copy, same `scheduleable` / `autoPush` draft writes). Page passes `disabled={!isEditing}`; popup always editable. Date / week / month / year / deadline fields stay in each shell — popup clears sibling schedule fields and uses a week date-picker; page patches one field and gates edits. |
| `tabs/details/ItemEstimateField.tsx` | _Last mapped: 2026-10-25._ Shared Details-tab estimated-duration LiveInput (`touchDraft` + `setTask`, empty→`0`). Reads and writes `Task.estimatedDuration`, the typed minutes, not the parts rollup. A saved change is appended to `Task.estimateLog` by `updateTask` (`noteTaskEstimate`). The same minutes again adds no row. `variant="popup"` keeps the Clock label + `min` suffix; `variant="page"` keeps “(minutes)” + read-only when not editing. Popup Time-tab estimate (`popup/PopupTimeTab.tsx`, `|| undefined`) stays popup-only. |
| `tabs/details/ItemRewardField.tsx` | _Last mapped: 2026-10-25._ Details-tab Reward Value (`#reward-value`) on the page and the popup. The number is `Task.pointsOverride`, the task card's On done points. Empty clears it. `rewardValue` is not this control. Each-step points stay `stepPoints` on the card. |
| `tabs/details/ReminderScheduleFields.tsx` | When / Repeat / Text me / Persistent on the Details tab for an item on the Reminders list. Repeat is once, every day, weekdays, every week, every month, every year, each new moon, or each full moon. Lunar picks fill the next 18:00 phase evening. Writes `scheduledDate`, `scheduledTime`, and `reminder`. Text me and Persistent default on (a missing flag stays on). A changed clock clears the sent and dismissed marks. The two switches do not. Shows “Sent to Inbox.” and a skipped-text note when those are set. The page and the popup commit this patch immediately so the header bell and the next delivery see it; the rest of the item still uses Save. |
| `tabs/details/ReminderScheduleFields.test.tsx` | Omitted flags read as on. Text me off and Persistent off keep the sent mark. |
| `ItemDetailPopup.tsx` | _Last mapped: 2026-10-27._ Public door. Import `TaskDetailPopup` from `@/components/ItemDetail/ItemDetailPopup`. Props, the draft, the unsaved guard, minimize, last-tab restore, and save / complete / missed / delete stay here. `data-ui-name="Item detail"` stays on the dialog. Panels live in `popup/` and are private to this popup. `stackAbove` paints it over another open dialog. Last tab per item is restored. Minimize leaves `ItemDetailDock` mounted. A click on the dimmed page saves, then minimizes; the × still asks. Close, a list-badge double-click, and opening another item go through the unsaved guard. Double-click a list badge minimizes, then `requestNavigateToListAfterPaint`. The fascia lamp shows **Saved** or **Unsaved changes** the whole time the popup is open. |
| `popup/layer-safe-dismiss.ts` | _Last mapped: 2026-10-27._ Private. A click or focus inside `[data-item-layer]` is not outside this popup. Escape closes only this dialog. |
| `popup/PopupFascia.tsx` | _Last mapped: 2026-10-27._ Private. The CRT title, window keys, type cards, and the save / complete / missed / card / delete row. |
| `popup/PopupTabKeys.tsx` | _Last mapped: 2026-10-27._ Private. The tab key bay, in the same order, with phosphor counts. |
| `popup/PopupDetailsMain.tsx` | _Last mapped: 2026-10-27._ Private. Details main column: reminders (they commit immediately), a person’s biography and pipelines, the computer-project desk, attributes, Detailed Description, duration and reward (`variant="popup"`), then repeated-task settings. A People I Know person shows `PersonDetail` first (full name, nicknames, optional relation, date met with Est., how long known, time since last seen, Instagram, address precision, interactions, gift notes, Close, and days until the next birthday). Standing and dated notes stay on the Notes tab. Close creates the Gift ideas list. The plaque draws a pixel cake and does not load images. Birthday, phone, and standing notes are omitted from Attributes. |
| `popup/PopupRepeatedTaskSettings.tsx` | _Last mapped: 2026-10-27._ Private to the details column. The Repeated Task Settings block. |
| `popup/PopupDetailsRail.tsx` | _Last mapped: 2026-10-27._ Private. Where this item lives: open task card, lists, tags, notes peek, Sent, and status. |
| `popup/PopupSchedulingTab.tsx` | _Last mapped: 2026-10-27._ Private. Popup scheduling markup. A date, week, month, or year still clears the other placements. Move to Weekly still writes immediately. |
| `popup/PopupDependenciesTab.tsx` | _Last mapped: 2026-10-27._ Private. Task Dependencies. A loop still only opens the cycle dialog. |
| `popup/PopupSubtasksTab.tsx` | _Last mapped: 2026-10-27._ Private. Subtasks for this popup: `SubtaskTree`, or `StepItemSubtasks` on a step item. |
| `popup/PopupAnalysisTab.tsx` | _Last mapped: 2026-10-27._ Private. Why and consequences. Not the page’s analysis card. |
| `popup/PopupTimeTab.tsx` | _Last mapped: 2026-10-27._ Private. Estimated vs actual, then the pen bay. An empty estimate clears (`undefined`). |
| `popup/PopupRecordTabs.tsx` | _Last mapped: 2026-10-27._ Private. Notes, Resources, Links, Body, and History. The shell places each tab where it already sat. |
| `popup/PopupOverlayDialogs.tsx` | _Last mapped: 2026-10-27._ Private. Item settings, attribute settings, unsaved prompt, cycle confirm, type editor, and missed reason. The shell keeps the locks and the host refs. |
| `type-views/HabitLinkedDetail.tsx` | Details main pane for an item whose `sourceHabitId` attribute is set. Notes editor (`task.notes`) plus a read-only habit summary, including **Counts:** / **Minutes:** tag wiring (names only). **Habit settings** returns to that habit’s edit window. |
| `tabs/subtasks/SubtaskTree.tsx` | Subtasks tab for both shells. Its own small outline (nested `ul.id-sub-list`, `li.id-sub-item`), not the shared `StepTree` the To Do lid uses; names and nesting match the lid, the markup and keys do not. Each row: name (edit in place), parts (`n/m`), minutes (edit in place), the sum of the steps inside, **+** (add a step inside) and delete. A name field adds a step on Enter. Phase 11: `onOpenStep` (dot click and ↗ open the step's item on top) and `StepItemSubtasks` (a step item's Subtasks tab). **Planned** here (they exist only in `StepTree`): drag and Alt+↑/↓ / Tab moves, Shift/Cmd multi-select, remembered folds, Hide locked and Show next only. |
| `ItemDetailPage.tsx` | _Last mapped: 2026-10-27._ Door for the full-screen editor. Exports `EnhancedTaskDetail`. Root stays `data-ui-name="Item detail"`. Owns the draft, edit mode, the unsaved guard, the session pin, save and undo hotkeys, `patchItem`, and the missing-item line (`Item not found`). Composes `page/`. `page/` is not imported by the popup or by To do. The last tab persists across refresh. A refresh while this page is open saves the draft, and the next load shows the minimized dock, not this page. Double-click a list badge calls `requestNavigateToListAfterPaint`. When the screen was opened from a habit, that double-click does not take Back’s return to habit settings. Back and **Habit settings** still do. The fascia lamp shows **Saved** or **Unsaved changes** the whole time the page is open. |
| `page/useItemDetailPageView.ts` | _Last mapped: 2026-10-27._ Page-only. Which panels, type cards’ `viewAsTypeId`, the tab list, and last-tab persistence. The type pick resets during render when the item id changes. |
| `page/useItemDetailPageCommands.ts` | _Last mapped: 2026-10-27._ Page-only. Save, delete, complete, reopen, missed, and item-type save and delete. Complete reads `actualDurationRef`. The delete confirm string stays `Delete "${task.description}"? This cannot be undone.` |
| `page/ItemDetailPageFascia.tsx` | _Last mapped: 2026-10-27._ Page-only fascia: Back, orb, title, Edit / Save / Cancel, Mark incomplete, actual minutes, Complete, Missed, Delete, Upgrade to Operation, done banner, type cards, stage, Clarify, gear, and “Took Nm”. The actual-minutes field stays an uncontrolled input (`value=""`). |
| `page/ItemDetailPageTabList.tsx` | _Last mapped: 2026-10-27._ Page-only keycaps and counts. History stays a real tab. Secondary tabs keep `id-tab-secondary`. |
| `page/ItemDetailPageDetails.tsx` | _Last mapped: 2026-10-27._ Page-only Details tab. Reminder fields commit immediately. A person shows the biography, then pipelines. A habit-linked item shows notes and **Habit settings**, which arms the return and then calls Back. `bindTextList` stamps the stored task. Create-attribute writes a list schema immediately when a list is targeted. |
| `page/ItemDetailPageTaskInfo.tsx` | _Last mapped: 2026-10-27._ Page-only Task Information card. Estimate and reward stay the shared fields (`variant="page"`). Urgency, importance, context, partial completion, and chunk size are edit-gated here. |
| `page/ItemDetailPageRail.tsx` | _Last mapped: 2026-10-27._ Page-only right column: task-card key, type badges, lists, tags, related, metadata. List-badge double-click navigates. The remove control shows only while editing. |
| `page/ItemDetailPageScheduling.tsx` | _Last mapped: 2026-10-27._ Page-only Scheduling tab. One field per change. Shared flags stay `ItemScheduleFlags` and `TodoCommitmentFields`. Inputs stay disabled until Edit. |
| `page/ItemDetailPageDependencies.tsx` | _Last mapped: 2026-10-27._ Page-only dependencies card around `ItemPicker`. A lone add still calls `addDependency`. A cycle sets the label and does not write. Empty copy stays `No dependencies`. |
| `page/ItemDetailPageSubtasks.tsx` | _Last mapped: 2026-10-27._ Page-only subtasks card and Molecular Breakdown. `SubtaskTree` is shared. Steps save through `updateTask` as you edit. Deleting a step also deletes an older Task-backed subtask with the same id. |
| `page/SplitStepsComposer.tsx` | _Last mapped: 2026-10-27._ Page-only textarea `id="split-steps"` and the Add steps button. |
| `page/ItemDetailPageAnalysis.tsx` | _Last mapped: 2026-10-27._ Page-only analysis card. Edit mode uses the why and consequences textareas. View mode uses `No reason specified` and `No consequences specified`. |
| `page/ItemDetailPageLedgerTabs.tsx` | _Last mapped: 2026-10-27._ Page-only Time, Body, Notes, Resources, and History shells. Notes picks `PersonNotes` or `ItemNotesLog`. History’s content stays mounted; the trigger is what hides it. The page Time ledger is read-only until Edit. |
| `page/ItemDetailPageDialogs.tsx` | _Last mapped: 2026-10-27._ Page-only item settings, attribute settings, cycle confirm, type editor, and miss reason. Attribute settings portals into the settings dialog and refuses to dismiss it while open. Missed still calls `markMissedOpportunity` and does not complete the item. |
| `tabs/notes/ItemNotesLog.tsx` | Notes tab: composer (day, time stamp, Cmd/Ctrl+Enter), pinned standing note (`Task.notes`), dated entries grouped by day. `NotesPeek` is the rail face. |
| `tabs/resources/ItemResourcesPanel.tsx` | _Last mapped: 2026-10-27._ Resources tab: drop tray with Auto / Copy / Link (desktop), cards, viewer (image / PDF / audio / video / text / folder / web link), caption, use note, Open / Download / Remove; linked files add Show in Finder and Locate…. |
| `tabs/resources/ItemResourcesPanel.test.tsx` | Linking on drop and from the folder picker, following a move, Missing and Locate, the use note, and the web fallback, with a mocked `fileLinks` bridge. |
| `type-views/ItemTypeViewCards.tsx` | _Last mapped: 2026-10-27._ Fascia type cards. One type is a nameplate. Two or more switch the detail view (`viewAsTypeId`). Double-click opens the type editor. |
| `type-views/ComputerProjectDetail.tsx` | _Last mapped: 2026-10-27._ Computer Project desk on Details: status, repo, next actions (`has-part`), milestones (`has-phase`, not repeated in next actions), notes, tracked time. Writes operation and computer-project attributes through the draft. Add action / Add milestone create linked tasks immediately. |
| `type-views/LogItemDetail.tsx` | _Last mapped: 2026-10-28._ Log desk on Details, gated like Computer Project on the page and the popup. `log`, `thought-process`, and the subtypes except count stay on the item for `trackingEntryId` (or a `tracking-entry-` id). **Edit the clock** opens EntryDialog; Close dismisses it. A missing entry says it is no longer on the grid and is not recreated. `log-food` opens FoodDetailDialog from **Food**. Line edits stay on EntryDialog. `log-count` reads the count name and ticks. Editing stays on the Tracking count shelf. TickEditor is not mounted. Count toward and Attach sit on the item, and inside the clock editor while that dialog is open. Count toward adds or removes that entry on an existing count (`incrementCountForEntry`, `removeCountTickForEntry`) and lists counts whose tick `sourceEntryId` is this entry. Attach copies (`duplicateLogEntry`, then link the new pointer) or moves (link the existing pointer; date and `startMin` stay). The link is `related` on the other log, target this log. This desk does not write spend, clocks, or intake back onto the task. Saving the clock in that dialog copies the new date, minute, and certainty onto ticks whose `sourceEntryId` is this entry. |
| `type-views/TimeblockItemDetail.tsx` | _Last mapped: 2026-10-28._ Timeblock desk on Details, gated like Computer Project. EntryDialog only when the entry exists and is not an instant. Close dismisses the editor and leaves **Edit the clock**. The record stays on the time grid. Painted blocks are not copied into the task vault. |
| `attributes/ItemAttributesSection.tsx` | Shared attributes surface. When the type has `detailLayout`, renders a large hero image and featured fields above the rest of the schema, then list-defined attributes, item-only leftovers, and `AttributeCreator`. `omitAttributeIds` hides fields edited on another panel of the same view. On a person, birthday and standing notes are omitted so the biography is their only editor. _Last mapped: 2026-10-24:_ `onLiveValue(id, value)` gets text, number and link keys before blur; both shells write it with `touchDraft`, so Cmd+S keeps unblurred text. Text lists and list references pass `textListIds`, `attributeLabels`, `onBindTextList`, and `onOpenTextList`. The cell name uses `attributeLabels` when this item set one. **Add attribute** is `.id-keycap`. |
| `attributes/item-attributes.test.tsx` | Hero/featured layout + attribute creator for catalog-style types. |
| `tabs/body/BodyPanel.tsx` | The `"body"` detail panel for document-type items. Default face is **rendered prose** (HTML stripped to plain when the body looks like markup); an explicit **Source** / **Rendered** toggle reveals the raw editor — never a raw-HTML face by default. Markdown still uses `RichTextEditor`. Persists through `useTaskStore.updateTask`, debounced (default 500ms) with a flush on blur/unmount. Props: `taskId`, `readOnly?`, `debounceMs?`. |
| `attributes/AttributeCreator.tsx` | Inline control for defining a brand-new typed attribute: a type palette grouped by Words / Numbers / Choices / Time / Media / References. Each group is its own plate. The chosen type shows a description, its settings (options, unit, labels, formula, scope), name, target, and initial value. **Scope list** on a list attribute, and **Source list** on a selection, are the searchable list picker (`SingleListPicker`: search, **Any list** or **Choose a list**, **New list**). A chosen scope list sits as a chip above that search. An item attribute has no scope list: its value searches every item and can create one. **Add to** stays a short menu of the lists this item already belongs to. The attribute can be added to one of those lists — persisted onto that list's `itemAttributes` schema so every item in the list gains it — or kept on just this item. Props: `categories`, `itemCategoryIds`, `existingIds`, `onCreate(def, value, listId)`. |
| `tags/ItemTagChip.tsx` | One item-tag chip. Value is the string name. When `normalizeTag(name)` matches a Tracking catalog tag, shows that tag’s color bead. Double-click opens `openTagSettings(id)` or `openTagSettingsFromName(name)`. Used by `TagInput` and Item Detail view-mode badges. |
| `tags/TagInput.tsx` | Presentational chip/token tag editor. Renders applied tags as removable `ItemTagChip`s and a text field that adds a tag on Enter/comma, with autocomplete suggestions drawn from all tags in use across `taskRepository.getAll()` (catalog matches show a bead in the list). Normalization via `lib/links.ts`. Props: `tags`, `onAdd`, `onRemove`. Chips stay strings. They are not Tracking tag ids. A Tracking catalog rename follows a string that used the old normalized name (`lib/catalog-tag.ts`). |
| `tabs/links/` | The Links tab. See **Links tab** above. _Last mapped: 2026-10-16._ The target search ends with Create "<query>": it adds the item to the task store at once (type = the relation's first `toTypes`, else item). The link itself stays a draft. Type selects use `NativeSelect`. _Last mapped: 2026-10-16_ ([`LINKS_REDESIGN.md`](../../docs/LINKS_REDESIGN.md) L3–L6): `use-links-graph.ts` computes derived edges (only with **with derived** on), the shelf, density and checks for the open draft. The panel adds a readout row and a view switch: Radial (`LinkConstellation.tsx`), Matrix (`LinkMatrix.tsx`), Path (`LinkPath.tsx`; the ruler stays, and a sentence from `path-sentence` sits under it when a path exists), Ledger (`LinkLedger.tsx`). `LinkComposer.tsx` is the sentence that adds a link. `relation-phrase.ts` guesses the reverse of a new relation phrase for `NewRelationForm`. `SuggestionShelf.tsx` accepts a draft link, dismisses one (`dismissedLinkSuggestions`), or mutes it for this viewer. `EdgeInspector.tsx` is the proof card on **why?**. The composer pre-checks a new link: an acyclic loop asks `window.confirm`; other checks show as a note. Ledger rows show a neutral **check** tag and hide Confirm on `quiet` relations. |
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

_Last mapped: 2026-10-27._ Both surfaces always offer a **History** tab
(`ItemActivityPanel`). The ledger is `lib/item-activity.ts`
(`brain2-item-activity`, legacy `cogs-item-activity`). `updateTask` is the one
writer: every changed field is its own line, `{date time} — {event} — {detail}`
(`Estimate — 25m → 40m`, `Substep added — “Rinse”`). A save that changes
nothing writes nothing. Newest first. `commitItemEdit` does not append a
second copy; it passes source and an optional order through that same write.
Lines written before `source` or `order` still load.

A Working-on-now sitting is recorded when it stops, on the item that was on
the clock. The pen clock (`taskId` / `stepId`) writes `Worked on — {duration} — {date}`
on that task, and `Worked on substep — {name} — {duration} — {date}` when a
step was active. Duration is the active sitting (paused time left out), the
same minutes as the time log. Under a minute there is no time log, and the
line still records (`10s`). The operations clock writes the same Worked-on
line on the operation, one per day slice, and only when that item exists.
Opening the tab only reads. A sitting already stored is not written again.

This is a ledger, not Cmd-Z. Settings selective restore is a different lane.

## Planned — differential and formulations (Wave 13)

Not built. A Differential tab will show one record as event, object, label,
and higher labels, with strings for characteristics left out (GS-7). Dated
formulation wording lives on this same ledger and shows as a timeline (GS-10).
[`docs/ScienceandSanityBrain2.md`](../../docs/ScienceandSanityBrain2.md) Part 3.

## Time and pens

_Last mapped: 2026-10-27._ The **Time** tab (`popup/PopupTimeTab.tsx` on the popup, and the page when the panel is on) shows estimated vs actual on the popup, then **Pens and tracked time** (`tabs/time/ItemPenTime.tsx`) in a milled bay. Each linked pen shows **clock** on the one ▶ paints with (the first `penLinks` entry). **clock** on another chip moves it first (`withClockPen`). Item detail leaves `chain` off, so this bay stays a chip list. The task card passes `chain` and draws the clock pen’s counts-as row there instead. For a task, that bay is `ItemTimeLedger`. The total is actual time for this task, or for this step when the open item is a step: minutes indicated only here, plus each part's actual minutes. A part's minutes are a block tagged to it or an objective tied to it. A saved actual counts only when it is larger than those minutes and the parts. Under the total, each direct part with time is one line (`26m on add the color effect`), and minutes that never named a part read `on this step only` or `on this task only`. Estimates stay as typed. A block whose objective names the step but records no worked minutes still lists here without adding, and a line under the total says how many minutes that is. Each block is one plate: day, length, and pen on the head, then When, Step, Label, and Notes, then **Objectives** (done, added → done, the step, and counts toward or finished step). A session, the pen clock, or a To Do ▶ already writes those blocks and logs (`sessionTimeLogs`, `logTaskClockSpan`). A log whose blocks are already listed stays out of the second list, so the minute is counted once. Logs with no painted block sit under **Logged, no painted block** and edit on the draft. Block clocks edit the time grid at once. **Add time** takes an optional start, end, and duration on the house clock. Any two fill in the third. Changing one, once all three are set, asks which of the other two to move. Objectives are a list of what that block accomplished, each marked done or still open. A start and an end paint on the linked pen (or the first pen); a duration with no clocks, or no pen, writes a log. The page ledger is read-only until Edit. A step's item shows that step's blocks and writes logs and step ticks onto the parent task. `ItemPenLinksField` edits `Task.penLinks` through the shell's draft; the first link is the clock pen. With no pen linked, the line says new clock paint counts once one is linked; blocks already tagged still show. `ItemTrackedTime` is the read-only total for an item that is not a task. Pen settings edits the same field (**Linked items**). Built for [`docs/TODO_REDESIGN.md`](../../docs/TODO_REDESIGN.md) Phase 5 (slice E). Operations totals read `trackedTimeForItem` (slice F). The To Do rows and lid read it too (Phase 6, slice L; [To Do README](../Home/ToDo/README.md)).

## Steps as items, stacked popups, one step tree

_Last mapped: 2026-10-27._ A step is still a `Subtask` in `task.subtasks`. Opening it makes an item for notes, files, and links (Phase 11). The redesign is resolved: [`docs/TODO_REDESIGN.md`](../../docs/TODO_REDESIGN.md).
- **Phase 9.** _Last mapped: 2026-10-25._ **Built (slice K):** `tabs/subtasks/SubtaskTree.tsx` and the To Do lid's `TodoBreakdown.tsx` host one shared `components/steps/StepTree.tsx`, with drag and multi-select. Spent on a row is Phase 6. The ↗ is Phase 11.
- **Phase 10.** Steps carry a Bare minimum / Goal / Exceptional tag. The Subtasks tab and Time tab show the task's B / G / E percent (weighted by the tree, each child an equal share of its parent) and the level it is completed to. The step readout's percent changes from a flat leaf count to the weighted one.
- **Phase 11.** _Last mapped: 2026-10-25._ **Built (slice M).** A step becomes an item the first time it opens (`Subtask.itemId`; the item has `parentTaskId` and `stepOf`; `lib/step-items.ts`). The tree stays the source of truth for order, done, estimate, needs, tier and points; the item keeps a read mirror of name and estimate, and edits to them go back to the step (`updateStepField`, via `components/steps/StepItemStack.tsx`). `TaskDetailPopup` takes `layerHeader` and `onStepComplete`, and marks a layered popup `data-item-layer`; a popup underneath ignores clicks inside it (`layerSafeDismiss`). Escape closes only the top layer. _Last mapped: 2026-10-27._ On a step item: Complete ticks the step and closes the layer; Missed and the Status picker are hidden; Subtasks shows the steps inside that step, written to the parent's tree (`StepItemSubtasks`). `SubtaskTree` rows get the dot click and **↗** (`onOpenStep`) on a stored task, and the tier tags (`tierTags`). Step item ids are `step-item-…`, never a step id, so the page's legacy delete of a Task-backed subtask with the step's id (above) never hits one. **Card** on a step item is built (Phase 12). The step-item bar does not draw its own level gauge. The level stays on Subtasks and the task card. The resolved redesign did not add one.
- **Phase 12.** _Last mapped: 2026-10-25._ **Built (slice O).** A **Card** key (key row, after Missed) opens the To Do task card while a To Do panel is mounted (`useTaskCardStore` `hosts`) and the task is open and on today / this week / this month (`onCurrentPeriod`). A step item's **Card** opens the parent's card at the step. It closes item detail first (or clears the step layers). The card's **↗ Item** opens item detail back on top. Every task also has **Open task card** in the Details rail and on the page's right column (`ItemTaskCardKey`), including when the key-row **Card** is hidden. That key opens the same card; if To Do is not mounted, Home switches to To Do.
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
