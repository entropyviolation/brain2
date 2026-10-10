# Inbox mill

Widget id: `home-widget-inbox`

Catalog id `inbox` (`data-widget="inbox"`, test id `home-inbox-tile`). The square is `InboxMillTile` in `components/Home/home-glance-tiles.tsx`. It reads `revisitInboxTasks` (`lib/item-slices.ts`): stage `inbox`, not completed, `monkeyBrain` not true, newest `createdAt` first. `inboxMillFace` (`lib/home-glances.ts`) puts that count in the CRT and the first title in the footer. An empty pile is CRT `0`, footer `Inbox clear`. The click-open handheld lists every title, then an **Open Inbox** key that closes itself and clicks `[data-inbox-entry]`.

## Data source + snapshot

Live vault, Electron localStorage, origin `http://localhost:3000`, key `brain2-task-storage`. Read from `~/Library/Application Support/cogs/Local Storage/leveldb` (WAL record, sequence 78101). Persist stamp `brain2-last-persist-ok` = `2026-10-10T06:11:28.839Z` (Thu Oct 9, 2026, 11:11 PM PDT). No `brain2-data-profile` key, so this is the Live profile.

Layout is `brain2-home-widgets` version 9 in the same LevelDB (table `019564.ldb`; the task write did not touch it). `inbox` is hidden. `widgetsFollowClock` is true. Hidden with it: affirmation, next, daysuntil, night, harvest, flow, paint. The strip that is up is Rituals, Points, Latest award, Today's Progress, Weather, screen pet, Day lamp, Moon, Solar remainder, Tracking now.

Hub `data/shared-persist.json` (`updatedAt` `2026-10-10T06:12:56.381Z`, source `electron`) is a later file and a thinner vault: 3,263 tasks, 194 revisit items, same newest title, and a different hidden set that also tucks `inbox`. Live wins. Counts below are the LevelDB snapshot.

The mill's pile at that stamp:

| | |
|---|---|
| Tasks in the vault | 3,267 (inbox 179, clarified 2,482, completed 349, list 257) |
| Revisit Inbox (the CRT) | **169** |
| Monkey brain, excluded | 5 (newest Oct 7) |
| Completed rows still stage `inbox`, excluded | 5 |
| Newest title | **Case of fuji apple redbull wanted** |
| Newest age | Thu Oct 9, 4:01 PM PDT, about 7 hours before the stamp. 33 characters. |
| Oldest open revisit | Wed Sep 24, 2:29 AM PDT, about 16 days. 114 characters. |
| Median / mean age | 3.8 days / 5.6 days |

Open captures by local day: Sep 24: 2, Sep 25: 5, Sep 26: 9, Sep 27: 22, Sep 28–Oct 3: none, Oct 4: 18, Oct 5: 4, Oct 6: **69**, Oct 7: 28, Oct 8: none, Oct 9: 12.

Age of what is still open: under 1 day 12, 1–3 days 29, 3–7 days 90, 7–14 days 31, 14 days and older 7.

Clutter, same 169:

- **135 bare** (no list, tag, date, note, attribute, link, or subtask; urgency and importance still the default 3; duration still 1). **9 dated. 25 on a list.** Those three split the pile with no overlap. Tags, notes, attributes, links, and subtasks: none.
- Of the 25 with a list, REMINDERS holds 6. Other list names are one-offs, including fragment names (`from`, `mb`). A list chip here is not a clarified idea.
- Title length: median 39 characters, 90th percentile 237, 42 longer than 80, **7 longer than 400**, longest **3,955**.
- One title is stored twice.
- Two meta lines sit in the pile: `Inbox` (5 characters) and `Process inbox`.
- The over-100 cue is already elsewhere. `process inbox information` is a clarified to-do, id `process-inbox-information`, scheduled Oct 9, not completed. The pile is **69 past** the limit of 100 (`PROCESS_INBOX_LIMIT` in `lib/inbox-process-todo.ts`).

## a. Biggest problems right now

The instrument is off while the pile is the problem. Persist v5 tucked Inbox mill, and the live layout still hides it. Home's strip does not show 169. The product cue for "this pile is too big" already fired, as a to-do, and the square that was built to show the pressure is in the Widgets menu.

The face that would show tells the wrong story about this list. CRT `169` plus footer `Case of fuji apple redbull wanted` is a fresh, short line from this afternoon on a pile whose middle is four days old and whose largest day is Oct 6 (69 still open). The oldest open capture is from Sep 24. Newest-first is the right sort for the inbox workbench. As the only footer on the square, it reads as if the mill were current.

The handheld repeats the pile as 169 raw titles and cannot say what the pile is. Four fifths are bare names. Seven titles are essays pasted into the name, up to about 4,000 characters, in a row style with no clamp. The only action, **Open Inbox**, is the last child of that scroll. The real Inbox already groups by day, marks age, splits a trailing parenthetical onto a second line, and can slice All / Dated / Bare. The mill drops all of that, then jumps to Inbox by clicking the header button.

## b. Layout, UI, design, and style

House style for this square is the milled overview tile: caption, CRT, footer, equal height (`docs/DESIGN_STYLE.md`, milled fascia). One green for the CRT value (`#7dffc4`). A 9px nameplate is a short engraved word, not a size for a sentence. The handheld is the silver instrument (`home-widget-dialog.tsx`): caption, power lamp, dark wells, one scroll, a metal key. Settings stay absent, which is right, because this widget has none.

### Overview

The tile matches the strip. Caption **Inbox**, pink power lamp `#ff6a8a` (the same per-tile lamp pattern as the other squares), phosphor count centered on black glass, silver footer. The footer clamps to two lines at 10px (`hab-score-sub`). Hide sits on the rim and asks **Are you sure?** The catalog id is tucked, so none of that is on the live strip.

The live footer happens to fit: 33 characters, one line. The type size is still a hint asked to carry a capture title. A title at the pile's 90th percentile (237 characters) becomes two clipped lines of 10px. The inbox count turns heavy at 10 (`data-heavy` on `.inbox-crt-count`). This CRT stays the same green integer at 169 as it would at 4, so the process-inbox line at 100 never reaches the glass.

Follow the clock is on in this layout and correctly leaves the mill alone. The pile is not a day. The catalog copy already says that.

### Detail view

The dialog is the shared handheld: 34rem, silver gradient, 13px uppercase **Inbox mill**, green power lamp, square metal close key. Empty copy, `Inbox clear.`, is a phosphor lead. That state is not this vault.

With 169 ideas the body is a column of `.home-widget-row` paragraphs (12px, green on `#07140f`, no line clamp, no age, no day plate) and then `.home-review-key` **Open Inbox**. Harvest leftover uses `WidgetWell` / `WidgetWells` for the numbers the square exists to show. Inbox mill never uses them, so the handheld has no count, no bare count, and no oldest age. The rows are not buttons. A 3,955-character title is one paragraph in a dialog whose scroll already holds every other name, and the handoff key sits under that scroll.

**Open Inbox** is a `querySelector` click on the header entry. It depends on that button being in the document. It does not pass the newest id, the oldest id, or the bare slice. Inbox itself would show this same 169 with sticky day plates (`Today · …`, `EEE MMM d`), a clock, and an `Nd` mark after the first day, plus clarify on the row.

## c. New features for the detail view

Keep the mill as pressure and a handoff. The Inbox dialog already clarifies, files, and walks. The handheld should show the shape of these 169 and open the right place in that dialog.

1. **Three wells at the top.** Waiting **169**, bare **135**, oldest **16d** (Sep 24). That is the pile: mostly unnamed, a four-day middle, a 16-day tail, and 69 still open from Oct 6. Nixie or phosphor, same wells Harvest uses. The metal **Open Inbox** key sits with the wells, not under the list.

2. **Day plates and age, in the order the tile already sorts.** Reuse the inbox grouping (local day, clock span, `Nd` after today). Oct 6's 69 becomes a plate. The Sep 24 pair stays visible as the tail instead of as the last two rows of a flat dump.

3. **Clamp every title to two lines, and open the seven long ones in place.** Median title is 39 characters and fits. The seven past 400 characters, one at 3,955, should not paint the whole handheld. Inbox already lifts a trailing parenthetical onto a quieter second line (`inboxTitleLines`). The mill can use that split on the way by.

4. **Row opens that idea in Inbox.** Clicking a row closes the handheld and opens Inbox on that capture (clarify), the way **Open Inbox** already aims at the header. A second key, **Bare (135)**, opens the inbox bare slice. Dated is only 9, so it can be a well, not a mode.

5. **One line for the cue that already exists.** The pile is 69 over 100, and `process inbox information` is already a clarified to-do for today. Say that next to the wells so the handheld and the to-do are the same fact. Leave Monkey brain out of the CRT. A single aside is enough for the 5 excluded there, matching the header tooltip, which already counts revisit first.

On the square itself, once it is shown: keep the newest title, and add the oldest age on the second footer line (`16d in`) so `169` is not only `Case of fuji apple redbull wanted`. Turn the CRT heavy when the count is over 100, the line the to-do cue already uses. The inbox's heavy style at 10 would be on for every day this pile has had.
