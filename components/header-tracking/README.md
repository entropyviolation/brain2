# `components/header-tracking/` — Now

The header **Now** word key (`components/cognitive-state.tsx`) opens this popup. It is the edge of the current moment: the recent past that was not tracked yet, what is true now, and the short plan ahead. Home → Tracking (`components/Home/Tracking/tracking-desk.tsx`) is a different screen and is not this dialog.

_Last mapped: 2026-10-16_

The dialog caption is **Recent now** on the Tracking pane and **Upcoming now** on the Plan pane. The frame is the shared milled header dialog (`.hpp95` / `.hpp95-shell-only`), `min(96vw, 84rem)`. That is wide enough for the Home desk’s three bays side by side. Below the desk’s 980px container break they stack, as on Home.

**Current moment** (`CurrentMomentDeck`) is the top of the dialog, above the
Tracking / Plan switch, on both panes. Order: **Working on**, then one band of
Activity / Location / Mood / Company lanes with the **Metrics** key at its end
(always up — there is no Paint… disclosure any more), then **Update state** or
the hint, then **Intake**, then **Events** and **Thought process** side by side
(`.htk-log-pair`, stacked when narrow). Metrics opens the wellbeing datapoint
logger (`components/Tracking/MetricLogger.tsx`). An estimated fact wears `~`
and the dashed est. treatment. Screen Time and the iPhone views stay on the
Home desk and in the Time Grid. They are not lanes on Current moment.

Clicking a lane opens **Update state** under the band; clicking the same lane again closes it. **Now** and
**Recent sequence** are milled keys with the same padding family as the other
popup keys. The current value opens a searchable list of every pen on that
view, portaled onto the dialog so the list sits above the grid. A new name
uses `ensureScopePen` / `addPen`. When the chosen value matches the last known
one, **Add for now** paints a separate block at this minute and **Update**
extends one continuous block from the last known moment through now. A
different value keeps a single **Add for now**. Both write through
`applyScopeNowUpdate` (`minute` or `open`). **Recent sequence** lists the
latest blocks on that view and can still save an exact or estimated sequence
(`paintScopeSequence`). The Exact control is a compact key: the box hugs the
checkbox and the word.

**Intake** (`now-intake.tsx`) logs food, drink, or drug / medicine at this minute through `submitTrackingLog` (mode `intake`), so it lands on the Tracking log’s Food / Drink / Drugs shelves. The class keys sit beside the heading. Chips are your most-used names for that class (`recentIntakeByClass`), then starters (Water, Coffee, Tea; Meal, Snack). A chip only fills the name, the same rule as the log’s Recent row. Add or Enter logs, and raises the bottom-right flag when the log’s flag setting is on.

The **Tracking pane** mounts the Home desk’s bays: `PenPalette variant="rack"`, `TimeGrid desk` with `PenModeDeck`, and the time recorder column. The day summary sits under them in the same `.trk-lace` frame. All of it is inside a `.trk95` wrapper (`.htk-desk`), because the summary well’s styles are scoped to `.trk95`. Without it the well crowded the bottom of the dialog.

Day notes stay on the Tracking pane. The day plan log stays on the Plan pane. Plan versus reality stays on Analytics.

## Files

| File | Purpose |
|------|---------|
| `header-tracking-popup.tsx` | Current moment, then the Tracking / Plan switch. Panes load when the dialog opens. |
| `current-moment.tsx` | Shared Current moment + `CurrentMomentDeck`: Working on; four lanes + Metrics, always up; Update state under a picked lane; Intake, Events, Thought process. |
| `update-state.tsx` | Update state. Now stamp, recent sequence, exact or estimated clocks. |
| `tracking-pane.tsx` | The Home desk’s three bays (pen rack, Time Grid screen, time recorder) and the day summary in the lace frame. |
| `plan-pane.tsx` | Short sequence, plan agenda, and the day plan log. |
| `now-log-lists.tsx` | Events and Thought process lists, written through `submitTrackingLog`. |
| `now-intake.tsx` | Intake row: class keys, quick chips, name field. Same writer as the Tracking log. |
| `pen-search-select.tsx` | Searchable pen list. A new name uses `ensureScopePen`. |
| `est-mark.tsx` | `~` and the dashed `.trk-est` treatment, plus the compact Exact key. |
| `header-tracking.css` | Popup layout. The lane color swatch corner is `--r-1`. Does not restyle the Home desk. |

## Writes

Tracking paint goes through `lib/tracking-presence.ts` (`applyScopeNowUpdate`, `paintScopeSequence`) into `useTimeTrackingStore`. A new value is a pen on that view. `open` fills the stretch from the previous log through now, so a matching pen becomes one block (**Update**). `minute` paints only this minute and keeps a seam, so a matching pen stays a second block (**Add for now** when the value is unchanged).

Events and Thought process use `submitTrackingLog` (`components/Home/Tracking/tracking-log-model.ts`), the same writer as the Home Tracking log. The lists reuse that log’s scroll well. Day notes use `TrackingDayNotes` (`appendDayNote`). The popup opens that well for today, the same day the Time Grid opens on, without changing the desk’s Expand preference or the desk’s selected day.

_Last mapped: 2026-10-20_ Log rows sit in a column flexbox with a height cap (`.trk-log` in `tracking-scope.css`, board rules ~2261). Rows must stay `flex: 0 0 auto`, or long text shrinks them to `min-height` and paints over the next row.

Plans go through `lib/header-tracking-plan.ts`: a Task (`Item.title`, `scheduledDate`, `estimatedDuration`), a planned-action placement, and a day-plan log line. The day plan composer on this pane is `PlanTextLog` (`appendPlanEntry`), the same log as Home → Plan. A saved plan row with an open task has **Skip**. That opens the optional why, then `recordPlanSkipped`. Skip on the prompt still marks the task missed and writes no `missReason`.

`WorkingNowStrip` lives inside Current moment, on both panes, and uses the same work-session store as the desk. Cmd/Ctrl-Z while the dialog is open still uses `useTrackingUndoHotkey`.

## Later

A stack of Current moment cards may show the tracked past and the planned future as rows of stacked colored cards. That is not built.
