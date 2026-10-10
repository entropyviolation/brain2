# Already flowing

Widget id: `home-widget-flow` (strip id `flow`, `data-widget="flow"`).

The square is one word for finished work. Daily habits that met their goal count as already in motion. A to-do with `completedDate` on the day counts as already in motion when `createdAt` is an earlier day, and as new when it was created the same day. `alreadyFlowingFace` then picks the glass: nothing finished is **Quiet**; only one side is **Flowing** or **Pushed**; if both sides are present, the larger side must be at least twice the other, otherwise **Mixed**.

## Data source + snapshot

**Source:** Electron LevelDB localStorage for `http://localhost:3000`, copied from `~/Library/Application Support/cogs/Local Storage/leveldb` at 2026-10-10T06:13:50Z (11:13 PM Pacific). Profile key `brain2-data-profile` is absent, so this is the live vault. Last persist stamp on that origin: `brain2-last-persist-ok` = 2026-10-10T06:11:28Z.

Keys read: `brain2-habits-store` (persist v26), `brain2-task-storage` (persist v17), `brain2-home-widgets` (persist v9). The word uses `flowingCounts` / `alreadyFlowingFace` (`lib/home-glances.ts`) and the same daily-habit met test as the tile (`isHabitGoalMet` on non-exempt daily habits for the local day). Time zone of the snapshot: America/Los_Angeles. Wall-clock day: **2026-10-09**.

`brain2-home-widgets` has `widgetsFollowClock: true` and `flow` in `hidden`. The Home cursor is pinned to **2026-09-24** (`brain2-home-date`, follows-today `0`). Follow the clock sends the overview squares to the wall clock, so an unhidden tile would describe **9 Oct**, not 24 Sep. Nothing on the square names that day.

Hub `data/shared-persist.json` is older and was not used. It still has follow-the-clock off, 6 daily habits met, and would say **Pushed** (`6 already · 12 new`). Live has 7 habits met, 3,267 item rows versus the hub’s 3,263, and a different word.

**Word the tile would show for 9 Oct: Mixed.** Footer: `7 already · 11 new`. Dialog line: “Some of what finished was already in motion, and some of it was new today.”

That word does **not** match the day. The seven “already” are seven daily habits. No older to-do was closed. No hand-made to-do was created and finished. All eleven “new” rows are generated Done logs stamped created and completed today.

| Bucket | Count | What it is |
| --- | --- | --- |
| Daily habits required | 28 | None exempt |
| Habits met (the whole “already” side) | 7 | See list below |
| Habits short of the goal | 21 | Includes “complete 1 to-do list item” |
| Older to-dos finished today | 0 | `createdAt` before 9 Oct and `completedDate` today |
| Habit Done mirrors in “new” | 6 | ids `habit-done-…`, tag `habit` |
| Tracking actions in “new” | 5 | ids `pen-action-…`, tag `tracking`, title “worked on computer” |

Habits met:

- Practice an instrument/music — yes/no, ticked by hand
- dance — yes/no, ticked by hand
- Go outside — yes/no, ticked by hand
- brush teeth — yes/no, ticked by hand
- skincare — yes/no, ticked by hand
- Work for 5 hours — goal 5, logged 8.6, sources manual then tracking tags
- log 70% of day — goal 70, coverage 76.1; this is the one met habit with no Done mirror

The six mirrors repeat the first six names and are counted again as new, because `syncHabitDoneLog` sets both `createdAt` and `completedDate` to the finish instant. The five computer rows are 165, 40, 67, 189, and 55 minutes (516 minutes, 8.6 hours) — the same stretch already stored on “Work for 5 hours.” Dropping only the habit mirrors still leaves Mixed (`7 already · 5 new`). Dropping every generated log leaves **Flowing** (`7 already · 0 new`), which is the day: finished work was the practice already on the books.

## a. Biggest problems right now

1. **Generated same-day Done rows are “new.”** `AlreadyFlowingTile` passes the entire task array into `flowingCounts`. A row counts as new whenever `completed` is set and `createdAt` and `completedDate` share the local day. Habit mirrors and tracking pen-actions are created that way on purpose. On 9 Oct they turn seven habits into Mixed and a footer of 11 new. Six habit names sit on both sides. The computer blocks are a third copy of the work habit. The unmet habit “complete 1 to-do list item” agrees there was no to-do to finish. The dialog’s Mixed sentence describes the algorithm, not the day.

2. **The wells are not a partition, and the 2× rule is invisible.** Already is 7, Habits finished is 7, New today is 11. Habits are inside Already and, via mirrors, inside New. Equal weight would still be Mixed; one side has to be at least double the other to earn Flowing or Pushed. 7 versus 11 fails both tests. Nothing on the glass says that.

3. **The square is hidden, and it does not say which day it means.** `flow` is still in `hidden` (v9 tucked it, and this vault never showed it). Follow the clock is on, so the word is 9 Oct while Habits, Plan, and To Do stay on 24 Sep. Unhiding it would put Mixed on a strip that is not labeled as the wall clock.

## b. Layout, UI, design, and style

### Overview

The tile is the shared overview instrument: metal face, teal caption pip (`is-flow`, `#5ee0c5`), CRT glass, two-line footer, equal height `--home-tile-h` (156px) and width 132–200px. That matches the strip. The miss is what the glass says.

The nameplate is always **FLOWING** (9px, tracked, uppercase — a legal nameplate). The CRT is the verdict, in `--hab-crt-green` at 20px, with no `data-lamp`. Quiet, Flowing, Mixed, and Pushed are the same phosphor. Day lamp already tints its word; this square does not, so Mixed does not look like a split.

On this vault the footer would be `7 already · 11 new`. It fits the 10px, two-line foot. It is also the false split: the 11 are not new to-dos. The caption and the CRT fight (FLOWING over Mixed). Hide stays off the open target and asks before it removes the square. That chrome is fine. The square is currently not in the row at all.

### Detail view

The dialog is the shared silver handheld: power lamp, uppercase title, CRT lead repeating the word, then wells, then two notes. Width up to 34rem. This widget has no settings, so the body is only the lead, the wells, and the copy. That is the right amount of chrome. The content is the wrong instrument.

`WidgetWells` is a two-column grid. Three wells wrap as Already | New today, then Habits finished alone. That is an orphan wrap: a peer left on its own row. Today the orphan repeats Already exactly (both 7), so the second row adds no fact.

New today is nixie blue; the other two are phosphor green. The color split is the right idea and then gets undone, because the blue number includes six of the green habits plus the five tracking blocks that already fed “Work for 5 hours.”

The notes are 11px and readable. The first is the Mixed sentence. The second restates the rule and never names a row, so the 11 cannot be checked. Two paragraphs do one job. There is no ledger, no created date, no “generated” mark, and no statement of the twice-the-other test.

## c. New features for the detail view

1. **A ledger that is the word.** Two lists, Already and New, one row per thing that actually counted: habit name, or to-do title plus the day it was created. Compute those lists before habit-done mirrors and pen-actions. On 9 Oct, Already would be the seven habit names and New would be empty, and the lead would be **Flowing**. Put generated rows in a third list, “Logged,” that does not move the word: six habit mirrors and five “worked on computer” blocks with their minutes. The person can see that 516 minutes is the work habit, not five new to-dos.

2. **Wells that partition.** Replace the three overlapping numbers with Habits, Older to-dos, and New to-dos, same height, one row (or a single column if the handheld is narrow — not two plus a leftover). Habits finished stops repeating Already. A thin ratio under the lead shows 7 against 0, and a short line states the rule: one side must be at least twice the other, or the word stays Mixed.

3. **A color for the word, and the day it belongs to.** Use the day-lamp tints already on `.home-daylamp-word`: Quiet dim, Flowing green, Mixed warm, Pushed the hot output hue. When Follow the clock is on and the Home cursor is another day, the caption reads the wall-clock date (9 Oct) so the word is not taken for 24 Sep.
