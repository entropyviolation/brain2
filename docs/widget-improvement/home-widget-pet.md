# Screen pet

Widget id: `home-widget-pet`

Pixel pet on the Home strip. The square is a clock, a 16×16 sprite, and one pose word. The dialog repeats that sprite and adds four wells. Pose comes from `petPose` in `lib/home-widgets.ts`: today’s daily-habit percent, the daily total, and the hour. Pleased is 100%. Asleep is under 20%, or night (before 6am or from 10pm), unless the sheet is already complete. Idle is the daytime band from 20% up to but not including 100%. No habits is idle by day and asleep at night.

## Data source + snapshot

**Source the tile reads:** Electron localStorage, origin `http://localhost:3000`, LevelDB under `~/Library/Application Support/cogs/Local Storage/leveldb`. Profile is Live (`brain2-data-profile` is absent). Read at 11:14pm local on Friday 9 Oct 2026 (hour 23).

| Key | What it says |
| --- | --- |
| `brain2-habits-store` | Persist version 26. `contentRev` stamped 9 Oct 2026, 10:42pm local. 52 habits. 28 daily, 17 weekly, 5 monthly, 2 seasonal. |
| `brain2-home-widgets` | Persist version 9. `widgetsFollowClock` is on. `pet` is in the order and not hidden (after Weather). |
| `brain2-home-date` | `2026-09-24`, and `brain2-home-date-follows-today` is `0`. |

Follow the clock is on, so the strip uses the wall clock (`homeWidgetDate`), not the pinned Home day. The pet scores **Friday 9 Oct 2026**, hour **23**. The Habits room can still be sitting on 24 Sep.

`data/shared-persist.json` (updated 9 Oct 2026, 11:11pm local, `source: electron`) is a different copy: habits `contentRev` 11:11pm, `widgetsFollowClock` off, home date `2026-09-23`. Electron keeps a rich local habits vault (52 tasks, over the seed cutoff) and does not paint that hub blob over LevelDB. Live LevelDB wins.

**Friday 9 Oct, from LevelDB.** Daily habits on the sheet: 28. None waived. Cells logged: 8. Met: **7**. Percent: **25** (`Math.round(7/28×100)`).

Of the seven that count: five hand ticks (`manual`), one tag reading (logged 8.6 against a goal of 5), one coverage reading (76.1 against a goal of 70). The eighth cell is a boolean with `completed: false` and a missed-opportunity flag; its sources are manual and sleep, and neither source has a reading that meets, so it stays open. The other 20 daily habits have no cell.

**Pose the pet should show: asleep.** Hour 23 is night, and 25% is not 100%, so night wins. Percent is in the daytime “underway” band (20% or more, and short of done), so the dialog line is “Asleep for the night — quiet hours after habits are underway.” Footer word: `asleep`. Clock face from `h:mm`: `11:14`, with no meridiem. The moon pixel is on (`night` and `asleep`). This is the habit sheet driving the pose. The empty-sheet branch (total 0) does not run.

The same hour on the pinned day, 24 Sep, is also 7/28 and asleep. The wells would look the same. The habits underneath are not the same set.

The later hub habits blob is 6/28 (21%) for 9 Oct. That is still night-asleep with the same “underway” line. It would change the Habits well from 7/28 to 6/28. The running tile does not use it.

## a. Biggest problems right now

1. **The square hides a 25% day inside a sleep face.** At 11pm anything short of 28/28 is asleep. Tonight is 7 done, one explicit miss, and 20 blanks — underway, not an empty sheet — and the only word on the tile is “asleep”. The line that says the day is underway exists only after you open the dialog. A 0% night uses the same sprite, the same footer, and the same moon.

2. **The clock does not say which 11.** `format(clock, "h:mm")` at 23:14 is `11:14`. The catalog preview is `3:42p`. The night fact is a data attribute and the word Night in the dialog, not on the clock. The caption ticks every 30 seconds, so the face can lag the minute.

3. **The fraction has no date.** Follow the clock is on and the Home cursor is pinned to 24 Sep. Both days are 7/28 at this hour, so the Habits well cannot tell you which day you are looking at. The pet never prints `2026-10-09`.

4. **One logged miss and twenty blanks are the same kind of “not done”.** The eighth cell is a real miss. The other twenty were never touched. Both lower the percent the same way, and the dialog does not list either.

## b. Layout, UI, design, and style

The house direction is a DSi-like instrument: pixel edges, CRT green `#7dffc4` (`--hab-crt-green`) in black glass, a short engraved nameplate, and one job per region. The pet is already in that family. The sprite is hard rectangles (`shape-rendering: crispEdges`), body in CRT green, marks in `#04140e`, moon in `#c9d4ff`. The tile is caption, CRT, footer, with hide outside the open button. The dialog is the shared silver handheld (power lamp, title, close key, dark wells).

### Overview

The nameplate is the clock, 9px, weight 700, tabular numerals. That size is the engraved nameplate, and `11:14` is short enough to sit there. What it fails to carry is the meridiem, so the nameplate and the night pose can disagree with a glance that reads “morning”.

The CRT holds only the sprite (64px). Style puts the value in the glass. Tonight the value is 7/28 and asleep-because-night. The glass shows the creature and the moon. The 7/28 is not there.

The footer is 10px: `asleep`. That is the pose word (`POSE_FOOT`), not the catalog’s “Habits underway”. Asleep, idle, and pleased share one body. Asleep adds closed eyes, three Z pixels (opacity pulse, 2.4s), and, at night, the moon. Idle blinks and sways 1px. Pleased bobs 1px. Reduced motion holds one frame. The Z pulse is an opacity fade, softer than the stepped 1px sway. At 11pm you only see the sleep drawing, so the daytime idle drawing — the one that would match 25% — never appears.

The tile is on the strip, after Weather. Opening it is the whole click. Nothing on the square jumps to the habit that is still open.

### Detail view

Same sprite, 72px, beside one sentence (`#d7ffe9`, 13px, weight 600, glow turned off). The wells glow; the sentence does not. The sentence is the right one tonight: quiet hours after habits are underway.

Four wells, two by two, equal height, 9px uppercase labels:

| Well | Label | Tonight | Tone |
| --- | --- | --- | --- |
| Habits | Habits | 7/28 | phosphor green |
| Clock | Clock | 11:14 | navy nixie `#4a7fd4` |
| Hour | Hour | Night | phosphor green |
| Mood | Mood | asleep | phosphor green |

The clock is the only nixie well, and it is still the ambiguous `11:14`. The well labeled Hour does not show 23 or 11pm. It shows the band name. Mood repeats the footer. The note under the wells restates the rule (night 10pm–6am, under 20%, 100% pleased). It does not say that this night is the 20%-or-better branch, and it does not name the day.

There is no list, no meter, and no settings. The dialog is a larger copy of the tile plus the fraction. Today’s Progress already lists what is still open. This instrument, which exists to express that sheet, does not.

## c. New features for the detail view

1. **Name the day, then the sheet.** A date plate for the day the percent used — Friday 9 Oct — sitting above the wells, because Follow the clock is on and 24 Sep is also 7/28 asleep at this hour. Under it, the 21 still open: the one logged miss first, then the 20 with no cell. Counts in the wells stay 7/28. The list is how you see that 25% is seven real completions, not a fallback.

2. **A night face for an underway sheet.** Keep pleased for 28/28, and keep deep sleep for under 20% or a blank sheet. Tonight is the third case: night, and 25%. The sentence already knows that. The sprite should too — moon stays, and a small CRT fraction or a lit pixel for “underway” — so the square and the dialog tell the same story before anyone reads the paragraph.

3. **Put the hour on the clock.** Show `11:14p` (the catalog already writes the meridiem) in the nameplate and in the nixie well, and let the Hour well read `11p · night` so the 10pm–6am rule sits next to the number that triggered it.
