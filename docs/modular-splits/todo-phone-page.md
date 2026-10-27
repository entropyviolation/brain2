# Split `todo-phone-page.tsx`

_Last mapped: 2026-10-27. Plan only. Do not treat this file as shipped structure until the split lands._

Pure structural extraction of `components/Home/ToDo/todo-phone-page.tsx`. The phone To Do looks and works the same. This plan does not cover `todo-panel.tsx`.

## Scope

| In | Out |
|----|-----|
| `components/Home/ToDo/todo-phone-page.tsx` (~1621 lines). `TodoPhonePage` is the only component, from ~164 to ~1620. | `todo-panel.tsx` and any files a sibling plan extracts for the desk. |
| New modules under `components/Home/ToDo/phone/`. | Anything under `components/Modules`. |
| Docs listed under [Doc updates](#doc-updates), written in the same implementation step that adds the files. | CSS files, including `todo-chrome.css`, `todo-mobile.css`, and `todo-chrome` class names. |
| | The dirty session and tracking work already in the tree. Leave those diffs alone. |
| | Item detail, the To do drawer, and the To do task card. They stay three UIs. |

`TodoPanel` is the switch. At `max-width: 767px` it mounts `TodoPhonePage` and leaves the fascia unmounted. From 768px up it mounts `TodoDeskPanel` and leaves the phone page unmounted. The two pages share stores and task writes. They do not share a layout. `todo-mobile.tsx` and `todo-mobile.css` stay the phone screen (rows, swipe, composer, sheets). This split moves the page's orchestration around that screen. It does not restyle the screen and it does not fold the phone into the desk.

## Responsibilities

What the page owns today, and where it lives after the split:

| Responsibility | Today | After |
|----------------|-------|-------|
| Public door | `export function TodoPhonePage` | Same function, same file, same props. The body calls one hook and returns one screen component. |
| Store reads and writes | Inside `TodoPhonePage` | `phone/use-phone-page.ts` and the ordered hooks it calls. Same stores, same selectors. |
| Period lens | Persisted tab, day controlled by Home or an internal date, separate week / month / season dates | `phone/use-phone-focus.ts`, called from the page hook. |
| Open, done, missed, undone, rites, morning priorities, session pick list | `useMemo` block ~270–398 | Pure derives in `phone/phone-lists.ts`, memoized from the page hook in today's order. |
| Verbs | Complete (flock), miss, push, delete, estimate, steps, tier, commitment, status, rename, log done, schedule existing, undone assimilate / push / discard, clock stop | `phone/use-phone-actions.ts`. |
| Task card host | Object ~723–747, passed to the existing `TaskCard` | `phone/phone-task-card-host.ts` builds the same object. `TaskCard` stays `TaskCard.tsx`. |
| Load figures and the load sheet element | `periodLoad`, header phosphor line, `TodoLoadPanel` element ~1348–1409 | `phone/phone-load.ts` returns the same `TodoLoadPanel` element. |
| Phone screen | `<TodoMobile>` ~1411–1618 | `phone/phone-screen.tsx` renders that element with the same props. |
| Overlays inside `TodoMobile` | Clock dialog, item detail popup, ritual walk, miss reason, task card, needs, session planner, Just Start | `phone/phone-overlays.tsx` returns the same sequence in a fragment. |
| Other tab | `todo95 todo-ios-wells` wrapping `TodoRangeNav` and `TodoRangeSheet` | `phone/phone-other-slot.tsx` returns that same `div`. |
| Unmounted desk copy | `renderTab` ~766–1183 and `renderSeasonRow` ~1225–1296. Nothing in this file calls them. The desk calls its own copies from `todo-panel.tsx`. | `phone/phone-desk-remnant.tsx`. The page builds the closures and does not call them. |

`todo-mobile.tsx` keeps the phone drawer sheet (`TaskSheet` / `SeasonSheet`), the composer, swipe, and segmented Day / Week / Month / Season / Other control. View still opens `TaskDetailPopup`. Card still opens `TaskCard`. Needs still opens `TaskPrereqDialog`. Those three editors stay on their current components.

## Stable exports

- `todo-panel.tsx` keeps `import { TodoPhonePage } from "./todo-phone-page"`.
- The props stay optional and default to `{}`:

```ts
{
  currentDate?: Date
  setCurrentDate?: (date: Date) => void
}
```

- `todo-phone-page.tsx` exports `TodoPhonePage` and nothing else. `TodoTab`, constants, hooks, and remnant functions stay inside `phone/`.
- Add no `phone/index.ts`. Outside `phone/`, the only import path is `components/Home/ToDo/todo-phone-page.tsx`.
- `TodoMobile`, `TodoMobileProps`, and `PhoneTab` stay exported from `todo-mobile.tsx` only.
- The static import in `todo-panel.tsx` stays static. A dynamic import would change when this module and `todo-chrome.css` load. The phone module is already in the client graph on the desk because that import is static. Keep it that way.

## New files and what moves

All new files are under `components/Home/ToDo/phone/`. Names here are the ones to create. Do not add siblings at `components/Home/ToDo/` root (`use-todo-period.ts`, `period-sheet.tsx`, shared action modules, and so on). The desk plan may use those names. Identical logic may be copied into `phone/`. Deduping with the desk is a later change and is out of this split.

`"use client"` goes on every new file that calls a hook. Pure `.ts` modules need no directive. Each new file opens with a short header comment in the house style (path, one-line purpose).

### `phone/phone-constants.ts`

Move the live constants from the top of the page (~132–139):

- `TODO_TABS`
- `TodoTab`
- `DEFAULT_LOGGED_DONE_MINUTES` (30, the assumed length for work logged after the fact)
- `EMPTY_PRIORITY_IDS` (stable `[]` so the morning-priority selector does not allocate a new array)

`SPAN_KEYS`, `spanSubLabel`, and `BGE_SECTIONS` move with the remnant. They feed the unmounted sheet only.

### `phone/phone-lists.ts`

Pure functions, no hooks. Copy the memo bodies and their dependency inputs as arguments. The page hook keeps the `useMemo` calls.

- Session pick list (~270–285). Season still falls through to every open task and the label `"All open tasks"`.
- Ritual board and the sun-filtered open board (~288–299), including `sunHiddenCount`.
- Morning tasks (~305–308).
- `filteredByPeriod` (~312–358), including day rites prepended to the day list.
- `lockedHiddenByPeriod` (~361–367). The count stays 0 when Available now is on, and when Hide locked is off.
- `doneByPeriod`, `missedByPeriod`, `undoneByPeriod` (~370–398). Day Done still concatenates rite tasks, then stored tasks.

### `phone/phone-load.ts`

Pure. Copy `periodLoad` (~750–764) and the header IIFE (~1333–1351).

- Header text stays `` `${formatWorkingHours(figures.hours)} left · ${formatMinutesAsHours(figures.minutes)} est · ${comfortWord(figures.band)}` ``.
- The returned element is `<TodoLoadPanel>` itself, for the season branch and the period branch (~1357–1408), with the same props, including the unestimated click that sets `selectedRowId` and `openRowId`.
- Pass that element as `loadPanel`. Wrap it in no extra component type. `TodoLoadPanel` has no hooks; a wrapper would still change the fiber `TodoMobile` mounts inside the Load sheet.

`loadOpen` is read only by the unmounted sheet. The live load sheet does not consult it. Leave that gate on the remnant.

### `phone/phone-task-card-host.ts`

`buildPhoneTaskCardHost(...)` returns the same `TaskCardHost` object (~723–747).

- `cardPeriod` is `"month"` when the lens is season, and the lens period otherwise.
- `periodLabel` stays `This day` / `This week` / `This month` / `This season`.
- Required and Prioritized follow the lens (`markPeriod`), including season. Push counts on the card still use `cardPeriod`.
- `hoursLeft` stays `workingHoursLeft("day", new Date())`.

### `phone/use-phone-focus.ts`

Hook. Owns the tab and the four dates (~193–219):

- `usePersistedTab(APP_NAV_KEYS.homeTodoTab, TODO_TABS, "day")`.
- `periodTab` is `"day"` while the tab is `"other"`.
- `currentDate` is the controlled prop when Home passes one, otherwise `internalDate` (the uncontrolled fallback tests use).
- `weekDate` / `monthDate` / `seasonDate` stay `null` until that nameplate is paged. A later shared-day change must not overwrite a week, month, or season the user already paged.
- `focusedDate` / `setFocusedDate` use the same branch order.

### `phone/use-phone-actions.ts`

Hook. Owns flock timers, miss/push reasons, task-card registration, and the clock stop, plus the plain handlers that sit between those hooks. Copy the function bodies. Keep comments that explain assumed times, flock-on-unmount, and ritual no-ops.

Handlers to move verbatim:

- `scheduleTaskForPeriod`, `seasonMonthDate`, `handleAddTodo`, `searchExistingTasks`, `pickExistingTask`, `handleAddDone`, `handleConfirmTimes`
- `openRitual`, `handleComplete`, `handleRename`, `handleMissed`, `handleTierChange`, `handlePush`, `handleDelete`, `handleEstimate`, `handleSteps`
- `resolveUndone`, `getStatus`, `openTask`, `handleCommitment`, `handleStatusChange`
- The quick-add closure the screen passes as `onQuickAdd` (~1586–1591)

Behavior that must survive the move:

- Log done on Season uses month placement and `seasonMonthDate()` (today while the season is current, otherwise the season's first month). Duration is `DEFAULT_LOGGED_DONE_MINUTES`. Estimates record the flat assumption. Points and `emitTaskCompleted` still run. The matching Done section opens.
- A second Done while a row is flocking is ignored. Reduced motion completes immediately. Otherwise the flock waits 380ms. Unmount runs any pending complete so leaving the tab does not drop it.
- Rite ids open `RitualWalkDialog` and do not complete, rename, miss, push, delete, or change status.
- Miss and push set `reasonAsk` and apply only from `MissReasonDialog`'s resolve. Push on the season lens is a no-op at the `TodoMobile` prop (`markPeriod === "quarter"`). The same no-op wraps B/G/E tier changes on season.
- Day Prioritized still writes the morning review through `nextPriorityIds` when a morning review exists.
- Step edits still go through `todoTime.settle` and `settleStepPoints`.

### `phone/use-phone-page.ts`

The only hook `TodoPhonePage` calls. It calls the smaller hooks in the order in [Hook order](#hook-order) and returns the bag `phone-screen.tsx` needs. It also calls `bindPhoneDeskRemnant` and discards the result with `void remnant` so the closures are created and not invoked. `void remnant` does not call `renderTab`.

### `phone/phone-desk-remnant.tsx`

Move `renderTab` and `renderSeasonRow` verbatim, including every `className`, `data-ui-*` attribute, copy string, and child (`TodoTable`, `WaitingLine`, `NativeSelect`, composer, `AddDoneDialog`, aftermath sections, `TodoDeleteButton`, `TodoLidSection`, `TodoBreakdown`).

Move with them the imports that exist only for this JSX: `Tabs` and its pieces, `orbFor`, `PickListKey`, `SessionKey`, `SessionsKey`, `TodoPeriodNav`, `TodoFilters`, `TodoSortKeys`, `TodoSettingsDialog`, `PriorityFormulaPanel`, `TodoTable`, `TodoBreakdown` / `TodoDeleteButton` / `TodoLidSection`, `NativeSelect`, `WaitingLine`, `openStepItem`, `DoneTodoSection`, `MissedTodoSection`, `UndoneTodoSection`, `AddDoneDialog`, `bgeScore`. `SessionPlanner` stays on the live overlay path. `AddTodoDialog`'s types stay on the live add handler; the dialog component is not on the live return.

`SPAN_KEYS`, `spanSubLabel`, and `BGE_SECTIONS` live in this file.

`bindPhoneDeskRemnant(bag)` returns `{ renderTab, renderSeasonRow }`. The page does not call either function and does not render their JSX. Mounting them would paint the desk sheet (`.todo-sheet`, `TodoTable`, the assigned composer) on the phone.

State that only this JSX reads stays in the page hook so hook order holds: `expandedPeriods`, `composerName`, `composerTier`, `periodFolding`, `sheetScrollRef`, and the unread `showTrayOpen` binding from `useTodoPrefs`. `assignedQuery` is live (season filter and tab reset) even though the search field that writes it sits in this remnant. Keep the state on the live hook and pass it in.

`setPeriodFolding` is never called today, so `periodFolding` stays `false`. Keep the state.

### `phone/phone-overlays.tsx`

A component that returns a fragment. Child order stays:

1. `clockStop.dialog`
2. `TaskDetailPopup` (`taskId`, `open={!!selectedTaskId}`, `onClose` clears the id)
3. `RitualWalkDialog`
4. `MissReasonDialog` (resolve copies `apply`, clears `reasonAsk`, then calls `apply`)
5. `taskClock.picker`
6. `<TaskCard host={taskCardHost} />`
7. `TaskPrereqDialog`
8. `SessionPlanner` when `sessionOpen` is set, with the same `startOn`, `periodLabel`, and `periodTasks`
9. `JustStartMode` when `justStartTaskId` is set

`TodoPhonePage` passes this as the children of `TodoMobile`, which still renders `{props.children}` in the same place. A fragment adds no DOM node.

### `phone/phone-other-slot.tsx`

Returns the same node the `other` prop holds today:

```tsx
<div className="todo95 todo-ios-wells">
  <TodoRangeNav />
  <TodoRangeSheet onOpenTask={openTask} onComplete={(id) => completeTask(id)} />
</div>
```

`onComplete` stays a direct `completeTask(id)` call. It does not go through the flocking `handleComplete`.

### `phone/phone-screen.tsx`

The live return (~1353–1618). Builds `phoneLens`, `phonePeriod`, counts, titles, and the `TodoMobile` prop list by copying the JSX. `paceSlot` stays a `<PaceSettings>` element with `samples`, `overrides`, `ghosts`, and `scopes` from `useTodoTime`.

`import "./todo-chrome.css"` stays the last import in `todo-phone-page.tsx`. The remnant and the screen do not import it again. Phone layout still does not edit that file. `todo-mobile.css` stays imported from `todo-mobile.tsx` only.

### `todo-phone-page.tsx` after the split

About 40–80 lines:

- The file header, updated so it points at `phone/` and still says the fascia is not mounted here.
- `"use client"`.
- Import `TodoPhonePage`'s hook and screen, then `./todo-chrome.css` last.
- `export function TodoPhonePage` calls `usePhonePageModel` and returns `<PhoneScreen model={...} />`.

No context provider. Arguments stay plain objects so the tree `TodoMobile` sees does not gain a provider fiber.

## Hook order

Reorder none of these. Custom hooks are called unconditionally. Nested hooks inside `usePenActionSync`, `usePersistedTab`, `useTodoPrefs`, `useTodoRanges`, `useTodoTime`, `useRitesSun`, `useTaskClockStarter`, and `useUnfinishedStop` stay inside those functions.

`usePhonePageModel` calls its children so the flattened order is:

1. `usePenActionSync`
2. `useTaskStore` tasks
3. `useReviewsStore` reviews
4. `useLayoutEffect` → `sweepStaleTaskPriorities`
5. `useStarLordStore` reports
6. `useUserSettingsStore` birthday
7. `useTaskStore` updateTask, deleteTask, addTask, lists, folders, priorityWeights
8. `useState` selectedTaskId, ritualWalk, justStartTaskId
9. `usePenColorSessionStore` task id, then step id
10. `useTaskClockStarter`
11. `useState` prereqTaskId, sessionOpen
12. `usePersistedTab`
13. `useState` internalDate, weekDate, monthDate, seasonDate
14. `useTodoPrefs`
15. `useTodoRanges`
16. `useState` peekHidden
17. `useTodoTime(tasks)`
18. `useRitesSun(ritesFollowSun)`
19. `useState` showFormula, estimateScope, assignedQuery, expandedPeriods, doneSectionsOpen, missedSectionsOpen, undoneSectionsOpen, openRowId, selectedRowId, flockingId, composerName, composerTier, periodFolding
20. `useRef` sheetScrollRef
21. `useMemo` sessionPeriod, ritualBoard, openRitualBoard
22. `useReviewsStore` morning priority ids (`?? EMPTY_PRIORITY_IDS`)
23. `useMemo` morningTasks, todoItems, filteredByPeriod, lockedHiddenByPeriod, doneByPeriod, missedByPeriod, undoneByPeriod
24. `useCallback` prefersReduced
25. `useRef` timers, flocking
26. `useCallback` later
27. `useEffect` clear timers and flush unfinished flocks
28. `useState` reasonAsk
29. `useEffect` `registerTaskCardHost`
30. `usePenColorSessionStore` now objectives
31. `useUnfinishedStop`
32. `useMemo` season (only after the action hooks; `renderTab` is not a hook, so the season memo stays immediately after `useUnfinishedStop`)

`showFormula` is written (`onShowFormula`, and cleared on tab change) and the value is not read. `TodoMobile` keeps its own formula-sheet state and still renders `PriorityFormulaPanel`. Keep the `useState`.

## Extraction order

Each step leaves the app building, with the same DOM. Run the [test plan](#test-plan) after steps 3, 5, and 7. Update the docs in the same step that adds each file.

1. **Constants and pure lists.** Add `phone-constants.ts` and `phone-lists.ts`. Point the existing memos at the pure functions. Hook calls stay in the page.
2. **Load and task-card host.** Add `phone-load.ts` and `phone-task-card-host.ts`. The `loadPanel` element type stays `TodoLoadPanel`.
3. **Remnant.** Add `phone-desk-remnant.tsx`. Move the unmounted functions and their imports. `void` the binder result. Confirm the phone test still finds no fascia, and that `.todo-sheet` and `.todo-season-row` are absent.
4. **Screen and slots.** Add `phone-screen.tsx`, `phone-overlays.tsx`, and `phone-other-slot.tsx`. Move the live return without editing prop values or child order.
5. **One page hook.** Add `use-phone-page.ts` and move the hook list into it in the order above, still as one function. `TodoPhonePage` becomes the thin door. CSS import stays last in the door file.
6. **Split the hook.** Add `use-phone-focus.ts` and `use-phone-actions.ts`. Move list memos' `useMemo` calls into the page hook (or a `usePhoneLists` in the same file) only when the flattened order matches. Do this after step 5 is green, so a hook-order mistake is easy to see.
7. **Docs and tree.** See [Doc updates](#doc-updates).

Stop when `todo-phone-page.tsx` is the thin door, every moved function is under `phone/`, the remnant is unmounted, and the tests below pass. Do not continue into `todo-mobile.tsx`, `todo-panel.tsx`, or a shared helper at `ToDo/` root.

## Visual and behavior invariants

The live tree is `TodoMobile` plus the overlay children. Class names, copy, and `data-ui-*` values on that tree stay byte-for-byte.

- Gate stays `max-width: 767px` in `use-todo-phone.ts`. This split does not edit that file. Desk width still shows `.todo-fascia` / `.todo-window` and no `.todo-ios`. Phone width still shows `[data-todo-layout="phone"]` and no `.todo-window`, `.todo-fascia`, or `.todo-desk-plate`.
- The remnant stays unmounted: no `.todo-sheet`, no `.todo-season-row`, no desk Assigned composer (`data-ui-name="Assigned composer"` belongs to the phone composer inside `todo-mobile.tsx`, which the existing test already finds).
- Segmented control words stay Day, Week, Month, Season, Other. ‹ › and Today, sideways period drag, and `touch-action: pan-y` stay in `todo-mobile.tsx`.
- Targets, safe-area insets, spring curves, and `prefers-reduced-motion` stay in the mobile module and CSS. Flock delay stays 380ms in the moved complete handler. Reduced motion still completes with no flock.
- The sheet on a row is the drawer inside `todo-mobile.tsx` (verbs, flags, tier, estimate, `TodoBreakdown`). It is not `TaskCard` and it is not item detail. View opens item detail. Card opens the task card. Needs opens `TaskPrereqDialog`.
- Done, Missed, and Undone sections, assumed-time confirm, B/G/E sections and score on the phone list, the waiting line, morning priorities, Required and Assigned, load line, Show / Sort, pace inside Settings, formula sheet, Open list, Session and Sessions, Add Task, composer, and Log done stay wired to the same callbacks.
- Empty bands stay the mobile module's choice. This split does not start drawing a band the phone currently hides.
- Tab change still clears the open row, the selected row, `assignedQuery`, and `showFormula`, and ignores a press of the active tab.
- Season lens: `phoneLens` `"season"`, `phonePeriod` `"month"`, push and B/G/E writes no-op, required and prioritized still use the season key, open count uses `seasonOpen`, undone count is 0, the season hint string stays `Tasks scheduled on a day, week, or month in ${quarterLabel}.`.
- Other lens: open count uses `tasksInRange` for the active range, filtered to open and not cleared. The range well keeps classes `todo95 todo-ios-wells`.
- Rites: wrong-end-of-day rows drop off the open list when the sun rule is on and the user is not peeking. Done, lookups, and walks keep the whole board. The waiting line adds `sunHiddenCount` on the day lens only.
- Hide locked and the sun rule still peek through the waiting line without turning the prefs off.
- Quick add uses `createScheduledTodoTask` and focuses the new row only when `focusFirstStep` is set. It no-ops unless `phoneLens` is `"period"`.
- Add Task on Season still schedules onto the month via `seasonMonthDate()`.
- `registerTaskCardHost()` still runs once on mount.
- Priority sweep still runs in `useLayoutEffect` when `tasks` or `reviews` change.
- Just Start still mounts `JustStartMode` for `justStartTaskId`. Session still mounts `SessionPlanner` with `startOn` `"session"` | `"shelves"` | `"list"`.
- Clock stop still goes through `useUnfinishedStop`, `stopTaskClock`, and `offerPenDebrief`. The unfinished dialog is still `clockStop.dialog`.
- Header phosphor line copy and the comfort angle fields stay. `TodoMobile` still receives `{ text, overCap }` only.
- No new wrapper DOM around `TodoMobile`, the range well, `PaceSettings`, or `TodoLoadPanel`.
- No copy edits, no `className` edits, no `data-ui-name` edits.

## Test plan

Existing coverage is the contract. Add no new suite.

Run:

- `components/Home/ToDo/todo-mobile.test.tsx` — phone page mounted, fascia absent, row complete, composer add, drawer sheet is not item detail, day nameplate steps.
- `components/Home/ToDo/todo-panel.test.tsx` — desk fascia still mounts when `matchMedia` is not the phone query. These tests must stay green without rendering `.todo-ios`.
- Any other test that imports `TodoPanel` or `TodoPhonePage`.

On the phone test "mounts the phone list and leaves the fascia off", add two expects after the split's remnant step:

- `querySelector(".todo-sheet")` is null
- `querySelector(".todo-season-row")` is null

That locks the remnant as unmounted. Add nothing else to the test.

Manual, phone viewport (`max-width: 767px`), if a browser is up:

- Day list shows the seeded row. Circle completes it into Done. Composer adds a task.
- Row opens the sheet. The sheet is not the item-detail dialog. Card and View still open the other two editors.
- Week, Month, Season, Other switch. Season does not show the desk season `<li class="todo-season-row">`. Other shows the range well.
- Load sheet, formula sheet, Show / Sort, Log done, Session, and a rite walk still open the same dialogs.
- Desk width: fascia present, phone root absent.

Skip screenshot recapture. `docs/screenshots/` has no phone To Do capture, and the desk captures must not change.

## Doc updates

Do these in the implementation step that adds the files. Edit the stale sentences. Stamp `_Last mapped: 2026-10-27_` on each section you touch (or the real date if that day has passed).

| Doc | Change |
|-----|--------|
| `components/Home/ToDo/README.md` | Files table: `todo-phone-page.tsx` is the thin door and renders `phone/phone-screen.tsx`. Add a `phone/` row listing the new files and the unmounted remnant. Phone section: same behavior; the orchestration lives under `phone/`. State that the remnant is the old desk sheet left uncalled, and that mounting it is out of bounds. Three-editors section stays as it is. |
| `components/Home/README.md` | The To Do bullet (~125) names `ToDo/phone/` as the page's modules and keeps `todo-phone-page.tsx` as the import path. |
| `docs/tree.md` and `docs/tree.txt` | Doc sync only (`.cursor/rules/doc-sync.mdc`), not this step. The phone files belong in the To Do README. |
| `docs/README.md` | One catalog row for `modular-splits/`: structural split plans, not product behavior. Point at this file. |
| `docs/SPEC_MAPPING.md` | No edit. No feature moved between missing / partial / implemented. |
| Root `README.md`, `docs/DESIGN_STYLE.md`, screenshot sidecars | No edit. |

Leave the sibling plan file untouched if it appears at `docs/modular-splits/todo-panel.md`.

## Risks

- **Remnant gets rendered.** The desk JSX is a full period sheet. Calling `renderTab` or placing it in the return paints a second To Do on the phone and breaks "the fascia is not mounted here." The binder result is discarded. The new expects cover `.todo-sheet` and `.todo-season-row`.
- **Hook order drifts** when the page hook is split. Local `useState` would swap fields after a hot reload; a conditional hook throws. Follow the numbered list. Land the single hook before splitting it.
- **Element type changes** for `loadPanel`, `paceSlot`, or `other`. Keep `TodoLoadPanel`, `PaceSettings`, and the `div.todo95.todo-ios-wells` as the nodes those props hold.
- **CSS order.** `todo-chrome.css` stays the last import on the door. A second import from `phone/` can reorder the cascade.
- **Shared extraction with the desk.** Copying a helper to `ToDo/*.ts` or importing a file the desk plan creates will collide. Phone-only path. Duplication with `todo-panel.tsx` stays until a later, separate dedupe.
- **Accidental behavior edits while moving.** Season month placement, flock timing, rite no-ops, `EMPTY_PRIORITY_IDS`, the controlled date, and the direct `completeTask` on the range sheet are easy to "tidy." Copy them.
- **`assignedQuery` looks dead.** The field that sets it is in the remnant, so the query stays `""` on the live screen. The season memo still filters with it, and tab change still clears it. Keep both.
- **`showFormula` looks dead.** The setter is live. The value is unused. Keep the state hook.
- **Dirty tree.** Session and tracking files are already modified. The split touches only `todo-phone-page.tsx`, new files under `phone/`, the one test expect, and the docs in the table above.
- **Bundle.** `TodoPanel` already imports this module statically, so the remnant stays in the client graph, which matches today. Do not delete it to shrink the bundle. Deleting it is a source change this plan is not asking for, and it invites a follow-up that reintroduces the sheet by rewriting it.

## Done when

- `TodoPhonePage` is still the only export of `todo-phone-page.tsx`, and `todo-panel.tsx` still imports it from `./todo-phone-page`.
- New modules live only in `components/Home/ToDo/phone/`.
- The phone DOM and the desk DOM match the tests above.
- The three task editors are still `TaskDetailPopup`, the phone sheet in `todo-mobile.tsx`, and `TaskCard`.
- No file under `components/Modules`, no CSS file, and no unrelated dirty file was edited.
