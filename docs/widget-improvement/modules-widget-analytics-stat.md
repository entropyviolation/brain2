# Analytics Stat

Widget id: `modules-widget-analytics-stat`

Module type `analytics-stat`. One dashboard card: a title, a number, and a caption. The body is `AnalyticsStat` in `components/Modules/module-bodies.tsx`. The Modules grid renders it through `ModuleCard` (`components/Modules/modules-panel.tsx`). The stat menu is `STAT_OPTIONS` in `components/Modules/module-helpers.ts`, edited in `ModuleConfigDialog.tsx`. A workspace view of kind `stat` mounts the same component (`components/Modules/workspace/module-view-bodies.tsx`). None of those views are saved.

## Data source + snapshot

Live vault, read from Electron Local Storage LevelDB at `~/Library/Application Support/cogs/Local Storage/leveldb`, origin `http://localhost:3000`. Clock on the snapshot: Friday 9 Oct 2026, 11:12pm Pacific Daylight Time. No `brain2-data-profile` key, so this is the Live profile. Demo keys were not used.

The card’s config is `brain2-modules-store`. The number is `points-store` (unprefixed). Habits would come from `brain2-habits-store` (`weeklyData`). Task counts would come from `brain2-task-storage`. Hub file `data/shared-persist.json` (source `electron`, `updatedAt` 2026-10-10T06:11:35Z) has the same analytics-stat instance and the same week sum. The points-store strings are the same length and not byte-identical, so the figures below are the LevelDB copy.

One saved instance. It is a valid config.

| | |
|---|---|
| id | `mod-points` (the seeded default) |
| title | Points this week |
| `config.stat` | `points-week` |
| What the card paints | **3472.45** and the caption “points this week” |

Week window is Monday–Sunday (`date-fns` `weekStartsOn: 1`): Mon 5 Oct 2026 00:00 through Sun 11 Oct 2026 23:59, Pacific. 147 ledger rows, 145 distinct task-and-day pairs. Two pairs on 5 Oct are stored twice; summing every row, which is what `getWeekPoints` does, adds 2 points (3,470.45 if the last row wins).

| Day | Points | Rows |
|---|---:|---:|
| Mon 5 Oct | 1,079.75 | 34 |
| Tue 6 Oct | 1,095.7 | 25 |
| Wed 7 Oct | 398 | 9 |
| Thu 8 Oct | 435 | 11 |
| Fri 9 Oct | 464 | 68 |
| Sat 10 Oct | — | 0 |
| Sun 11 Oct | — | 0 |

Monday and Tuesday are 2,175.45 of the 3,472.45. Friday has the most rows and a middling sum. The whole ledger is 823 rows across 69 dates, 8 Jun 2026 through 9 Oct 2026. All-time sum’s raw string is `15137.499999999998`. Last week (28 Sep–4 Oct) is 1,295 from 37 rows. October so far is 4,359.15 from 170 rows (`getMonthPoints` exists; the stat menu does not offer it).

Other menu values against this same snapshot, if the card were switched tonight:

| Stat | Value the component would paint | Why |
|---|---|---|
| Points today | 464 | 68 rows on local 9 Oct |
| Total points | 15137.499999999998 | raw `String(sum)`, no rounding |
| Habits logged today | 0 | key is UTC `2026-10-10`, and that day is empty |
| Open tasks | 2,817 | every record with `completed === false` |
| Completed tasks | 450 | every record with `completed === true` |

Local habit day 9 Oct has 8 cells. Seven are `completed` and would count. One is a missed opportunity (`completed: false`) and would stay out. 52 habits exist in the habits store; the stat does not say 7 of 52.

Open records by type: task 2,081, item 676, note 31, operation 17, flight 5, untyped 7. Among the open set, 5 are `status: "missed"`, 135 are `active`, 1 is `deferred`, and 2,676 have no status. Completed records: action 288, task 107, item 53, untyped 2.

Sibling dashboard cards in the same grid: `mod-random` (“What should I do now?”) and `mod-1781860762205` (“reading list”). Eleven workspaces sit above that grid. No workspace view has `kind: "stat"`.

## a. Biggest problems right now

The saved card is a single sum. The week that produced 3,472.45 is five unequal days, two still ahead, and 147 rows, and none of that is on the card. The number cannot be opened. Home already shows this same week, formatted `3,472.45`, inside the points instrument (`components/Home/points-stats.tsx`). This card repeats the total and drops the grouping, the range, and the prior week (1,295).

Two menu options are wrong against tonight’s vault even though this card is not set to them. “Habits logged today” uses `formatDateKey`, which is `toISOString().slice(0, 10)`. At 11:12pm Pacific that key is 10 Oct, so the card would read 0 while seven habits are logged on local 9 Oct. “Open tasks” and “Completed tasks” count the entire item vault: 2,817 and 450, including notes, flights, operations, list items, and 288 completed actions. The caption still says “open tasks” and “completed tasks”.

`getWeekPoints` adds every ledger row. Twenty task-and-day pairs in the full ledger are stored more than once (twelve with equal points, eight with different points). This week that is 2 extra points, both on 5 Oct. An unknown `stat` string falls through to “points this week” with no mark; this saved config is `points-week`, so it is not in that hole. “Total points” would paint the binary float `15137.499999999998` because the component renders `{value}` with no rounding. This card’s own string is the clean `3472.45`.

## b. Layout, UI, and style

### Overview

The card is a raised gadget in `.mod95` (`components/Modules/modules-chrome.css`): min-height 156px, three-column grid from 1024px, one column on a phone. The title bar is 12px bold, a `BarChart3` line icon, the title, a settings key, and a remove key (18×16). The body is a sunken scope (`#0b1a12`) with the number in phosphor `#3dff8a`, `text-4xl`, tabular numerals, a soft green glow, and the caption in `#8fd9a8`.

That well is the right material. Design style asks for a CRT value in black glass, phosphor for the figure, and the largest type on the thing the region is for. The number is that figure. What the well does not hold is the week. Monday through Sunday are one instrument; the card keeps only the sum and centers it in the empty glass. The title and the caption are the same sentence (“Points this week” / “points this week”), so the small type does not carry the basis (147 rows, Mon 5–Fri 9, two days left). Home’s points tile uses the same ledger and prints `3,472.45`. This card prints `3472.45`.

The three dashboard cards share one grid and one height. A random task and a reading list are different jobs from a week total. Stretching the stat well to match a taller neighbor adds empty phosphor around the same centered number. Settings is the only control on the number, and it opens the module form (type, title, six stats), not the ledger.

### Detail view

There is no detail view. The number is not a control. Removing the card and opening settings are the only actions. A workspace `stat` tab would be the same centered number in the workspace client, and this vault has no such tab.

The configure dialog is a short form: type, title, and the six stats. It can turn this card into another widget type. It does not show the 3,472.45, the seven days, or the rows behind them.

## c. New features for the detail view

Open the phosphor number into the week that is already in `points-store`. Seven day figures, in order, with the sums above: Mon 1,079.75, Tue 1,095.7, Wed 398, Thu 435, Fri 464, Sat and Sun empty because those dates have no rows yet. A lamp per day (lit when that date has rows) keeps the DSi mark on the same glass as the total. The basis line under the total is the small type: 147 rows, Monday 5 Oct through Friday 9 Oct, two days still ahead, last week 1,295.

A day opens its own rows, grouped by task. Friday is 68 rows for 464 points; the week’s common point sizes are 1 (66 rows) and 50 (54 rows), plus a few fractional rows (seven this week, including 1.25 and 3.7). A flat list of 68 lines is the wrong shape. Show the task once, with its points. Mark the two doubled task-days on 5 Oct and the 2 points they add, and let the detail use one row per task per day.

Keep the scope well. Put the day row inside it, under the total, so the card and the detail are one instrument. Format with the same grouping Home already uses (`3,472.45`). Round an all-time total so it cannot paint `15137.499999999998`.

If the stat is habits, key the day with the local date. Tonight that detail is seven completed cells and one missed-opportunity cell on 9 Oct, out of 52 habits — the UTC key’s 0 is the bug, not the reading. If the stat is tasks, split the count by type before showing a single number: the open 2,817 is 2,081 tasks plus items, notes, operations, flights, and untyped records; the completed 450 includes 288 actions.

Leave “possible points” off this detail. The week projection from open scheduled tasks is 3, from 3 tasks. Next to 3,472.45 it is noise. October’s 4,359.15 is already on the ledger via `getMonthPoints` and is a real missing menu entry; the week detail is the one this saved card needs first.
