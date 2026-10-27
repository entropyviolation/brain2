# Split `todo-panel.tsx`

_Last mapped: 2026-10-27. Plan only. Do not implement from this file in the same pass as the unrelated session and tracking edits._

Pure structural extraction of `components/Home/ToDo/todo-panel.tsx` (1734 lines). `TodoDeskPanel` is the body, lines 192–1733 (~1542). The screen, the stores, and the writes stay as they are. The only change is which file holds which block.

This is not a redesign. It does not merge editors, restyle the fascia, or move To Do onto the module platform. `docs/ARCHITECTURE_MODULARITY.md` says module interiors stay feral; this split stays inside `components/Home/ToDo/`.

## Why this shape

The file is already an orchestrator that calls other files (`TodoTable`, `todo-filters`, `todo-utils`, the phone page). What is still inside `TodoDeskPanel` is one closure: lens state, the derived board, every verb, and the whole desktop tree. Cut along those four seams. Leave the verbs as functions the desk owns, and leave the tree as presentational children that receive those functions. Do not push the verbs into `TodoTable`, `TaskCard`, or item detail.

## Hard constraints

- **Three editors stay separate.** Item detail → Subtasks, the To do drawer (`TodoTable` / `TodoBreakdown`), and the task card (`TaskCard.tsx`) keep their own UI. Decision 15 in `docs/TODO_REDESIGN.md`, restated in `components/Home/ToDo/README.md` (“Three ways to edit a task stay separate”). The desk may keep passing a `TaskCardHost`. It may not render the card’s layout in the lid, and it may not render the lid’s layout in the card. Season rows stay the flex closed-row they are today. Do not rebuild them on `TodoTable` or `TaskCard`.
- **Do not touch `components/Modules/`.**
- **Do not change functionality, DOM, class names, copy, `data-ui-*` attributes, or effect timing.** A fragment is allowed where a new component would otherwise wrap a node. A new `div` is not.
- **Do not edit `todo-chrome.css`, `todo-mobile.css`, or `SessionPlanner.tsx`.** The working tree already has unrelated session and tracking edits, including `components/Home/ToDo/SessionPlanner.tsx`. Do not revert those. Import `PickListKey`, `SessionKey`, `SessionPlanner`, and `SessionsKey` from `./SessionPlanner` exactly as today.
- **Do not code-split the desk.** `TodoPanel` keeps a static import of the desk module. A `dynamic()` / `lazy()` import would change when CSS and `usePenActionSync` evaluate.
- **Do not add `React.memo`, new `useMemo` deps, or a shared band component** that parameterizes Required / Assigned copy. The day ledger and the season list use the same class names and different help text. Copying the markup into two sheet files is the safe cut. Sharing one band with a mode flag is how a season string lands on the day sheet.
- **New helpers stay in `components/Home/ToDo/`.** Do not add exports to `todo-utils.ts` or `lib/`. Those modules are already imported outside this room.
- **Phone and desk stay two trees.** `TodoPanel` only chooses. At `max-width: 767px` it mounts `TodoPhonePage` and does not mount the desk. From 768px up it mounts the desk and does not mount the phone page.

## Responsibilities today

`todo-panel.tsx` has one export and four jobs.

| Block | Lines (2026-10-27) | Job |
|-------|--------------------|-----|
| Module comment, imports, `./todo-chrome.css` | 1–144 | Side-effect CSS plus every store and sibling the desk closes over |
| `TODO_TABS`, `TodoTab`, `SPAN_KEYS`, `spanSubLabel`, `BGE_SECTIONS`, `DEFAULT_LOGGED_DONE_MINUTES`, `EMPTY_PRIORITY_IDS` | 146–176 | Constants. `EMPTY_PRIORITY_IDS` is a stable Zustand snapshot (`?? []` would loop) |
| `TodoPanel` | 179–189 | Switch. `useTodoPhone()`, then phone or desk. Props default to `{}` so tests render `<TodoPanel />` |
| `TodoDeskPanel` state and derived board | 192–793 | Stores, lens dates, prefs, ritual board, filtered / done / missed / undone, session period, handlers, flock timers, `taskCardHost`, `periodLoad` |
| `renderTab` | 794–1211 | Day / week / month sheet: load, morning priorities, B/G/E score, Required, Assigned, composer, Waiting line, Undone / Done / Missed |
| `season` memo + `renderSeasonRow` | 1213–1324 | Season list only. Flex rows, Flags lid, `TodoBreakdown`. Not the period grid |
| Heading, counts, header load, return | 1325–1733 | Fascia (screen, season nameplate or `TodoPeriodNav`, span keys, Add task, Session, Show / Sort), stage, status bar, dove plate, overlays |

Hook order inside `TodoDeskPanel`, top to bottom. A split that keeps this component must flatten to the same order. Child components add their own hook lists and must not take ownership of state that has to outlive the sheet.

1. `usePenActionSync`
2. Task / reviews / star / birthday / list selectors, then `useLayoutEffect` → `sweepStaleTaskPriorities`
3. Dialog state (`selectedTaskId`, ritual walk, Just Start, prereq, session), then pen-clock selectors and `useTaskClockStarter`
4. `usePersistedTab` (`APP_NAV_KEYS.homeTodoTab`, default `"day"`)
5. Uncontrolled date fallback plus week / month / season lens offsets
6. `useTodoPrefs`, `useTodoRanges`, chrome `useState`, `sheetScrollRef`
7. Board `useMemo`s (session period, rites, morning priorities selector, `filteredByPeriod`, locked counts, done, missed, undone)
8. `prefersReduced`, flock `useRef`s, `later`, unmount cleanup that both clears timers and runs unfinished flock completions
9. `useEffect` → `registerTaskCardHost` (empty deps; desk lifetime only)
10. `useUnfinishedStop` after the clock-objectives selector

`registerTaskCardHost` and `usePenActionSync` run only while the desk is mounted. The phone page must not start calling them. `lib/task-card.ts` shows **Card** on item detail only when a host is mounted.

Shared state that must stay on the desk lifetime, not inside a sheet that unmounts with the tab:

- Lens dates, tab, `assignedQuery`, `estimateScope`, `peekHidden`, `showFormula`, section-open maps, `expandedPeriods`, `openRowId`, `selectedRowId`, composer name and tier, `periodFolding`
- Flock refs and `later`. Tab change does not unmount the desk, so a 380ms flock still finishes on the desk. Moving that cleanup into the sheet would complete the task on tab change.
- `reasonAsk` (one `MissReasonDialog` for push, missed, and undone push)
- `taskCardHost` inputs and the host-registration effect

`sheetScrollRef` is attached on the period sheet and never read. Keep the attachment. Do not delete it as “unused.”

`assignedQuery` is one box for every lens. The tab handler clears it, along with the open row, the selection, and the formula panel. Composer name is not cleared on tab change. Preserve both.

## Stable exports

The public door does not move.

| Import | Stays |
|--------|--------|
| `import { TodoPanel } from "@/components/Home/ToDo/todo-panel"` | Named export. `home-dashboard.tsx` lazy-loads `mod.TodoPanel`. `home-dashboard.test.tsx` mocks this module path. |
| `import { TodoPanel } from "./todo-panel"` | `todo-panel.test.tsx`, `todo-mobile.test.tsx` |

`TodoPanel`’s props stay `{ currentDate?: Date; setCurrentDate?: (date: Date) => void }` with a default of `{}`.

Do not re-export the new files from `todo-panel.tsx`. Nothing outside this folder should gain a new import. Inside the folder, import the new modules by their own paths.

`todo-utils.ts` exports listed in the To Do README stay on `todo-utils.ts`. This split does not add to that list.

## New files and what moves

All paths are under `components/Home/ToDo/`. None of these are new public API.

### Door

`todo-panel.tsx` shrinks to the switch (today’s lines 179–189) plus a short comment and the static imports of `useTodoPhone`, `TodoPhonePage`, and `TodoDeskPanel`. Target: under 40 lines. No CSS import here once the desk module owns it (see extraction step 4). No store reads.

### Constants and pure functions

| File | Moves | Notes |
|------|--------|-------|
| `todo-desk-constants.ts` | `TODO_TABS`, `TodoTab`, `SPAN_KEYS`, `spanSubLabel`, `BGE_SECTIONS`, `DEFAULT_LOGGED_DONE_MINUTES`, `EMPTY_PRIORITY_IDS` | `spanSubLabel` copy stays: weekday short + day, week label, full month, capitalized season, `"named ranges"`. `BGE_SECTIONS` titles stay `Bare minimum`, `Goal`, `Exceptional`. |
| `todo-desk-schedule.ts` | `scheduleTaskForPeriod`, `seasonMonthDate` | Same field writes: day → `scheduledDate`, week → `scheduledWeek`, month → `scheduledMonth`. Season adds land on month. `seasonMonthDate` is `new Date()` when `quarterKey(focusedDate)` is the current quarter, else `quarterStartDate(focusedDate)`. |
| `todo-period-figures.ts` | `periodLoad`, header-load text, `openCount` arithmetic, `activeFilterCount` | Plain functions called from the same render sites. Do not wrap them in a new memo. `periodLoad` still drops undone ids on a past period, then `summedEstimate` / `workingHoursLeft` / `hoursLeftInPeriod` / `comfortRatio` / `comfortBand`. Header glass string stays `` `${formatWorkingHours(hours)} left · ${formatMinutesAsHours(minutes)} est · ${comfortWord(band)}` ``. Needle angle stays `((-90 + comfortDialT(ratio) * 180) * Math.PI) / 180`. `activeFilterCount` still counts available now, all tasks, hide locked, show next only, tier not `"all"`, and a non-default status filter. |
| `todo-logged-done.ts` | The `Task` object built inside `handleAddDone` | Called synchronously from the handler. Id pattern stays `` `done-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` ``. The handler, not this helper, still calls `addTask`, `resolveCompletionPoints`, `addPoints`, `emitTaskCompleted`, and `setDoneSectionsOpen`. Same order. |

`handleAddDone`’s window still uses `completionWindow` with `DEFAULT_LOGGED_DONE_MINUTES`, `dayAnchorMinutes`, and `awakeWindowFor`. Season still logs onto month, using `seasonMonthDate()`.

### One desk hook, three inner hooks

`use-todo-desk.ts` exports `useTodoDesk(controlledDate?, setControlledDate?)`. `TodoDeskPanel` calls it once at the top. The hook composes the three hooks below, in this order, unconditionally, then builds `taskCardHost` and returns a plain object. Do not memoize the returned object.

| File | Owns |
|------|------|
| `use-todo-desk-lens.ts` | `usePersistedTab`, `internalDate`, `weekDate`, `monthDate`, `seasonDate`, `focusedDate`, `setFocusedDate`, `periodTab` (`"other"` reads as `"day"` for the period machinery). Day `setFocusedDate` calls `setCurrentDate`. Week, month, and season only set the local offset. An unset offset follows `currentDate`. |
| `use-todo-desk-board.ts` | Session-period memo, ritual board, `openRitualBoard`, `sunHiddenCount`, morning priorities (stable `EMPTY_PRIORITY_IDS`), `morningTasks`, `todoItems`, `filteredByPeriod`, `lockedHiddenByPeriod`, `doneByPeriod`, `missedByPeriod`, `undoneByPeriod`, and the season memo (returns `null` unless `periodTab === "quarter"`). Same filters: rites prepended on day only; sun rule uses `ritualBoardFollowingSun` when `ritesFollowSun && !peekHidden`; done keeps the full ritual board. |
| `use-todo-desk-actions.ts` | Every handler now in the desk: add, search existing, pick existing, log done, confirm times, open ritual, complete (flock 380ms, immediate when `prefers-reduced-motion`), rename, missed, tier, push, delete, estimate, steps (`todoTime.settle` then `settleStepPoints`), undone resolve, status, commitment (including morning-review `priorityTaskIds` when a day Prioritized mark flips and a review exists), open task, composer submit. Plus `prefersReduced`, flock refs, `later`, the unmount effect, `reasonAsk`, and `registerTaskCardHost`. |

`taskCardHost` stays a `TaskCardHost` built in `useTodoDesk`, not inside `TaskCard.tsx`. Same fields: `period` is month when the lens is season; `markPeriod` is the lens itself; labels `This day` / `This week` / `This month` / `This season`; Required and Prioritized follow the lens; `onStepsChange` is `handleSteps`; Just Start, Needs, `timeOf`, clock ids, `taskClock.start`, `clockStop.request`, `defaultEstimateMin`, `hoursLeft: workingHoursLeft("day", new Date())`.

Store selectors stay as narrow as they are now (`s.tasks`, `s.updateTask`, and the rest). Do not subscribe the desk to the whole task store.

### Presentational cuts

These components are functions of props. They do not call stores, `useTodoPrefs`, or `setTodoPrefs` except where the fascia already calls `setTodoPrefs` for `loadOpen` and `showTrayOpen` — that call stays in the fascia because that is the click handler today. Prefer passing `onToggleLoad` / `onToggleShow` from the desk so the fascia does not grow new store knowledge. The callback bodies stay the same `setTodoPrefs({ loadOpen: !loadOpen })` and `setTodoPrefs({ showTrayOpen: !showTrayOpen })`.

| File | Markup that moves | `data-ui-name`s |
|------|-------------------|-----------------|
| `todo-desk-panel.tsx` | `TodoDeskPanel`. Root `.todo95`, `Tabs`, stage, `TabsContent` slots, dove plate. Composes the pieces below. | `To Do`, `To Do plate` |
| `todo-desk-fascia.tsx` | Screen, load readout button, `TodoSettingsDialog` + `PaceSettings`, season nameplate **or** `TodoRangeNav` **or** `TodoPeriodNav`, span keys, Add task, Session / Sessions, Show key, `TodoSortKeys`, show tray. | `To Do fascia`, `Period keys`, and the season-only `Period nameplate` (day/week/month nameplate stays in `TodoPeriodNav.tsx`) |
| `todo-period-sheet.tsx` | `renderTab`’s outer `.todo-sheet`, load panel, ledger, aftermath. | `Period sheet`, `Required`, `Assigned` |
| `todo-morning-priorities.tsx` | The day strip. Rendered only when `period === "day"` and `morningTasks.length > 0`. | `Morning priorities` |
| `todo-bge-score.tsx` | The score strip. Same numbers and title attribute. | `B/G/E score` |
| `todo-assigned-composer.tsx` | Composer input, nixie `NativeSelect` (A+ through D), Open existing, Add, `AddDoneDialog`. | `Assigned composer` |
| `todo-period-table-props.ts` | The `tableProps` object passed to `TodoTable`. | None. It is not a component. |
| `todo-season-sheet.tsx` | Season `TabsContent` body: hint, load, Required list, Assigned list, empty copy. | `Season list`, `Required`, `Assigned` |
| `todo-season-row.tsx` | `renderSeasonRow`. | None beyond the row classes |
| `todo-assigned-search.tsx` | The shared search `<label class="todo-search">`. Both sheets use it. The label, placeholder, and `aria-label` stay `Search` / `Search assigned tasks`. | None |
| `todo-desk-status.tsx` | `.todo-status`. | `Status bar` |
| `todo-desk-overlays.tsx` | A fragment, in this order: `clockStop.dialog`, `TaskDetailPopup`, `RitualWalkDialog`, `MissReasonDialog`, `taskClock.picker`, `TaskCard`, `TaskPrereqDialog`, conditional `SessionPlanner`, conditional `JustStartMode`. | None (those names live in the children) |

`PriorityFormulaPanel` stays where it is in the tree: after the fascia, before `.todo-stage`, only when `showFormula` and the tab is not Other and not Season. Do not move that panel into the fascia file if that would put it inside `.todo-fascia`.

`TabsContent` stays in `todo-desk-panel.tsx`. Inactive period sheets stay unmounted the way they are now (`periodTab === "day" ? … : null`, and the same for week, month, other, quarter). Do not switch Radix to `forceMount`.

B/G/E bands stay inside `todo-period-sheet.tsx` (the `BGE_SECTIONS.map`). Their `data-ui-name`s stay `` `${title} tier` `` (`Bare minimum tier`, `Goal tier`, `Exceptional tier`). Required is omitted when `bgeTiers` is on, including when Required is empty. Empty Done, Missed, Undone, and Required stay unmounted. Aftermath columns: `is-columns` and `--todo-aftermath-cols` only when more than one of those wells is shown.

### What does not move

- `TodoTable.tsx`, `TodoBreakdown.tsx`, `TaskCard.tsx` and its siblings, `TaskPrereqDialog.tsx`, `AddTodoDialog.tsx`, `AddDoneDialog.tsx`, the Done / Missed / Undone sections, `TodoLoadPanel.tsx`, `TodoPeriodNav.tsx`, `todo-filters.tsx`, `TodoSettingsDialog.tsx`, `PriorityFormulaPanel.tsx`, `TodoRangeSheet.tsx`, `todo-ranges.ts`, `SessionPlanner.tsx`, `todo-phone-page.tsx`, `todo-mobile.tsx`, `use-todo-phone.ts`, `use-todo-time.ts`, `use-rites-sun.ts`, `todo-prefs.ts`, `todo-utils.ts`, `todo-chrome.css`.
- The phone page’s own reads and writes. It already duplicates desk behavior on purpose. Do not “dedupe” the phone into these new files.
- `components/steps/WaitingLine`, `components/ItemDetail/ItemDetailPopup`, `components/Focus/*`, `components/Reviews/MissReasonDialog`, `components/Reviews/RitualWalkDialog`.

### Size after the cut

Rough targets, so the desk does not remain one function under a new name:

| File | Target |
|------|--------|
| `todo-panel.tsx` | < 40 |
| `todo-desk-panel.tsx` | < 220 (composition only) |
| `use-todo-desk.ts` | < 120 (wire-up and `taskCardHost`) |
| `use-todo-desk-actions.ts` | < 450 |
| `use-todo-desk-board.ts` | < 280 |
| `todo-period-sheet.tsx` | < 280 |
| `todo-desk-fascia.tsx` | < 220 |
| `todo-season-sheet.tsx` | < 160 |
| Every other new file | < 120 |

If `use-todo-desk-actions.ts` is still the long file, that is acceptable. Splitting each handler into its own file would hide the order of `addTask` / points / `emitTaskCompleted`. Keep the verbs together.

## Extraction order

Each step must leave `npm test -- components/Home/ToDo/todo-panel.test.tsx components/Home/ToDo/todo-mobile.test.tsx components/UiNames/ui-names-stamps.test.ts` green before the next step. Update the To Do README in the same step the paths change (see Doc updates). Do not batch the README until the end.

1. **Constants.** Move the module-level constants and `spanSubLabel` into `todo-desk-constants.ts`. `todo-panel.tsx` imports them. No JSX change. `EMPTY_PRIORITY_IDS` must remain one module-level array, not a new array per render.
2. **Pure schedule and figures.** Move `scheduleTaskForPeriod`, `seasonMonthDate`, `periodLoad`, and the logged-done task builder. Call them from the same places. No JSX change.
3. **Hooks, still in this file.** Introduce `useTodoDesk` and the three inner hooks. `TodoDeskPanel` becomes “call the hook, then the existing return.” Flattened hook order matches the list above. Do not move JSX yet. This is the step most likely to scramble state; run the panel tests before continuing.
4. **Move the desk component.** `TodoDeskPanel` goes to `todo-desk-panel.tsx`. The door keeps a static import. Move `import "./todo-chrome.css"` with the desk so the door’s static import still evaluates it. Retarget every ui-name stamp that still points at `todo-panel.tsx` for markup that now lives in the desk file (the door will not contain those strings).
5. **Fascia.** Cut `todo-desk-fascia.tsx` out of the return. Season ‹ › stays in the fascia, not in the season sheet. `TodoPeriodNav` stays the day/week/month nameplate.
6. **Period sheet.** Cut `todo-period-sheet.tsx`, then `todo-morning-priorities.tsx`, `todo-bge-score.tsx`, `todo-assigned-composer.tsx`, and `todo-period-table-props.ts`. Pass `sheetScrollRef` onto the same `.todo-sheet` node (`ref` as a prop; React 19). The folding class `is-folding` stays on that node only, not on the season sheet.
7. **Season sheet and row.** Cut `todo-season-sheet.tsx` and `todo-season-row.tsx`. Extract `todo-assigned-search.tsx` only as a verbatim copy of the existing label. Do not unify the Required / Assigned sections across the two sheets.
8. **Status and overlays.** Cut `todo-desk-status.tsx` and `todo-desk-overlays.tsx` (fragment). Overlay order stays the list above. `SessionPlanner` still mounts only when `sessionOpen` is truthy, with `startOn` of `"session"` | `"shelves"` | `"list"`.

Stop if a step requires a class-name change, a copy change, or a hook that runs on the phone page. That is a behavior change, not a split.

## Visual and behavior invariants

Desktop, from 768px up. The phone page is unchanged and still the only tree under 768px.

- Root is `div.todo95` with `data-ui-name="To Do"`, the same help and docs strings, and `data-season` only when the lens is season (`seasonSlug(seasonOfDate(focusedDate))`).
- Fascia classes stay `todo-fascia`, `todo-fascia-row is-screen`, `todo-fascia-row is-keys`, `todo-screen`, `todo-mark`, `todo-mark-count`, `todo-load-readout`, `todo-load-needle`, `todo-span`, `todo-view-keys`, `todo-span-key`, `todo-actions`, `todo-show-keys`, `todo-fascia-tray` (`id="todo-show-tray"`, `hidden` when the tray is closed).
- Span words stay Day, Week, Month, Season, Other. Sub-labels stay `spanSubLabel`. Show and sort stay hidden on Season and Other (`stripShown`).
- Period sheet is `div.todo-sheet` with `data-ui-name="Period sheet"`. Fold class is `is-folding` for 180ms unless reduced motion, including when the next tab is season (the season sheet itself does not get the class).
- Ledger: Required (`todo-band is-required`) then Assigned (`todo-band is-assigned`). Prioritized Assigned rows still lead (`pinPrioritizedFirst`). Search empty copy stays `Nothing matches.` / `Nothing else assigned.` B/G/E empty copy stays `Nothing at ${title} yet.`
- Composer placeholder `Add a task…`, button `Add`, match button `Open existing`, tier select label `Composer tier`. Enter submits; Shift+Enter still focuses the first step via the existing `setTimeout(…, 0)`. A name that matches an open row still opens that row and does not create a second task.
- Waiting line still receives `lockedHiddenByPeriod[period] + (period === "day" ? sunHiddenCount : 0)` and toggles `peekHidden` without turning the prefs off.
- Morning strip copy stays `Morning priorities`. A completed priority still gets the visually hidden ` (done)`.
- B/G/E score copy stays `B/G/E {period} score`, the B/G/E fraction line, and `{n} of {n} tasks done`. Rites stay out of the score (no task → dropped).
- Season hint stays `Tasks scheduled on a day, week, or month in {quarterLabel}.` Empty assigned copy stays the long “Nothing scheduled in this season yet…” sentence. Season Required help stays “Marked required for this season.” Assigned help stays “Everything else scheduled in this season. Prioritized rows lead.”
- Status line stays `Day view` / `Week view` / `Month view` / `Season view`, or `Other view · before ${name}` / `Other view · no range yet`, plus `{openCount} open` and ` · ${undoneCount} undone` only when viewing a past day/week/month.
- Dove plate stays `div.todo-desk-plate` with `data-desk-plate="todo"`, `aria-hidden="true"`, `img` `draggable={false}`, `orbFor("home-todo")`.
- Day ‹ › Today calls `setCurrentDate`. Week, month, and season ‹ › Today do not. A paged week, month, or season survives a later shared-day change. A fresh mount with no local offset follows the shared day.
- Done flock is 380ms, ignored if that id is already flocking, immediate under reduced motion, and completed on desk unmount if still pending. Ritual ids never complete, rename, miss, push, delete, or change tier; they open `RitualWalkDialog`.
- One clamshell: `openRowId` / `selectedRowId` live on the desk. Tab change clears both, clears `assignedQuery`, closes the formula, and does not clear the composer draft.
- `TaskCard` mounts once, with `host={taskCardHost}`. `TaskDetailPopup` still opens from View / morning-priority click / `openTask`. The drawer still edits through `TodoTable` props. Those three paths stay three components.
- `usePenActionSync()` still runs for the desk only, so Done rows from a pen’s default action format keep updating while the fascia is mounted.
- CSS is still `todo-chrome.css` only. No new class, no renamed class, no edited rule.

## Test plan

Existing tests are the contract. Do not add a test that imports the new files unless a pure helper is extracted and a panel test cannot see it. Behavior belongs in the panel tests.

Run, in this order, after every extraction step:

```bash
npx vitest run components/Home/ToDo/todo-panel.test.tsx components/Home/ToDo/todo-mobile.test.tsx components/UiNames/ui-names-stamps.test.ts
```

`todo-panel.test.tsx` (35 cases) already covers the seams this split can break:

- Header, `.todo95`, fascia, period nameplate, period keys, filters, period sheet
- B/G/E sections, score, Required hidden in that mode, tier written on the day mark
- Priority sort, name sort, prioritized rows pinned first
- Closed row keeps Card and the clock; D completes a selected row; Done and Done at Bare minimum
- Missed opportunity, Done well, empty wells with Log done still on the composer
- Show-key filter count and tray persistence
- Add task → From lists schedules an existing task; new tasks stay scheduleable
- Available now hides unmet dependencies
- Load strip, days-left hidden on the day lens, σ tube rather than B/G/E in the Done cell
- Open list navigates to that period’s Lists list
- Assigned search, step add, row delete
- Active lamp toggled twice keeps the row
- Spent time on the row and in the lid
- Tier menu and a lid with one title
- Controlled day, `setCurrentDate` on the day nameplate, week/month/season paging without `setCurrentDate`, Today on day vs week, shared-day moves the day sheet, a paged season survives a shared-day change, a fresh mount follows it
- Rites on Sunday, Monday, and the first and last day of the month
- Season add lands on this month while the season is current
- A deleted morning priority disappears
- Assigned search clears when the lens changes
- Unmount mid-flock still completes

`todo-mobile.test.tsx` must still show the phone page and not the fascia when `matchMedia` matches `max-width: 767px`. If the desk CSS import or `usePenActionSync` moves onto `TodoPanel` itself, this test is the one that catches a phone tree mounting desk chrome.

`ui-names-stamps.test.ts` reads source files. After markup moves, retarget these rows (the attribute strings stay the same):

| Stamp `data-ui-name` | File after the split |
|----------------------|----------------------|
| `To Do` | `todo-desk-panel.tsx` |
| `To Do fascia` | `todo-desk-fascia.tsx` |
| `Period keys` | `todo-desk-fascia.tsx` |
| `Period sheet` | `todo-period-sheet.tsx` |
| `Season list` | `todo-season-sheet.tsx` |
| `Morning priorities` | `todo-morning-priorities.tsx` |
| `Required` | `todo-period-sheet.tsx` (the season sheet also has the string; one stamp is enough) |
| `Assigned` | `todo-period-sheet.tsx` |
| `Assigned composer` | `todo-assigned-composer.tsx` |
| `Status bar` | `todo-desk-status.tsx` |
| `To Do plate` | `todo-desk-panel.tsx` |

Leave the stamps that already point at `TodoPeriodNav.tsx`, `todo-filters.tsx`, `PriorityFormulaPanel.tsx`, `TodoLoadPanel.tsx`, and the Done / Missed / Undone files. Do not add new stamp names.

`home-dashboard.test.tsx` mocks `@/components/Home/ToDo/todo-panel`. It should not need an edit if `TodoPanel` is still the named export. Run it once at the end:

```bash
npx vitest run components/Home/home-dashboard.test.tsx
```

No browser pass is required for a move that does not change DOM. If any class or copy has to change to make a file compile, stop and treat that as a failed split. Do not “fix” the UI to match a new component tree.

## Doc updates

Do these in the same step as the file move they describe. House voice: short sentences, paths in backticks, `_Last mapped: 2026-10-27_` on each section you rewrite.

| Doc | What to change |
|-----|----------------|
| `components/Home/ToDo/README.md` | Files table: `todo-panel.tsx` is only the switch. Add a row per new file. Point `seasonMonthDate`, `spanSubLabel`, `openRitualBoard`, and `peekHidden` at the new paths. Phone section: desk is `TodoDeskPanel` in `todo-desk-panel.tsx`. Task-card “Files” note: mounted from `todo-desk-overlays.tsx` (or wherever the `<TaskCard host>` line lands). Do not weaken the three-editors section. |
| `components/Home/README.md` | The phone note can keep citing `TodoPanel` in `todo-panel.tsx` as the switch. Add the desk filename only if that sentence still says the fascia lives in `todo-panel.tsx`. |
| `components/Home/ToDo/TaskCard.tsx` | File comment that says the card is mounted in `todo-panel.tsx`. Point it at the overlays module. Comment only. |
| `components/Home/ToDo/todo-phone-page.tsx` | Comment that names the fascia file. |
| `lib/task-card.ts` and `lib/README.md` | “while `todo-panel` is mounted” means while the desk is mounted. The phone switch does not register a host. One sentence each. |
| `lib/step-points.ts` | Comment that names `todo-panel` `handleSteps`. Point at `use-todo-desk-actions.ts`. |
| `docs/tree.md` and `docs/tree.txt` | Doc sync only (`.cursor/rules/doc-sync.mdc`), not this step. The To Do README lists the door and the desk. It must not say the fascia body is still `todo-panel.tsx`. |
| `docs/SPEC_MAPPING.md` | §8.4 can keep `todo-panel.tsx` as the door. Add the desk path in the same bullet so the map is not a lie. |
| `docs/PERF_PLAN.md` | The sentence that `todo-panel.tsx` memoizes period lists should name `use-todo-desk-board.ts`. |
| `docs/README.md` | One index row for `modular-splits/todo-panel.md`: the structural split plan for the To Do desk. This planning pass did not edit that index; add the row when this plan lands, not during the code split. |
| `docs/PLAN_OF_ACTION.md`, `docs/BRAIN2_FEATURE_IDEAS.md` | Leave them. They name `todo-panel.tsx` as the feature’s home, which is still true. |

Do not edit `docs/TODO_REDESIGN.md` except if a path in Decision 15’s “where the code lives” note would be false. The decision itself does not change.

Screenshots: no UI change, so do not run `npm run capture-screenshots`.

## Risks

| Risk | Why it is real | Guard |
|------|----------------|-------|
| Hook order | Custom hooks flatten into `TodoDeskPanel`. A conditional hook, or calling `usePenActionSync` from `TodoPanel`, changes the phone page and the host count. | One unconditional `useTodoDesk()` on the desk. Compare the flattened list to the inventory above before moving JSX. |
| Flock lifetime | Sheet unmount on tab change would run a cleanup that currently runs only when the desk unmounts. | Timers stay in `use-todo-desk-actions.ts`. |
| Composer and search state | Local `useState` in the sheet resets when `TabsContent` swaps. Search is supposed to clear on tab change; the composer draft is not. | Both stay in the desk hook. The sheet is controlled. |
| Stable `EMPTY_PRIORITY_IDS` | A fresh `[]` in the morning-review selector loops Zustand. | Module-level constant in `todo-desk-constants.ts`. |
| Extra DOM node | A wrapper around the fascia, the sheet, or the overlays changes layout and the stamp tree. | Fragments. Class names stay on the same elements. |
| DRY across season and day | One `RequiredBand` with a `variant` will drift help text, empty copy, or the season flex row back toward `TodoTable`. | Two sheets. Shared search label only. |
| Three editors collapse | `tableProps` or the season lid starts rendering `TaskCard` pieces to “share” flags and steps. | Season row keeps `TodoLidSection` + `TodoBreakdown`. Period rows keep `TodoTable`. Card keeps `host`. |
| CSS load change | Moving the CSS import onto a lazy boundary drops fascia styles, or loading it from the phone module is fine only because the door already imported it. | Static import from the door to the desk module that imports `todo-chrome.css`. |
| `ref` on the sheet | Dropping `sheetScrollRef` is a tiny edit, and still an edit. | Pass it through. |
| Stamp test | It checks file paths, not the live DOM. The UI can be unchanged and the test still fails. | Retarget stamps in the same step that moves the string. |
| Dirty `SessionPlanner.tsx` | A drive-by edit or a revert mixes this split with pause / session work. | Import only. Do not open that file. |
| `setFocusedDate` identity | Today it is a new function every render. Wrapping it in `useCallback` is unnecessary and can mask a stale lens. | Leave it unmemoized. |
| `periodLoad` during render | It is called from `renderTab` and from the header IIFE, twice per render on a period tab. Memoizing it “while you’re there” can change the `new Date()` inside `workingHoursLeft("day", new Date())` on the card host if that call gets pulled in. | Move the function, do not cache it. Leave `hoursLeft` on the host as its own call. |
| Logged-done id | Pulling `Date.now()` / `Math.random()` into a helper that is called twice, or prebuilding the task in render, changes ids and points. | Call the builder once inside `handleAddDone`, then the side effects. |

## Out of scope

- Any change under `components/Modules/`.
- Phone layout, `todo-mobile.tsx`, or sharing desk handlers with the phone page.
- Editing `SessionPlanner.tsx`, `todo-chrome.css`, or the session / tracking files already dirty in the working tree.
- Merging item detail, the drawer, and the task card, or reusing either component to shrink the season row.
- New behavior: sticky fascia, memoized tables, a unified period navigator, a second public export, a lib-level `scheduleTaskForPeriod`.
- Screenshot recapture.

## Implementation note

Land the split in its own commit, after the extraction steps above, with the README and stamp updates in that same commit. Do not mix it with the in-progress pause and session work. This document is the spec; implementing it is a later pass.
