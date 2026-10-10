# Clock and sky

Implementation plan for the Home clock, the sky, and the “what is happening now” squares. Live vault, Friday 9 Oct 2026, Pacific, San Diego pin 32.71571, −117.16472. Follow the clock is on. The home cursor is pinned to 24 Sep 2026. LevelDB at `http://localhost:3000` is the vault. `data/shared-persist.json` is not.

Each step makes one tile say the next true fact. Order is how often that fact changes the next hour, then whether the square is already on the strip. Hidden tiles stay hidden.

## What is wrong together

One evening is being told as if it were still afternoon, still last night, or already the new moon.

Solar remainder is on the strip and counts time since sunset. At 11:10 PM the glass is `4h 46m` / `after sunset · 6:24 PM`. Tomorrow’s sunrise is already known: 6:50 AM, 7h 40m away. Moon is on the strip and says both **New moon** and **1 day until new moon**. The instant is 10 Oct 2026, 8:51 AM. Weather is on the strip at 69°F, clear, and the footer still says the day warms to 81° by 3p. The same fetch has Saturday drizzle and Sunday heavy rain. Tracking now is on the strip, caption `Last`, footer `last known`, lanes ended at 9:55 PM, and the 10:41 PM Text log instant is skipped. At 11pm the pet is asleep on a 7/28 sheet, so an underway day wears the empty-night face.

The hidden faces, if read, are the same kind of miss. Next would be the untimed inbox row “process inbox information”. Night well is empty for Oct 8 and Oct 9, while Oct 6 is an all-nighter and Oct 4 was 5h 59m. Plan and lived says Close (17h 42m vs 18h 56m) because plan minutes are mostly Computer Work copied onto done rows and lived includes 9h 40m of sleep. Days Until target “Elijah Comes Home” on 2026-09-28 is past, and the tile is hidden.

## Do these, in order

### 1. Tracking now — age of the last stamp

**Change.** The foot and the dialog lead say when the lanes were last true, and for how long the grid has been open since then. Activity stays the last interval (Computer Work). The newest activity instant sits beside that interval so a later mark is visible. `trackingPresenceSnapshot` in `lib/tracking-presence.ts` keeps kind and name and drops `loggedAt`. `classifyScope` in the same file skips instants in both `covers` and `startedBy`. The tile in `components/Home/home-tracking-tile.tsx` then prints a bare `last known`. Read `trackingScopeStatuses` (it already returns `loggedAt`) and format the clock with `formatLoggedMoment`. The header already draws this stamp in `components/header-tracking/current-moment.tsx`. The Home square uses that stamp.

**Why this is first.** It is the present-tense square, and it is on the strip. After 9:55 PM every glance says the evening is still Computer Work, with no age, while a newer activity fact is already on the day.

**Files.** `lib/tracking-presence.ts` (`trackingScopeStatuses`, `formatLoggedMoment`, `classifyScope`). `components/Home/home-tracking-tile.tsx` (foot, lead, activity row). `components/header-tracking/current-moment.tsx` is the stamp to match, not a second clock to invent.

**Acceptance.** At the 11:09 PM sample (minute 1389), all four lanes still name Computer Work, Home, the mood sentence, and Alone, last named minute 9:55 PM (exclusive end 9:56 PM). The foot shows that clock and the open stretch: 74 minutes before the sample, 73 minutes unpainted from 9:56 PM to 11:09 PM. The activity row also shows the Text log instant at 10:41 PM (28 minutes before the sample). A lane with no later instant omits that row. The confirm path is untouched, so nothing writes 9:56 PM–11:09 PM.

### 2. Weather — the change still ahead

**Change.** Once this hour is past the day’s warm peak, the glance names the next change in the same fetch instead of falling back to the whole day. `weatherLaterGlance` in `lib/home-widgets.ts` filters to hours after `nowHour`, and when that list is empty it uses every hour, so the peak stays 15:00. The week is already on the reading: `HomeDayWeather.week` (`HomeWeekDay` in `lib/weather-client.ts`). The tile and the detail story both call `weatherLaterGlance` from `components/Home/weather-instrument.tsx`. One function fixes both lines.

**Why this is next.** The square is on the strip and it is the sky you dress for. At 11pm it describes 3p, and the weekend rain is already in the body.

**Files.** `lib/home-widgets.ts` (`weatherLaterGlance`). `components/Home/weather-instrument.tsx` (tile footer and detail story). `lib/home-widgets.test.ts` (the later-today glance test). `lib/weather-client.ts` only as the type of `week` — the parser stays.

**Acceptance.** Pin San Diego, current 69°F, WMO 0, sun glyph. At hour 23 the footer is not `Clear · warmer 81° by 3p`. The line names Saturday 10 Oct, code 51, 44% rain, and Sunday 11 Oct, code 65, 96% rain, high 68.7°. The detail story does not capitalize that 3p clause. The CRT stays 69°.

### 3. Solar remainder — time until sunrise

**Change.** After sunset the CRT counts forward to the next sunrise, and the footer is that clock. `solarRemainderFace` in `lib/solar-remainder.ts` currently returns `now − sunset` and `after sunset · ${sunsetLabel}`. It only receives today’s sun. `components/Home/home-solar-tile.tsx` calls `computeDaySun` once, for today (`lib/sun-times.ts`). Call it again for the next local date and pass that sunrise in. Before sunset the face stays a countdown to today’s sunset. The dialog sentence that walks the night “until midnight, then the next day’s sunrise” comes out; Rise and Set stay. The catalog line in `lib/home-widgets.ts` (`shows` for `solar`) still describes a midnight handoff and a CRT that is the phase name. Update that sentence so the catalog matches the remainder.

**Why this is next.** The square is on the strip and its job is the remainder. After 6:24 PM the number points at a sunset that has happened. Midnight would jump the same glass from a large elapsed count to a countdown.

**Files.** `lib/solar-remainder.ts`. `components/Home/home-solar-tile.tsx`. `lib/sun-times.ts` (`computeDaySun` — call it, do not change the astronomy). `lib/solar-remainder.test.ts`. `lib/home-widgets.ts` catalog `shows` for `solar`.

**Acceptance.** At 11:10 PM, both pins, today is sunrise 6:49 AM / sunset 6:24 PM. Tomorrow 10 Oct is sunrise 6:50 AM. The CRT is `7h 40m`. The footer is `6:50 AM`. The glass is not `4h 46m` and not `after sunset · 6:24 PM`. A fresh `computeDaySun` is the clock. The weather payload’s 6:48 AM / 6:22 PM is not.

### 4. Moon — one phase

**Change.** The eight-phase name uses the same local day as the footer countdown. `phaseIdForCycle` in `lib/lunar.ts` bins the cycle at ±1/16, so the name flipped to New moon at 8 Oct 2026, 12:34 PM, while `calendarDaysUntil` still counts midnights to the Meeus instant. `moonGlance` then feeds `face.label` and `face.untilPhrase` to `components/Home/home-moon-tile.tsx`, and the same glance fills the lead and the Next Major Phase line. Keep the name on the footer’s calendar day: Waning crescent until the local day that contains the new moon, and New moon on that day, when `moonUntilPhrase` already says “New moon today”. The 8-bit disk stays on `cycle` (0.986, dark). The illumination line uses `cycle < 0.5` for “increasing”; at 0.986 that trend follows the same day rule so it does not say the light is still decreasing into a new moon that is tomorrow morning.

**Why this is next.** The square is on the strip, and the CRT and the footer are one region saying two clocks. The disagreement has been on the glass since Thursday afternoon. It does not change what you do in the next hour the way the log, the rain, and the sunrise do.

**Files.** `lib/lunar.ts` (`phaseIdForCycle`, `moonGlance`, `moonUntilPhrase`, `moonIlluminationLine`). `components/Home/home-moon-tile.tsx` (name, footer, lead, next-major line — they should keep reading one glance).

**Acceptance.** At 11:07 PM on 9 Oct the name is Waning crescent, the footer is `1 day until new moon`, and the next-major line is New Moon on October 10, 2026, at 8:51 AM. The lead is not New moon while that line is still ahead. On the local day of 10 Oct the name is New moon and the footer is `New moon today`. The disk stays the dark cycle-0.986 face on the evening of the 9th.

### 5. Screen pet — night, and the sheet is underway

**Change.** Night plus a sheet that is underway is its own pose. `petPose` in `lib/home-widgets.ts` returns `asleep` when the hour is before 6am or from 10pm, unless the percent is 100. Under 20%, and a sheet with no habits, stay deep sleep. Pleased stays 100%, including at night. The third case is night and at least 20% and short of done. `components/Home/home-screen-pet.tsx` already has the sentence for that case (“quiet hours after habits are underway”) and still draws the empty-night sprite and the footer `asleep`. The sprite keeps the moon and adds the underway mark the report names: the fraction, or one lit pixel. `POSE_FOOT` for this case is not the empty-night word.

**Why this is next.** The pet is on the strip. From 10pm to 6am every incomplete day looks like a blank night. The dialog sentence already knows tonight is underway. The square does not.

**Files.** `lib/home-widgets.ts` (`petPose`). `components/Home/home-screen-pet.tsx` (`POSE_FOOT`, `PetSprite`, the pose line). `lib/home-widgets.test.ts` (today `petPose(40, 3, 23)` expects `asleep`).

**Acceptance.** Hour 23 on 9 Oct, 7 of 28 daily habits met (25%). The pose is the underway night, moon on, and the footer is not the same `asleep` a 0% night uses. Under 20%, and a sheet with total 0, stay asleep at that hour. 28/28 stays pleased. Pose and night only: no habit list, no meridiem change.

### 6. Next — the next thing on the calendar

**Change.** An untimed row on a clear day is not the hit. `pickHomeNext` in `lib/home-widgets.ts` takes today’s events, keeps an all-day event at any hour, then falls through to `todos[0]`. `components/Home/home-next-tile.tsx` builds those todos with `openTodosOnDay` (`lib/item-slices.ts`) and never reads planned actions. Skip a row with no start, including the generated cue `process-inbox-information` (`lib/inbox-process-todo.ts`). After today’s events and planned actions are exhausted, walk forward to the next event or planned action. A planned action comes from `usePlannedActionStore` (`lib/planned-action-store.ts`). The footer for an all-day event stays `All day` plus the date, so it is not a clock and not the list fallback `To Do`.

**Why this is next.** This is the square that should name what you do next. Tonight it would name an automatic inbox cue with no start and no end. The calendar’s next mark is ten days away, and the square will not say so until that morning. The tile stays in `hidden`.

**Files.** `lib/home-widgets.ts` (`pickHomeNext`, `HomeNextEvent`). `components/Home/home-next-tile.tsx` (pass planned actions; keep the dialog a lead, a When well, and one key). `lib/home-widgets.test.ts` (the “next event, then an open to-do” test). `lib/inbox-process-todo.ts` only as the id to skip.

**Acceptance.** Widget day 9 Oct, 11:09 PM. No events and no planned actions that day. The face is not `process inbox information` / `To Do`. The hit is `elijah leaves for tour`, 19 Oct, all day. Thanksgiving, 26 Nov, 09:00–10:00, stays behind the tour. The only planned action, 21 Sep 20:15–20:45, does not win. The home cursor stays 24 Sep. `next` stays hidden.

### 7. Night well — the last real night

**Change.** When this morning and the morning before are blank, the face names the latest earlier morning that is an all-nighter or has a duration. `pickHomeNight` in `lib/home-glances.ts` returns today, otherwise only `previousDateKey` one step back, otherwise nothing — so Oct 9 looks at Oct 8, finds neither, and `nightWellFace` paints `—` / `No night logged`. Walk back through `useSleepStore` nights (`lib/sleep-store.ts`) to the last real row. The footer includes that morning’s date. An all-nighter keeps its sunset: `NightWellTile` in `components/Home/home-glance-tiles.tsx` already calls `computeDaySun` on `previousDateKey(night.date)` and then `nightWellFace` returns before the sunset phrase. The dialog also shows the last duration when that morning is a different row from the last mark.

**Why this is next.** Last sleep is the other half of the clock. Two blank mornings erase both the all-nighter and the last duration, and the glass says nothing was logged. The tile stays in `hidden`.

**Files.** `lib/home-glances.ts` (`pickHomeNight`, `nightWellFace`). `components/Home/home-glance-tiles.tsx` (`NightWellTile`). `lib/sleep-log.ts` (`previousDateKey`, `sleepMinutes`). `lib/home-glances.test.ts`.

**Acceptance.** On the evening of 9 Oct the face is not `—` / `No night logged`. The last record is the 6 Oct all-nighter, and the footer names 6 Oct (and the 5 Oct sunset, 6:29 PM) so the mark is not “last night”. The dialog also shows 4 Oct as the last duration: `5h 59m`, asleep 4:11 AM, woke 10:10 AM, 9h 39m after the 3 Oct sunset at 6:32 PM. `night` stays hidden.

### 8. Plan and lived — forward plan against waking paint

**Change.** The word is forward scheduled minutes against waking paint, with echoed done-rows and sleep minutes left out of those two numbers. `plannedMinutesForDay` in `components/Home/Plan/plan-capacity.ts` adds `estimatedDuration` for every non-inbox task with a `scheduledDate` that day (`scheduledDateCountsOnPlan` in `lib/item-utils.ts`). Completed rows count. Pen-action rows are written by `lib/pen-action-sync.ts` with id `pen-action-…` from `penActionLogId` in `lib/pen-action-format.ts`, and the same function sets `scheduledDate`, `estimatedDuration`, and `actualDuration` to the block. The habit row is written by `lib/habit-done-log.ts`, which copies a tracked window onto `estimatedDuration` and `actualDuration` (`derived.window.kind === "tracked"`). Leave `plannedMinutesForDay` as the Plan sidebar total. The cut for this word lives beside `planAndLivedFace` in `lib/home-glances.ts`, and `PlanAndLivedTile` in `components/Home/home-reading-tiles.tsx` passes that cut in.

Lived: `livedPaintMinutes` calls `isSleepBlock` (`lib/time-entries.ts`) with no sleep-pen set. `isSleepBlock` sees `generatedBy.kind === "sleep"` or `tagIds` containing `tag-sleep`. Tonight’s Sleep block is pen `act-sleep` (catalog tag `tag-sleep` in `lib/time-tracking-store.ts`), with empty `tagIds` and no `generatedBy`. Dropping that activity entry is not enough: Location still covers the minutes, and `uniqueMinutes` keeps them. Remove the sleep minutes from the union.

The dialog shows the amounts left out: echoed minutes, and the sleep that left the union. Zero-length completed habit rows stay at 0. Day-plan and week-plan prose stay out of the minute math.

**Why this is next.** The word is the end-of-day verdict, and Close is a match between two piles that are not a plan and a day. You meet it when you ask whether the paint followed the plan. The tile stays in `hidden`.

**Files.** `lib/home-glances.ts` (`livedPaintMinutes`, `planAndLivedFace`). `components/Home/home-reading-tiles.tsx` (`PlanAndLivedTile`). `lib/time-entries.ts` (`isSleepBlock`, `uniqueMinutes`). `lib/pen-action-format.ts` and `lib/habit-done-log.ts` as the two echo writers to recognize. `lib/home-widgets.test.ts` (the “skips sleep” case). Do not change the number `planned-tasks-sidebar.tsx` gets from `plannedMinutesForDay`.

**Acceptance.** For 9 Oct the word is not Close and the footer is not `plan 17h 42m · lived 18h 56m`. Plan for the word is the 30 forward minutes (open “process inbox information”, no clock). The 1,032 echoed minutes stay out: five pen-action Computer Work rows (165+40+67+189+55 = 516) plus “Work for 5 hours” holding that 516 again. Lived for the word is 556 (9h 16m), the union after the 580 sleep minutes (9h 40m, 3:00 AM–12:40 PM) leave, even though Home still runs 3:00 AM–9:56 PM. 556 against 30 is Over. Mood (356) and Alone (250) are not the lived number. The five zero-length habit rows add nothing. `paint` stays hidden.

### 9. Days Until — a past date says Since

**Change.** When the target is behind you, the caption and the dialog title follow the count-up. `daysUntilLiveFace` in `lib/home-widgets.ts` already returns footer `Since ${label}` once a date-only target is past midnight, and the CRT is `formatCountdownSpan` of the elapsed time. Empty `time` is local midnight via `daysUntilTargetDate`. **Shipped after this plan:** many marks (`items[]`), explicit countdown / count-up / auto modes, caption from `daysUntilCaption`, optional Plan all-day link — see [`../home-widget-daysuntil.md`](../home-widget-daysuntil.md). The honesty step here (Since caption + midnight note) still applies per mark; the family may stay hidden.

**Why this is last.** The count-up math is already the true span. The remaining lie is the future caption on a date that passed. Nothing else on the strip depends on it tonight, and the square stays in `hidden`.

**Files.** `components/Home/home-days-until.tsx` (caption, dialog title, one midnight sentence). `lib/home-widgets.ts` (`daysUntilLiveFace`, `daysUntilTargetDate`) — read them; the face function already counts up.

**Acceptance.** Record “Elijah Comes Home”, date `2026-09-28`, time empty, format `unit`. At the 23:07 read the CRT is `11 days 23 hours` and the footer is `Since Elijah Comes Home`. The caption and the dialog title say Since. The dialog says the count starts at local midnight. The next change is midnight, to `12 days 0 hours`. `daysuntil` stays hidden. The catalog card stays the stock example.

## Shared seams

Do not add a sun-phase helper. Solar and Night both resolve the pin the same way — weather latitude and longitude, otherwise `sunPlaceForCity` of Settings `homeCity`, otherwise `SAN_DIEGO_COORDS` — and both call `computeDaySun`. Solar needs tomorrow’s sunrise (10 Oct, 6:50 AM). Night needs the sunset of the evening before the logged morning (`previousDateKey`: 3 Oct 6:32 PM for the 4 Oct night, 5 Oct 6:29 PM for the 6 Oct all-nighter). Those are two dates. Weather’s own sunrise and sunset (6:48 AM / 6:22 PM on 9 Oct) stay on the weather instrument.

Do not add an “age since last stamp” helper. Tracking’s age is `loggedAt` on `trackingScopeStatuses` (9:55 PM, 74 minutes before 11:09). Days Until counts from a target midnight with `daysUntilRemainingMs`. Night’s gap is a walk across mornings in `pickHomeNight`.

## Leave for later

These are in the reports. They are not the true-next-fact steps above.

- Solar: daylight arc, city nameplate, phase lamp, a Since well for elapsed time after sunset.
- Moon: log camera at the saved 1,000 km, moonrise, one chart clock for the photograph and the Earth–Moon card, light-time, libration, hiding the This sky checklist.
- Weather: archive `end_date` past the archive window and the year-ago “typical” body, a kept last-good reading, the 11pm chip, beach and tide, one facts bay, opening a week cell.
- Pet: a date plate for 9 Oct versus the pinned 24 Sep, the logged miss versus the twenty blank habits, `11:14p` on the clock.
- Next: the rest-of-day rail, and the key pinning the home cursor to the hit’s day (Open To Do currently lands on 24 Sep).
- Night: four single-word wells, a week of mornings, the 8h target, the 17 Sep `nightProblem` line, estimated marks, a Morning Review key.
- Plan and lived: day-plan and week-plan lines as prose, the est. chip, the ratio next to the fifth-either-way sentence, the gold pip following the word.
- Days Until: a previous-mark line that keeps 28 Sep when a new target is set (multi-mark tiles already ship), the minutes under the hour, a passed lamp, opening 28 Sep on the home calendar.
- Tracking: Update that sends only a changed lane and offers this minute versus the open stretch, today’s sequence with holes, the mood reading, a minute tick, the lamp following Now versus Last.

## Do not

- Do not take `night`, `daysuntil`, `next`, or `paint` out of `hidden`. Showing a tile is not this work.
- Do not restyle overview type, CRT sizes, or overview font CSS.
- Do not edit the research reports or `docs/widget-improvement/README.md`.
- Do not seed faces from `data/shared-persist.json`. That file still has Portland, Follow the clock off, a thinner sleep store, and an empty Elijah date.
- Do not invent a city, a date, a moonrise, or a log camera. (Multiple Days Until marks are intentional product work outside this honesty pass — see [`../home-widget-daysuntil.md`](../home-widget-daysuntil.md).)
- Do not paint the 73 open tracking minutes as part of showing their age.
- Do not change the Plan sidebar by folding the echo cut into `plannedMinutesForDay`.
