# Today's Progress

Widget id: `home-widget-progress`

Catalog id is `progress` (`lib/home-widgets.ts`). The strip tile is `data-widget="progress"` / `.home-tile.is-progress`. The square is visible: `brain2-home-widgets` v9 keeps `progress` out of `hidden`.

## Data source + snapshot

Live vault, Electron localStorage, origin `http://localhost:3000`, LevelDB under `~/Library/Application Support/cogs/Local Storage/leveldb`. Read about 11:12pm Pacific on Friday 9 October 2026. No `brain2-data-profile` key, so the profile is Live. Demo keys were skipped.

| Key | What it supplied |
| --- | --- |
| `brain2-task-storage` | 3,269 tasks. The `cogs-task-storage` twin is a 782-byte example stub and was not used. |
| `brain2-habits-store` | 52 habits (28 daily, 17 weekly, 5 monthly, 2 quarterly), `contentRev` 1791610949467. |
| `brain2-home-widgets` | `widgetsFollowClock: true`. |
| `brain2-home-date` | `2026-09-24`, with `brain2-home-date-follows-today` = `0`. Current home tab: `habits`. |

Widget day is the wall clock, because Follow the clock is on (`homeWidgetDate` in `lib/home-widgets.ts`). That day is **2026-10-09**. Counts below use the same rules as `useHomeDayStats` in `components/Home/home-day-stats.ts`: to-dos not hidden from To Do and scheduled on that day; daily habits only; exemptions dropped (none today); climb habits through `isHabitGoalMet`.

The hub file `data/shared-persist.json` (`updatedAt` 2026-10-10T06:07:48.085Z, `source` electron) disagrees: 3,262 tasks, `widgetsFollowClock` false, home date 2026-09-23. A present localStorage key wins over the hub, so the snapshot is the LevelDB copy.

**Widget day, Friday 9 October 2026**

- To-do: **11 done / 12 total** (92%), **1 open**. All 11 completions are dated 2026-10-09. None are deadline-only. The open title is `process inbox information`.
- Habits: **7 done / 28 daily** (25%), **21 left**. Zero exemptions. Eight cells exist for the day; seven are met and one is an explicit miss.
- Done: Practice an instrument/music, Work for 5 hours (logged 8.6), dance, Go outside, brush teeth, skincare, log 70% of day (logged 76.1).
- The miss is `wake up before 9` (`completed: false`, `missedOpportunity: true`). The other 20 have no cell today. Every one of those 21 has logs on earlier days. 17 of them were last logged yesterday (2026-10-08).

The CRT therefore reads **1 left · 92%** and **21 left · 25%**. The footer reads **To do 11/12 · habits 7/28**.

The habits sheet is not on this day. The Home cursor is pinned to 2026-09-24. That day is also 7/28 habits and is 9/9 to-dos, with a different seven habits done. The square does not name 9 October.

## a. Biggest problems right now

1. **21 left is three different states.** At 11pm the habit bar is still a quarter full. One of the 21 is a marked miss (`wake up before 9`). Twenty have no cell. Seventeen of those were logged yesterday, so the list is a real daily set that did not carry over, not abandoned seed rows. The square and the closed fold both treat a miss, a blank, and a climb with no score as the same kind of leftover.

2. **The two meters disagree about to-dos.** To-dos are 11/12, with one item left. The daily habit `complete 1 to-do list item` listens to a list link named `to do` with count 1 (`completionSources`: manual, list). It has no cell today; its last log is 2026-10-05. It sits in the 21. Finishing eleven to-dos does not move that habit, and the widget cannot say why.

3. **The day on the square is unlabeled, and the sheet is another day.** Follow the clock is on, so the meters are 9 October. The habits tab — the tab this vault is on — is pinned to 24 September and will not catch up (`home-date-follows-today` is 0). Both days score 7/28, so a glance at the percent looks stable while the finished set has changed. The title is always "Today's Progress". It never prints the date.

4. **The one open to-do has nowhere to go.** Detail is a pair of closed folds. `process inbox information` is a title in a list. There is no complete, no open, and no jump to To Do. The seven habits already done are absent from the detail; only the fraction 7/28 records them. Work at 8.6 hours and the day log at 76.1% are stored on the cells and never shown.

## b. Layout, UI, design, and style

Shared chrome is the silver handheld in `home-widget-dialog.tsx`: power lamp, caption, one scroll, × to close, settings omitted because this widget has none. That shell is the right instrument. The trouble is what the CRT and the scroll put inside it.

`docs/DESIGN_STYLE.md` asks for one job per region, a readable hint, and a 9px size only as a short engraved nameplate. Pixel type and a small lamp are the direction. A 7px gradient and a 9px sentence are doing the job of the readout.

### Overview

`DailyProgressQuickview` with `instrument` (`home-overview.tsx`) puts two meters in the CRT and one footer line under the caption. The tile is 156px tall and 132–200px wide. Each meter is a name, a 9px stat (`N left · P%`), and a 7px bar in the habits gradient (percent LED, grade tube, output tube). The footer is 10px, clamped to two lines: `To do 11/12 · habits 7/28`.

On a 132px tile that footer wraps, so the habit fraction — the number that is actually in trouble tonight — drops to a second silver line. The CRT leads with "21 left · 25%" at 9px. That string is a sentence, and 9px is the nameplate size. The bars do separate 92% from 25%, and they share one gradient, so color does not say which meter is which. The labels do.

The non-instrument branch of `daily-progress-quickview.tsx` is a shadcn card with Lucide icons and blue/emerald bars. The strip never renders it. The live face is the CRT.

### Detail view

`ProgressDetail` in `home-overview.tsx` is a 2×2 of wells plus two `<details>` folds (`>` shut, `^` open). Wells: `To do:` 11/12 with a 6px meter, nixie `1`, `Habits` 7/28 with a meter, nixie `21`. The fold counts repeat those nixie numbers. The colon on `To do:` is the only label that has one.

Folds start shut. Opening habits dumps 21 names at 12px, in one flat list, with no miss mark, no goal, no last-logged day, and no done column. `wake up before 9` looks like `Drink water`. Chess (`Chess score + 10`) last logged a score of 355 on 2026-09-21, so today's derived target is 365, and the row is only the name.

The dialog is `min(34rem, viewport)` with an 18px corner radius from the shared widget chrome. The wells inside use a 6px radius. The bars on the square are square (`--r-0`). The fold marks are ASCII, not the pixel lamp the rest of the house uses for on/off.

## c. New features for the detail view

1. **Three habit piles for this night: 7 done, 1 miss, 20 blank.** Open on the miss. `wake up before 9` already stores `missedOpportunity`. Show that lamp on the row. Keep the 20 blanks behind their own fold so 21 is not one undifferentiated list. Show the seven finished names, with the stored proof on the two numeric ones (work 8.6, day log 76.1).

2. **Hand off the one open to-do.** `process inbox information` should be a key: complete it, or open it on To Do. A single leftover does not need a disclosure triangle.

3. **Say why `complete 1 to-do list item` is still open.** The row should show the list link (list name `to do`, count 1) and that today's cell was never written, next to the to-do fraction 11/12. The contradiction is the useful line.

4. **Print the widget day in the caption.** `Fri 9 Oct` next to the title, because Follow the clock is on and the habits sheet is 24 September. Same cursor or two labeled jobs. The title alone says "today" while the tab is fifteen days earlier.

5. **Climb rows show the target.** Chess has no score today and a derived target of 365 from the last logged 355. A blank boolean and a climb waiting on a number should not share a row style.
