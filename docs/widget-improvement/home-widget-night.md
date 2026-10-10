# Night well

Widget id: `home-widget-night`

Last night’s hours in the CRT. The footer is the asleep clock, the woke clock, and how the bedtime sat against that evening’s sunset. The tile is `NightWellTile` in `components/Home/home-glance-tiles.tsx`. The face is `pickHomeNight` / `nightWellFace` / `sleepAfterSunset` in `lib/home-glances.ts`. Sleep rows are `useSleepStore` (`lib/sleep-store.ts`, persist v1). Sunset for the phrase is `computeDaySun` in `lib/sun-times.ts`, at the weather pin when both coordinates are set. Chrome is `HomeWidgetDialog`, `WidgetWell`, `TileOpen`, and `TileHide` in `components/Home/home-widget-dialog.tsx`, mounted from `components/Home/home-overview.tsx` when the id is visible. Layout visibility is `brain2-home-widgets`.

## Data source + snapshot

**Live wins.** Read 2026-10-09 evening from Chromium localStorage for origin `http://localhost:3000`, LevelDB at `~/Library/Application Support/cogs/Local Storage/leveldb` (files touched 23:06 PDT). Keys `_http://localhost:3000\u0000\u0001brain2-sleep-store`, `brain2-sun-times`, `brain2-home-widgets`, `brain2-home-weather`, `brain2-user-settings`. The `cogs-sleep-store` twin is the same length (1181 bytes). `brain2-data-profile` is absent, so this is the live profile. Demo keys were not read.

`brain2-sleep-store` version 1. `targetMinutes` is 480 (8h). Seven mornings, no notes:

| Morning | Asleep | Woke | Duration | Precision | What `nightWellFace` paints for that row |
| --- | --- | --- | --- | --- | --- |
| 2026-09-17 | 8:00 AM (`sleptMin` 480) | 7:15 AM (`wokeMin` 435) | none — woke before asleep | both estimated | CRT `—`, footer `Night incomplete` |
| 2026-09-19 | 1:00 AM | 9:00 AM | 8h (480 min) | both estimated | `8h` · `asleep 1:00 AM · woke 9:00 AM · 6h 8m after sunset` |
| 2026-09-20 | 10:00 PM | 1:00 PM | 15h (900 min) | asleep estimated, woke definite | `15h` · `asleep 10:00 PM · woke 1:00 PM · 3h 9m after sunset` |
| 2026-09-26 | all-nighter, source `telegram` | — | none | — | `all-nighter` · `No sleep` |
| 2026-09-27 | 9:40 PM | 12:30 AM | 2h 50m (170 min) | both estimated | `2h 50m` · `asleep 9:40 PM · woke 12:30 AM · 2h 59m after sunset` |
| 2026-10-04 | 4:11 AM | 10:10 AM | 5h 59m (359 min) | both estimated | `5h 59m` · `asleep 4:11 AM · woke 10:10 AM · 9h 39m after sunset` |
| 2026-10-06 | all-nighter, source `telegram`, written 2026-10-06T11:49:15Z | — | none | — | `all-nighter` · `No sleep` |

From 2026-09-17 through 2026-10-09 is 23 mornings. Sixteen of them have no row: Sep 18, Sep 21–25, Sep 28–30, Oct 1–3, Oct 5, Oct 7, Oct 8, Oct 9.

The sunset clause uses the weather pin, not the sticky sun cache. `brain2-home-weather` has `lat` 32.71571, `lng` -117.16472, city San Diego. `brain2-user-settings` `homeCity` is `San Diego, California`. `brain2-sun-times` holds 57 first-write slots (places map empty) and is not what the tile reads. `computeDaySun` at that pin, in `America/Los_Angeles`, matched the stored sunset minute for every logged evening. The evenings that matter:

| Evening before the morning | Sunset the tile would compute | Stored first-write |
| --- | --- | --- |
| 2026-10-03 (before the 5h 59m night) | 6:32 PM (1112 min) | `2026-10-03\|32.7157\|-117.1611`, 6:32 PM |
| 2026-10-05 (before the Oct 6 all-nighter) | 6:29 PM (1109 min) | `2026-10-05\|32.7157\|-117.1647`, 6:29 PM |

`sleepAfterSunset` is bedtime minus that evening’s sunset, not duration versus daylight. For 2026-10-04, 4:11 AM is 579 minutes after 6:32 PM, which the face prints as `9h 39m after sunset`. The all-nighter branch returns before that phrase is attached, so Oct 6 drops 6:29 PM.

**What the strip would show tonight.** `brain2-home-widgets` version 9. `widgetsFollowClock` is true, so the square reads the wall clock, not the selected day. On the evening of 2026-10-09, `pickHomeNight` looks at `2026-10-09`, then `2026-10-08`, finds neither, and returns nothing. Face: CRT `—`, footer `No night logged`. Sunset is not consulted. The same empty face is what 2026-10-08 would paint. 2026-10-07 would still fall back one day and paint the Oct 6 all-nighter (`all-nighter` / `No sleep`), with the 6:29 PM sunset computed and then discarded.

`night` is in `hidden`, with `affirmation`, `next`, `daysuntil`, `harvest`, `inbox`, `flow`, and `paint`. Order still reserves it after `tracking` and before `harvest`. Showing tiles: review, points, award, progress, weather, pet, daylamp, moon, solar, tracking. The overview does not mount Night well.

The hub file `data/shared-persist.json` (`updatedAt` 2026-10-10T06:09:31.476Z, source `electron`) is a thinner copy. Its `brain2-sleep-store` has only 2026-09-17, 2026-09-19, and 2026-09-20 (533 bytes). Its widgets blob has `widgetsFollowClock` false and a different `hidden` list. Numbers in this report are the LevelDB vault.

## a. Biggest problems right now

1. **Tonight’s face is an empty night, and the last night is three mornings back.** Follow the clock is on. Oct 9 and Oct 8 have no row, so the glass is `—` and the foot says `No night logged`. The last record is the 2026-10-06 all-nighter. The last duration is 2026-10-04: 5h 59m, asleep 4:11 AM, woke 10:10 AM, 9h 39m after a 6:32 PM sunset. `pickHomeNight` steps back one morning only. The second blank morning erases both. Sixteen mornings in the logged span are already missing; the tile cannot say which ones.

2. **The square is hidden.** Home does not render `NightWellTile` while `night` is in `hidden`. The Widgets catalog is the surface that still names it, and that card is the stock example (`7h 20m`, footer `asleep 11:40p · woke 7:00a`, caption “Example”), with the state line “Hidden”. Nothing on the overview says the last duration was 5h 59m or that the last mark was an all-nighter.

3. **A resolved night still hides the sunset, the target, and a broken row.** An all-nighter paints `all-nighter` / `No sleep` and drops the evening sunset (Oct 5, 6:29 PM). 2026-09-17 has both clocks and `nightProblem` already says “Woke up before falling asleep — check which end is which.” The face says only `Night incomplete`. The store target is 8h. 2026-09-19 meets it (8h). 2026-10-04 is 121 minutes short. 2026-09-20 is 15h, and its wake is the only `definite` end in the vault. The face prints none of that, and it never prints `estimated`.

4. **The hub copy would tell a different last night.** Tonight’s `shared-persist.json` stops at 2026-09-20 and still has Follow the clock off. LevelDB is the vault the app reads. A seed that trusts the hub would miss Oct 4 and Oct 6.

## b. Layout, UI, design, and style

Style read from `docs/DESIGN_STYLE.md`: a CRT value is one phosphor figure in black glass (`#040a08`, `--hab-crt-green` `#7dffc4`), padded so type does not touch the ring. A 9px nameplate is a short engraved word, not a sentence. The largest type is the value; the smallest is the caption, and a hint that fails at a glance is the wrong size. Sibling wells of one instrument share one height. The Home strip already does the equal-height version (`--home-tile-h`). One green for CRT values. The screen stays one instrument.

### Overview

The strip does not render this tile. `home-overview.tsx` only mounts `NightWellTile` for ids outside `hidden`. Order still reserves the slot between Tracking now and Harvest leftover for the day it is added back.

What that square is built to show, and what this vault would put in it with Follow the clock on:

- Fixed bay, 132–200px wide and 156px tall (`min-width` / `max-width`, `--home-tile-h` in `home-chrome.css`). Periwinkle caption pip `#8aa4ff` on `.home-tile.is-night`. Caption text is always “Night”, the 9px engraved nameplate (weight 700, tracking 0.14em, uppercase) with a 7px power lamp. That nameplate matches the fascia. It does not say which morning.
- The CRT is `.hab-score-readout.home-night-readout`: phosphor green, glass `#040a08`, glow, `overflow: hidden`, type knocked down to 16px (sibling tiles use 20px). Tonight’s string is `—`, which fits. The last record’s string is `all-nighter`, eleven letters in a well that clips overflow. The last duration’s string is `5h 59m`, which fits the glass. The catalog preview `7h 20m` is the same kind of figure, and its footer `asleep 11:40p · woke 7:00a` is a clock the formatter does not emit (`offsetToLabel` prints `4:11 AM`).
- Footer `.hab-score-sub` is 10px, line-height 13px, two-line clamp, on a foot whose min height is 40px and max height is 44px. Tonight’s footer `No night logged` fits that foot and is the wrong fact. A complete night’s footer is one sentence of about 52 characters (`asleep 4:11 AM · woke 10:10 AM · 9h 39m after sunset`). That sentence is the sunset comparison the square exists to show, set in the caption size, clamped to two lines, inside a bay that is often near 132px. The clause that falls off is the sunset.
- Hide is the hover × (`TileHide`), then “Are you sure?”. That is how this id can sit in `hidden`. Add it back from the catalog; the catalog will still preview `7h 20m`, not `—` and not `5h 59m`.

Follow the clock means browsing to Oct 4 or Oct 6 does not change the glass. The date bar and this square are two cursors, and only the wall clock is labeled by omission.

### Detail view

Opening the tile (once it is on the strip) is `HomeWidgetDialog` titled “Night well”: a silver handheld, green power lamp, metal ×. The body is one column and one well.

```tsx
<WidgetWell label={face.footer} tone="nixie">{face.crt}</WidgetWell>
```

- Tonight that well’s nameplate is `No night logged` at 9px, tracked 0.12em, uppercase — a sentence in the nameplate size the style file refuses. The figure is `—`, painted navy `#4a7fd4` (`.home-widget-nixie`) instead of the phosphor green on the tile. The tile and the dialog disagree about what color a duration is.
- For the last duration the same slot would uppercase the whole 52-character footer (`ASLEEP 4:11 AM · WOKE 10:10 AM · 9H 39M AFTER SUNSET`) and put `5h 59m` under it in nixie. The comparison, the two clocks, and the date are one label. There is no second well. Harvest leftover splits earned and still possible. Inbox mill lists rows and a key. Night well repeats the tile.
- No morning date, no `estimated` mark, no 8h target, no sunset clock (6:32 PM), no `nightProblem` line, no `updatedAt`. 2026-09-20 was written 2026-09-22; the store keeps that timestamp so a later edit stays honest, and the dialog never shows it. An all-nighter dialog is `NO SLEEP` over `all-nighter`, with Oct 5’s 6:29 PM omitted.
- No settings and no action. The chrome comment says settings appear only when the widget has any. This one has none, and it cannot open Morning Review or write the three blank mornings.

## c. New features for the detail view

These follow this vault: Follow the clock on, the tile hidden, tonight’s face empty, the last mark an all-nighter on 2026-10-06, the last duration 5h 59m on 2026-10-04, target 480, and sixteen blank mornings since 2026-09-17.

1. **Show the last logged morning when the tile is empty.** The glass can stay `—` for a blank Oct 9. The handheld should name 2026-10-06 as an all-nighter and 2026-10-04 as the last duration (5h 59m, 4:11 AM–10:10 AM, 9h 39m after sunset), and list the blank mornings since: Oct 7, Oct 8, Oct 9. That is the gap `No night logged` is failing to be.

2. **Four wells, one word each.** Hours, Asleep, Woke, Sunset. Phosphor green for the hours, the same green as the tile. Nameplates stay single words. For 2026-10-04 the figures are `5h 59m`, `4:11 AM`, `10:10 AM`, and `6:32 PM`. The sunset well carries `9h 39m after` at body size, plus the evening date Oct 3. Estimated ends get the same small mark Analytics already uses; the only definite end in the vault is the 1:00 PM wake on 2026-09-20.

3. **A week of mornings in the dialog.** Seven cells, newest at the right, each one a duration, `all-nighter`, `incomplete`, or a blank. Tonight the last three are blank, Oct 6 is the all-nighter, and Oct 4 is `5h 59m`. The sixteen-day hole stays out of the tile and becomes visible here. Sibling wells share one height.

4. **Say the contradiction and the target.** 2026-09-17 should print the existing `nightProblem` line, not only `Night incomplete`. A target well reads the stored 8h: 2026-09-19 meets it, 2026-10-04 is 2h 1m short, 2026-09-20 is 7h over. The 15h night is inside the 20h cap, so the face currently treats it as an ordinary duration.

5. **Keep the sunset on an all-nighter.** Oct 6’s dialog should still show the evening it skipped: Oct 5, sunset 6:29 PM, and the morning date the mark belongs to. `No sleep` stays the figure. The date stops the fallback from looking like last night when the strip does reach it (as it would have on Oct 7).

6. **A key to log the open morning.** Oct 7, Oct 8, and Oct 9 have no row. The handheld should offer one key into the place sleep is written (Morning Review), dated to the wall-clock morning while Follow the clock is on. The dialog does not need its own bedtime form.
