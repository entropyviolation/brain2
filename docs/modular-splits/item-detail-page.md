# Split `ItemDetailPage` into page-only modules

_Last mapped: 2026-10-27._ Plan only. Do not treat this as a behavior change.

Pure structural extraction of `components/ItemDetail/ItemDetailPage.tsx` (1653 lines). `EnhancedTaskDetail` is lines 140–1627. `SplitStepsComposer` is a private function at lines 1629–1652. Move blocks into files that only this page imports. The screen, the DOM, the class names, and the copy stay as they are.

This is not the density-mode merge sketched in `docs/ARCHITECTURE_MODULARITY.md`. Page chrome and popup chrome stay separate. Item detail, the To do drawer, and the To do task card stay separate. See [Do not merge](#do-not-merge).

Line numbers below are the file as of this plan. After the first move, follow the block, not the number.

## 1. Current responsibilities and public exports

### Public door (stable)

The module `@/components/ItemDetail/ItemDetailPage` exports one name: **`EnhancedTaskDetail`**.

```ts
interface EnhancedTaskDetailProps {
  taskId: string
  onBack: () => void
}
```

That props type is not exported. There is no default export. `SplitStepsComposer` is not exported.

Callers that must keep compiling with no edit:

| Caller | How it loads the page |
|--------|------------------------|
| `app/page.tsx` | `lazy(() => import("…/ItemDetailPage").then(mod => ({ default: mod.EnhancedTaskDetail })))` |
| `components/Modules/workspace/ModulePopoutView.tsx` | same named lazy import |
| `components/spreadsheet/SheetPopoutView.tsx` | same named lazy import |
| `app/page.test.tsx` | `vi.mock` of `{ EnhancedTaskDetail }` |
| `components/ItemDetail/ItemDetailPage.test.tsx` | named import |
| `components/ItemDetail/detail-card-agreement.test.tsx` | named import |

Do not add a default export. Do not re-export the new section components from `ItemDetailPage.tsx`. Do not edit anything under `components/Modules/`; the existing import path is enough.

`openItemDetailPage` in `lib/points-ledger-nav.ts` opens this page through the shell. It does not import the component. Leave it.

### What the component does

One full-screen editor (`className="id95"`, `data-ui-name="Item detail"`, `data-ui-docs="components/ItemDetail/README.md"`). It shares the draft with the popup through the existing hook `useItemDetailDraft`. It does not share layout with the popup.

Cross-cutting work that stays on the door:

- Draft subscription, store reads (`updateList`, folders, item types), and `effectiveId` (`overrideId ?? taskId`, cleared when the `taskId` prop changes).
- Which panels exist: `resolveDetailView`, type cards’ `viewAsTypeId`, tab list, last-tab persistence (`APP_NAV_KEYS.itemDetailTab`).
- Edit mode (`isEditing`). View mode is the default. Save and Cancel leave edit mode. Cmd/Ctrl+S calls the same save.
- Unsaved guard on Back, opening another item, list-badge jump, and Habit settings. `useItemDetailSession` pins the open item and writes the draft on unload.
- Undo hotkey. Page subtask edits also write straight through `updateTask` (see Subtasks below).
- Empty state when the id is missing: the text `Item not found` inside `div.flex.items-center.justify-center.h-64`. This return sits **after** every hook.

Already-extracted interiors stay imported. Do not move them, restyle them, or give them page branches. That set includes `useItemDetailDraft`, `ItemSaveFlag`, `ItemSettingsKey`, `ItemSettingsPanel`, `AttributeSettingsDialog`, `InboxClarifyKey`, `ItemTaskCardKey`, `WorkingNowBanner`, `ItemDoneBanner`, `FasciaOrb`, `ItemTypeViewCards`, `ItemAttributesSection`, `ItemEstimateField`, `ItemRewardField`, `ItemScheduleFlags`, `TodoCommitmentFields`, `ReminderScheduleFields`, `SchedulingSummary`, `HabitLinkedDetail`, `ComputerProjectDetail`, `SubtaskTree`, `ItemPenTimeSection`, `BodyPanel`, `ItemNotesLog`, `ItemResourcesPanel`, `ItemActivityPanel`, `TagInput`, `ItemTagChip`, `RichLinksPanel`, `CycleConfirmDialog`, and `item-detail-chrome.css`.

People, completion, and type-editor UI stay the components they already are (`PersonDetail`, `PersonNotes`, `PersonPipelinesEditor`, `CompletionDialog`, `MissReasonDialog`, `ItemTypeEditor`).

### Page-only blocks inside the file today

| Block | Lines (approx.) | Why it is page-only |
|-------|-----------------|---------------------|
| Fascia: Back, orb, title, Edit / Save / Cancel, Mark incomplete, actual minutes, Complete, Missed, Delete, Upgrade to Operation, done banner, type cards, stage chip, Clarify, settings gear, “Took Nm” | 525–657 | Popup has its own fascia and its own save / complete / missed / delete handlers |
| Tab keycaps | 660–697 | Counts and which keys show are this shell’s |
| Details main column: reminder, person, habit, computer-project desk, attributes, Task Information | 699–927 | Task Information (urgency, importance, context, partial completion) is edit-gated here |
| Details rail: Task card, Type, Lists, Tags, Related, Task Metadata | 929–1084 | Page column. `ItemTaskCardKey` is already the door to the task card; the card around it is this page’s |
| Scheduling dates | 1088–1233 | `ItemScheduleFlags` is shared. Date, time, deadline, week, month, and year fields stay in each shell on purpose |
| Dependencies card | 1236–1292 | Page markup around `ItemPicker` |
| Subtasks card + Molecular Breakdown | 1295–1380 | `SubtaskTree` is shared. The molecular list, context lines, and `SplitStepsComposer` are page-only and save as you edit |
| Analysis | 1383–1451 | Why / consequences / metrics, edit-gated |
| Time, Body, Notes, Resources, History | 1454–1527 | Thin shells over shared panels. Notes picks `PersonNotes` vs `ItemNotesLog` |
| Dialogs: Item settings, attribute settings, cycle confirm, type editor, miss reason | 1532–1623 | Page stacking (`z-[90]`, settings host ref, attribute lock). `UnsavedChangesDialog` sits with the guard |
| `SplitStepsComposer` | 1629–1652 | Private. Textarea `id="split-steps"` |

## 2. Proposed files

New files live in `components/ItemDetail/page/`. No `index.ts`. A barrel would invite the popup and the To do card to import them.

Each new file starts with a one-line comment: page-only; not for `ItemDetailPopup`, the To do drawer, or the task card. Each file that uses state or hooks is `"use client"`.

`ItemDetailPage.tsx` keeps the single `import "./item-detail-chrome.css"`. New files do not import CSS and do not add class names.

Nothing outside `ItemDetailPage.tsx` and `components/ItemDetail/page/` may import `page/`. The new components are exported from their own files so the door can import them. They are not part of the public door.

### Door — stays `components/ItemDetail/ItemDetailPage.tsx`

Target about 350–450 lines: props, draft hook, the commands hook, the view hook, guard, session, hotkeys, the missing-item return, and a short composition.

The root element stays here, unchanged:

```tsx
<div ref={detailRef} className="id95" data-ui-name="Item detail" data-ui-docs="components/ItemDetail/README.md">
```

`data-ui-name="Item detail"` has to remain in this file. `components/UiNames/ui-names-stamps.test.ts` reads this path.

Also stays here:

- `useItemDetailDraft(effectiveId)` and the store subscriptions it does not already provide.
- `useUnsavedGuard`, `useItemDetailSession`, `useItemDetailSaveHotkey`, `useItemDetailUndoHotkey`.
- `UnsavedChangesDialog` (it renders `guard.prompt` from that guard).
- `overrideId` / `openItem`. Opening a linked item swaps the draft inside this surface.
- `isEditing`.
- `actualDurationRef`. The Complete field writes the ref and does not re-render. Do not turn it into state.
- `patchItem` (`touchDraft` + functional `setTask`). Time and Item settings both use it. One function, passed down. Do not copy it.
- Empty state, after all hooks.

`Tabs` stays on the door so tab value, `activeDetailTab`, and the keycap list stay in one place. Section components return the existing `TabsContent` node as their root. Do not wrap them in an extra div. Do not pass `forceMount`.

### `components/ItemDetail/page/useItemDetailPageView.ts`

Moves the view derivation, verbatim:

- `isTask` via `isTaskItem`.
- `typePick` and the **render-time** reset `if (typePick.itemId !== task?.id) setTypePick(...)`. Do not convert this to `useEffect`. A later effect changes the first paint of the type cards.
- `primaryTypeId`, `assignedItemTypes`, `activeDetailTypeId`, `viewAsTypeId`.
- `detailView` memo (`resolveDetailView`). The fallback when `task` is missing stays `{ panels: ["details"], capabilities: {}, layout: undefined }`.
- `scheduleableCategoryIds`, `detailTabs` (hidden shell tabs, History appended unless hidden).
- `detailTab` state, the two effects that read and write `APP_NAV_KEYS.itemDetailTab`, and `activeDetailTab`.

The hook runs on every render, including the missing-item path, so hook order does not change.

### `components/ItemDetail/page/useItemDetailPageCommands.ts`

Moves the handlers the guard, the hotkey, and the fascia share:

- `handleSave` — `commitDraft(getDraft())`, then `setIsEditing(false)`.
- `handleDelete` — `confirm(\`Delete "${task.description}"? This cannot be undone.\`)`, then `deleteTask` and `onBack`.
- `handleComplete` — reads `actualDurationRef`, commits `completed: true` and `actualDuration` (parse the ref, or `undefined` when empty).
- `handleReopen` — `commitDraft(withCompleted(draft, false))`.
- `handleMissed` — `setMissAsk(true)` only. `markMissedOpportunity` stays in the miss dialog’s `onResolve`.
- `handleSaveItemType` and the type-editor delete `window.confirm` string: `Delete the "${name}" item type? Items keep their data.`

Create the ref and `isEditing` in the door. Pass them in. Do not call `useItemDetailDraft` a second time inside this hook.

### `components/ItemDetail/page/ItemDetailPageFascia.tsx`

Moves `<div className="id-fascia">` … through the meta row (Working now, title row, done banner, completion dialog, type cards, stage, Clarify, gear, duration badge).

The title still reads and writes `task.description` and `title` together (`onLiveChange` → `touchDraft`, `onCommit` → `setTask`). That read is why `lib/item-title-reads.test.ts` allowlists this surface. When the read leaves `ItemDetailPage.tsx`, move the allowlist entry to this file in the same step. Do not leave a stale entry, and do not leave the new file unlisted.

Preserve the actual-minutes input: `value=""`, both live and commit write the ref, class `id-duration`, placeholder `Actual minutes`. It shows only when `caps.duration` and the item is not cleared from work.

Preserve Upgrade to Operation: disabled when `isOperation(task)`, label `Already an Operation` or `Upgrade to Operation`, calls `upgradeTaskToOperation(task.id)`.

### `components/ItemDetail/page/ItemDetailPageTabList.tsx`

Moves `TabsList` (`id-view-keys b2-keycap-tab`) and the triggers. `style={{ gridTemplateColumns: \`repeat(${tabCount}, minmax(0, 1fr))\` }}` stays. Tab labels, icons, `id-tab-secondary`, and phosphor counts stay. Note count is still `foldPersonNoteLog(task).noteLog?.length`. Resource count is still `task.resources.length`.

### `components/ItemDetail/page/ItemDetailPageDetails.tsx`

Moves `TabsContent value="details"` and the `grid grid-cols-1 lg:grid-cols-3 gap-6` frame.

Main column class stays the ternary:

- habit-linked: `id-detail-main lg:col-span-2`
- otherwise: `lg:col-span-2 space-y-6`

Same children, same conditions: `ReminderScheduleFields` (immediate `commitReminder`), `PersonDetail` + `PersonPipelinesEditor`, `HabitLinkedDetail`, `ComputerProjectDetail`, `ItemAttributesSection` inside `div.id-bay`, then task info when `isTask`.

`omitAttributeIds` stays the same person ids and the same computer-project desk ids.

Handlers used only here move with it: `commitReminder`, `commitNotes` (commits immediately when not editing; while editing, touch + `setTask` only), `bindTextList` (`asListReference`, stamps the stored task and `setOriginalTask`), `handleCreateAttribute` (list schema via `updateList` immediately; value on the draft), `openHabitSettings` (`armHabitSettingsReturn` then guarded `onBack`).

### `components/ItemDetail/page/ItemDetailPageTaskInfo.tsx`

Moves the `Card` titled `Task Information`: estimate and reward (`variant="page"`), urgency, importance, context, partial completion, chunk size. Labels, select option strings (`1 - Low` … `5 - Critical`), ids `urgency` / `importance` / `context` / `allow-partial` / `chunk-size`, and the read-only branches stay. The partial checkbox stays disabled when not editing, and its handler still no-ops unless `isEditing`.

Do not fold this into `ItemEstimateField` or the task card.

### `components/ItemDetail/page/ItemDetailPageRail.tsx`

Moves the right column (`div.space-y-6`): Task card, Type badges, Lists, Tags, Related, Task Metadata.

List badge double-click still calls `handleNavigateToList`. Remove (`XCircle`) only while editing, and its double-click still `stopPropagation`. Tag view mode is `ItemTagChip` or the sentence `No tags`. Related still mounts `RichLinksPanel` with `editable={isEditing}`.

Metadata lines stay, including `Parent Task:` via `allTasks` and `Actual Duration: N minutes`.

`ItemTaskCardKey` stays the only task-card control, with `onBeforeOpen={requestClose}`. Do not render `TaskCard` here.

### `components/ItemDetail/page/ItemDetailPageScheduling.tsx`

Moves `TabsContent value="scheduling"` and `handleSchedule`. One field per call (`date` | `week` | `month` | `year`). Date and deadline still go through `parseLocalDate` / `dateInputValue`. Time still uses `ClockPicker` and `touchDraft` plus functional `setTask`. Inputs stay `disabled={!isEditing}`.

Keep using `SchedulingSummary`, `ItemScheduleFlags` (`disabled={!isEditing}`), and `TodoCommitmentFields` (`disabled={!isEditing}`). Do not add the date inputs to `ItemScheduleFlags`. The summary well (`bg-muted`, icon lines, copy `Scheduled for`, `Deadline:`, `Scheduled for week:`, `Scheduled for month:`, `Scheduled for year:`) moves as-is.

Ids: `scheduled-date`, `scheduled-time`, `deadline`, `scheduled-week`, `scheduled-month`, `scheduled-year`. Week placeholder stays `e.g., 2024-05-19_2024-05-25`. Year `min="2024"` `max="2030"`.

### `components/ItemDetail/page/ItemDetailPageDependencies.tsx`

Moves the dependencies card and `syncDependencies`. Adding one id with nothing removed still calls `addDependency`; `ok: false` sets `cycleLabel` and does not write. Other edits still call `removeDependency` per removed id. The picker filter stays: not this item, and either already selected or open and not a child task of `effectiveId`. Empty copy stays `No dependencies`. Remove buttons only while editing.

### `components/ItemDetail/page/ItemDetailPageSubtasks.tsx`

Moves both cards and the molecular handlers:

- `persistSubtasks` writes `setTask` **and** `updateTask`. Subtasks save as you edit. Do not route them through `commitDraft` only.
- `removeBackingSubtasks` deletes a Task whose id is in the removed set and whose `parentTaskId` is `effectiveId`.
- `splitIntoSteps`, `handleToggleStepComplete`, `handleToggleStepMolecular`, `handleStepContextChange`, `handleDeleteStep`.

`SubtaskTree` props stay: `steps`, `onChange={persistSubtasks}`, `onRemoved={removeBackingSubtasks}`, `onOpenStep` only when `allTasks` contains this task, calling `openStepItem(task.id, step.id)`.

The molecular card is a second list of the same `task.subtasks`. Keep both lists. Intro copy stays, including `MOLECULAR` and the Just Start sentence. Empty copy stays `No steps yet — split the task above to begin.`

### `components/ItemDetail/page/SplitStepsComposer.tsx`

Move the function unchanged. Root stays a fragment of the textarea plus the Add steps button. `id="split-steps"`, the numbered placeholder, `parseSteps` for `disabled`, clear the field after a successful add.

### `components/ItemDetail/page/ItemDetailPageAnalysis.tsx`

Moves the Analysis card. Edit mode uses `IsolatedTextarea` (`id="why"`, `id="consequences"`) with `touchDraft` on live change. View mode uses the muted paragraphs `No reason specified` and `No consequences specified`. Metrics stay entropy (two decimals), Reward Value (`pointsOverride` or `—`), cognitive load `/3`, estimated minutes, and actual minutes when set. The heading strings stay `Task Analysis` and `Task Metrics`.

### `components/ItemDetail/page/ItemDetailPageLedgerTabs.tsx`

Moves the five thin tabs as one module (they are adapters, not new product):

- Time — `ItemPenTimeSection` with `editableTime={isTask}`, `readOnly={!isEditing}`, `onPatch={patchItem}`.
- Body — `BodyPanel taskId={task.id}` inside the Body card.
- Notes — `PersonNotes` when `itemShowsPersonPipelines`, otherwise `ItemNotesLog`.
- Resources — `ItemResourcesPanel`.
- History — `ItemActivityPanel itemId={task.id}`.

Time and Body stay wrapped in the same `Card` / `CardContent` / `CardHeader` structure. Notes, Resources, and History stay unwrapped, as now. Time, Body, Notes, and Resources still render only when `visiblePanels` includes them. History’s `TabsContent` stays unconditional, matching today (the trigger is what hides it).

### `components/ItemDetail/page/ItemDetailPageDialogs.tsx`

Moves, as a fragment with **no wrapper element**:

- Item settings `Dialog` (`data-ui-name="Item settings"`, classes `id95-dialog id95 z-[90] sm:max-w-xl max-h-[85vh] overflow-hidden !flex flex-col`, `overlayClassName="z-[90]"`).
- The `attributeLock` ref behavior: a close is ignored while the lock is set; opening an attribute sets the lock; dismissing attribute settings clears it. Pointer and interact outside are prevented when the target is `[data-ui-name='Attribute settings']`.
- `AttributeSettingsDialog` with `container={settingsHost.current}`. The ref stays on this dialog’s `DialogContent`, same component as the attribute dialog, so the portaled settings still mount inside it.
- `CycleConfirmDialog`.
- `ItemTypeEditor`, including `onOpenItem` closing the editor then `openItem`.
- `MissReasonDialog`. On resolve: close, then `markMissedOpportunity(task.id, undefined, reason)`.

## 3. Extraction order

Each step is a move. After each step, run the tests in [Test plan](#5-test-plan) for that step. Do not start the next step on a red test. Do not tidy imports, rename props, or “simplify” a handler while moving it.

The working tree already has unrelated session and tracking edits. Do not revert, stage, or rewrite those files. Touch only `ItemDetailPage.tsx`, the new `page/` files, the allowlist test when the title moves, and the docs in section 6.

1. **`SplitStepsComposer.tsx`.** Leaf. No props change. Confirm the Subtasks molecular textarea still sits under the label `Split into steps (one per line)`.
2. **`ItemDetailPageAnalysis.tsx`.** Self-contained card. Edit gating and `touchDraft` move with the JSX.
3. **`ItemDetailPageScheduling.tsx`.** Includes `handleSchedule`. Shared flag components stay imports.
4. **`ItemDetailPageDependencies.tsx`.** Includes `syncDependencies` and the cycle-label setter passed in.
5. **`ItemDetailPageSubtasks.tsx`.** Includes `persistSubtasks` and the backing-task delete. `SubtaskTree.tsx` is not edited.
6. **`ItemDetailPageTaskInfo.tsx`.** Card only. Estimate and reward components stay as they are.
7. **`ItemDetailPageRail.tsx`.** Lists, tags, related, metadata, task-card key.
8. **`ItemDetailPageDetails.tsx`.** Composes the main column plus task info and the rail. Local handlers (`commitReminder`, `commitNotes`, `bindTextList`, `handleCreateAttribute`, `openHabitSettings`) move here.
9. **`ItemDetailPageLedgerTabs.tsx`.** Thin tabs. `patchItem` still comes from the door.
10. **`ItemDetailPageTabList.tsx`.** Keycaps and counts.
11. **`ItemDetailPageFascia.tsx`.** Move the title read, then update the allowlist in `lib/item-title-reads.test.ts` in the same step. Root `data-ui-name` stays on the door.
12. **`ItemDetailPageDialogs.tsx`.** Settings host ref and attribute lock move together.
13. **`useItemDetailPageView.ts`**, then **`useItemDetailPageCommands.ts`.** Only after the JSX lives in section files, so the hooks are a thin leftover, not a place to rewrite behavior. The render-time `typePick` reset moves verbatim.

Stop when the door is the composition listed above. Do not continue into `ItemDetailPopup.tsx`.

## 4. Behavior and visual invariants

A reader of the DOM should not be able to tell the split happened.

- Same root classes and data attributes. Same `id-window` / `id-fascia` / `id-body` nesting. No new wrapper nodes around a moved block. Fragments stay fragments (`SplitStepsComposer`, the dialog cluster, the door’s outer `<>`).
- Same visible strings, `aria-label`s, `title`s, `placeholder`s, input `id`s, and button names the tests query: `Back`, `Edit`, `Save`, `Cancel`, `Delete`, `Complete`, `Missed`, `Mark incomplete`, `Habit settings`, `Unsaved changes`, `Exit without saving`, `Item not found`, `Task Information`, `Estimated Duration`, `Reward Value`.
- Same tab values: `body`, `details`, `scheduling`, `dependencies`, `subtasks`, `notes`, `resources`, `analysis`, `time`, `history`. History is a real tab, not a menu. Secondary tabs keep `id-tab-secondary`.
- Edit mode still gates the page fields that are gated today (schedule inputs, list add/remove, tag editor vs chips, analysis textareas, task info selects, partial checkbox, pen time `readOnly`). Complete, Missed, Delete, and Upgrade stay available without entering Edit, as they are now.
- Save lamp, Cmd/Ctrl+S, and undo stay on `detailRef`. A dialog above the page still keeps the chord (that rule lives in the existing hotkey hooks; do not reimplement it).
- Dirty Back still asks. Clean Back still leaves. Discard restores `originalTask`. List double-click still calls `requestNavigateToListAfterPaint`. If a habit-settings return is armed, that jump does **not** call `onBack`. Otherwise it does. Habit settings still arms the return and then calls `onBack`.
- Reload / `beforeunload` still saves without a browser leave prompt and still pins `brain2-item-detail-dock` via `useItemDetailSession`.
- Subtasks and molecular edits still hit `updateTask` immediately. Reminder fields still `commitDraft` immediately. `bindTextList` still updates the stored task, the original snapshot, and the draft. Create-attribute still writes a list schema immediately when a list is targeted.
- `actualDurationRef` stays a ref. The input stays uncontrolled (`value=""`).
- Type pick still resets during render when the item id changes. A type that is not assigned is still ignored by `activeDetailTypeId`. The stored type does not change when a card is clicked.
- Attribute settings still refuses to dismiss Item settings while it is open, and still portals into the settings dialog.
- Delete and type-delete confirmation strings stay character-for-character.
- Missed still opens `MissReasonDialog` and then `markMissedOpportunity(task.id, undefined, reason)`. It does not complete the item.
- Capability gates stay: no Scheduling tab and no Task Information and no Complete on a generic item; completable chrome only when `caps.completable`; duration field only when `caps.duration`.
- Keystrokes still go through `touchDraft` / `onLiveChange`. Do not point a live handler at `setTask`.
- Do not add `React.memo` unless a later measurement asks for it. A memo with a new comparator is a behavior change.
- CSS is the existing `item-detail-chrome.css` only. No new class, no renamed class, no copied rule.

## 5. Test plan

No new product behavior, so no new feature tests. The existing page tests are the contract. They render `EnhancedTaskDetail` from the same path.

After every extraction step:

```bash
npx vitest run components/ItemDetail/ItemDetailPage.test.tsx components/ItemDetail/detail-card-agreement.test.tsx
```

That covers title and tabs, dirty and clean Back, unload pin, missing item, estimate save and History line, Ctrl+S, delete confirm string, generic item without Scheduling / Task Information / Complete, habit summary and Habit settings, list-chip navigation with and without a habit return, and estimate / `pointsOverride` agreement with the task card.

When the fascia moves (step 11), also run:

```bash
npx vitest run lib/item-title-reads.test.ts components/UiNames/ui-names-stamps.test.ts
```

The title allowlist must name the file that still contains the `{task.description}` display read. The UI-name stamp must still find `data-ui-name="Item detail"` in `ItemDetailPage.tsx`.

After the last step, run those four files once more. Do not add a test that imports a `page/` component directly. Privacy of those modules is the point.

### Browser

The page tests do not click every tab. After the last step, with the app already running, open one real item from the shell (the path that mounts `EnhancedTaskDetail`) and walk:

- Edit, change the estimate, see Unsaved changes, Cancel, Back on a dirty draft, Exit without saving, then Edit and Save.
- Scheduling stays disabled until Edit. A date input’s `id` is still `scheduled-date`.
- Subtasks tab shows both the tree card and Molecular Breakdown.
- Settings gear opens `Item settings`. Open one attribute’s settings and confirm the item dialog stays up.
- A non-task item still hides Scheduling, Task Information, and Complete.

Then open the popup on another item and confirm its fascia is unchanged (this split must not have edited it). Open a To do row lid and a task card only far enough to see they still use their own chrome.

Desktop width is the page’s layout (`lg:grid-cols-3`). A narrow window should still stack that grid; no new breakpoint.

Screenshots in `docs/screenshots/` stay as they are. Recapture only if a check above shows a real visual diff.

## 6. Doc updates

Do these in the same step as the file move that makes them stale. Do not edit `docs/BRAIN2_FEATURE_IDEAS.md`.

| Doc | What to change |
|-----|----------------|
| `components/ItemDetail/README.md` | Files table: `ItemDetailPage.tsx` becomes the door. Add the `page/` files, each marked page-only. Public door section stays `EnhancedTaskDetail` from `@/components/ItemDetail/ItemDetailPage`. Say that `page/` is not imported by the popup or by To do. `_Last mapped: 2026-10-27_` on the sections you rewrite. |
| `components/README.md` | The ItemDetail row. One sentence: the page is split under `components/ItemDetail/page/`, still entered through `ItemDetailPage`. |
| `components/Operations/README.md` | The Upgrade to Operation mention points at `ItemDetailPage.tsx`. After step 11, point it at `components/ItemDetail/page/ItemDetailPageFascia.tsx`. |
| `docs/ARCHITECTURE_MODULARITY.md` | The split-candidate cell for `ItemDetailPage.tsx`, and the extractable-component row “ItemDetail density mode”. Record the decision: this split is private page modules. A `page` \| `popover` density mode is declined, because it would merge the two shells. |
| `docs/tree.md` and `docs/tree.txt` | Doc sync only (`.cursor/rules/doc-sync.mdc`), not this step. `page/` belongs in the ItemDetail README. |
| `docs/README.md` | Add a `modular-splits/` row pointing at this plan. |
| `lib/item-title-reads.test.ts` | Allowlist path move, step 11. This is the test that scans the read, not a product test. |

Leave `docs/SPEC_MAPPING.md` (the feature stays implemented). Leave screenshot sidecars unless a browser check shows the UI changed. Historical line counts in `docs/PERSON_DETAIL_REDESIGN.md` are a snapshot of that redesign; do not rewrite that plan to match the new files.

## 7. Risks

### Do not merge

Decision 15 in `docs/TODO_REDESIGN.md`: item detail → Subtasks, the To do drawer, and the task card stay different UI. `.cursor/rules/three-task-editors.mdc` and `components/Home/ToDo/README.md` (“Three ways to edit a task stay separate”) say a merge needs allie’s yes.

This split must not:

- Import from `components/Home/ToDo/` (drawer, `TaskCard`, `TodoBreakdown`, `StepTree`).
- Render the task card, or replace `ItemTaskCardKey` with card UI.
- Move the molecular list or the page’s `SubtaskTree` call into `SubtaskTree` in a way that changes the popup’s Subtasks tab. `SubtaskTree` is already used by both shells; only the page’s cards and the molecular list move.
- Replace `SubtaskTree` with `StepTree` while “cleaning up”. The page file’s comment and `SubtaskTree`’s own header say this outline is not the lid. Swapping it would change the Subtasks tab.
- Share new components with `ItemDetailPopup`. Similar scheduling fields, dependency rows, and analysis text exist on the popup on purpose. Copy stays duplicated.
- Add a `density` prop, a shared shell, or a shared save / complete / missed / delete handler.
- Put page sections in `components/ui/` or next to shared interiors in a way that looks public. The `page/` folder is the fence.
- Touch `components/Modules/`, including `ModulePopoutView.tsx`.

`docs/ARCHITECTURE_MODULARITY.md` currently says to split this file as “one surface with a density mode, not a second mirror.” That recommendation is declined here. Update that doc when the split lands so the next agent does not merge the shells.

### Behavioral traps while moving

- **Hook order.** The missing-item return is after the hooks. A hook inside a child that only mounts when `task` exists is fine. A new hook after that return on the door is not. Both new hooks run unconditionally.
- **`typePick` during render.** An effect-based reset flashes the previous item’s type view.
- **`actualDurationRef`.** Lifting the keystrokes into React state re-renders the whole page on each digit and can drop a completion that today reads the ref.
- **Two write paths.** Subtasks and molecular steps call `updateTask` immediately. The rest of the draft waits for Save, except reminders, list-attribute schemas, `bindTextList`, and the unload save. Unifying those paths is a product change.
- **`commitNotes`.** While editing, it must not `commitDraft`. Out of edit mode, it does.
- **Settings portal.** Splitting Item settings and Attribute settings into two components breaks `container={settingsHost.current}` unless the ref and both dialogs stay in `ItemDetailPageDialogs.tsx`.
- **Title allowlist.** Moving the fascia without editing `lib/item-title-reads.test.ts` fails one of the two assertions (new unlisted read, or stale allowlist entry).
- **UI-name stamp.** Moving `data-ui-name="Item detail"` off `ItemDetailPage.tsx` fails `ui-names-stamps.test.ts`.
- **Radix tabs.** An extra wrapper between `Tabs` and `TabsContent`, or a changed `value`, unmounts the wrong panel or shows a blank tab.
- **Dirty tree.** Unrelated tracking and session files are already modified. A broad checkout or format would destroy that work.
- **CSS chunk.** The stylesheet import has to stay on the module the shell lazy-loads (`ItemDetailPage.tsx`), so the page still brings `item-detail-chrome.css` with it.

### Out of scope

Popup file split, To do splits, `SubtaskTree` internals, shared field components, new tabs, and any copy or layout polish.
