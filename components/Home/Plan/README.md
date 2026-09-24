# `components/Home/Plan/` — Plan (Calendar) Panel

The Home **Plan** sub-tab in **Brain2**. A milled fascia calendar (CRT title, Month/Week/Day bay with round power lamps, period nameplate, metal action keys, Explorer rail, status bar) holding Month / Week / Day views, drag-and-drop scheduling, calendar events, and free-text plan areas. The selected day is Home’s shared `useCurrentDate` cursor.

Measure against Lists Icons and [`docs/DESIGN_STYLE.md`](../../../docs/DESIGN_STYLE.md): milled instrument frame, luminous chips, room for one impossible motion. Event *contents* keep the mint / lilac opalescence (glass wash + left stripe, not SaaS pills). Not a second product, and not a Windows dialog kept gray on principle. The rail will show the latest period handoff once GS-6 lands ([`docs/ScienceandSanityBrain2.md`](../../../docs/ScienceandSanityBrain2.md)). Ghosts of the plan stay beside tracked time and are never merged into it.

## Data sources

| Data | Store / persistence |
|------|---------------------|
| Tasks (scheduled) | `lib/task-store.ts` |
| Calendar events | `lib/event-store.ts` |
| Planned actions (day placements) | `lib/planned-action-store.ts` → `brain2-planned-actions` (`cogs-planned-actions` alias). Timed intentions: free click-drag blocks, To Do / Next Action placements, daily-habit plans. Not events; habit drop does not complete. |
| Day / week / month plan text | `lib/plan-text.ts` → localStorage (`dayPlan-*`, `weekPlan-*`, `monthPlan-*`) via the persist hub adapter. Versioned JSON log of immutable entries (`createdAt` + `text`) plus optional unsubmitted `draft`. Month identity is local `YYYY-MM` from `formatLocalMonthKey` (legacy unpadded `YYYY-M` migrates). An empty string on `monthPlan-*` is a tombstone, not a plan — Electron preload / hub hydrate skip it so a typed month log is not wiped on refresh. `brain2-`/`cogs-` prefixes are healed. Week key is Monday–Sunday (`getWeekString`); ISO `YYYY-Www` copies onto that range on read. Target MongoDB `plans` collection |
| Plan dark chrome (optional) | `plan-theme.ts` → localStorage `brain2-plan-dark` (`1`/`0`); default off |
| Gem and trinket mode (optional) | `plan-gem-mode.ts` → localStorage `brain2-plan-gem-mode` (`1`/`0`); default off. Past Month days only. |
| Waking window (capacity line) | `lib/sleep-sync.ts` `awakeWindowFor` (sleep log, else painted Tracking, else typical night) |

Plan text is an **append log** (`lib/append-log.ts`): **Submit plan** stamps the writing time (`9/20 9pm - …`). Unsubmitted composer text is saved on the same period key (`draft`) so a refresh keeps the writing. Past entries cannot be edited. List / Bulk / Latest (shared `appendLogView`) show newest first. Reviews (day/week/month) read the formatted log plus a reflection field.

## Files

| File | Purpose |
|------|---------|
| `plan-panel.tsx` | Milled fascia window (`data-ui-name="Plan"`, help: calendar window + written logs): CRT **Plan** mark + **Calendar** chip, Settings / Paste Events / Add Event / **Add Plan** metal keys, Month/Week/Day view-key bay (active = CRT + round power lamp), optional Dark / Gem latches in `#plan-chrome-toggles` (labels flip with `aria-pressed`: **Dark** → **light mode**, **Gem and trinket** → **no gem no trinket**), status bar. Wires dialogs. **Add Plan** opens `planned-action-dialog` in create mode on the selected day (dashed linen chip, not an event). Default chrome is milled silver (`data-plan-dark="false"`); gem mode default off. Inner desks stamp themselves so Names deepest-wins past this window. |
| `plan-theme.ts` | Plan-only dark latch. Persist `brain2-plan-dark` (`1` / `0`); default off. Does not theme the rest of BRAIN2 or portaled dialogs. |
| `plan-gem-mode.ts` | Gem-and-trinket latch. Persist `brain2-plan-gem-mode` (`1` / `0`); default off. |
| `plan-gem-mode-toggle.tsx` | Toolbar gem latch (`#plan-gem-mode`). Off label **Gem and trinket**; on label **no gem no trinket**. Sits next to Dark; does not rewrite dark CSS. |
| `plan-gem-day.ts` | Maps a local calendar day to habit gems (`resolveTaskGem`) and list orbs (`iconFor`). Daily habits from `weeklyData`; list items from `completedDate`; habit-done logs are not double-counted. |
| `plan-gem-day-body.tsx` | Past-day Month cell body when gem mode is on: event chips stay chips; completed work is clickable gems/orbs (`data-no95` so house bevel does not wrap 16px tokens); incomplete scheduled tasks stay chips. Empty days keep the numbered rectangle (`data-plan-day-body="gems"`). |
| `plan-gem-mode.css` | Compact gem wrap inside existing month cells. Does not change cell size or grid density. Dark latch adds a slight drop-shadow so 16px gems read on near-black cells. |
| `plan-chrome.css` | `.plan95` milled fascia (brushed bay, CRT title mark, Month/Week/Day view-key bay with power lamps, period nameplate + metal prev/next/today, metal action/mode keys, engraved legends) + opalescent `.plan-chip` / `.agenda-block-opal` contents + `.plan95-dialog` for portaled dialogs (navy caption quote, milled action keys). Compact month squares (`.plan-day` ~88px, small chips). Navy field focus, nested milled rail/desktop wells. Day split (`.plan-split-day`) is tall (`max(38rem, 100dvh - 5.5rem)`); `.plan-schedule-well` fills leftover (`min-height: 22rem`) so a long rail does not leave empty gray; Day Plan log is capped (~22%) so the agenda can be bigger. Hour rows are **152px**. Optional `.plan95[data-plan-dark="true"]` (darker mill vs near-black month/week/day paper, sage chips, violet Today / mode latches). Month cells: `data-past` gray, `data-today` inset ring + CRT `today` mark (sage ring in Dark), `data-selected` dotted outline. Shared `.append-log` composer/log chrome (also used by Tracking day notes; `.append-log-views-well` wraps List / Bulk / Latest; `.append-log-history` holds the read-only log so it can scroll apart from the composer). Also imported from `app/layout.tsx` so Fast Refresh cannot drop it. |
| `plan-chip.tsx` | Event/task chips: time range + wrapped title; `+N more` with a tooltip of hidden rows and a tiny orb mark. All-day banners may show the same crystal-ball mark. Default color `#8cd4a5`; presets mint / sage / teal / moss / lilac / violet. |
| `plan-capacity.ts` | Planned minutes vs waking-window minutes; `"11h into a 9h window"` plus a 10-pip FR4 channel (`capacityPipCount`) |
| `plan-text-log.tsx` | Day/Week/Month Plan **append log** wrapper (`components/append-log.tsx`): write, auto-saved `draft` on the period key (saved on each keystroke), **Submit plan** (stamps now), List / Bulk / Latest, copy. Past entries are read-only. Names: **Month Plan** / **Week Plan** / **Day Plan** on the composer root (`data-ui-help` says it is the written log, not the calendar); **Plan log** on List/Latest history; **Plan bulk** on the Bulk textarea. Same period names sit on the view fieldsets (legend + composer) so hovering **Month Plan — September 2026** is not the outer **Plan** window. Docs anchors `#month` / `#week` / `#day`. |
| `month-view.tsx` | Compact milled month grid (`data-ui-name="Month calendar"`) with FR4 hairlines; small chips (`data-plan-day-body="chips"` — not individually named); optional `gemMode` branches **past-of-today** days to `PlanGemDayBody`. Click a cell to open Day view; drag to reschedule; packed planned-tasks rail; Month Plan log cabinet (`periodKey` = `formatLocalMonthKey`). `data-past` uses `isPastLocalCalendarDay` (local today, not the selected/viewed date). Local today sets `data-today` + a CRT `today` mark on the date number (`aria-current="date"`). The Plan cursor day sets `data-selected` (dotted outline), which can combine with today. |
| `week-view.tsx` | Seven-day hourly grid (`data-ui-name="Week calendar"`) with hairlines; elapsed columns set `data-past`; drag tasks/events to time slots; Week Plan log |
| `day-view.tsx` | Single-day hour grid via `AgendaGrid` (`data-ui-name="Day schedule"`; `plan-split-day` is tall; `.plan-schedule-well` fills leftover so a long rail does not leave empty gray; hour rows stay 152px with roomier chips; lands on now / wake); all-day banners; Day Plan log (composer capped so the agenda stays the large surface). Rail drop plans at that time (To Do / Next actions also set `scheduledTime`; habits write a placement only) and opens `planned-action-dialog` on the fresh placement so duration and notes are one gesture away. Click-drag empty minutes creates a planned action; click without drag still opens Add Event. Toolbar **Add Plan** also creates a free planned action for this day. |
| `agenda-grid.tsx` | Shared hour-by-hour grid (Plan day view and Tracking day log). Current-time line plus sunrise/sunset from Settings home location. Plan Day passes `scrollToMinutes`. Drops read `lib/plan-drag.ts` (`text/plain` first, then a live payload; pointer fallback onto `data-plan-drop="hour"`). Planned-action chips use dashed linen (`.agenda-block-planned`), distinct from opal event chips. In **log** mode it overlays painted Tracking blocks (`trackedBlocks`) on plan ghosts. Tracked blocks that span hours render as **one continuous slab** (position + height, title once) so Sleep is not reprinted every hour — still clickable throughout. Plan-mode events still slice per hour. |
| `planned-tasks-sidebar.tsx` | Explorer rail (`data-ui-name="Planned tasks"`) for month / week / day: packed wells (head, 10-pip capacity, search + sort, **To Do / Habits / Next actions** toggles, sunken list, period add). Month = month-planned todos + incomplete monthly habits + Next Actions workable that month. Week = week-planned todos + incomplete weekly habits + Next Actions workable that week. Day = untimed day todos + **undone, non-exempt daily habits** (gem + drag handle) + Next Actions that can be worked that day. Exempt habits stay off this list the same way completed ones do. Habits use `HabitRowGem` / `resolveTaskGem`; To Do and Next actions use the Lists orb/trinket (`iconFor` through `HabitGemImg`) at the same 16px rail cut. Every To Do, Next action, and undone habit row is **draggable** (`lib/plan-drag.ts` + pointer fallback). Double-click any of those rows (click still works on To Do / Next actions) → `TaskDetailPopup` via `onTaskClick`. Drop scheduled chips on the rail to unschedule. Empty stays reserved furniture. Add writes the same records as Home → To Do for that period. |
| `use-plan-rail-drag.ts` | Rail HTML5 `dragstart` plus pointer press+move so a host that never starts native drag still drops onto `[data-plan-drop]`. |
| `planned-action-dialog.tsx` | Create/edit a planned action (`data-ui-name="Planned action"`): title, start, duration, time-block notes. Toolbar **Add Plan** opens create mode (`action` null + `createDate`). Not `event-dialog`. Remove / Cancel / Add or Save. |
| `event-dialog.tsx` | Create/edit `CalendarEvent` (`data-ui-name="Plan event"`: title, times, all-day, multi-day, location, description, **color**). Bounded Win95 window (`.plan95-dialog`, ~30.5rem, navy caption, title-bar × on the right, milled **Cancel** + Create/Update) — not `sm:max-w-2xl` / `w-full` stretch. Dirty close uses the house unsaved-changes guard. Color picker + mint/sage/teal/moss/lilac/violet presets. Default mint `#8cd4a5`. |
| `paste-events-dialog.tsx` | Paste unstructured itinerary text → preview → bulk-create editable events (`lib/parse-event-text.ts`). Same bounded Win95 chrome + dirty guard. |
| `settings-dialog.tsx` | Export/clear plan text and calendar data. Same chrome; dirty when import JSON is staged. |

## Views

### Month
- Clicking a day cell sets the shared `useCurrentDate` cursor and switches Plan to **Day** view. **Add Event** (and Week/Day hour clicks) still create events. **Add Plan** writes a dashed planned-action chip on the selected day (visible here and on Week/Day).
- Days **before the current local calendar date** (`isPastLocalCalendarDay` / `day < startOfLocalToday`) set `data-past` for gray furniture — including other-month lead/trail cells that are already over. The cutoff is wall-clock today, not the selected day and not the month being viewed: selecting the 25th does not darken the 22nd–24th; future days in the open month stay live. Other-month cells still set `data-outside`. Today is never past.
- Local **today** keeps a distinct cell ring plus a CRT phosphor `today` mark on the date number (`data-today`, `aria-current="date"`). The selected/viewed day uses a dotted outline (`data-selected`). Both apply when today is selected. Distinct from Dark’s violet toolbar **Today** button.
- Multi-day all-day events appear on every day in their `[date, endDate]` span (month chips, week all-day row, day banner).
- Chips show a usable time range and wrap the title on a glass/opal wash with a left color stripe. Days with more than three items show `+N more` (tooltip lists the rest; tiny orb mark). Month cells are compact numbered squares (min ~88px, ~5.5rem columns) with small chips — denser Win95 calendar, not tall empty wells. Inner chip list is `data-plan-day-body="chips"`. Optional **Gem and trinket** mode (toolbar latch, default off) replaces that body on **past-of-today days only** with `data-plan-day-body="gems"`: events stay chips; completed daily habits use the photographed habit gem (`resolveTaskGem` / `HabitGemImg`); completed list items use the Lists orb/trinket (`iconFor`); icons open `TaskDetailPopup` (habit-done log id for habits). Today and future days keep chips. Empty past days stay a numbered rectangle. Cell furniture uses engraved FR4 hairlines, not a PCB wallpaper.
- Drag tasks from the rail onto days.
- Month Plan log at bottom: submit-stamped entries, newest first. Names: **Month Plan** (cabinet + composer), **Plan log** / **Plan bulk** inside it, **Month calendar** on the grid.

### Week
- 7-column × 24-hour grid. Past weekday headers and hour cells use the same `data-past` gray as month.
- Drag-drop scheduling with event duration preserved; rail habits/to-dos land as planned actions. Clicking an hour still creates an event.
- Planned-action chips (dashed) show on the hour they start. Click opens the planned-action dialog.
- Week Plan log at bottom: same submit-stamped entries as Day / Month.

### Paste Events
- **Paste Events** opens `paste-events-dialog.tsx`: paste unstructured itinerary / tour text, preview parsed drafts (`lib/parse-event-text.ts`), edit, then bulk-create `CalendarEvent`s (including multi-day all-day spans).

### Day
- Full day schedule with current-time indicator. The Day split (`plan-split-day`) is **tall** (`max(38rem, 100dvh - 5.5rem)`): a long Next actions rail scrolls inside the left pane; the agenda column stays the large surface. `.plan-schedule-well` (not the fieldset) takes leftover height so the agenda *surface* fills the column — no postage-stamp box over empty gray. Hour rows are **152px** with roomier chips, gutters, and rail rows. The Day Plan log is capped (~22%) so it does not eat the agenda. Nested 24h scroll still **lands on now** (today, two hour-rows of context above) or the first waking hour (`firstUnpaintedWakingHour` / `DEFAULT_WAKE_MIN`). Midnight hours stay in the grid. Week/month splits are unchanged.
- Sunrise / sunset lines for the **Settings → Home location** city (default San Diego).
- All-day event banner (opal chip + crystal-ball mark).
- Day Plan log at bottom: composer empty min ~6rem in the Day split (capped so the agenda stays tall), **Submit plan** stamps the writing time, List / Bulk / Latest, copy-only history (newest first). Native WebKit resize `+` is hidden; `resize-y` stays.
- Left rail has **three views**, each toggleable, all sharing the same search + sort:
  - **To Do** — untimed day todos (same records as Home → To Do). Each row shows the Lists orb/trinket (`iconFor`). Drag onto an hour to **plan** that item at that time: restores the old `scheduledDate` + `scheduledTime` write **and** creates a planned-action placement with editable time, duration, and notes. Click or double-click opens `TaskDetailPopup`.
  - **Habits** — **undone, non-exempt habits only** (completed and exempt stay off this list). Each row has a drag handle, the habit gem (`HabitRowGem` / `resolveTaskGem`), and is `draggable`. Double-click opens `TaskDetailPopup` on the same `onTaskClick` path as To Do / Next actions (does not complete the habit; drag-to-plan still works). Drop onto the agenda means “I plan to do this habit then.” Completing still goes through Habits.
  - **Next actions** — searchable Lists Next Actions (`taskIsNextAction`: membership in a Next Actions folder list) that are still open, dependency-available (`isAvailableNow`), and not locked to a **future** slot after this Plan period. Same Lists orb, drag-to-plan, and click/double-click detail path as To Do.
- Drag-create on empty agenda minutes writes a **planned action** (dashed linen chip), not a calendar event. Toolbar **Add Plan** does the same via a dialog (title, start, duration, notes) on the selected day — also visible on Week and Month. Click without drag still uses the empty-slot Add Event UX. Events from Add Event / Paste stay events (opal chips).
- Every Day drop (rail row or drag-created block) opens `planned-action-dialog` on the new placement, so start, duration, and notes are editable in the same gesture. Cancel keeps the placement; **Remove** deletes it.
- Planned placements persist in `brain2-planned-actions` and survive refresh. Unschedule-drop on the rail still clears a timed to-do / event / placement.

## Shared components

`AgendaGrid` renders timed tasks and events in hourly rows. Used by:
- `day-view.tsx` (editable plan mode)
- `Tracking/actual-day-view.tsx` (log mode: plan ghosts + painted Tracking blocks + task timeLogs)

The red now-line is today-only. Amber sunrise and orange sunset lines load for whichever day is open, using Open-Meteo times for the saved home city. In log mode, solid pen-colored blocks are `TimeEntry` intervals from the Time Grid; clicking one opens the Tracking block editor. Ghost (dashed) plan items are clickable: Day Log opens `confirm-planned-dialog.tsx` to paint the window and, for tasks, `completeTask` so dependents unlock. Amber blocks are `task.timeLogs`. Tracked blocks that span hours are one continuous slab so a sleep stretch is a single named block, clickable in every hour it occupies.

## Capacity

The rail always shows planned minutes for the **selected day** versus that day’s waking window (`awakeWindowFor`): timed tasks’ `estimatedDuration` (skipped when a planned-action already covers that to-do), timed events, and planned-action durations. All-day events do not count as minutes. A 10-pip milled channel sits above the sentence (`capacityPipCount`); overfill keeps all ten pips lit and bolds the ink — it does not turn orange. With no sleep evidence the line reads `40m planned · waking window unknown` and the pips stay empty.

## Gaps

- Carry-over of incomplete tasks to the next period is handled in Reviews, not automatically in Plan.
- Plan text is an append log today (`v: 1` JSON entries via `lib/append-log.ts`); target is MongoDB `plans` collection documents (§3).
- Official `02-home-plan*.png` were recaptured 2026-09-21 (Win95 calendar, capacity rail, append log). Capacity still needs both ends of a night (or 3+ typical nights).
- Gem mode is Month-only. Weekly/monthly habit completions appear on the day their habit-done log is stamped (`completedDate`), not on every day of the period. List items without a custom `icon` still get the stable hashed Lists orb. Habits without a stored gem use `resolveTaskGem`'s catalog fallback. Incomplete scheduled tasks on past days stay chips.

## Middle ground (do not destyle)

Chrome is milled fascia (same language as Home → To Do / Goals / app tabs). Event
*contents* stay luminous. Do not sand chips back to gray faceplates. Do not
replace the **default** milled silver calendar with a dark-slate SaaS look —
optional **Dark** is a Plan-only latch, not the normal view.

- **Color picker** in `event-dialog.tsx`: presets plus a swatch. Persists
  `CalendarEvent.color`. Default `#8cd4a5`.
- **SHOW peach** `#e89b6c` remaps to teal `#7eb8b2` (`resolvePlanColor` and
  `lib/parse-event-text.ts`). Avoid orange house accents on Plan.
- **Spacing:** month cells ~88px tall and ≥5.5rem wide (compact numbered squares, scroll rather than crush);
  week hours 72px; day hours 152px; rail width 18.5rem. Pack rail gaps 4–6px
  (list rows 10px). Week floors are unchanged. Day Plan empty min
  is ~6rem in the Day split so the agenda can stay tall. Day agenda
  has no `58vh`/`640px` cap — Day split is tall while the rail
  list scrolls (`plan-split-day`); the agenda well fills leftover
  (`min-height: 22rem`, `max-height: none`).
- **Dark chrome:** optional, Plan-tab only. Toolbar **Dark** (`#plan-dark-mode` in
  `#plan-chrome-toggles`) latches `brain2-plan-dark`. Off = milled silver (the
  default); the button still says **Dark**. On = the button says **light mode**
  (toggle back). Furniture is near-black metal vs darker calendar paper, sage
  chips, violet Today / gem latch, across Month, Week, and Day. Does not restyle
  Habits, Lists, or portaled Plan dialogs.
- **Gem and trinket mode:** optional, Month past-days only. Toolbar **Gem and
  trinket** (`#plan-gem-mode` in `#plan-chrome-toggles`) latches
  `brain2-plan-gem-mode`. Off = chip listing (the default); the button says
  **Gem and trinket**. On = the button says **no gem no trinket**; gems and Lists
  orbs for completed work; events stay chips. Does not change cell size or
  week/day views.
- **Period toolbar:** `.plan-period` is a milled strip — metal chevrons, centered
  date as an engraved nameplate, **Today** as a metal key (violet fill when Plan
  dark is on). Same idea as Home → To Do. Not Lucide.
- **View keys:** Month / Week / Day share one bay (`.plan-view-keys`); active key
  is CRT black glass with a round phosphor power lamp (`--hab-crt-green`).
- **Legends:** fieldset captions are engraved uppercase nameplates floated off the
  bevel (padding + hairline), not blue underlined links.
- **Focus:** text inputs, textareas, and selects use navy `#000080` **app-wide**
  (`body.win95-app` in `win95.css`, `--ring` in `globals.css`). Gallery friend
  names, Lists `.fm-input`, Plan `--p-focus`, and shadcn fields all match.
  WebKit orange / peach rings are not allowed on any text field.
