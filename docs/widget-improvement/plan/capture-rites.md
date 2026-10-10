# Capture and rites

Rituals, Inbox mill, and Affirmation. Live vault, Friday 9 Oct 2026, Follow the clock on. Inbox mill and Affirmation are hidden in `brain2-home-widgets` v9. This plan makes the faces true for when they are on. Turning them on is a separate choice.

## What is wrong together

Each square names a small fresh thing and hides the object that is actually open.

The Rituals CRT is **10**, and the footer is `Friday, October 9`. Two of those ten are that Friday: morning, unfinished at the bed question since 1:09p (`resumeStep: "bed"`, `completed: false`, saved 2026-10-09T20:09:23Z, no bed or wake time), and tonight’s night, which has no end body. One is Thursday 8 Oct, which has no review. The other seven have never been stored: week review `2026-09-28_2026-10-04`, October start, September review, 2026 Q4 start, 2026 Q3 review, 2026 start, 2025 review. The current week start (`2026-10-05_2026-10-11`, `start.completed: true`) is already excluded, so 10 is the rest of the catalog. Tile Open, every detail-row Open, and `handleStartReview` all end on the header Rituals button. `data-rituals-entry` and `data-home-review-entry` are that one control. The morning walk never opens.

The Inbox mill, if it were on the strip, would read CRT **169** and footer **Case of fuji apple redbull wanted** (Thu 9 Oct, 4:01p, about 7 hours before the 11:11p stamp). The pile’s middle is older: 135 of the 169 are bare, the oldest open revisit is Wed 24 Sep (about 16 days), and 69 sit past the process-inbox line of 100. The handheld is those 169 titles and an Open Inbox key under the scroll. It has no count, no bare count, and no oldest age. The Inbox dialog already does the work.

The Affirmation tile, if it were on, would show the real sentence for 9 Oct and then fail to say which one it is. Follow the clock hashes `2026-10-09` over the 57 active lines of list Affirmations (63 members, 6 completed, none of the 57 are the 8 built-ins). The index is 8, the 9th line: “I have been given endless talents which I begin to utilize today.” The footer is the word `today`. The handheld repeats that sentence and stops. Morning for 9 Oct never reached affirmations, so nothing was saved as spoken. The tile does not need a ritual to show the line.

## Do these, in order

### 1. Make Friday’s Rituals numeral 2

**Change.** The square’s CRT counts the open day slots for the clock day: today’s morning and today’s night. The footer names that next slot and its state: Morning, in progress, bed. Thursday’s missing night and the seven empty week, month, quarter, and year slots stay in the catalog and stay off this numeral.

`countAvailableRituals` keeps meaning “every undone slot,” which is what the header Rituals badge and the BIM board already show. Add a day count beside it and point the square at that. `listAvailableRituals` stays the full list so the header menu does not lose the seven first-run slots.

**Why.** The footer is the first slot’s period title, `Friday, October 9`, while the CRT is `listAvailableRituals` plus an empty Star Lord list. That sentence says Friday owes 10 rites. Friday owes the morning already in progress and tonight’s night.

**Files.** `lib/rituals.ts` (`listRitualSlots`, `listAvailableRituals`, `countAvailableRituals`). `components/Home/home-review-banner.tsx` (the CRT is `pendingCount`; the footer is `first.periodTitle`). `lib/rituals.test.ts`. `components/Home/home-review-banner.test.tsx`. Catalog sentence for `review` in `lib/home-widgets.ts`. `components/Home/README.md` (the banner line that says the CRT is the due count and the footer is the period).

**Acceptance.** With Follow the clock on and the clock on Friday 9 Oct, the CRT reads 2. The two are today’s morning (still `bed`, no bed time, no wake time) and today’s night (no end body). The CRT does not include Thursday 8 Oct, the week review `2026-09-28_2026-10-04`, October start, September review, 2026 Q4 start, 2026 Q3 review, 2026 start, or 2025 review. The done week start `2026-10-05_2026-10-11` stays out, as it does now. The footer reads Morning, in progress, at bed, and does not use `Friday, October 9` as the name of the 10. The header Rituals badge can still read 10. Star Lord still adds 0 (birthday blank, no `brain2-star-lord-store`).

### 2. Make Open open that morning

**Change.** Tile Open and the Morning row’s Open mount `MorningReviewDialog` for `2026-10-09` and close the handheld. Night opens `ReviewDialog` for that day key. A longer start opens `StartRitualDialog`. A longer review opens `ReviewDialog` for that period key. `handleStartReview` takes the slot kind, period, and period key and renders those existing dialogs. It stops discarding the arguments and stops clicking `[data-home-review-entry]`. `openFirst` and the row buttons stop returning early on `[data-rituals-entry]`.

The desktop morning dialog already opens on Fell asleep. That is the bed question this morning is stuck on. Do not add a step machine to jump `resumeStep`.

**Why.** Both Open paths only reveal the Rituals menu. The walk that has been open since 1:09p stays behind that menu.

**Files.** `components/Home/home-review-banner.tsx` (`openFirst`, and the row Open that special-cases `day-morning` and period start). `components/Home/home-dashboard.tsx` (`handleStartReview`). `components/Reviews/reviews.tsx` (the `active` switch that already mounts `MorningReviewDialog`, `ReviewDialog`, and `StartRitualDialog` — share that switch, do not copy the forms). `components/Reviews/MorningReview.tsx` (leave the form). `components/Home/home-review-banner.test.tsx`. `components/Home/home-overview.test.tsx` (it expects `onStartReview`). `components/Home/README.md`. `components/Reviews/README.md` if it still says the tile only points at the header.

**Acceptance.** Tile Open opens Morning review for Friday 9 Oct. Fell asleep and Wake time are empty. The header Rituals menu does not open. The Morning row’s Open does the same and closes the handheld. The Night row’s Open opens the night review for `2026-10-09`, not the menu. Dismiss still hides the square until the next session and still writes nothing.

### 3. Show what the old 10 was

**Change.** The Rituals handheld leads with three wells: Next `Morning`, State `in progress`, Due `2`. Under that, one line for the catalog this device actually has: `1 in progress · 9 not started · 0 Star Lord`. Group the rows the slots already have, each row status and resume:

- **Today** — Morning, in progress, bed. Night, not yet.
- **Last night** — Thursday, October 8, not yet.
- **Longer** — the seven empty slots, each `Start` or `Review` plus the period title the code already builds (`Week of Sep 28`, `October 2026`, `September 2026`, `Quarter 2026 Q4 (Winter)`, `Quarter 2026 Q3 (Fall)`, `2026`, `2025`). They read as first-run slots.
- One dim row so the done week is visible: `Week of Oct 5 · start done`.

Drop `app Header → Rituals → …` and `text gm` / `text gn` / `text review week` from the rows. Row Open is the same door as step 2.

**Why.** After the CRT says 2, the handheld is the place that still has to add up to the old 10: 2 today, Thursday’s night, and seven empty longer slots. The operator paths on the LCD are how Open got confused with the menu.

**Files.** `components/Home/home-review-banner.tsx` (the `HomeWidgetDialog` body). `components/Home/home-widget-dialog.tsx` (`WidgetWell`, `WidgetWells` — use them, do not restyle them). `components/Home/README.md`.

**Acceptance.** On this vault the wells read Morning, in progress, and 2. The tally reads 1 in progress, 9 not started, 0 Star Lord. Today shows the bed morning and tonight’s night. Last night shows Thursday 8 Oct. Longer shows those seven names and no stored row. Week of Oct 5 shows start done and is outside the 2. No row shows a telegram verb or a header path. Opening Morning from a row lands on the empty Fell asleep clock.

### 4. Tell the Inbox face how old the pile is

**Change.** Keep CRT `169`. Keep the newest title in the footer, and add the oldest age on that footer: `16d`. `inboxMillFace` today takes titles only and returns the first one. Give it the ages (or the tasks) so the footer can say both. Empty stays CRT `0`, footer `Inbox clear`.

**Why.** Newest-first is the right order for the Inbox workbench. As the only footer, `Case of fuji apple redbull wanted` reads as if the mill were a 7-hour pile. The oldest open revisit is 24 Sep.

**Files.** `lib/home-glances.ts` (`inboxMillFace`). `components/Home/home-glance-tiles.tsx` (`InboxMillTile`, which already reads `revisitInboxTasks`). `lib/item-slices.ts` (reuse `revisitInboxTasks`; do not add a second inbox query). `lib/home-glances.test.ts`. Catalog `shows` for `inbox` in `lib/home-widgets.ts`. `components/Home/README.md`.

**Acceptance.** Rendered against this vault, the CRT is 169. The footer contains `Case of fuji apple redbull wanted` and `16d`. The 5 monkey-brain rows and the 5 completed rows still staged `inbox` stay out, as they do now. A count of 4 and a count of 169 use the same CRT treatment. The hidden flag in the layout is untouched, so this is checked by rendering the tile, not by finding it on the live strip.

### 5. Put count, bare, and oldest on the Inbox handheld

**Change.** The handheld body is three wells: Waiting **169**, bare **135**, oldest **16d**. Bare uses `isBareInboxCapture`. Oldest is the oldest `createdAt` among `revisitInboxTasks`, labeled in days. The existing **Open Inbox** key sits with the wells and still closes the handheld and clicks `[data-inbox-entry]`. The 169 titles are not rendered.

**Why.** The square exists to show the pressure. Four fifths of this pile are bare names, and the tail is 16 days. The Inbox dialog already groups by day, marks age, and clarifies. The mill should hand off to it with the three facts, not become a second list.

**Files.** `components/Home/home-glance-tiles.tsx` (`InboxMillTile` dialog). `lib/inbox-batch.ts` (`isBareInboxCapture`). `components/Home/home-widget-dialog.tsx` (`WidgetWell`, `WidgetWells`). `components/Home/README.md`.

**Acceptance.** On this vault the wells read 169, 135, and 16d (24 Sep). Open Inbox opens the existing Inbox. The dialog does not list the capture titles. Dated (9) and listed (25) stay out of this pass; they already split the 169 with the 135 bare and do not overlap.

### 6. Show the Affirmation line and its place

**Change.** `pickDailyAffirmation` already returns the sentence for `hash(dateKey) % pool.length`. Also return the 1-based place and the pool length. When the tile is on, the CRT stays that sentence. The footer becomes the place, `9 of 57`, for the date key that was hashed. The handheld keeps the sentence as the lead and adds the place and the date key (`2026-10-09` while Follow the clock is on). The pool stays `affirmationLinesForHome`: active lines on the Affirmations list, in store order.

**Why.** The sentence is already the right one. The footer word `today` does not say which of the 57 it is, and it would still say `today` if the clock switch were off and the key were `2026-09-24` (index 49, “I will win a Nobel Prize”). The handheld currently repeats the CRT and stops.

**Files.** `lib/home-widgets.ts` (`pickDailyAffirmation`, `affirmationLinesForHome`, the `affirmation` catalog footer). `lib/affirmations.ts` (reuse `getAffirmationItems`; do not change the morning ritual’s random five). `components/Home/home-overview.tsx` (`AffirmationTile`). `lib/home-widgets.test.ts`. `components/Home/README.md` (the affirmation row).

**Acceptance.** With the tile mounted, Follow the clock on, and the clock on 9 Oct, the CRT is “I have been given endless talents which I begin to utilize today.” The footer and the handheld both read 9 of 57 and `2026-10-09`. The pool is the 57 active lines; the 6 completed lines stay out. The 9 Oct morning review is still `resumeStep: "bed"` with no `affirmations` field, and the tile still shows this line. The hidden flag is untouched.

## Leave for later

- The four partials the window already dropped: 26 Sep morning (`todo-priorities`), 27 Sep morning (`todo-required`), 4 Oct night (`endCompleted: false`), 5 Oct night (time reflection, 1 resolved, 2 pushed). They are in the store and off the square.
- Home’s pinned day is `2026-09-24` (`brain2-home-date-follows-today` is `0`) while this strip follows the clock. Leave Habits, Plan, and To Do on that day.
- Star Lord. Birthday is blank, so the birthday rite cannot open. No report exists, including for the full moon on 26 Sep. The next new moon is Saturday 10 Oct 2026, 8:51a local. Say so when that line is built. Do not add it to Friday’s 2.
- A clear day staying in the strip at CRT 0. Tonight the day count is 2, so the square stays for this pass. `return null` on a real zero can wait.
- Inbox day plates, two-line clamps, opening one capture from a row, a Bare slice key, a dated well, and a line that this pile is 69 over `PROCESS_INBOX_LIMIT` (the to-do `process inbox information` already exists for 9 Oct). The five excluded monkey-brain rows can stay a header-tooltip fact.
- Pinning the affirmation index for a date, a fold of the 57, a key that opens the list item, a spoken / not-spoken well, and a mark when the face is the 8 built-in lines. Completing a line above index 8 still moves `hash % length` until a pin exists.
- Amber versus green on the Rituals pip, and any other lamp state.

## Do not

- Unhide Inbox mill or Affirmation. Do not change `DEFAULT_HOME_WIDGET_HIDDEN` or the live v9 `hidden` list. The checks above mount the tile; they do not put it on the strip.
- Restyle overview type. Leave `.home-affirmation-line`, CRT padding, footer size, the Rituals key padding, and the Inbox CRT weight alone. A count over 100 stays the same green integer as a count of 4.
- Turn the Inbox handheld into a second inbox: no day groups, no clarify, no file, no bare mode, no dump of the 169 titles.
- Add a ritual engine, a resume stepper, or a morning-affirmation walker for these tiles. Morning review, Start ritual, and Review ritual stay the dialogs they are.
- Edit `docs/widget-improvement/README.md` or the research reports (`home-widget-review.md`, `home-widget-inbox.md`, `home-widget-affirmation.md`).
- Move the Rituals square onto the pinned Home day `2026-09-24`.
- Count the done week start, or treat the seven empty longer slots as missed mornings.
