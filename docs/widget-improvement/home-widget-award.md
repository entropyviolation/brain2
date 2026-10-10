# Latest award

Widget id: `home-widget-award`

Data source + snapshot. The square reads the unprefixed Zustand ledger `points-store` (`lib/points-store.ts` via `createCogsJSONStorage`). Layout is `brain2-home-widgets` persist v9. Profile key `brain2-data-profile` is absent, so this is the live vault, not demo.

**Source that wins:** Electron localStorage for `http://localhost:3000`, LevelDB under `~/Library/Application Support/cogs/Local Storage/leveldb`. Read at 2026-10-10T06:11:03Z.

The hub file `data/shared-persist.json` (same timestamp, `source: electron`) holds the same 823 ledger rows and zero rows the desktop lacks. Array order is not the same. `latestPointAward` breaks a same-day tie by later position in the array, and rows have no clock time — only `date`, `taskId`, `points`, `taskDescription`. On that rule the hub’s newest positive row is **+50**, “Higher habit grades than last week” (2026-10-09). The desktop’s is the inbox line below. The running app shows the desktop.

**Face on the desktop:** **+1**, reason **Inbox handled: make it real with berggruen** (42 characters). Local date **2026-10-09**. It is row 823 of 823 (index 822), the last write on the newest day. Ledger span is 2026-06-08 through 2026-10-09, 823 rows, none zero or negative.

That day has 68 positive rows, sum **+464**:

| Kind | Rows | Sum |
| --- | ---: | ---: |
| Habit-day completions | 7 | +350 |
| Weekly grade lift | 1 | +50 |
| Beat the prior 30-day completion | 1 | +5 |
| Inbox handled | 58 | +58 |
| One other completion | 1 | +1 |

The seven habit lines are brush teeth, skincare, dance, Practice an instrument/music, Go outside, log 70% of day, and Work for 5 hours, each +50. The grade lift and the +5 monthly beat sit earlier in the array than the inbox run. After the grade-lift row, the rest of 2026-10-09 is +1 inbox handles. The day before (2026-10-08, 11 rows, +435) is eight habit completions, a +25 “higher than yesterday” lift, and the +5 week and +5 month average beats — no inbox.

`recentPointAwards(..., 8)` is what the dialog lists. All eight are 2026-10-09 inbox handles at +1. Reason lengths in that window: 42, 93, 95, 27, 29, 40, 24, 25. Elsewhere on the same day, 17 reasons are longer than 80 characters, and the longest stored line is 1,520 characters. None of the +50 rows fit in the eight.

Strip layout from the same LevelDB blob: award is showing, third in order (Rituals, Points, Latest award, then Today’s Progress). Follow the clock is on. The award tile does not use that switch; it always reads the whole ledger. Visible siblings: Rituals, Points, Latest award, Today’s Progress, Weather, Screen pet, Day lamp, Moon, Solar remainder, Tracking now.

## a. Biggest problems right now

The square is supposed to be the last thing that paid. Tonight it is a one-point inbox handle, while the same calendar day already paid +50 seven times and +50 again for beating last week’s habit grades. `latestPointAward` keeps walking, and any later positive row on the newest date replaces the face, including `addPoints` of +1 from `inboxHandleLabel`. The catalog blurb only promises a completion, a high-percent bonus, or a grade that beat yesterday or last week. The live face is none of those.

The dialog makes that worse. Eight rows, newest write first, so the handheld is eight inbox sentences and a footnote about Habits → Settings bonuses. The grade lift, the +5 monthly beat, and the seven completions are on this day and still off the list. Yesterday’s +25 lift is off the list too.

“Newest” is not a time. Two copies of the same 823 rows already disagree: desktop +1 inbox, hub +50 grade lift. A phone hydrated from the hub would congratulate a different award than the Electron window, with no timestamp to decide which write happened later.

The footer is the raw reason. For this row that is the whole inbox title, prefix included. The tile foot clamps to two lines at 10px inside a 132–200px square, so a 42-character sentence is already at the edge of the clamp, and the 93- and 95-character neighbors in the dialog would lose the tail immediately. One same-day reason is 1,520 characters. Nothing in the row truncates before paint; only the square’s two-line clamp and a `title` tooltip hold it. The amount has no date on the square, and the dialog prints `Oct 9` with no year and no time, so the list cannot show that the +1 landed after the +50.

## b. Layout, UI, design, and style

### Overview

The tile is the shared home square: nameplate, CRT, silver footer, equal height `--home-tile-h` (156px), width flexing 132–200px (`home-overview.tsx`, `home-chrome.css`). That matches the milled fascia in `docs/DESIGN_STYLE.md`: nameplate, black-glass CRT in `--hab-crt-green` (`#7dffc4`), footer as a two-line silver label. Hide × sits outside the open target and asks before removing the square. Click opens the handheld.

What this face does with that frame:

- The nameplate says **Latest**, 9px, tracked uppercase. The catalog preview caption is **Award**, and the dialog title is **Latest award**. Three names for one instrument.
- The CRT is `+1` at 22px (`.home-award-readout`), centered. The largest type is the value, which is right, and the value is the least meaningful number on the strip. Points sits beside it with the real totals. A two-glyph readout in a 156px well looks empty, and it does not flash when a new row lands (the today points line can).
- The power lamp for this tile is `--home-caption-pip: #25366a`, the same navy as the Perfect-output gradient stop. On the silver nameplate that lamp reads unlit. Sibling tiles use a bright pip (points violet, progress green, pet phosphor). The style guide’s lamp is a radial phosphor in a gunmetal ring, leading the nameplate, not a dark stop from the meter gradient.
- The footer’s job is the reason, at the smallest size, two-line clamp. For this award the reason is the sentence the person needs, and the clamp is the first thing that fails. There is no kind mark (inbox vs habit vs grade), so +1 and a long title have to carry the whole story.

### Detail view

`HomeWidgetDialog` is the silver handheld (power pip, caption, one scroll, ×). Points uses it properly: navy nixie wells, meters, sparklines. Latest award does not. It maps eight `<p class="home-widget-row">` lines — date · reason on the left, `+n` in nixie on the right — then a gray 11px note that bonuses are edited in Habits → Settings.

Against this snapshot that body is the wrong instrument:

- No lead well for the award the square just showed. The +1 is only the first of eight identical-looking rows.
- Rows are `align-items: center` with no line clamp. A long inbox body becomes a tall paragraph with the amount floating at its vertical center. The 1,520-character line is not in today’s eight, but the list rule would drop it in as soon as it is among the newest writes.
- Every visible row is the same kind and the same amount. Nothing groups habit completions, the grade lift, and inbox handles, so the eye cannot find the +50s that are already in the ledger.
- The settings note describes high completion and grade beats. None of the eight rows are those beats. The note is a dead caption, not a control, and it is the only copy in the dialog that mentions the awards the catalog promised.
- Rows are not keys. A habit completion cannot open the habit. An inbox line cannot open the idea. There is no empty-state path here (the ledger is full); the “No points yet” lead is unused.
- Date labels share no column width with the reason, and the amount is the only tabular figure. Sibling labels in one group should share a size and a baseline; these rows let the reason set the height.

## c. New features for the detail view

1. **Open on this award, then the day.** First paint is three wells in the existing handheld: amount **+1** (nixie), when **Oct 9** (and a real write time once the row has one), kind **Inbox handled**. The reason sits under them as one clamped lead, not the raw 42-character title competing with seven more titles. Under that, a same-day rollup for 2026-10-09: 7 habit completions +350, weekly grade lift +50, 30-day beat +5, 58 inbox handles +58, day sum +464. The eight-row window can stay, but it cannot be the only view, or the +50s remain invisible.

2. **Give “latest” a time, and stop letting +1 define the award.** Persist a write instant (or a monotonic sequence) on the ledger row so desktop and hub pick the same face. Until that exists, do not treat array order as time. In the detail, split the day into completions, grade and average bonuses, and inbox handles, and let the latest *of each* show. The inbox +1 can stay listed; it should not be the only story when a +50 grade lift is already on that date.

3. **Make a row a key with a short reason.** Clamp the reason to two lines in the well, keep the full text on the tooltip, and never lay out a 1,520-character inbox body as the row. The amount stays nixie and right-aligned. A habit row opens that habit; an inbox row opens the handled item. Show the Habits → Settings sentence only beside a bonus row, with that bonus’s amount, not as a footer under a list of inbox handles.
