# Day lamp

Widget id: `home-widget-daylamp`

**Source.** Live Electron localStorage, origin `http://localhost:3000`, LevelDB under `~/Library/Application Support/cogs/Local Storage/leveldb`. Profile key `brain2-data-profile` is absent, so this is the Live vault. Snapshot copied about 11:08pm Pacific on Friday 9 October 2026. Keys used: `brain2-habits-store` (persist v26, 52 habits), `brain2-task-storage` (persist v17, 3267 items), `brain2-home-widgets` (persist v9). Rates below are `dayLampWord` and `useHomeDayStats` applied to that snapshot: daily habits that are not exempt, goal met via `isHabitGoalMet`, to-dos that are not hidden and are scheduled or due that day, percents rounded, then the unweighted mean of whichever bars exist.

The hub file `data/shared-persist.json` (`updatedAt` 2026-10-10T06:07:48.085Z, `source` electron) is behind this snapshot. It still has Follow the clock off, Day lamp hidden, and `brain2-home-date` of 2026-09-23. Live wins: Follow the clock is on, Day lamp is showing, and the Home cursor is pinned to 2026-09-24.

**What the lamp shows for today.** Friday 9 October 2026. Habits 7/28 (25%). To-dos 11/12 (92%). Mean of the two percents: 58.5. Word: **Warm** (20 up to 60; Bright starts at 60). Footer copy would be `habits 7/28 · to do 11/12`. None of the 28 dailies are exempt. All 28 carry a completion-source list; 8 have a cell today and 7 of those are met, so the 25% is the same trust result the tile uses. The five unmet goal habits are at zero logged value (no partial credit). Unmet by type: 11 boolean, 5 goal, 3 incremental, 2 text. All 12 to-dos are scheduled on this date (none are deadline-only), and none were completed on another day. Item share, counting each habit and to-do once: 18/40 = 45%.

Checking the last open to-do would make the mean (25 + 100) / 2 = 62.5, which is **Bright**, with the habit sheet still 7/28. One more met habit at the current to-do percent is 8/28 → 29%, mean 60.5, also Bright.

**Layout in the live strip.** Order places `daylamp` after `next` and before `daysuntil`. Hidden ids are affirmation, next, days until, night, harvest, inbox, flow, and paint. Day lamp is on. Visible run: review, points, award, progress, weather, pet, day lamp, moon, solar, tracking.

**The sheet under the lamp is a different day.** `widgetsFollowClock` is true, so the tile reads the wall clock (Friday 9 October). `brain2-home-date` is `2026-09-24` and `brain2-home-date-follows-today` is `0`, so Habits and To Do stay on Thursday 24 September. That day is also 7/28 habits, and its to-dos are 9/9, mean 62.5, word Bright. The date plate says Friday October 9. The lamp, the plate, and the grids are not one day.

**Fortnight, same formula.** Habit denominator stays 28. To-dos are whatever was scheduled that day.

| Day | Habits | To-dos | Mean | Items | Word |
| --- | ---: | ---: | ---: | ---: | --- |
| Sat 9/26 | 14/28 (50%) | 15/15 | 75 | 67% | Bright |
| Sun 9/27 | 4/28 (14%) | 6/6 | 57 | 29% | Warm |
| Mon 9/28 | 1/28 (4%) | 5/5 | 52 | 18% | Warm |
| Tue 9/29 | 2/28 (7%) | 2/2 | 53.5 | 13% | Warm |
| Wed 9/30 | 3/28 (11%) | 2/2 | 55.5 | 17% | Warm |
| Thu 10/1 | 2/28 (7%) | 1/1 | 53.5 | 10% | Warm |
| Fri 10/2 | 3/28 (11%) | 2/2 | 55.5 | 17% | Warm |
| Sat 10/3 | 4/28 (14%) | 4/4 | 57 | 25% | Warm |
| Sun 10/4 | 6/28 (21%) | 8/8 | 60.5 | 39% | Bright |
| Mon 10/5 | 14/28 (50%) | 23/23 | 75 | 73% | Bright |
| Tue 10/6 | 14/28 (50%) | 19/19 | 75 | 70% | Bright |
| Wed 10/7 | 5/28 (18%) | 8/8 | 59 | 36% | Warm |
| Thu 10/8 | 8/28 (29%) | 8/8 | 64.5 | 44% | Bright |
| Fri 10/9 | 7/28 (25%) | 11/12 | 58.5 | 45% | Warm |

Outside the lamp: 17 weekly habits, 3 met in the week of 5–11 October (6 cells in that bucket); 5 monthly habits, 0 met in `2026-10` (1 cell); 2 quarterly habits, not scored here.

## a. Biggest problems right now

The word is an unweighted mean of two percents, and tonight that mean is a bad picture of the day. Habits are a quarter done and untouched beyond that (21 still open, goal logs at zero). To-dos are one item from finished. Those two facts become 58.5 and the middle word Warm. The band copy — “between 20% and 60%” — is arithmetically true and says nothing about which bar is which. Warm is also the word for 1/28 habits with a cleared to-do list (28 September, mean 52) and for 5/28 (7 October, mean 59). Bright is the word for 6/28 once to-dos are 100% (4 October, mean 60.5) and for 8/28 (8 October, mean 64.5). On 4 October and 8 October the item share is 39% and 44%, still inside Warm if every row counted once, while the bar mean has already crossed 60. The 60 line is following the smaller bar. Tonight the smaller bar is 12 to-dos: the last open to-do is the 1.5 points that keep Friday out of Bright, and 21 open habits are not.

The lamp is also easy to misread against the rest of Home. Follow the clock is on, so the tile is Friday. The grids are still Thursday 24 September, where the same 7/28 habits plus a finished to-do list already read Bright. Someone checking the lamp against the sheet will think the thresholds moved. They did not. The days did.

The daily-only denominator is a smaller miss tonight. The week is 3/17 and October’s month habits are 0/5, so leaving them out does not hide a finished book. It does mean the word is only the daily sheet plus today’s to-dos, while the catalog still holds 24 other habits.

## b. Layout, UI, design, and style

### Overview

The square is the house tile: milled metal, a nameplate (`Day lamp`, 9px, weight 700, tracking 0.14em, uppercase, ink `#2a2c2e`), a CRT well (`#040a08` glass, phosphor bloom, gunmetal ring), and a silver footer. That structure matches the milled-fascia notes. The footer is the honest part of the face. `habits 7/28 · to do 11/12` is what the mean throws away, and it is clamped to two lines at 10px inside a 40–44px foot, so the fractions survive and the imbalance is still easy to miss at a glance.

The word is the wrong material. Design style keeps one CRT green, `--hab-crt-green` (`#7dffc4`), on that glass. The tile does that only when the level has no `data-lamp` color, which is Quiet. Dim, Warm, Bright, and Full borrow the habit tube gradient: `--home-grad-led` `#7e14ff`, `--home-grad-grade` `#508b51`, `--home-grad-output` `#25366a`. On `#040a08` those contrasts are about 3.3:1, 4.9:1, and 1.7:1. Navy on the CRT is the Bright and Full color, so the word gets harder to read as the day crosses 60. Four days in this fortnight (4, 5, 6, and 8 October) are Bright and would have been that navy. Tonight is Warm, so the tile is forest green (`#508b51`) while the detail lead for the same word is amber (`#ffb45a`). Quiet, the empty day, is the only level in real phosphor (about 16:1), so a blank sheet glows harder than a Warm one.

The only lamp on the square is the 7px caption pip, and it is pinned to `#ffb020` for the widget id. It does not step Quiet → Full. The DSi note in the style guide — a few pixels of glow that say power or mode — is the pip, and the pip is not the level. There is no lamp glyph. The level is a word in a color borrowed from a tube that was drawn for metal, not for black glass.

### Detail view

The handheld is the shared silver instrument (close key, uppercase caption, 8px header power lamp). That header lamp stays `--friend-glow` (`#7dffc4`) for every level. The hide confirm is the view that turns it amber. Day lamp does not.

Inside: the lead repeats the word on `#07140f` with its own scale (Quiet `#9ad7ff`, Dim `#c9d4c4`, Warm `#ffb45a`, Bright `#fff4c2`, Full `#ffe08a`). Those read, at roughly 11:1 to 18:1. Bright and Full are two pale yellows. Then two wells, `7/28 · 25%` and `11/12 · 92%`, then two notes. The first note is the band sentence. The second says the lamp ignores the clock, mood, and weather. Nothing on the panel is the mean 58.5, the 1.5 points under 60, or the 21 open habits. Today’s Progress already draws meters and remaining folds from the same stats. The lamp detail restates the rule and leaves the shape of the day in the two fractions.

The lead and the tile disagree about what Warm looks like (amber versus forest green), and the header pip agrees with neither unless the level happens to be a green CRT day.

## c. New features for the detail view

1. **A marked scale for this mean.** Draw both bars and the 58.5 average on one lamp, with ticks at 20 and 60. The line under it should say what the ticks mean tonight: the open to-do is the gap under Bright, and the habit bar is still 25%. That is the number the current note replaces with “between 20% and 60%.”

2. **Remaining folds, shared with Progress.** 21 habits and 1 to-do, using the lists `useHomeDayStats` already builds. The word needs a body. A count by type (11 boolean, 5 goal, 3 incremental, 2 text, all goal remainders at zero) belongs above the names so the fold is a shape before it is a list.

3. **The rows the mean skips.** One well: weekly 3/17 for 5–11 October, monthly 0/5 in October, quarterly 2 not in the average. Tonight that well shows the lamp is not hiding a finished week. On a week that is actually done, it would show the word is only the daily sheet.

4. **Bind the header power lamp to the level.** Use the lead’s scale (the one that stays readable on the dark well) for the 8px pip and the lead together, so the handheld’s lamp is the level. Leave the tile CRT on phosphor or on that same scale; the tube navy does not belong on the glass. The detail can show the pip changing while the tile is fixed in a later pass — the dialog is where the level should become a light.
