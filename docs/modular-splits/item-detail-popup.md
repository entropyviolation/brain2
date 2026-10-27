# Split `ItemDetailPopup` — plan only

_Last mapped: 2026-10-27._

This is a structural plan. Do not implement it from this file until asked.
The split changes no look, no copy, no DOM, no class name, and no behavior.
It only moves private sections out of the one popup file.

The working tree already has unrelated session and tracking edits. Do not
revert, stage, or rewrite those files. The split touches
`components/ItemDetail/ItemDetailPopup.tsx`, new files under
`components/ItemDetail/popup/`, the docs named in **Doc updates**, and the
one allowlist test named in **Test plan**.

Do not touch anything under `components/Modules`.

## Intent

`components/ItemDetail/ItemDetailPopup.tsx` is about 1880 lines. Almost all
of that is one function, `TaskDetailPopup` (starts ~176). Callers, lazy
imports, and `vi.mock` factories already import that name from this path.
The file stays the public door. Private sections move into
`components/ItemDetail/popup/` and are imported only by that door.

Item detail, the To do drawer, and the To do task card stay three editors.
See **Do not merge** below.

Line numbers below are the file as of this plan. Re-find a block by its
heading copy or `id` if the file has moved.

## 1. Current responsibilities and public exports

### Public door (must stay)

| Stable surface | What it is |
|----------------|------------|
| Path | `@/components/ItemDetail/ItemDetailPopup` |
| Named export | `TaskDetailPopup` only |
| Default export | none. `app/page.tsx` maps `mod.TaskDetailPopup` onto a lazy default |
| `"use client"` | stays on the public file |
| CSS import | `./item-detail-chrome.css` stays on the public file, once |

`TaskDetailPopupProps` (~160–174) is **not** exported today. Do not start
exporting it. Callers pass props inline. Children in `popup/` define their
own narrow props.

Props that must keep the same names, defaults, and meaning:

| Prop | Default | Who passes it |
|------|---------|----------------|
| `taskId` | — | every caller |
| `open` | — | every caller |
| `onClose` | — | every caller |
| `stackAbove` | `false` | friend mission sheet, friend mission detail, Home award and progress tiles, `StepItemStack` |
| `container` | `null` | no current caller. Keep it. It is forwarded to `DialogContent` |
| `layerHeader` | — | `components/steps/StepItemStack.tsx` |
| `onStepComplete` | — | `StepItemStack` (Complete ticks the step and closes the layer) |
| `startMinimized` | `false` | `app/page.tsx` dock restore |

Direct importers of the named export: `app/page.tsx` (lazy), Home dashboard,
Plan, To do panel, To do phone page, Lists, Scheduler, Mobile, Operations
Home, Operations workspace, `StepItemStack`. Dynamic `import()` of the same
path: `components/Home/use-item-detail-popup.ts`, `components/friend-mission-sheet.tsx`,
`components/friend-details/FriendMissionDetail.tsx`.

`vi.mock("@/components/ItemDetail/ItemDetailPopup")` expects a named
`TaskDetailPopup` in: `app/page.test.tsx`, `components/Operations/panels/OperationHome.test.tsx`,
`components/Operations/OperationWorkspace.test.tsx`,
`components/Scheduler/enhanced-scheduler.test.tsx`,
`components/Home/ToDo/todo-panel.test.tsx`,
`components/Home/Plan/plan-panel.test.tsx`,
`components/Home/home-award-tile.test.tsx`,
`components/Lists/enhanced-list-view.test.tsx`,
`components/Lists/__tests__/enhanced-list-view.integration.test.tsx`,
`components/baby-animal-nest.test.tsx`.

`components/UiNames/ui-names-stamps.test.ts` requires
`data-ui-name="Item detail"` and
`data-ui-docs="components/ItemDetail/README.md"` to remain **in**
`ItemDetailPopup.tsx` (on the main `DialogContent`, ~583–584).

### What the function does today

One mounted popup. `useItemDetailDraft(effectiveId)` is the shared data
seam with the page. Everything else in this file is popup chrome.

Stays in the shell because it is the session, not a panel:

- `overrideId` resets when the host `taskId` changes. `effectiveId` is
  `overrideId ?? taskId`. Opening a related item swaps the draft in place.
- `detailView` memo (~263–274). Keys stay `hasTask`, `taskType`,
  `taskLists`, `taskHiddenPanels`, `taskShownPanels`, `lists`, `itemTypes`,
  `isTask`, `viewAsTypeId`. Typing in the draft must not recompute panels.
- `typePick` reset during render when `task.id` changes (~238–244). Leave
  this in the shell. Do not move it into a child.
- Last tab per item: read and write `APP_NAV_KEYS.itemDetailTab`
  (~287–303). `activeDetailTab` falls back to `"details"`.
- Save, complete, reopen, missed, delete, status, reminder commit,
  attribute create, type save, dependency sync, text-list bind, list
  navigation, minimize, save-and-minimize, click-away park.
- `useItemDetailSaveHotkey`, `useItemDetailUndoHotkey`, `useUnsavedGuard`,
  `useItemDetailSession`. Same call order, all unconditional, all above
  the `if (!task) return null` (~539).
- `outsideHold` (~463–471): settings, attribute settings, type editor,
  cycle dialog, miss dialog, completion review, unsaved prompt. Click-away
  and Escape do nothing while it is set.
- `layerSafeDismiss` (~134–158): a click or focus inside `[data-item-layer]`
  is not outside. Escape closes only this dialog.
- `data-item-layer=""` only when `layerHeader !== undefined`.
- Minimize lock so a minimize does not also run the dialog close path.
- Settings and attribute locks so those dialogs do not close the item.
- Early `return null` when there is no task. Closed `open={false}` still
  mounts the component; the dialog is closed. Tests expect no dialog role.
- Fascia, tab bay, tab bodies, dock, and the stacked dialogs. These are
  the pieces that move. State they read stays in the shell.

Already extracted, and **not** part of this split (do not restyle or
re-wire them): `useItemDetailDraft`, `ItemSaveFlag`, `InboxClarifyKey`,
`ItemSettingsKey`, `ItemTaskCardKey`, `WorkingNowBanner`, `ItemSettingsPanel`,
`AttributeSettingsDialog`, `ItemDetailDock`, `ItemActivityPanel`,
`ItemNotesLog` / `NotesPeek`, `ItemResourcesPanel`, `RichLinksPanel`,
`BodyPanel`, `SubtaskTree` / `StepItemSubtasks`, `ItemAttributesSection`,
`ItemEstimateField` (`variant="popup"`), `ItemRewardField` (`variant="popup"`),
`ItemScheduleFlags`, `TodoCommitmentFields`, `ReminderScheduleFields`,
`ItemPenTimeSection`, `ComputerProjectDetail`, `ItemTypeViewCards`,
`FasciaOrb`, `CycleConfirmDialog`, `ItemDoneBanner`, `SchedulingSummary`,
`TagInput`, People biography and pipelines, `ItemTypeEditor`,
`MissReasonDialog`, `CompletionDialog`.

The page has its own copies of scheduling dates, analysis, dependencies,
urgency, and the right column. Those stay on the page. This split does not
dedupe them.

### Map of the return (~566–1878)

| Block | Lines | Moves to |
|-------|------:|----------|
| `layerSafeDismiss` | 134–158 | `popup/layer-safe-dismiss.ts` |
| Dialog shell, dismiss, `data-ui-*`, `data-item-layer` | 566–595, 1768–1770 | stays |
| Fascia (`id-fascia` through the key row) | 597–710 | `PopupFascia.tsx` |
| `ItemDoneBanner` + `CompletionDialog` | 712–713 | stays (two existing components) |
| Tab keys | 717–787 | `PopupTabKeys.tsx` |
| Details main column | 792–1092 | `PopupDetailsMain.tsx` |
| Repeated-task block inside that column | 957–1090 | `PopupRepeatedTaskSettings.tsx`, used only by the details main |
| Details rail | 1094–1236 | `PopupDetailsRail.tsx` |
| Notes, resources, links, body, history | 1240–1280, 1751–1765 | `PopupRecordTabs.tsx` |
| Scheduling tab | 1282–1576 | `PopupSchedulingTab.tsx` |
| Dependencies tab | 1578–1636 | `PopupDependenciesTab.tsx` |
| Subtasks tab | 1638–1662 | `PopupSubtasksTab.tsx` |
| Analysis tab | 1664–1705 | `PopupAnalysisTab.tsx` |
| Time tab | 1707–1748 | `PopupTimeTab.tsx` |
| Dock conditional | 1771–1780 | stays. `ItemDetailDock` already exists |
| Settings, attribute settings, unsaved, cycle, type editor, miss | 1781–1877 | `PopupOverlayDialogs.tsx` |

`Tabs`, `TabsList`, and every `TabsContent` stay descendants of the same
`Tabs`. A moved panel returns its existing `TabsContent`. Do not wrap the
scroll column in a new element.

## 2. Proposed files

All of these are private. No `popup/index.ts`. No re-export from
`ItemDetailPopup.tsx`. Nothing outside `ItemDetailPopup.tsx` imports them.
Each file header says it is private to `TaskDetailPopup` and is not for the
page, the To do drawer, or the task card.

No new CSS file. Class strings move unchanged with their elements.
`"use client"` on each new `.tsx`, matching the other ItemDetail modules.
The `.ts` helper has no directive.

### `components/ItemDetail/popup/layer-safe-dismiss.ts`

Moves the function at ~134–158 unchanged, including the comment about
Phase 11 and Escape. The shell spreads the result onto the same
`DialogContent`.

### `components/ItemDetail/popup/PopupFascia.tsx`

Moves the `<div className="id-fascia">` tree (~597–710): `WorkingNowBanner`,
CRT title (`IsolatedInput` class `id-title-input id-title`, placeholder
`Item name`), orb, settings gear, minimize, close, type cards, stage chip,
Clarify, “Took {n}m”, save cluster, Mark incomplete, Complete, Missed,
Card, Delete.

The shell still owns the handlers, `cardTarget`, `writeDraft`, and the
locks. The fascia receives them as props. `WorkingNowBanner` stays the
first child of `id-fascia`.

### `components/ItemDetail/popup/PopupTabKeys.tsx`

Moves the `TabsList` (~717–787). Same trigger order: Body, Details,
Scheduling, Dependencies, Subtasks, Notes, Resources, Links, Analysis,
Time, History. Same icons, the same `id-tab-secondary` on Links, Analysis,
Time, and History, the same `id-tab-count` spans. Visibility still comes
from `visiblePanels` and `popupTabs`. Counts (`noteCount`, `resourceCount`,
`linkCount`) are computed in the shell and passed in.

### `components/ItemDetail/popup/PopupDetailsMain.tsx`

Moves the main column inside `id-details-grid` (~792–1092), still wrapped
by the shell’s `<TabsContent value="details">` **or** the component returns
that `TabsContent` itself. Pick one and keep the content’s class
`space-y-6 mt-0` and the grid class `id-details-grid`.

Includes, in this order: reminder fields, person biography plus pipelines,
computer-project desk, attributes bay, Detailed Description
(`id="task-description"`, `sizeKey={`id-desc:${task.id}`}`), then the
duration grid when `caps.duration || isTask`, then repeated-task settings
when `caps.scheduleable`.

`omitAttributeIds` stays the same expression (person birthday, phone, and
notes; computer-project desk attrs). `ItemEstimateField` and
`ItemRewardField` stay `variant="popup"`.

### `components/ItemDetail/popup/PopupRepeatedTaskSettings.tsx`

Moves only the “Repeated Task Settings” block (~957–1090). Checkbox id
`is-repeated`. Same select copy (“Must be completed X times total”,
“Must be completed X times per period”). Used only by `PopupDetailsMain`.

### `components/ItemDetail/popup/PopupDetailsRail.tsx`

Moves `<aside className="id-details-rail" aria-label="Where this item lives">`
(~1094–1236). Order stays: Open task card (tasks only), Lists (badges with
double-click and the remove button, then `ListPicker`), Tags, Notes peek,
Sent, Status (hidden on a step item).

Sent copy stays: button name `Sent`, `aria-pressed`, and the sentence
“Marks this item sent. It stays in the vault and is not deleted. Sent items
hide in the list until Show sent, and leave the list next week.”

Status ids and labels stay: `completion-status`, “Created:”, “Lifecycle:”,
“Completed:”, “Deadline:”, “Actual Duration:”.

### `components/ItemDetail/popup/PopupSchedulingTab.tsx`

Moves `<TabsContent value="scheduling">` (~1282–1576). This is the largest
leaf. It is popup markup on purpose.

Keep every id and the clear-siblings behavior:

- `scheduled-date`, `scheduled-time` (`ClockPicker`), `scheduled-week`
  (date input that calls `handleScheduleToWeek`), `scheduled-month`,
  `scheduled-year` (`IsolatedInput`, live touch then commit), `deadline`,
  `must-be-done-after`, `must-be-done-before`, `time-preference`,
  `day-constraints`.
- Sections stay `01` Where it shows up, `02` When, `03` Deadline and limits,
  with the same `aria-label`s and the same sentences.
- “Move to Weekly” stays the popup’s immediate `updateTask` path
  (`handleMoveToWeeklyTodo`). Do not fold that into `ItemScheduleFlags`.
- `ItemScheduleFlags` and `TodoCommitmentFields` stay children. Do not edit
  those shared files in this split.

The page patches one schedule field and gates editing. Do not point the
page at this file.

### `components/ItemDetail/popup/PopupDependenciesTab.tsx`

Moves ~1578–1636. Heading “Task Dependencies”. Sentence “Tasks that must
be completed before this task can be started.” Empty line “No dependencies
set”. `ItemPicker` `mode="multi"`, `searchLabel="Add dependency"`. Row
dot classes `bg-green-500` / `bg-yellow-500`, badges “Completed” /
“Pending”. `syncDependencies` and `removeDependency` stay shell callbacks.
A cycle still only opens `CycleConfirmDialog`.

### `components/ItemDetail/popup/PopupSubtasksTab.tsx`

Moves ~1638–1662. Heading “Subtasks” and the existing minute sentence.
`task.stepOf` still renders `StepItemSubtasks`. Otherwise `SubtaskTree`
with the same `onOpenStep` guard (`allTasks.some(...)`).

Do not edit `SubtaskTree.tsx`. Do not switch this tab to `StepTree`,
`TodoBreakdown`, or the task card. The three editors stay separate even
though they write the same `subtasks` tree.

### `components/ItemDetail/popup/PopupAnalysisTab.tsx`

Moves ~1664–1705. Heading “Task Analysis”. Labels and placeholders for
`why` (`id="why"`) and `consequences` (`id="consequences"`) stay verbatim.
The page’s analysis card is a different tree. Do not share this file with it.

### `components/ItemDetail/popup/PopupTimeTab.tsx`

Moves ~1707–1748, still gated by `visiblePanels.includes("time")` at the
call site. Heading “Estimated vs actual time”. Labels “Estimated (plan)”
and “Actual (logged total)”. The estimate parse stays
`Number.parseInt(v) || undefined` (empty clears). That is not
`ItemEstimateField`, which maps empty to `0`. Actual duration stays a
read-only `Input`. `ItemPenTimeSection` stays a child with `editableTime={isTask}`
and `chain` left off.

### `components/ItemDetail/popup/PopupRecordTabs.tsx`

One module for the five thin tabs, so the shell does not keep their
imports and we do not add five files of a single component call:

- Notes (~1240–1262): person → `PersonNotes`, otherwise `ItemNotesLog`.
  Still gated with `visiblePanels.includes("notes")`.
- Resources (~1264–1268): `ItemResourcesPanel`.
- Links (~1270–1280): `RichLinksPanel` inside `id-bay`.
- Body (~1751–1761): heading “Body”, `BodyPanel taskId={task.id}`.
- History (~1763–1765): `ItemActivityPanel itemId={task.id}`.

Same `TabsContent` class names (`mt-0`, and `space-y-4` / `space-y-6` where
they exist now).

### `components/ItemDetail/popup/PopupOverlayDialogs.tsx`

Moves the siblings after the dock (~1781–1877):

- Item settings dialog. `data-ui-name="Item settings"`. `container={detailRef.current}`.
  Outside events that hit `[data-ui-name='Attribute settings']` still
  `preventDefault`. Class string stays
  `id95-dialog id95 z-[90] sm:max-w-xl max-h-[85vh] overflow-hidden !flex flex-col`
  and overlay `z-[90]`.
- `AttributeSettingsDialog` with `container={settingsHost.current ?? detailRef.current}`.
- `UnsavedChangesDialog`.
- `CycleConfirmDialog`.
- `ItemTypeEditor`, including the same `window.confirm` delete sentence.
- `MissReasonDialog`.

The shell keeps `settingsLock`, `attributeLock`, `itemSettingsOpen`,
`attributeSettingsId`, `editingItemType`, `cycleLabel`, `missAsk`,
`reviewOpen`, and `guard`. The overlay file only renders. Locks still
update in the shell’s existing handlers, passed down.

The dock stays in the shell so `minimized` and `dockShape` do not move.

### What stays in `ItemDetailPopup.tsx`

- File header, updated so it still says to import `TaskDetailPopup` from
  this path, and that panels live in `popup/` and are private.
- Props, draft hook, view memo, tab persistence, every `useCallback` that
  exists today, the three hotkey/guard/session hooks, `outsideHold`,
  `cardTarget`, the early null return.
- The outer fragment, the main `Dialog` / `DialogContent`, `Tabs` (value
  `activeDetailTab`), the scroll div
  (`flex-1 min-h-0 overflow-y-auto custom-scrollbar`), done banner,
  completion review dialog, dock.
- `import "./item-detail-chrome.css"`.

Do not add `React.memo` on the new components. The shell re-renders the
tree the way it does now. A memo with a missed callback would freeze a
field.

Do not hoist `writeDraft` (~561–564) into a hook unless a child needs it
before the null return. It can stay after `if (!task) return null` and be
passed as a prop. Children render only when `task` exists.

`handleToggleSent` (~554–556) is the same: it closes over `task` after the
null return. Leave that closure in the shell.

## 3. Extraction order

One move per step. After each step, run the popup test in **Test plan**
before the next cut. Copy JSX. Do not tidy class strings, conditionals, or
handler bodies while moving them.

1. `layer-safe-dismiss.ts`. No JSX. Lowest risk.
2. `PopupAnalysisTab.tsx`. Small, no shared-field variant trap.
3. `PopupSubtasksTab.tsx`.
4. `PopupDependenciesTab.tsx`.
5. `PopupTimeTab.tsx`. Keep the `|| undefined` parse.
6. `PopupRepeatedTaskSettings.tsx`, then `PopupDetailsMain.tsx` so the
   repeated block has a home.
7. `PopupDetailsRail.tsx`.
8. `PopupSchedulingTab.tsx`. Largest leaf. Do it after the smaller tabs
   so a scheduling slip is the only diff.
9. `PopupRecordTabs.tsx`.
10. `PopupTabKeys.tsx`.
11. `PopupFascia.tsx`. Update the title allowlist in the same step
    (**Test plan**).
12. `PopupOverlayDialogs.tsx`. Last, because of the lock refs and portals.
13. Stop. Do not add a `usePopupActions` hook in the first pass. The
    callbacks are the session. Moving them is how call order and the
    `outsideHold` ref get scrambled. Revisit only if the shell is still
    hard to read after the JSX is gone, and then move existing
    `useCallback`s without changing their dependency arrays.

If a props list is harder to read than the JSX it replaced, leave that
block in the shell. Scheduling, the rail, and the fascia are still worth
moving. A 15-line wrapper is not.

Target shape: the shell is state, guards, and composition. A few hundred
lines is enough. Do not chase a smaller file by merging panels back
together under a switch.

## 4. Behavior and visual invariants

- Same public path and named export. Mocks and lazy imports keep working
  without edits.
- Same props, including unused `container`.
- `data-ui-name="Item detail"` and `data-ui-docs` stay on the main
  `DialogContent` in `ItemDetailPopup.tsx`. `hideClose` stays. `sr-only`
  title stays “Item detail”.
- Dialog class stays
  `` `id95-dialog id95 sm:max-w-5xl max-h-[90vh] overflow-hidden !flex flex-col${stackAbove ? " z-[80]" : ""}` ``
  with overlay `z-[80]` only when `stackAbove`.
- `data-item-layer` stays on that content, empty string only when
  `layerHeader` is passed. `layerHeader` stays the first child after the
  title, above the fascia, so a step breadcrumb does not cover the CRT.
- Gear, minimize (`aria-label="Minimize"`), and close stay in `id-window-keys`.
- Save lamp, **Save** (`title="Cmd/Ctrl+S"`), **Complete**, **Missed**,
  **Mark incomplete**, **Card**, **Delete** stay in that order in
  `id-key-row`. Card still closes the item (or clears step layers when
  `stackAbove`) and calls `openTaskCard`. Step items still hide Missed
  and the status picker. Complete on a step item still calls
  `onStepComplete` after `commitDraft`.
- Click on the dimmed page still saves and minimizes, unless `outsideHold`.
  Escape still asks, unless `outsideHold`. × still asks. Minimize still
  leaves the dock mounted. Dock close still asks. A list-badge double-click
  still minimizes, then `requestNavigateToListAfterPaint`. Opening another
  item still goes through `guardAction`.
- `detailView` memo dependencies do not grow. `typePick` still resets in
  the shell render when the item id changes.
- Tab order, phosphor counts, secondary tab class, and last-tab restore
  stay. Hiding a tab from Item settings still drops it on the next render.
- Input ids listed in section 2 stay. Tests and `<label htmlFor>` use them.
- Person fields, attributes, and the title still `touchDraft` on the live
  key and commit on blur. Cmd/Ctrl+S still saves that live draft.
- Reminder When / Repeat / Text me / Persistent still commit immediately.
- Time-tab estimate empty value still becomes `undefined`. Details-tab
  estimate still goes through `ItemEstimateField` (empty → `0`).
- Scheduling a date, week, month, or year still clears the other placements
  the way the current handlers do. “Move to Weekly” still calls `updateTask`
  immediately.
- Sent still uses `withSentMark` and only appears when a list has
  `sentThisWeek`.
- Dependency add that would loop still refuses and opens the cycle dialog.
  No add-anyway.
- Missed still opens `MissReasonDialog` and then `markMissedOpportunity`.
- Delete confirm string stays `` Delete "${task.description}"? This cannot be undone. ``
- No new wrapper divs around the dialog, the fragment, the tab scroll, or
  the fascia. No new class, no renamed class, no copy edit.
- No `React.memo`, no new context, no new store.

## 5. Test plan

No new product behavior, so no new test file. Private modules are covered
only through `TaskDetailPopup`. Do not import `popup/*` from a test. That
would make a second public door.

### Contract

`components/ItemDetail/ItemDetailPopup.test.tsx` (import stays
`@/components/ItemDetail/ItemDetailPopup`). Run it after every extraction
step:

```text
npx vitest run components/ItemDetail/ItemDetailPopup.test.tsx
```

What that file already locks, so a move that drops a label fails here:

- Closed popup renders no dialog.
- Open task shows the title, Details, Scheduling, History, Complete, and
  no Sent until the list opts in. Delete remains.
- Scheduling: “Send to Scheduler” inherit-on, Auto-push off until switched,
  Save persists.
- Description edit, save lamp Saved → Unsaved changes → Saved, History line.
- Clarify saves the live title.
- Cmd/Ctrl+S. Orb pick. Type badge double-click opens the type editor.
- List badge double-click minimizes. Dirty paths: dock close asks, click-away
  saves and minimizes, × asks, reload pins the dock, `startMinimized` opens
  on the dock, Exit without saving drops the edit, opening a related item
  asks, a clean list double-click does not ask.
- Furniture hides Scheduling, Complete, Subtasks, Analysis, and repeated
  settings. Book shows the cover hero and Pages read without Scheduling.
- Notes add, Resources attach, Links, Analysis has no “Additional Notes”.
- Attributes region sits above Detailed Description.
- Person full name and Instagram survive Cmd/Ctrl+S without blur.
- A string attribute survives Cmd/Ctrl+S without blur.
- Make Brain2 list keeps the list id.
- Item settings can hide a tab.

### Allowlist that must move with the title

`lib/item-title-reads.test.ts` allowlists
`components/ItemDetail/ItemDetailPopup.tsx` because the name field reads
`task.description` (~604) and the delete confirm interpolates it (~326).

When the title input moves into `PopupFascia.tsx`:

- Add that new file to `ALLOWED` with the same reason, `"item name editor"`.
- Keep the popup file on the allowlist while the delete confirm still
  reads `task.description`.
- Do not rewrite either read to `itemTitle()`. The allowlist exists so the
  name editor keeps reading and writing `description` together.

Run, in the same step as the fascia move:

```text
npx vitest run lib/item-title-reads.test.ts components/ItemDetail/ItemDetailPopup.test.tsx
```

If the title stays in the shell, do not touch the allowlist.

### Stamps

`components/UiNames/ui-names-stamps.test.ts` stays green only if the Item
detail stamp strings remain in `ItemDetailPopup.tsx`. Run it once after
the dialog shell is confirmed unchanged (it should be, if step 1 and the
overlay move did not take those attributes with them):

```text
npx vitest run components/UiNames/ui-names-stamps.test.ts
```

### Regression, not new coverage

These already pass against the public popup or the shared fields. Run once
at the end. A failure means the split changed a shared module or the public
import. Do not edit them to match a new structure.

- `components/ItemDetail/detail-card-agreement.test.tsx` — estimate and
  on-done points. The popup fields must keep writing `estimatedDuration`
  and `pointsOverride`.
- `components/ItemDetail/ItemDetailPage.test.tsx` — the page was not part
  of the split. It should be untouched and still pass.
- `components/ItemDetail/draft/useItemDetailDraft.test.tsx` — draft hook stays.
- `components/Operations/panels/OperationHome.test.tsx` and
  `components/Operations/OperationWorkspace.test.tsx` — mocks of the public
  module still resolve.

Do not add a test that the new files exist. The popup test is the behavior
lock. Docs record the files.

## 6. Doc updates

Do these in the same step as the file adds, after the last extraction.
Living docs only. Do not rewrite historical line numbers in
`docs/PERSON_DETAIL_REDESIGN.md` or the To do redesign. The public path
those docs name still exists.

### `components/ItemDetail/README.md`

- Files table: keep the `ItemDetailPopup.tsx` row as the public door.
  Shorten it to the shell (props, guard, minimize, tab restore, save /
  complete / missed / delete) and point at `popup/`.
- Add rows for each new `popup/` file: one sentence, private to the popup,
  what block moved. `_Last mapped: 2026-10-27_` on the rows you add.
- **Time and pens**: the popup Time tab’s estimated-vs-actual block moves
  to `popup/PopupTimeTab.tsx`. The sentence that says it lives in
  `ItemDetailPopup.tsx` must say that. `ItemPenTime.tsx` stays the shared
  bay. Do not describe a shared time form with the page.
- **Public door** and the import-path line stay
  `@/components/ItemDetail/ItemDetailPopup` → `TaskDetailPopup`.
- State the decision: popup panels are private modules so the file can be
  read in pieces. They are not a shared density mode with
  `ItemDetailPage`. Date fields, analysis, dependencies, and the rail stay
  duplicated on purpose.

### `components/README.md`

The `ItemDetail/` row (~59) can keep its behavior sentence. Add one clause:
popup-only panels live in `ItemDetail/popup/` and are not shared with the
page or the To do card. `_Last mapped: 2026-10-27_` on that row if the
clause lands.

### `docs/tree.md`

The room map does not list panels. Name `popup/` in `components/ItemDetail/README.md`
as private sections of `ItemDetailPopup.tsx`. The public import path stays
unchanged. `docs/tree.txt` is a doc sync (`.cursor/rules/doc-sync.mdc`), not
this step. Do not hand-edit `tree.txt`.

### `docs/README.md`

Add one index row for `modular-splits/`: structural split plans. This file
is the popup plan. It is not a product wave.

### `docs/ARCHITECTURE_MODULARITY.md`

The split-candidate row for `ItemDetailPopup.tsx` (~173) and the
“ItemDetail density mode (`page` | `popover`)” row (~144) read as “next,
unify the chrome.” Update both in the same step. Record the decision:
the popup is an orchestrator plus private `popup/` modules; a shared
density-mode component with the page is refused, because the three task
editors stay separate and the page’s field wiring is not the popup’s.
Why: a later pass that “finishes” that table would merge the UIs this
plan exists to keep apart.

### Docs that stay

`components/Operations/README.md`, `components/Home/ToDo/README.md` (Card
ways in), and `app/README.md` name `TaskDetailPopup` or
`ItemDetailPopup.tsx` as the public file. That path remains true. Leave
them unless a sentence claims the popup is still one undifferentiated file.

`docs/SPEC_MAPPING.md` does not name the file path. No status change.
This split does not move a feature between missing and implemented.

## 7. Risks

### Do not merge the three editors

`components/Home/ToDo/README.md` section “Three ways to edit a task stay
separate”, and `CLAUDE.md`, are hard constraints.

- Item detail → Subtasks is the whole record.
- The To do drawer (`TodoTable` / the lid) is quick edits for this period.
- The task card is this period’s plan: full step tree, mass edit, needs,
  points.

They share store functions. They do not share UI. A change that merges
them or makes one mirror another needs allie’s yes. This split does not
ask for that.

Concrete refusals while extracting:

- Do not import `popup/*` from `ItemDetailPage.tsx`, `components/Home/ToDo/`,
  or `components/steps/StepTree.tsx`.
- Do not replace `PopupSubtasksTab`’s `SubtaskTree` with the lid’s tree or
  the card’s tree.
- Do not lift scheduling dates, urgency, importance, analysis, dependencies,
  or the rail into `ItemScheduleFlags` or any new shared module “because
  the page looks similar.” The page README already says those fields stay
  in each shell.
- Do not give the new files a `variant="page" | "popup"` prop. That is the
  density-mode merge, one step later.
- `ItemEstimateField` and `ItemRewardField` already have a popup variant.
  Leave them. Do not fold the Time-tab estimate into `ItemEstimateField`.
- The **Card** key and `ItemTaskCardKey` open the task card. They do not
  embed it. Keep that as a close-then-open.

### Other risks

- **Hook order.** `if (!task) return null` sits after the hooks (~539).
  New files must not call hooks that the shell used to call, and the shell
  must not call hooks after that return. Overlay dialogs are render-only.
- **Portals.** Settings `container={detailRef.current}` and attribute
  settings `container={settingsHost.current ?? detailRef.current}` are
  timing-sensitive. Moving the JSX is fine. Moving the refs into a child
  that is not the dialog host will unmount settings outside the item and
  can dismiss the popup. Keep both refs in the shell.
- **Locks.** `minimizeLock`, `settingsLock`, and `attributeLock` are refs
  written during click and read during `onOpenChange`. A setState in the
  child that replaces these refs will close the item when settings opens.
- **`outsideHold`.** If a moved dialog forgets to report open state, click
  away will save and minimize under an open type editor or miss dialog.
- **Unmount.** Radix unmounts inactive tab content. State that survives a
  tab change (`detailTab`, draft, `typePick`, minimize) must stay in the
  shell. Do not add `useState` inside a tab panel.
- **Title allowlist.** Moving the name input without updating
  `lib/item-title-reads.test.ts` fails the scan. “Fixing” the read to
  `itemTitle()` is a behavior change, not a cleanup.
- **Stamp test.** Moving `data-ui-name="Item detail"` into `PopupFascia`
  fails `ui-names-stamps.test.ts` and moves the Names overlay target.
- **Class-string drift.** Reformatting the dialog `className` template,
  or “cleaning” `id-btn-danger id-btn-quiet`, changes the fascia. Copy
  the attribute exactly.
- **Dirty tree.** Unrelated tracking and session files are already modified.
  A split commit must not include them. Do not revert them to get a clean
  diff.
- **`components/Modules`.** Out of scope, including any module that opens
  an item. The public import keeps those callers working.
- **Habit panel.** `HabitLinkedDetail` is page-only. Do not add it to the
  popup while moving Details. That would show a panel the popup does not
  show today.

## Done when

- `TaskDetailPopup` still loads from `@/components/ItemDetail/ItemDetailPopup`.
- New modules exist only under `components/ItemDetail/popup/` and only the
  shell imports them.
- `ItemDetailPopup.test.tsx` and `lib/item-title-reads.test.ts` pass.
- The page, the To do drawer, and the task card have no new imports from
  this work.
- The docs in section 6 name the private folder and still describe the
  same popup behavior.
