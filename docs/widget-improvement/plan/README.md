# Widget improvement plan

One ordered plan to make every registered widget tell the truth about this device's live vault, without unhiding tiles the user hid and without a visual redesign. Overview type is already moving to Karla (plates 13px, footers 11px, CRT values 20px); do not schedule that again.

The vault is the Electron localStorage at `http://localhost:3000` on Friday 9 Oct 2026, Pacific, San Diego pin 32.71571, −117.16472. Follow the clock is on, so the widget day is `2026-10-09`. The Home cursor stays pinned to `2026-09-24`. `data/shared-persist.json` is not the vault.

Each step says what changes, which section file has the detail, and the acceptance check. Do the steps in order. When a check needs a tucked tile, Add it from Widgets, look, Hide it, and confirm. Leave the strip as you found it.

## Order

The shared today reading comes before Points, Harvest leftover, Today's Progress, Latest award, Day lamp, and Already flowing. On-strip and on-desk lies come next, most useful first. Hidden tiles come after that, still hidden. Shared chrome that every tile needs — one name, a word-sized well label, phosphor that stays green, a zero that stays on the strip, the day in the dialog caption, a full-width odd well — comes after the data, so the numbers are not waiting on polish, and before any further per-tile caption, well, or color edit. The Open function is the exception that moves up: Rituals and Inbox mill call it, so it lands immediately before those keys.

1. **One today reading.** Extend `homeDayStatsOf` / `useHomeDayStats` with the habit piles (done, miss, blank), the to-do count, the points split, and unpaid habit points, and make Points, Harvest, and Award call those helpers. Latest award takes the same `currentDate` the other tiles already get. Detail in [day-score.md](day-score.md) step 1. Worked when this Friday returns 7 done, 1 miss (`wake up before 9`), 20 blank of 28; to-dos 11/12; points 350 habit + 55 bonus + 59 other = 464; unpaid habit points 1,050 of a 1,400 ceiling.

2. **Points and Harvest leftover use the habit pool.** The today meter and the Harvest CRT stop treating the open to-do `rewardValue` (1) as the day's remainder. Points keeps CRT 464, names the split in the footer (350 habits, 55 bonuses, 59 other), and fills the meter 350/1,400 (25%). Harvest shows CRT `1050` and footer `1050 left of 1400`, with wells for 350 paid and 1,050 unpaid. Detail in [day-score.md](day-score.md) step 2. The footer is no longer `+1 possible`, and the meter is no longer about 99.8%. Harvest stays hidden.

3. **Today's Progress and the pet's habit count show the three piles.** The habit line is 7 done, 1 miss, 20 blank. Keep the to-do line (1 left, 11/12) and the footer `To do 11/12 · habits 7/28`. The miss `wake up before 9` is its own row; the 20 blanks stay a separate fold. The pet's Habits well shows the same piles beside 7/28. Detail in [day-score.md](day-score.md) step 3. Pose, sprite, and the asleep footer stay for step 11.

4. **Latest award prefers this day's +50.** On `2026-10-09`, a bonus row or a `habit-day:` row wins over a later inbox handle, larger points first, task id as the tie-break. The CRT is `+50` and the footer is the weekly grade lift (`Higher habit grades than last week`). The dialog leads with 350 habit, 50 grade lift, 5 prior-30-day beat, 59 other, sum 464. Detail in [day-score.md](day-score.md) step 4. An inbox +1 written after the grade-lift +50 still yields the +50, and the hub and the desktop agree.

5. **Day lamp follows the lower bar.** When both bars exist, the word uses the lower percent. The bands stay. Detail in [day-score.md](day-score.md) step 5. Habit 25% and to-do 92% stay Warm, and 25% and 100% stay Warm. The old check that expected Bright for habit 80 and to-do 50 becomes Warm. The detail includes the piles: 7 done, 1 miss, 20 blank.

6. **Already flowing ignores generated Done rows.** `flowingCounts` skips ids prefixed `habit-done-` and `pen-action-`. Detail in [day-score.md](day-score.md) step 6. This Friday the word is Flowing and the footer is `7 already · 0 new`. The tile stays hidden.

7. **Tracking now says when the lanes were last true.** The foot and the dialog lead show the last stamp and how long the grid has been open since then. The newest activity instant sits beside the last interval. Detail in [clock-sky.md](clock-sky.md) step 1. At 11:09 PM the four lanes still name Computer Work, Home, the mood sentence, and Alone, last named at 9:55 PM. The foot shows that clock and the 74 minutes before the sample (73 unpainted from 9:56 PM). The activity row also shows the Text log at 10:41 PM. Nothing writes 9:56 PM–11:09 PM.

8. **Weather names the change still ahead.** After the day's warm peak, the footer and the detail story name the next change in the same fetch. Detail in [clock-sky.md](clock-sky.md) step 2. At hour 23 the CRT stays 69°. The footer names Saturday 10 Oct, code 51, 44% rain, and Sunday 11 Oct, code 65, 96% rain, high 68.7°. It does not say the day warms to 81° by 3p.

9. **Solar remainder counts forward to sunrise.** After sunset the CRT is the time until tomorrow's sunrise and the footer is that clock. Detail in [clock-sky.md](clock-sky.md) step 3. At 11:10 PM, today is sunrise 6:49 AM / sunset 6:24 PM and tomorrow 10 Oct is sunrise 6:50 AM. The CRT is `7h 40m` and the footer is `6:50 AM`. The clock is a fresh `computeDaySun`, not the weather payload's 6:48 AM / 6:22 PM.

10. **Moon uses one phase.** The eight-phase name uses the same local day as the footer countdown. Detail in [clock-sky.md](clock-sky.md) step 4. At 11:07 PM on 9 Oct the name is Waning crescent, the footer is `1 day until new moon`, and the next major phase is New Moon on 10 Oct 2026 at 8:51 AM. On the local day of 10 Oct the name is New moon and the footer is `New moon today`. The disk stays the dark cycle-0.986 face on the evening of the 9th.

11. **Screen pet: night, and the sheet is underway.** Night plus at least 20% and short of done is its own pose. The sprite keeps the moon and adds the underway mark. Detail in [clock-sky.md](clock-sky.md) step 5. Hour 23 on 9 Oct, 7 of 28 (25%), the footer is the underway-night word. Under 20%, and a sheet with total 0, stay asleep. 28/28 stays pleased. This step does not redo the habit piles from step 3.

12. **Rituals counts Friday's two open slots.** The CRT counts today's morning and today's night. The footer names the next slot and its state. The header badge can still read 10. Detail in [capture-rites.md](capture-rites.md) step 1. With the clock on 9 Oct the CRT is 2: morning still at bed (no bed time, no wake time) and tonight's night (no end body). The footer reads Morning, in progress, at bed. Thursday 8 Oct and the seven empty longer slots stay off this numeral.

13. **Open calls a function.** `.home-tile-open`, `.home-weather-open`, and the overview review key use `cursor: pointer`. Rituals and Inbox stop using `document.querySelector` on the header buttons. Register the review `setActive` and the inbox `setOpen` where Home can call them, and have the header controls call the same functions. Detail in [shared-chrome.md](shared-chrome.md) step 4. The square still opens the handheld. The key labeled Open runs the opener. Steps 14 and 27 use this function.

14. **Rituals Open opens that morning.** Tile Open and the Morning row's Open mount Morning review for `2026-10-09` and close the handheld. Night opens the night review for that day key. Detail in [capture-rites.md](capture-rites.md) step 2. Fell asleep and Wake time are empty. The header Rituals menu does not open. Dismiss still hides the square until the next session and still writes nothing.

15. **The Rituals handheld shows what the old 10 was.** Three wells: Next `Morning`, State `in progress`, Due `2`. Under that, `1 in progress · 9 not started · 0 Star Lord`, then Today, Last night (Thursday 8 Oct), the seven empty longer slots, and a dim `Week of Oct 5 · start done`. Detail in [capture-rites.md](capture-rites.md) step 3. No row shows a telegram verb or a header path. Opening Morning from a row lands on the empty Fell asleep clock.

16. **The reading list card shows a book name, author, and genre.** Each of the five picks is `itemTitle`, then Author and Genre when filled. Under the five: `Reading List · 5 of 1,024`. Detail in [modules.md](modules.md) step 1. On `mod-1781860762205`, five titles, author and genre where set (1,022 and 1,020), no badge row. **Surprise me (5)** redraws five open books. The points card and the random card sit in a row whose height is five names.

17. **One of those five opens on the same card.** The title opens one book on the card: name, author, genre, and Brief Description. **Open item** still calls `onTaskSelect`. **Back** returns to the same five. Detail in [modules.md](modules.md) step 2. The Modules tab stays up.

18. **The gear tells the three Reading Lists apart.** Each list option is the name, the member count, and the latest member touch. Detail in [modules.md](modules.md) step 3. The three rows read Reading List · 1,024 · touched Sep 24, Reading List · 82 · touched Sep 8, and Reading List · 8 · touched Jul 23. Cancel leaves the card on `1781860357899`.

19. **Points this week opens onto the seven days.** The total is `3,472.45`. Under it: Mon 1,079.75, Tue 1,095.7, Wed 398, Thu 435, Fri 464, Saturday and Sunday empty. The caption names 147 rows, Monday 5 Oct through Friday 9 Oct, two days still ahead, last week 1,295, and Monday's extra 2 points from two task-and-day pairs stored twice. Detail in [modules.md](modules.md) step 4. The title stays "Points this week". The same grouped format applies to any stat value this component paints.

20. **What should I do now draws from this month.** The default draw is open items on the bound list whose `scheduledMonth` is `2026-10` and whose status is not `missed`. The census line reads `to do · 18 this month · 80 open`. A control can widen to the 79 open items that are not missed. Detail in [modules.md](modules.md) step 5. **Another** does not repeat the current item until those 18 have each appeared. Save for this card stays disabled until a list is chosen. The binding stays `mod-random` on list `1781214482554`.

21. **The pick line and Mark done match the item in hand.** Omit the duration and importance line when either field is missing, and when the pair is the repeated 1 minute and importance 3. Show it for any other pair. **Mark done** calls `requestTaskCompletion`, leaves the name up until Save, and appears only when `resolveDetailView` says the item is completable. Detail in [modules.md](modules.md) step 6. A 30-minute pick shows `30m`. A generic `item` has no **Mark done**.

22. **Next names the next thing on the calendar.** Skip a row with no start, including `process-inbox-information`, then walk forward to the next event or planned action. Detail in [clock-sky.md](clock-sky.md) step 6. On 9 Oct at 11:09 PM the hit is `elijah leaves for tour`, 19 Oct, all day. Thanksgiving (26 Nov, 09:00–10:00) stays behind it. The 21 Sep planned action does not win. `next` stays hidden.

23. **Night well names the last real night.** When this morning and the morning before are blank, walk back to the latest earlier all-nighter or duration, and put that morning's date on the footer. Detail in [clock-sky.md](clock-sky.md) step 7. On the evening of 9 Oct the face is the 6 Oct all-nighter, footer naming 6 Oct and the 5 Oct sunset at 6:29 PM. The dialog also shows 4 Oct as the last duration: `5h 59m`, asleep 4:11 AM, woke 10:10 AM. `night` stays hidden.

24. **Plan and lived compares forward plan with waking paint.** Echoed done-rows and sleep minutes stay out of the two numbers the word uses. The Plan sidebar total is unchanged. Detail in [clock-sky.md](clock-sky.md) step 8. For 9 Oct the word is Over: 30 forward minutes against 556 lived minutes (9h 16m) after 580 sleep minutes (9h 40m) leave the union. The 1,032 echoed minutes stay out. `paint` stays hidden.

25. **Days Until says Since once the date has passed.** The caption and the dialog title follow the count-up. The dialog says the empty time is local midnight. Detail in [clock-sky.md](clock-sky.md) step 9. For "Elijah Comes Home" on `2026-09-28`, at the 23:07 read the CRT is `11 days 23 hours` and the footer is `Since Elijah Comes Home`. The next change is midnight, to `12 days 0 hours`. `daysuntil` stays hidden. **Later product work (not this honesty step):** many marks, countdown / count-up / auto, optional Plan all-day — [`../home-widget-daysuntil.md`](../home-widget-daysuntil.md).

26. **Inbox mill says how old the pile is.** Keep CRT 169 and the newest title, and add the oldest age on the footer. Detail in [capture-rites.md](capture-rites.md) step 4. The footer contains `Case of fuji apple redbull wanted` and `16d`. The hidden flag stays, so check by rendering the tile.

27. **The Inbox handheld shows count, bare, and oldest.** Three wells: Waiting 169, bare 135, oldest 16d (24 Sep). **Open Inbox** uses the opener from step 13. The 169 titles are not rendered. Detail in [capture-rites.md](capture-rites.md) step 5. Open Inbox opens the existing Inbox. `inbox` stays hidden.

28. **Affirmation shows the line and its place.** The CRT stays the sentence. The footer is the 1-based place and the pool length for the hashed date key. The handheld keeps the sentence and adds the place and the date key. Detail in [capture-rites.md](capture-rites.md) step 6. On 9 Oct the CRT is "I have been given endless talents which I begin to utilize today." The footer and the handheld read 9 of 57 and `2026-10-09`. The tile stays hidden. The morning review is still at bed, and the line still shows.

29. **One name on the plate, in the dialog, and on the catalog sample.** Identity text uses `HOME_WIDGET_LABEL` for the tile caption, the dialog title, the catalog name, and `preview.caption`. Detail in [shared-chrome.md](shared-chrome.md) step 1. Latest award, Harvest leftover, Already flowing, Plan and lived, Night well, Inbox mill, Rituals, and Tracking now read the same in all three places. Today's Progress and Solar remainder match too. Weather keeps the city on the plate. The screen pet keeps the clock. If a long plate ellipsizes in the 132px bay, tighten letter-spacing on the overview caption only and put the full label in `title`. Leave the 13px size alone.

30. **A well label is a word. The footer stays a sentence.** Days Until, Night well, Solar remainder, and Harvest leftover stop passing `face.footer` into the engraved label. The sentence renders as a note. Tracking's labels are Activity, Location, Mood, and Company. Detail in [shared-chrome.md](shared-chrome.md) step 2. Days Until's label is Until, Since, or Today. Night's label is Hours. Harvest's hero word is Left. `.home-widget-lead` drops its letter-spacing.

31. **The figure you clicked stays green.** A well that repeats the CRT uses `--hab-crt-green`. Remove `tone="nixie"` from Points' four lines, Night's duration, Harvest's opening digit, Solar's remainder, and Days Until's countdown. The day-lamp word and its detail lead stay phosphor for every lamp. The award caption pip is a lit phosphor. Detail in [shared-chrome.md](shared-chrome.md) step 3. Points: the four CRT lines and the four wells are the same green. Warm is one color on the glass and in the dialog.

32. **A Rituals count of zero stays on the strip.** Nothing due renders the shared tile, CRT `0`, and a clear-day footer. Session Dismiss still removes it until the next session. Detail in [shared-chrome.md](shared-chrome.md) step 5. Friday itself stays CRT 2 from step 12. `hidden` is untouched. Days Until stays absent while it is tucked.

33. **The dialog names the day it read.** `HomeWidgetDialog` takes an optional short date and paints it in the caption, on the pixel face, after the title. Every day-scoped tile passes the `currentDate` the square already uses. Latest award and Inbox mill omit it. Solar passes the wall-clock day it computed. Detail in [shared-chrome.md](shared-chrome.md) step 6. Today's Progress and Harvest leftover, with Follow the clock on and the habits sheet on another day, both show the day the numbers used.

34. **An odd well takes the full row.** In `.home-widget-wells`, the last child spans both columns when it is also an odd child. Detail in [shared-chrome.md](shared-chrome.md) step 7. Already flowing: the third well is full width. Points: the four wells still sit in a 2×2.

35. **Rules: a blank cause does not match.** A blank value on `>`, `>=`, `<`, `<=`, and `contains` is unfinished, so `ruleMatches` returns false. **Add Rule** inserts `is set` and no value. Save stays disabled while a numeric op or `contains` has an empty value. Detail in [modules.md](modules.md), Rules. A rule forced through with `op: ">"` and `value: ""` badges nothing. Stop there. No Rules card is on the desk.

36. **List Summary: an empty list is not 0/0.** Unbound still says "Configure a list to summarize." A missing list says the list is missing. A list with no members says "This list is empty." Neither face shows `0/0` or a bar. Save stays disabled until a list is chosen. Detail in [modules.md](modules.md), List Summary. Stop there.

37. **Writing Generator: the sentence survives reload and names its source.** On first show and on **New prompt**, write `{ form, topic, constraint, at }` onto the module and render that record. A task-store update leaves it until **New prompt**. With no list, the card says the topics are the built-in list. Detail in [modules.md](modules.md), Writing Generator. The same sentence is there after reload. Stop there. Do not seed `mod-write`.

## Do not

- Hidden tiles stay hidden. Do not take `harvest`, `flow`, `next`, `night`, `paint`, `daysuntil`, `inbox`, or `affirmation` out of `hidden`, and do not edit `DEFAULT_HOME_WIDGET_HIDDEN` or the live v9 list.
- No second font pass. The Karla ramp already in `home-chrome.css` stays (plates 13px, footers 11px, CRT values 20px).
- No features for module cards that are not on the desk, beyond the smallest honesty fix in steps 35–37. The three saved bindings stay: `mod-1781860762205`, `mod-points`, `mod-random`.
- No redesign of the phosphor/Win95 language. The milled bay, `--hab-crt-green`, and the pixel face on the handheld stay.

## Section index

- [Day score](day-score.md) — one today reading, then Points, Harvest leftover, Today's Progress, the pet's habit count, Latest award, Day lamp, and Already flowing all use it.
- [Clock and sky](clock-sky.md) — Tracking now, Weather, Solar remainder, Moon, and the pet's night pose, then hidden Next, Night well, Plan and lived, and Days Until.
- [Capture and rites](capture-rites.md) — Rituals counts Friday's two open slots and opens that morning; Inbox mill and Affirmation tell the truth while they stay hidden.
- [Module cards](modules.md) — the three cards on the desk (reading list, Points this week, What should I do now?), then the smallest honesty fix for Rules, List Summary, and Writing Generator.
- [Shared chrome](shared-chrome.md) — one name, a word-sized well label, phosphor that stays green, a real Open, a zero that stays visible, the day in the dialog caption, and a full-width odd well.
