# Plan and lived

Widget id: `home-widget-paint` (catalog id `paint`).

The square compares a day’s scheduled minutes with painted Tracking minutes and shows one word: Open, Planned, Tracked, Short, Close, or Over. Plan is `plannedMinutesForDay` in `components/Home/Plan/plan-capacity.ts`: to-dos with a scheduled date (inbox rows skipped; a to-do already placed as a planned action skipped), plus timed events, plus planned actions. All-day and multi-day events add nothing. Lived is `livedPaintMinutes` in `lib/home-glances.ts`: every non-instant block on that date, each minute once, across every Tracking scope. A block is dropped only when `generatedBy.kind` is `sleep` or the block’s own `tagIds` include `tag-sleep`. The face treats lived/plan under 0.8 as Short, over 1.2 as Over, and the band between as Close.

**Data source.** Live Electron localStorage, origin `http://localhost:3000`, LevelDB under `~/Library/Application Support/cogs/Local Storage/leveldb`. Profile is Live (`brain2-data-profile` is absent; no `brain2-demo-*` keys). Read on the evening of Friday 9 Oct 2026, Pacific (`America/Los_Angeles`). Keys used: `brain2-task-storage`, `brain2-event-storage`, `brain2-planned-actions`, `brain2-timegrid-store`, `brain2-home-widgets`, `brain2-home-date`. Day and week plan keys were checked because they are the written plan; this widget does not read them.

Hub `data/shared-persist.json` the same evening matches lived (**1,136**). Its plan is **1,097** (18h 17m), 35 minutes higher, because it still has two scheduled to-dos local does not: Popup dishes (20) and Popup floor (15). Shared rows match. The word would still be Close. **Live LevelDB is the snapshot below.**

**Layout.** `brain2-home-widgets` persist v9. `paint` is in the order and in `hidden`, with affirmation, next, days until, night, harvest, inbox, and flow. The square is not on the strip. `widgetsFollowClock` is true, so if it were shown the overview would read the wall clock (9 Oct), not `brain2-home-date` (`2026-09-24`). `brain2-home-date-follows-today` is `0`.

**What the tile would claim for today (9 Oct 2026).** Caption **Lived**. CRT **Close**. Footer **plan 17h 42m · lived 18h 56m**. Detail lead **Close**. Wells **Plan 1062m** and **Lived 1136m**. Note: “Painted minutes sit near the plan, within about a fifth either way.” Ratio 1136/1062 = 1.07, inside 0.8–1.2. Short would be under 850 lived minutes; Over would be above 1,274.

| Side | Minutes | What they are |
| --- | ---: | --- |
| Plan | 1,062 | 12 scheduled rows. No events. No planned actions (the only stored action is 21 Sep). None of the 12 have `scheduledTime`. |
| of which pen-action echoes | 516 | Five “worked on computer” done rows, 165+40+67+189+55. `estimatedDuration` equals `actualDuration` and equals the five Computer Work blocks. |
| of which habit echo | 516 | Completed “Work for 5 hours”. Estimate and actual are both 516, the same Computer Work minutes again. |
| of which forward to-do | 30 | Open “process inbox information”. No clock. |
| of which zero-length habit rows | 0 | Brush teeth, skincare, dance, practice an instrument, go outside. Scheduled, completed, no estimate. |
| Lived | 1,136 | One Location block, Home, 3:00a–9:56p. That span is the whole unique total. |
| Activity inside it | 1,096 | Sleep 3:00a–12:40p (580) and Computer Work (516) from 1:15p to 9:56p. |
| Location with no activity | 40 | 12:40p–1:15p (35) plus two 1–3 minute seams in the afternoon. |
| Mood / company | 356 / 250 | Inside the Home span, so they do not raise the unique total. |
| Instants | 21 | Ignored, correctly. Screen Time and estimated blocks: none in the lived set. |

**Gaps.** Clock-placed plan is **0** minutes (no event ranges, no planned-action ranges, no `scheduledTime`). Unpainted plan is the whole **1,062**: nothing was given a clock to paint against. Of that, **1,032** is the 516 Computer Work minutes stored twice (pen-action rows plus the habit row), and **30** is the inbox to-do. Unplanned paint is the whole **1,136**: every lived minute sits outside a placed plan. Inside it, **580** is hand-painted Sleep and **516** is Computer Work.

The Sleep pen is `act-sleep` and carries `tag-sleep`, but this block’s `tagIds` is empty and `generatedBy` is absent, so the filter keeps it. Removing those Sleep *blocks* and leaving Location up still yields 1,136. Removing the Sleep *minutes* from the union yields **556**.

Day plan `brain2-dayPlan-2026-10-09` has 3 stamped entries (212 characters of body) and an unsent draft (437 characters). Week plan `brain2-weekPlan-2026-10-05_2026-10-11` has 1 entry (2,433 characters). `plannedMinutesForDay` never opens those keys.

If Follow the clock were off, the same function on the stored home date 24 Sep 2026 would say **Over**, footer **plan 2h 20m · lived 24h** (140 vs 1,440). That is not today’s claim.

## a. Biggest problems right now

The word Close is a match between two piles that are not a plan and a day. 1,032 of the 1,062 plan minutes are painted Computer Work written back onto done rows (`pen-action-*` sets `scheduledDate`, `estimatedDuration`, and `actualDuration` to the block; the “Work for 5 hours” habit row holds the same 516). The other 30 minutes is one untimed to-do. Lived is not that work. It is one Home location stroke of 18h 56m, and 9h 40m of that stroke is hand-painted Sleep that the filter does not see. Unique minutes across scopes then keep the sleep hour, because Location still occupies it. The fifth-either-way test (1.07) calls that Close. A waking cut (556 lived against 1,062 plan) would say Short. The 30-minute to-do against 1,136 lived would say Over. The square reports none of those cuts.

Clock gaps are total. Unpainted plan = 1,062 minutes with no start time. Unplanned paint = 1,136 minutes with no placed block on top of them. The detail has no row for either gap, so the Close note describes a near miss that the clocks do not have.

The written day and week plans are invisible to the math. Three day-plan stamps and a week stamp sit in the keys the Plan log uses. The tile’s “plan” is scheduled duration only.

The square is hidden, so this face is not on screen. The stored settings would show it for 9 Oct, while the home date key is still 24 Sep. The tile does not name which day it read.

## b. Layout, UI, design, and style

### Overview

The square is the shared overview tile: caption, CRT, footer, gold pip (`is-paint`, `#e6c15a`), 132–200px wide and 156px tall. Hide sits on the × with the confirm dialog. The open button is the rest of the tile. That chrome is one instrument, equal height with its siblings, and it does not restack into cards.

For this vault the face would be caption **Lived**, CRT **Close**, footer **plan 17h 42m · lived 18h 56m**. The large type is the verdict. The two durations that make the verdict are the 10px footer, clamped to two lines. On a tile this narrow that footer is the whole argument, and it is the smallest type. Short, Close, and Over share the same green CRT. The pip is a fixed gold lamp, so the DSi light never changes with the word.

Nothing on the square says 9 Oct. Follow the clock is on and the panel date key is 24 Sep. A date the strip can disagree with needs a label on the instrument that is reading the other one.

### Detail view

The handheld is the shared widget dialog: power lamp, title “Plan and lived”, one scroll, no settings. Lead repeats **Close**. Two equal wells, labels at 9px (a nameplate, which is the right size for the word), values at 18px monospace: **1062m** in green, **1136m** in nixie blue. Then the Close sentence, then the definition: plan is scheduled work, events, and planned actions; lived is painted minutes, each minute once; sleep the log filled in is not counted.

The wells and the footer disagree in notation. The footer already knows 17h 42m and 18h 56m. The detail prints raw minutes, so the number you open the tile to see is harder to read than the footer you left. Both are derived. The 1,032 echoed minutes are durations the paint wrote, shown as Plan with no ~ and no est. chip.

The two notes are true about the ratio and thin about the day. “Within about a fifth” is the 0.8–1.2 band, and 1.07 sits in it. The note does not say that clock-placed plan is 0, that unpainted plan is 1,062, or that unplanned paint is 1,136. It does not say 580 of the lived minutes are a Sleep pen whose tag lives on the pen, not on the block. “Sleep the log filled in is not counted” describes `generatedBy`, and this night was not generated.

The dialog is one region with one job, which is right. The job’s answer — where the plan went unpainted, and where the paint had no plan — is not in the region.

## c. New features for the detail view

Show the plan as three counts the wells can sit on: forward scheduled minutes, paint echoed onto done rows, and zero-length habit rows. Today that is 30, 1,032, and five rows that add nothing. The 30 is “process inbox information”, still open, with no start. The 1,032 is five computer blocks plus “Work for 5 hours” holding those same 516 minutes a second time. Without that split, Close keeps winning whenever a painted block files a done row.

Add the two gaps as their own wells, in the same hour format as the footer. Unpainted plan: 17h 42m, all of it off the clock. Unplanned paint: 18h 56m, all of it. Under them, a single day ribbon from the blocks already stored: Home 3:00a–9:56p, Sleep 3:00a–12:40p, Computer Work 8h 36m from 1:15p to 9:56p, and the 40 empty activity minutes. Placed plan has no bar until a row has a start. That ribbon is the picture the ratio is standing in for.

Make lived a waking activity total, and show the other scopes beside it. Drop a minute from lived when the activity pen carries `tag-sleep`, even if Location still covers that minute. Today that cut is 1,136 → 556, and the activity that remains is 8h 36m of Computer Work. Mood (356) and Alone (250) stay visible as scopes; they should not be the number the word is computed from.

Put the written plan under the wells as lines, without turning the prose into minutes. Today’s day key has three stamps and a draft; the week key has one stamp. The minute math skips them. The detail is where those lines belong, next to the 30 minutes that actually were scheduled.

Name the day in the caption (“9 Oct”), format the wells as 17h 42m and 18h 56m, and mark echoed estimates with the est. chip. Let the gold pip take the verdict — Close stays gold, Short and Over get their own lamp — and print the ratio (1.07) next to the fifth-either-way sentence so the band is a number.
