# `components/header-tracking/` — Now

The header **Now** word key (`components/cognitive-state.tsx`) opens this popup. It is the edge of the current moment: the recent past that was not tracked yet, what is true now, and the short plan ahead. Home → Tracking (`components/Home/Tracking/tracking-desk.tsx`) is a different screen and is not this dialog.

_Last mapped: 2026-10-25_

The dialog caption is **Recent now** on the Tracking pane and **Upcoming now** on the Plan pane. The frame is the shared milled header dialog (`.hpp95` / `.hpp95-shell-only`), `min(96vw, 84rem)`. That is wide enough for the Home desk’s three bays side by side. Below the desk’s 980px container break they stack, as on Home.

**Current moment** (`CurrentMomentDeck`) is the top of the dialog, above the
Tracking / Plan switch, on both panes. Order: the operation **Working on**
clock, then the activity-pen clock (`PenColorNowStrip` with `scopeId="activity"`:
search any Activity pen, or type a new name and create it, then start that
shared pen session), then one band of Activity / Location / Mood / Company
lanes with the **Metrics** key at its end (always up — there is no Paint…
disclosure any more), then **Update state** or the hint, then **Intake**, then
**Events**, **Notes**, and **Thought process** (`.htk-log-pair`, three across
when there is room, stacked when narrow). A log row grows with its text; the
well scrolls once the pile is taller than the cap. Metrics opens the wellbeing datapoint
logger (`components/Tracking/MetricLogger.tsx`). An estimated fact wears `~`
and the dashed est. treatment. Screen Time and the iPhone views stay on the
Home desk and in the Time Grid. They are not lanes on Current moment.

Clicking a lane opens **Update state** under the band; clicking the same lane again closes it. **Now** and
**Recent sequence** are silver keycaps (`.todo-cap` inside `.b2-now`). Pressing **Recent sequence** again returns to **Now**. The current value opens a searchable list of every pen on that
view, portaled onto the dialog so the list sits above the grid. A new name
uses `ensureScopePen` / `addPen`. A color dot sits under the view name, to the left of that field. Double-click the dot to open pen settings for that pen (`openPenSettings` — the same dialog as everywhere else).

When the chosen pen has detail splits (Pen settings → “Break this pen down by…”), those names are optional keycaps. Click selects one; click again clears it. Leaving them clear stamps the pen only, as before. **Add for now** still paints a separate block at this minute. **Update** still continues the pen through now. If a detail is selected and it differs from the block being continued, the pen fills the open stretch and the previous detail holds until this minute; the chosen detail starts at this minute. Example: Home + Living Room, then five minutes later Home + Bedroom and **Update** — Home covers the gap, Living Room lasts until now, Bedroom is this minute. A covering block is only rewritten at this minute (the head keeps the old detail).

**Notes** is one optional field for both modes. A filled note is appended to the notes on each block this action creates or lengthens, as a blank line, then ` {time}- {note} `, then a blank line. The time is the tracking clock (`minutesToLabel`, such as `2:00 PM`), not an ISO stamp. Earlier notes stay. After a successful Update, Add for now, or Save sequence, the field clears. A blank field writes nothing and does not clear notes already stored; it also does not copy the previous note onto new minutes (that copy-forward from 2026-10-25 is dropped). On a filled **Update**, the previous note is carried through the paint so the continued block stays one piece and the line is added at its end. **Recent sequence** lists the latest blocks and can collapse with **Hide recent** / **Show recent**. Double-click a row (`trk-log-row`) opens that block in `EntryDialog`, stacked on this popup. The sequence can still save an exact or estimated range (`paintScopeSequence`), and a filled note is appended on those steps the same way. The Exact control is a compact key: the box hugs the checkbox and the word.

_Last mapped: 2026-10-25._

**Intake** (`now-intake.tsx`) logs food, drink, or drug / medicine at this minute through `submitTrackingLog` (mode `intake`), so it lands on the Tracking log’s Food / Drink / Drugs shelves. The class keys sit beside the heading. Chips are your most-used names for that class (`recentIntakeByClass`), then starters (Water, Coffee, Tea; Meal, Snack). A chip only fills the name, the same rule as the log’s Recent row. Add or Enter logs, and raises the bottom-right flag when the log’s flag setting is on. Under that, today’s bare intake (`classifyLogInstant` list `intake` — no food, drink, or drug class) is listed when any exist. Food, Drink, and Drug / med call `setIntakeClass`, the same `intakeClass` and `eventKind` write as a classed log line. A row leaves this list once it has a class. Classed items stay on the Tracking log shelves and are not repeated here. _Last mapped: 2026-10-25._

The **Tracking pane** mounts the Home desk’s bays: `PenPalette variant="rack"`, `TimeGrid desk` with `PenModeDeck`, and the time recorder column. The day summary sits under them in the same `.trk-lace` frame. All of it is inside a `.trk95` wrapper (`.htk-desk`), because the summary well’s styles are scoped to `.trk95`. Without it the well crowded the bottom of the dialog.

Day notes stay on the Tracking pane. The day plan log stays on the Plan pane. Plan versus reality stays on Analytics.

## Files

| File | Purpose |
|------|---------|
| `header-tracking-popup.tsx` | Current moment, then the Tracking / Plan switch. Panes load when the dialog opens. |
| `current-moment.tsx` | Shared Current moment + `CurrentMomentDeck`: operation clock and activity-pen clock; four lanes + Metrics, always up; Update state under a picked lane; Intake, Events, Notes, Thought process. |
| `update-state.tsx` | Update state. Now stamp, optional detail keys, color dot, notes, recent sequence (collapsible; double-click opens `EntryDialog`), exact or estimated clocks. |
| `tracking-pane.tsx` | The Home desk’s three bays (pen rack, Time Grid screen, time recorder) and the day summary in the lace frame. |
| `plan-pane.tsx` | Short sequence, plan agenda, and the day plan log. |
| `now-log-lists.tsx` | _Last mapped: 2026-10-27._ Events, Notes, and Thought process. Written through `submitTrackingLog` with `logSource: "now-popup"`. A Text log instant with no `eventKind` is a Note (`classifyLogBookRow` list `note`). The Tracking log shelves it the same way. |
| `now-intake.tsx` | Intake row: class keys, quick chips, name field, and today's uncategorized intake with Food / Drink / Drug / med sort (`setIntakeClass`). Same writer as the Tracking log. |
| `pen-search-select.tsx` | Searchable pen list. A new name uses `ensureScopePen`. |
| `est-mark.tsx` | `~` and the dashed `.trk-est` treatment, plus the compact Exact key. |
| `header-tracking.css` | Popup layout. The lane color swatch corner is `--r-1`. Does not restyle the Home desk. |

## Writes

Tracking paint goes through `lib/tracking-presence.ts` (`applyScopeNowUpdate`, `paintScopeSequence`) into `useTimeTrackingStore`. A new value is a pen on that view. `open` fills the stretch from the previous log through now, so a matching pen becomes one block (**Update**). `minute` paints only this minute and keeps a seam, so a matching pen stays a second block (**Add for now** when the value is unchanged). Pass `variantIds` to store a detail split; when that detail differs from the continued block, the old detail is painted up to this minute and the new detail starts here. Pass `notes` when the field is filled. The stamp appends `\n\n {time}- {note} \n\n` and does not replace the notes already on the block. A blank field does not clear them and does not copy them onto new minutes. _Last mapped: 2026-10-25._

_Last mapped: 2026-10-27._ Events, Notes, and Thought process use `submitTrackingLog` (`components/Home/Tracking/tracking-log-model.ts`), the same writer as the Home Tracking log, with `logSource: "now-popup"`. Events are `mode: "event"`. Notes are `mode: "note"` (a general note). The Home log shelves that row under Notes, not Events. Thought process is `mode: "thought"`. Intake on this popup passes `now-popup` too. Enter adds the line; Shift+Enter starts another line inside the field. The first line is the title and later lines are `notes`, and the row grows to show both. The lists reuse that log’s scroll well. Day notes use `TrackingDayNotes` (`appendDayNote`). The popup opens that well for today, the same day the Time Grid opens on, without changing the desk’s Expand preference or the desk’s selected day.

_Last mapped: 2026-10-24_ Now’s log rows sit in a column flexbox with a height cap (`.htk-moment .trk-log` in `header-tracking.css`). Rows stay `flex: 0 0 auto` and the copy wraps (`white-space: pre-wrap`), so a long thought grows the row instead of painting over the next one. The Tracking log board has the same shrink bug if a row is `flex: 1` (`.trk-log` in `tracking-scope.css`, board rules ~2261).

Plans go through `lib/header-tracking-plan.ts`: a Task (`Item.title`, `scheduledDate`, `estimatedDuration`), a planned-action placement, and a day-plan log line. The day plan composer on this pane is `PlanTextLog` (`appendPlanEntry`), the same log as Home → Plan. A saved plan row with an open task has **Skip**. That opens the optional why, then `recordPlanSkipped`. Skip on the prompt still marks the task missed and writes no `missReason`.

`WorkingNowStrip` lives inside Current moment, on both panes, and uses the same work-session store as the desk. Its operation field searches the operation list and can create one (`createOperation`) when the name is missing. Under it, `PenColorNowStrip` (`scopeId="activity"`) is the same pen-color session as the Tracking desk, limited to Activity pens: search, assign, or create, then start the clock. _Last mapped: 2026-10-25._ A pen started on another view still shows here while that session is live. Cmd/Ctrl-Z while the dialog is open still uses `useTrackingUndoHotkey`.

## Later

A stack of Current moment cards may show the tracked past and the planned future as rows of stacked colored cards. That is not built.
