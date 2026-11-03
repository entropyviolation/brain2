# Split `habit-tracker.tsx`

_Last mapped: 2026-10-27_

Plan only. Do not implement until asked. This is a pure structural extraction: the app must look and work the same. No new behavior, no renamed controls, no CSS edits, no `components/Modules` edits, and no edits to `daily-task-form.tsx` (a sibling planner owns that file).

The working tree already has unrelated session and tracking edits. The implementation must not revert or restage those. The only application file that should change in the Habits room, besides new files under `tracker/`, is `components/Home/Habits/habit-tracker.tsx`, plus the comment and doc touch-ups listed under **Doc updates**. The one existing test that must change is the Names stamp path, because it reads source text.

## What the file is today

`components/Home/Habits/habit-tracker.tsx` is about 1643 lines. `HabitsDesktopPage` (~204–1632, about 1430 lines) is not exported. `WeeklyTaskTracker` (~1636) is the public door: under 767px it mounts `HabitsPhonePage`, and at 768px and up it mounts `HabitsDesktopPage`. Home loads the named export with `lazy()` in `components/Home/home-dashboard.tsx`. The default export is the same function.

The desktop page is one client component. It owns store subscriptions, the period lens, the habit form session, four frequency memos, order-draft sorting, view-toggle lists, grade numbers, five dialogs, the fascia header, the four period keys, and four sheet panes. Grids, the control panel, rockers, wands, and dialogs are already other files. This split only moves what is still inline here.

The phone page (`habits-phone-page.tsx`) repeats `viewToggles`, `sortTools`, and the wand mast. Leave that copy alone. Unifying it is a second change and can drift the phone sheet.

## Responsibilities after the split

| Piece | Job |
| --- | --- |
| `habit-tracker.tsx` | Public door only. Static-imports the desktop page, switches on `useHabitsPhone`, keeps the three CSS side-effect imports. |
| `tracker/habits-desktop-page.tsx` | Composer. Calls the hooks in a fixed order and renders header, keys, four panes, and dialogs inside the same `Tabs` root. |
| `tracker/use-habits-desk-store.ts` | The existing `useHabitsStore` / reviews / exemption selectors, one selector per field, same as today. |
| `tracker/use-habit-period-lens.ts` | Week / month / season lens, `weekDates`, hydrate-safe restore, `writeStoredDate`. |
| `tracker/use-habit-form-session.ts` | Add / edit / delete session, `task-${Date.now()}` ids, tracking backfill, Lists return. |
| `tracker/sheet-idle.ts` | Idle grade, output, percent map, and good-day placeholders. Shared singleton maps. |
| `tracker/*-model.ts` | Pure bundles for daily, weekly, monthly, and season. Closed tabs still return idle and skip that tab’s grade math. |
| `tracker/active-grade.ts` | Which bundle feeds the tubes, the “through …” line, and the blended percents. |
| `tracker/view-toggles.ts` | Rocker descriptors for the control panel. Labels and ids stay byte-for-byte. |
| `tracker/order-draft.ts` | Visible-row reorder while Default sort is in edit. |
| Pane files | The four `TabsContent` trees. |
| `tracker/habit-desk-header.tsx` | Fascia title, the four `WeekNavigation` branches, Settings. |
| `tracker/habit-period-keys.tsx` | Daily / Weekly / Monthly / Season keycaps. |
| `tracker/habit-desk-dialogs.tsx` | Form, both grade sheets, good periods, settings. |
| `tracker/habit-plan-log.tsx` | The plan `fieldset` under a solo view. |
| `tracker/habit-wand-mast.tsx` | Wand banner mount above the well. |
| `tracker/habit-sheet-loading.tsx` | The “Loading habits…” well. |
| `tracker/habit-desk-frame.tsx` | The repeated `.hab-desk` / `.hab-sheet` / `.hab-well` / control-panel skeleton, with slots so it adds no wrapper nodes. |

Grade math stays in `lib/calculations.ts`. Completion writes stay in the grid files. `HabitsTabControls` stays presentational. This folder does not become a second public API.

## Stable exports

Keep these importable from `components/Home/Habits/habit-tracker.tsx` and do not add exports there:

- Named `WeeklyTaskTracker` (`{ currentDate?: Date }`, default `new Date()`).
- Default export, the same function.

Call sites that must keep compiling with no import edit:

- `components/Home/home-dashboard.tsx` — `import("@/components/Home/Habits/habit-tracker")` then `mod.WeeklyTaskTracker`.
- `components/Home/home-dashboard.test.tsx` — `vi.mock("@/components/Home/Habits/habit-tracker")`.
- `habit-tracker.test.tsx`, `habit-priority-sheet.test.tsx`, `habits-phone.test.tsx` — `import { WeeklyTaskTracker } from "./habit-tracker"`.

`HabitsDesktopPage` stays unexported. Files under `tracker/` may export whatever the desktop page imports. Nothing outside `components/Home/Habits/` should import `tracker/`. Do not add `tracker/index.ts`.

`WeeklyTaskTracker` must static-import `HabitsDesktopPage`. A dynamic `import()` on the desktop branch would change when CSS and the desktop module evaluate, including on the phone path, because today they are one module. The phone and desktop trees still must not mount together.

## New files and what moves

All new paths are under `components/Home/Habits/tracker/`. Every `.tsx` file starts with `"use client"`. Pure `.ts` files stay free of JSX.

### `tracker/sheet-idle.ts`

Move unchanged, as module singletons (not factories):

- `EMPTY_HABIT_PRIORITY_IDS`
- `IDLE_GRADE`, `IDLE_OUTPUT`, `IDLE_PERCENTS`, `IDLE_GOOD_DAYS`
- `openGrade`, `openOutput`

`EMPTY_HABIT_PRIORITY_IDS` is the stable fallback for a missing morning review. A fresh `[]` each render would change that subscription. `IDLE_PERCENTS` is one shared `Map`. Closed-tab bundles return that same map today.

### `tracker/single-period.ts`

- `singlePeriodColumns` — when Week / Month / Season View is on, the sheet shows the current column (or the last column). The full window list stays in the grade memo.

### `tracker/habit-plan-log.tsx`

- `HabitPlanLog` — `fieldset.hab-period-plan.hab-plan-frame` plus `planPeriodStampProps`, then `PlanTextLog`.
- `weekPlanLegend` — `Week Plan — ${MMM d} to ${MMM d}` over that column’s Monday plus six days (`addCalendarDays`).

### `tracker/habit-wand-mast.tsx`

The function now called `priorityBar`. Exact tree:

- `div.hab-sheet-mast`
- `div.hab-wand-mount` with `data-testid="habit-wand-banner-mount"`
- `HabitWandBanner` with `view` `exemption`, `missed`, or `null`

That mount is only the banner. Rockers are not on this strip. `sortTools` still renders `HabitControlBar` into the control panel’s Order plate (`HabitsTabControls`). Do not put rockers back on the sheet while moving code. The sheet’s older control-bar story in the README is not a target for this split.

### `tracker/habit-sheet-loading.tsx`

The four identical busy wells:

```tsx
<div className="habit-grid-wrap" aria-busy="true">
  <p className="text-sm text-muted-foreground p-4">Loading habits…</p>
</div>
```

The ellipsis is `…`.

### `tracker/view-toggles.ts`

Pure `habitViewToggles(frequency, flags)` copied from the inner `viewToggles` (~823–904). Same ids and labels:

| Frequency | Ids beyond the shared pair |
| --- | --- |
| daily | `group-by-kind`, `heatmap-view`, `day-view`, then `hide-done`, `hide-completed-and-missed` (no suffix) |
| weekly | suffix `-weekly`; solo id `week-view` |
| monthly | suffix `-monthly`; solo id `month-view` |
| quarterly | suffix `-season`; solo id `season-view` |

Shared first pair: `highlight-priorities`, `streak-marks`, plus that suffix. Labels: Highlight priorities, Streaks and multipliers, Group by category, Heatmap View, Day View, Week View, Month View, Season View, Hide Done, Mask done and missed.

Do not wrap the builder in `useCallback`. The page rebuilds the array every render today.

### `tracker/order-draft.ts`

Pure helpers only. State setters stay in the page (or in the form/order hook if that hook is the only caller):

- `orderWithDraft`
- `editingFrequency` (`habitSortMode === "default"` and the draft’s frequency)
- the `reorderVisible` / `mergeVisibleOrder` update shape

`sortTools` can be a small function in `tracker/habit-sort-tools.tsx` that returns the same `HabitControlBar` element. Sort ids stay `habit-sort`, `habit-sort-weekly`, `habit-sort-monthly`, `habit-sort-season`.

### `tracker/daily-model.ts`, `weekly-model.ts`, `monthly-model.ts`, `season-model.ts`

Move the bodies of the four `useMemo`s (~396–747). Each file exports one function, e.g. `computeDailyBundle(...)`. The page keeps four `useMemo` calls and the same dependency arrays.

Closed-tab returns stay inside those functions. A weekly completion write must not run season grade math.

Daily still calls `weekWillpowerStones` before the closed-tab return. Weekly, monthly, and season panes show those daily stones. Moving the stone call under `if (habitTab !== "daily")` would empty the gems on the other sheets.

### `tracker/active-grade.ts`

Pure picks, copied from ~936–980:

- `activePrioGrade`, `activePrioOutput`, `activeGrade`, `activeOutput` by `habitTab` (`quarterly`, then `monthly`, then `weekly`, else daily).
- `shownGrade` / `shownOutput`: `0` until `hydrated`, otherwise `blendPriorityScore(...)`.
- `gradeDaysReady`, `outputReady` (hydrated, `daysIncluded > 0`, and `habits.length > 0`).
- `gradePeriodUnit`: `season` / `month` / `week` / `day`.
- `gradeLabel`: daily is `Week grade`; every other tab is `Span grade`.
- `gradeThrough`: `null` when nothing is included; daily is `full week` or `through ${EEE}`; other tabs use `through ${format(...)}` with `MMM yyyy` for month and season and `MMM d` for week. Daily indexes `weekDates[gradeDaysReady - 1]`. The others index `activeGrade.days[gradeDaysReady - 1].date`.

Tube text stays `` `${n.toFixed(0)}%` `` or `—` when the ready flag is 0 / false.

### `tracker/good-period-model.ts`

The `goodDaySummary`, `todayPrioRaw`, and `goodPeriodSummary` bodies (~981–1047), still invoked from `useMemo` on the page with the same deps. `periodWells` is built only from a non-null `goodPeriod`. Each pane still passes good-day props with the same condition it has now (`habitTab === "weekly"` and the monthly / season twins). Daily passes `goodDays.streak` and `goodDays.last30Count`.

`goodDayAsOf`, `monthWindowAsOf`, and `weekWindowAsOf` are `useState` initializers from a wall-clock `new Date()`, not from `currentDate`. Keep that. They are not the Home plan cursor.

### `tracker/use-habit-period-lens.ts`

Move ~314–349 and the `weekDates` state. Preserve:

- First paint: `weekLens` / `monthLens` / `quarterLens` are `null`. `weekDates` starts at `getWeekDates(habitsViewedWeekStart(currentDate))`. `periodCursorReady` starts false. No `localStorage` read in `useState`.
- `useLayoutEffect` with `[]` calls `resolveHomeCursor(new Date())` (not `currentDate`) and `habitsLensFromStored` for week, month, and quarter, then sets `periodCursorReady`.
- The week effect always `retainHabitsWeekDates`. It `writeStoredDate`s only after the cursor is ready. Month and quarter effects write only after ready.
- `currentWeekStart`, `currentMonth`, and `currentQuarter` are the lens or the Home-day anchor.

### `tracker/use-habit-form-session.ts`

Move ~290–312 (dialog booleans and `editingTask` / `defaultFrequency` / `habitTab`) only if the dialogs and panes can take those setters as props without a second copy of state. `habitTab` is `usePersistedTab(APP_NAV_KEYS.homeHabitsTab, HABIT_FREQ_TABS, "daily")` and must stay the `Tabs` value.

`handleAddTask`: edit calls `updateTaskInStore`; create uses `` `task-${Date.now()}` `` and `task.frequency || defaultFrequency`. `setShowTaskForm(false)` runs before `syncTrackedHabitsForTask`. The `catch` still `console.error("Failed to sync tracked time onto habit", savedId, error)`.

`handleEditTask` and the `subscribeNavRestore` effect (~375–388) move with it. The effect’s dependency list stays `[]`. Return-from-Lists still uses `habitSettingsReturnReady`, `peekHabitSettingsReturn`, `clearHabitSettingsReturn`, `takeHabitDraft`, then the store row.

### `tracker/habit-desk-dialogs.tsx`

The five dialogs now held in `habitDialogs` (~1067–1130), rendered as `{habitDialogs}` after `</Tabs>` and still inside `.hab-frame`. Same components, same props. Daily `todayOverall` still calls `rawDayCompletionPercent(...)`; other tabs pass `0`. `todayPriority` is `todayPrioRaw`. `weekAverage` is passed only when `habitTab === "daily"`.

### `tracker/habit-desk-header.tsx`

`.hab-head` (~1135–1208): `h3.hab-head-title` text `Habits`; `.hab-head-center` with one `WeekNavigation`; `.hab-head-utils` Settings button (`habit-chrome-btn`, lucide `Settings` `h-3.5 w-3.5`, label `Settings`).

Navigation copy and ranges, by the same `habitTab` chain (quarter, then week, then month, else daily):

| Tab | Current key | Range | Prev / next aria | Current label | Lens update |
| --- | --- | --- | --- | --- | --- |
| Season | `currentQuarter` for both start and end | `quarterLabel(quarterKey(currentQuarter))` | Previous season / Next season | This season | `shiftQuarter(currentQuarter, ±1)`; current clears the lens |
| Weekly | first `weekPeriods` date, or `weekWindowAsOf` | `weekWindowRange` (first Monday through last Monday + 6 days; empty window is `weekWindowAsOf` plus 6) | Previous Week / Next Week | This week | `addCalendarDays(currentWeekStart, ±7)` |
| Monthly | `currentMonth` | one column `MMMM yyyy`; several columns `MMM yyyy – MMM yyyy` (en dash); no columns `MMMM yyyy` of `monthWindowAsOf` | Previous Month / Next Month | This month | `new Date(year, month ± 1, 1)` |
| Daily | `currentWeekStart` | no `rangeLabel` (the nameplate formats start through `weekEndDate`) | default Previous Week / Next Week | default Today | `addCalendarDays(currentWeekStart, ±7)` |

`weekEndDate` is `new Date(currentWeekStart)` then `setDate(+ 6)`. Keep that. Do not swap in `addCalendarDays` on the daily nameplate unless a test proves the string matches, including around a DST boundary.

`viewingCurrentPeriod`: season compares `quarterKey`; month compares `habitsCalendarKey(currentMonth)` to `habitsCalendarKey(habitsViewedMonth(currentDate))`; daily and weekly both use `isSameLocalWeek(currentWeekStart, currentDate)`. Weekly “this week” follows the lens, not the first column of the weeks window.

`isCurrentPeriod` is that flag. Clearing the lens (`null`) is how This week / This month / This season / Today returns to the Home day.

### `tracker/habit-period-keys.tsx`

`.habit-grades.hab-view-changer.b2-keycap-tab` > `TabsList` `aria-label="Habit period"` `className="hab-period-keys"`. Triggers: `Daily`, `Weekly`, `Monthly`, and `Season` (value `quarterly`). Counts append ` (${n})` only when `hydrated`. The season trigger and the season `TabsContent` both set `data-season={seasonSlug(seasonOfDate(currentQuarter))}`.

`TabsList` and `TabsContent` must stay descendants of the same `Tabs`. Extracted components rendered as children satisfy that. Do not set `forceMount`. Inactive panes stay unmounted, which is the Radix default this file relies on.

### `tracker/habit-desk-frame.tsx`

Optional shared skeleton, used only if the rendered elements match a pane’s tree with no extra node:

- `TabsContent.hab-pane` (season also `data-season`)
- `div.hab-desk`
- `div.hab-sheet` containing the wand mast, then `div.hab-well`
- `HabitsControlPanel` with `stones={willpowerStones}` (`[]` until hydrated)
- plan log as the next sibling of `.hab-desk`, still inside the tab pane

`willpowerStones` is `hydrated ? willpowerStoneRows : []`.

Shared meter props (label, value text, through line, bar value, hues, click handlers, wand setters, loading bar, small LEDs) can be one object spread into `HabitsTabControls`. Per-tab overrides stay explicit:

- `loadingBarId`: `loading-bar`, `loading-bar-weekly`, `loading-bar-monthly`, `loading-bar-season`
- `smallLedsId`: `small-leds`, `small-leds-weekly`, `small-leds-monthly`, `small-leds-season`
- `toggles={["loadingBar", "smallLeds"]}`
- Weekly `weekWindow`: `HabitWeekWindowControl`. Monthly `monthWindow`: `HabitMonthWindowControl` with birthday. Daily and season omit both.
- `onNewHabit`: daily calls `setDefaultFrequency(habitTab)`. Weekly, monthly, and season pass the literals `"weekly"`, `"monthly"`, `"quarterly"`. Keep that difference. Also `setEditingTask(null)` and `setShowTaskForm(true)`.
- `goodDays`: daily uses the daily summary click. The other panes pass `periodWells` only under their existing `habitTab === …` check.

### `tracker/daily-pane.tsx`

`TabsContent value="daily"`. Well, once hydrated:

- Heatmap when `habitViewMode === "heatmap"`, else `TaskGrid`.
- Heatmap props stay: `dailyRows`, `weeklyData`, `asOf={currentDate}`, `frequency="daily"`, `hideCompleted={hideCompletedToday}`, `periodPercentFor` from `dailyWeekPercent`, `focusKey={formatLocalDateKey(currentDate)}`, exemption and missed-op handlers. The missed write parses the key, trims `missReason`, and calls `updateCompletion` with `{ missedOpportunity, missReason }`. Empty trim stores `""`.
- `TaskGrid` keeps `groupByKind={groupHabitsByKind}`, `viewMode="day"`, `dayView={habitDayView}`, `selectedDate={currentDate}`, the exempt-all `null` percent closures, and `calculateDayPercentageAV`. Reorder only while `editingFrequency === "daily"`.
- Plan log when `hydrated && habitDayView`: period `day`, key `formatLocalDateKey(currentDate)`, legend `Day Plan — ${format(currentDate, "MMMM dd, yyyy")}`, placeholder `Write your day plan, goals, and objectives...`, `size="day"`.

`priorityProps` stay `highlightPriorities`, `ritualIds` (morning review ids), `ritualMultiplier`, `showStreakMarks`, spread onto the grid and the heatmap.

### `tracker/weekly-pane.tsx`, `monthly-pane.tsx`, `season-pane.tsx`

Each mounts `PeriodHabitList` after hydration. Sheet columns are `singlePeriodColumns` only while that view rocker is on. Percents and grades still use the full window (`weekPeriods`, `monthPeriods`, `seasonPeriods`).

| | Weekly | Monthly | Season |
| --- | --- | --- | --- |
| Rows | `weeklyRows` | `monthlyRows` | `quarterlyRows` |
| Columns on the sheet | `weekSheetPeriods` | `monthSheetPeriods` | `seasonSheetPeriods` |
| Data / update | `weeklyHabitData`, `updateWeeklyHabitCompletion` | `monthlyHabitData`, `updateMonthlyHabitCompletion` | `quarterlyHabitData`, `updateQuarterlyHabitCompletion` |
| Exemption frequency | `"weekly"` | `"monthly"` | `"quarterly"` |
| `completionLabel` | Weekly completion | Monthly completion | Season completion |
| `emptyLabel` | No weekly habits yet. Add one to get started. | No monthly habits yet. Add one to get started. | No season habits yet. Add one to get started. |
| `detailColumn` | `habitWeekView` | `habitMonthView` | `habitSeasonView` |
| Plan log | `hydrated && weekPlanColumn`, period `week`, legend `weekPlanLegend`, placeholder `Write your week plan, priorities, and focus areas...` | period `month`, legend `Month Plan — ${MMMM yyyy}`, placeholder `Write your month plan, goals, and objectives...` | period `quarter`, legend `Season plan — ${quarterLabel(key)}` (lowercase “plan”), placeholder `Write this season's plan — what the quarter is for...` |

Row percent returns `null` when every period in the full window is exempt, `0` when the task id is missing, otherwise the memoized map. Column percent returns `null` when every task is exempt on that key, `0` when the column is missing, otherwise `calculatePeriodColumnPercentage`. Copy each closure. Do not share one helper that drops a `null`.

### `tracker/habits-desktop-page.tsx`

`HabitsDesktopPage` composes the pieces. It still calls `useHabitTrackingSync()` first. Suggested hook order, top to bottom: tracking sync, desk store, period lens, form session, the four bundle memos, good-day memos, then derived grade values. That keeps hook order stable inside this component.

### `habit-tracker.tsx` after the move

File comment for the switch only (the long desktop comment moves with `HabitsDesktopPage`). Imports: React is unnecessary if the file only renders the two pages; `useHabitsPhone`, `HabitsPhonePage`, `HabitsDesktopPage`, and the three CSS imports:

- `./habit-grid.css`
- `./habit-chrome.css`
- `./noble-gas-tube.css`

Leave those imports in this file so the public module still evaluates them. `app/layout.tsx` already imports some of the same sheets; `noble-gas-tube.css` is pulled here today. Do not delete a side-effect import as “unused”.

## Extraction order

Each step is a move, then the existing Habits tests. Stop on the first failure. Do not restyle or “fix” a comment in the moved JSX.

1. `sheet-idle.ts` and `single-period.ts` (no DOM).
2. `habit-plan-log.tsx` and `weekPlanLegend`.
3. `habit-wand-mast.tsx` and `habit-sheet-loading.tsx`.
4. `view-toggles.ts` and `order-draft.ts` / `habit-sort-tools.tsx`.
5. The four `compute*Bundle` functions. Memos and dependency arrays stay in the page.
6. `active-grade.ts` and `good-period-model.ts`.
7. `use-habit-period-lens.ts`, then `use-habits-desk-store.ts`, then `use-habit-form-session.ts`.
8. `habit-desk-dialogs.tsx`, then `habit-desk-header.tsx`, then `habit-period-keys.tsx`.
9. `habit-desk-frame.tsx` only after a pane can be compared against the old tree. If the frame would add a node, skip it and keep the skeleton in each pane.
10. `daily-pane.tsx`, then weekly, monthly, and season.
11. `habits-desktop-page.tsx`, and shrink `habit-tracker.tsx` to the switch.

Aim for each new file under about 400 lines. The composer will still be the longest file. That is the wiring, not a second copy of the panes.

## Visual and behavior invariants

DOM and copy that tests and the Names overlay already lock:

- Root `div.hab-frame` with `data-ui-name="Habits"` and `data-ui-docs="components/Home/Habits/README.md"`.
- Heading `Habits`. Period tablist name `Habit period`. Tab names `Daily (n)` and the weekly / monthly twins; the fourth tab reads `Season`, value `quarterly`.
- Settings is a `habit-chrome-btn`. New habit, Week grade, Perfect output, Good days, Streak, Last 30, Willpower gems stay where `HabitsTabControls` and the control panel already render them.
- Sort control name `Sort`, visible text `SORT:`. There is no “Sort Habits” heading and no “Morning habit priorities” block.
- `HabitControlBar` keeps `aria-label="Control bar"`. Rockers for Highlight priorities, Streaks and multipliers, Heatmap View, Day View, Hide Done, and Mask done and missed are in the Views band, not in that bar. Week View is absent on Daily. Group by category stays on Daily.
- Wand mount test id `habit-wand-banner-mount`.
- Loading copy `Loading habits…` and `aria-busy="true"` until `usePersistHydrated`.
- Grade tubes stay at 0 / `—` until hydration. Tab counts appear only after hydration.
- Heatmap replaces only the daily well. Day / Week / Month / Season View still add the plan frame and the detail column without changing `habitWeekWindow` or `habitMonthWindow`. Span grades still use the full window.
- Phone gate stays `useHabitsPhone` (`max-width: 767px`), starting false so the server render matches. Desktop class names in `habit-chrome.css` are untouched, including the older `720px` rules.
- Store writes stay the same functions: completions, exemptions, wand flags, sort, reorder, tolerances, import, reset.
- Undo, points, and tracking sync stay inside the stores and `syncTrackedHabitsForTask`. This split does not retarget them.
- `priorityProps` and highlight / ritual / streak behavior stay on the grid components. This file only passes them.

Do not change class names, `data-*` attributes, aria labels, button types, or the lucide icon size classes. Do not memoize a child that was not memoized. Do not combine Zustand selectors into one object selector. Do not “correct” the daily New habit frequency to the literal `"daily"`.

## Test plan

Run, and leave the assertions alone:

- `components/Home/Habits/habit-tracker.test.tsx`
- `components/Home/Habits/habit-priority-sheet.test.tsx`
- `components/Home/Habits/phone/habits-phone.test.tsx`
- `components/Home/Habits/period/habits-period-cursor.test.ts`
- `components/Home/Habits/period/habits-period-cursor.hydrate.test.tsx`
- `components/Home/home-dashboard.test.tsx` (the mock path must still be `habit-tracker`)
- `components/UiNames/ui-names-stamps.test.ts` after the path edit below

One source-text edit is required. `ui-names-stamps.test.ts` reads `data-ui-name="Habits"` from `components/Home/Habits/habit-tracker.tsx`. Point that row at `components/Home/Habits/tracker/habits-desktop-page.tsx` (or whichever file still contains that attribute). The attribute strings stay the same. Do not add a duplicate stamp on the switch file just to keep the old path.

Do not add a new public export to satisfy a test. Do not snapshot the new modules. A pure helper does not need a new test file; the desktop tests already render through `WeeklyTaskTracker`.

Manual check, desktop width and a width under 767px, because this is a move of the live Home surface: open Home → Habits; confirm Daily grid, Weekly, Monthly, and Season; Settings; New habit opens the same dialog; Week grade and Perfect output open; Good days opens; Heatmap View and Day View; one solo view on Weekly or Monthly including its plan log; Exemption wand banner; phone width shows the phone page and not the desktop frame. No screenshot recapture. Pixels and sidecar prose stay as they are.

`scripts/screenshot-manifest.mjs` lists `habit-tracker.tsx` as a source for `01-home-daily-habits.png`, `01-home-habits-weekly.png`, and `01-home-habits-monthly.png`. Append the desktop page path to those `sources` arrays so the manifest names where the tree lives. Do not run `npm run capture-screenshots`.

## Doc updates

Do these in the same implementation step as the move. Retarget file paths. Do not rewrite product behavior, and do not revive the abandoned sheet-level rocker bar.

- `components/Home/Habits/README.md` — Public door stays: other rooms import `WeeklyTaskTracker` from `habit-tracker.tsx`. File table: `habit-tracker.tsx` is the switch; the desktop tree is `tracker/habits-desktop-page.tsx` and the pane files. Point `viewToggles` and the wand mount at `tracker/`. Heading **Tabs in `habit-tracker.tsx`** becomes **Tabs on the desktop page** and names the pane files. `_Last mapped: 2026-10-27_` on each section touched. Interior-files rule still holds: `tracker/` is inside this folder, and outside rooms do not import it.
- `components/Home/Habits/panel/habits-tab-controls.tsx` — the file comment that says writes stay at the habit-tracker call site. Point it at `tracker/`.
- `components/Home/Habits/phone/habits-phone.tsx` and `habits-phone-page.tsx` — comments that say the desktop tree lives in `habit-tracker.tsx`. One line each. No phone logic.
- `components/Home/README.md` — the Habits bullet can keep citing `WeeklyTaskTracker` in `habit-tracker.tsx`. Add that the desktop console is `Habits/tracker/habits-desktop-page.tsx`.
- `docs/tree.md` and `docs/tree.txt` — doc sync only (`.cursor/rules/doc-sync.mdc`), not this step. The desktop tree belongs in the Habits README.
- `docs/README.md` — add a row for `modular-splits/` (this plan and any sibling split plans). This plan file is the first entry.
- `docs/SPEC_MAPPING.md` — only if a row names `habit-tracker.tsx` as the whole desktop UI. Retarget the path. Skip if it does not.
- Leave historical mentions in `lib/habits-store.ts`, `lib/calculations.ts`, and `docs/BRAIN2_FEATURE_IDEAS.md`. They describe an older extraction or an idea, not the current file map.
- Skip `docs/screenshots/` PNGs and their `.txt` sidecars.

`components/README.md` does not name this file. Skip it. The room map does not list it either.

## Risks

- **Willpower stones on non-daily tabs.** The daily memo computes stones even when Daily is closed. A “skip work when the tab is closed” cleanup inside that early return drops the gems.
- **Idle singletons.** New `Map`s or arrays per call change identity and can rerun child work, or drop the stable morning-review fallback.
- **Lens hydrate.** Reading `localStorage` during `useState` mismatches SSR. Writing storage before `periodCursorReady` clobbers a stored lens with the Home day.
- **Wall-clock windows.** `weekWindowAsOf` and `monthWindowAsOf` are fixed at first mount. Wiring them to `currentDate` moves the weekly and monthly columns when the Home cursor moves. That is a behavior change.
- **Daily nameplate date math.** `setDate(+ 6)` on a copy of `currentWeekStart` is what the range uses. Replacing it changes DST weeks.
- **Weekly “This week”.** It uses `currentWeekStart`, while the nameplate range uses the weeks window. One shared nav config will mix those.
- **`null` percents.** Exempt-all cells render as `—` because the closures return `null`. Coercing to `0` changes the footer.
- **Daily New habit frequency.** It stores `habitTab`, not the literal `"daily"`.
- **Dialog placement.** Dialogs sit inside `.hab-frame` and outside `Tabs`. Moving them into a pane unmounts them on tab change (`forceMount` is off) and drops an open grade sheet.
- **CSS evaluation.** Moving the three CSS imports onto a dynamically imported module drops the skin on the phone path and on the first desktop paint. Keep them on `habit-tracker.tsx` and static-import the desktop page.
- **Selector merging.** One Zustand selector for the whole store rerenders on a different cadence and is easy to get wrong. Keep one hook call per field.
- **Phone duplication.** Importing `view-toggles.ts` from `habits-phone-page.tsx` in this pass couples two pages. Leave the phone copy.
- **`daily-task-form.tsx`.** The desktop page never imports it. The form arrives through `TaskFormDialog` in `daily-task-form-dialog.tsx`. Do not open the form file.
- **`components/Modules`.** Do not touch it, even if a module card mentions Habits.
- **Dirty tree.** Do not `git checkout` or restage session, tracking, or pause-reason files. When a commit is requested later, stage only `habit-tracker.tsx`, `components/Home/Habits/tracker/**`, the stamp test, the screenshot manifest source lists, and the docs above.
- **README drift.** The long file-table paragraph still describes rockers on the sheet. The code and the 2026-10-20 note at the bottom of the Habits README put those rockers in the panel. Follow the code. Fixing that prose is in scope only where it names the wrong file. It is not a license to change the UI.

## Out of scope

- Any visual, copy, or interaction change.
- Sharing code with `habits-phone-page.tsx`.
- `daily-task-form.tsx` and `components/Modules/`.
- New features, persist version bumps, and grade-formula edits.
- Screenshot recapture.
- Re-exporting desktop pieces from `habit-tracker.tsx`.
