# Next

Widget id: `home-widget-next` (catalog id `next`).

The square is the next Plan event still ahead on the widget day, otherwise the first open to-do scheduled that day. `pickHomeNext` in `lib/home-widgets.ts` sorts that day’s events by `startTime`, skips an event whose end has passed only when the widget day is the wall-clock day, and treats an all-day event as still ahead at any hour. The tile in `components/Home/home-next-tile.tsx` then takes `openTodosOnDay`: not hidden, not completed, scheduled or due that day, in store order. The footer is the start time, `All day`, the first list name, or the fallback `To Do`. Planned actions are never read.

## Data source + snapshot

**Source.** Electron localStorage, origin `http://localhost:3000`, LevelDB at `~/Library/Application Support/cogs/Local Storage/leveldb`. Profile key `brain2-data-profile` is absent, so this is the live vault. Demo keys were skipped.

The hub file `data/shared-persist.json` (source `electron`, `updatedAt` `2026-10-10T06:09:31.476Z`) matches `brain2-event-storage` and `brain2-planned-actions` byte for byte. It does not match the live task blob (local 2,125,907 bytes, hub 2,123,605), `brain2-home-widgets`, or `brain2-home-date`. Live localStorage wins. The hub still has Follow the clock off and the home day on 23 Sep 2026.

**Clock.** Friday 9 Oct 2026, 11:09 p.m. local (minute 1389). `brain2-home-widgets` is persist v9, `widgetsFollowClock` true, and `next` is hidden (order index 7). The home cursor in `brain2-home-date` is pinned to **24 Sep 2026** with `brain2-home-date-follows-today` = `0`. Follow the clock sends the strip to 9 Oct. Plan and To Do stay on 24 Sep. `onOpenHomeTab` only calls `setActiveTab`.

**What Next would show if the square were unhidden.**

| Face | Value |
| --- | --- |
| CRT | process inbox information |
| Footer | To Do |
| Detail “When” | To Do |
| Jump | Open To Do |

That row is the generated inbox cue (`id` `process-inbox-information`, `autoPush` true, `lists` empty, urgency 4, importance 4). It was created 6 Oct 2026 and scheduled 9 Oct 2026 (`2026-10-09T07:00:00.000Z`, local 9 Oct). Revisit Inbox holds **170** open ideas; the cue is added above 100. It has no start and no end.

**Why that row wins.**

- **Events** (`brain2-event-storage`): **62** events, **55** all-day and **7** timed, from 9 Jun 2026 through 26 Nov 2026. **Zero** fall on 9 Oct. The previous one is 27 Sep, 18:00–19:00, “Elijah gets home”. The next one is 19 Oct, all day, “elijah leaves for tour” (`00:00`–`23:59`). The only future timed event is Thanksgiving, 26 Nov, 09:00–10:00. Seed events are still stored: “Product Strategy Hike” (11 Jun, 02:00–10:20) and “Kayaking Workshop” (13 Jun, 01:00–03:00). Every stored start time is zero-padded `HH:MM`.
- **Planned actions** (`brain2-planned-actions`): **one** placement, 21 Sep 2026, 20:15–20:45, source `habit`, title “'bedtime' before 11 (with caveats)”. Nothing is planned on 9 Oct.
- **To-dos** (`brain2-task-storage`): **3,267** tasks. **12** are scheduled on 9 Oct; **11** are completed (brush teeth, skincare, dance, and the other finished rows) and this cue is the only open one. The vault has **7** open day-scheduled to-dos in total. The next of those sit on 11 Oct (two) and 12 Oct (one). On the pinned day, 24 Sep, the calendar is the all-day event “SHOW - Denver, CO”, with **9** completed scheduled tasks and **0** open ones.

## a. Biggest problems right now

1. **The hit is an untimed inbox cue, and the calendar gap is silent.** At 11:09 p.m. the day has no event and no planned action left. Next falls through to the only open day to-do, which is the automatic “process inbox information” row. The footer and the “When” well both say `To Do` because `lists` is empty. The next real event is ten days away and all day. Next will not name it until 19 Oct, and it will not name the open to-dos already scheduled on 11 Oct.

2. **Planned actions cannot become Next.** The day agenda lives in `brain2-planned-actions`. The picker only sees `brain2-event-storage` and day to-dos. Tonight the only placement is already over (21 Sep, 20:15–20:45), so it would not replace this hit. The miss is that a later timed block on the agenda still cannot.

3. **Open To Do lands on the wrong day.** Follow the clock makes the square read 9 Oct while the home cursor stays on 24 Sep. The key switches to the To Do tab and leaves that pin. The cue is not scheduled on 24 Sep, and that day has no open scheduled to-do. The Denver show is what a clock-off square would call Next on 24 Sep: the day is not “live”, so an ended all-day event is kept, and events beat to-dos.

4. **All-day events never age out on a live day, and most of the calendar is all-day.** `isAllDay` skips the end check. On 19 Oct the tour event would stay Next through 11 p.m., with footer `All day`, and would hide any open to-do. 55 of 62 events are stored that way (`00:00`–`23:59`). The June seeds and the 9 Jun timed leftover are still in the same list; they do not win tonight only because the square is on 9 Oct.

5. **The square is hidden.** `next` is in the v9 hidden list, so the strip does not show this hit until it is turned back on. The choice above is what the tile computes.

## b. Layout, UI, design, and style

The house instrument is caption, CRT, footer, then a silver dialog of phosphor lead, dark wells, and one key. Next uses that shell and leaves the clock out of it. The style file wants the CRT to be the value, the smallest type to be a readable caption, sibling wells at one height, and a clock that belongs to the instrument. Two dates that disagree are either one cursor or two labeled jobs.

### Overview

The tile is the shared 148×156 square (`--home-tile-w`, `--home-tile-h`) with the green pip `#9dff6a`. Caption “Next”, CRT title clamped to three centered 12px lines, footer in the 40–44px foot. Tonight that is the inbox sentence over the word `To Do`.

The CRT is doing the job of a title, and the foot is doing the job of a list that this row does not have. A start time, when one exists, is the raw `HH:MM` string (the catalog preview is `18:00`), not a clock. An all-day event replaces that with `All day`, so 55 events would show no hour. The pip stays the same green for an event, a to-do, the inbox cue, and an empty day.

`.home-next-open` in `home-chrome.css` is unused. The tile opens through `TileOpen`.

Hide (×, then “Are you sure?”) matches the other squares. That part can stay.

### Detail view

`HomeWidgetDialog` title “Next”. The lead repeats the CRT title at 18px phosphor. One `WidgetWell`, label “When”, nixie tone, shows the same footer. Then one `home-review-key`: “Open To Do” or “Open Plan”.

“When” is a 9px engraved label, which is the right size for a short nameplate, and the value under it is the word `To Do`. Nixie styling is for a time. There is no second well for list, source, or end, even though `WidgetWells` is already a two-column grid. The key is the right kind of control, in the right place (one row at the foot), and it does not carry the day it came from. Nothing in the dialog says 9 Oct, 11:09 p.m., inbox cue, or that the calendar is clear until 19 Oct.

An empty hit is the em dash, footer “Nothing next”, and the well sentence “No event or open to-do on this day.” The key hides. That empty state is honest. Tonight is the worse case: a full-looking instrument whose time well is a list fallback.

## c. New features for the detail view

Keep the handheld: phosphor lead, dark wells, one metal key. No card stack.

1. **Name the gap and the source.** Three wells in the existing grid. **Kind:** Event, Plan block, To do, or Inbox cue (this row exists because revisit Inbox is 170). **When:** start–end as a clock, or a nixie `no clock` when the row has no time, which is tonight. **Until:** the next calendar event after this day — 19 Oct, all day, “elijah leaves for tour” — so a clear evening does not look like the end of the plan. On a past day (24 Sep, Denver), the When well reads **already over** instead of offering the show as Next.

2. **A short rest-of-day rail under the wells.** Still-ahead events, then planned actions for that local day, then open day to-dos. Mark the one the square chose. Tonight the rail is one line, the inbox cue, and the rail’s footnote is the 11 Oct to-dos waiting on later days. A planned action on the day would sit in that rail with its start, end, and source (`free`, `todo`, or `habit`). The 21 Sep bedtime block would stay off it because that day is over.

3. **The key opens the hit on its own day.** “Open To Do” pins the home cursor to 9 Oct and opens `process-inbox-information`, instead of switching tabs onto 24 Sep. “Open Plan” does the same for an event or a planned action. The dialog states the day in the caption so Follow the clock and the pinned day stay two labeled jobs until the key makes them one.
