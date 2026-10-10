# `components/header-tracking/` — Now

The header **Now** word key (`components/cognitive-state.tsx`) opens this popup. It is the edge of the current moment: the recent past that was not tracked yet, what is true now, and the short plan ahead. Home → Tracking (`components/Home/Tracking/tracking-desk.tsx`) is a different screen and is not this dialog.

The dialog caption is **Recent now** on the Tracking pane and **Upcoming now** on the Plan pane. The frame is the shared milled header dialog (`.hpp95` / `.hpp95-shell-only`), `min(94vw, 66rem)`. That is a small step in from `70rem`, still wide enough for the Time Grid’s pen well, counts-as find, log, day nav, and fill. Those controls are the real grid (`TimeGrid`), with wrap rules only under `.htk-grid` in `header-tracking.css`.

**Current moment** is the top of the dialog, above the Tracking / Plan switch, on both panes. It shows Activity, Location, Mood, and Company, the value, and when that value was last true. A **Metrics** key sits to the right of those lanes. It opens the same wellbeing datapoint logger (`components/Tracking/MetricLogger.tsx`) the header Capture cluster used to open, and it writes the same metrics store. **Working on** (the shared working-now strip), **Events**, and **Thought process** sit in that same block, so a lane edit, a log line, the Metrics key, and the working-now clock are available on the Plan pane too. An estimated fact wears `~` and the dashed est. treatment. Screen Time and the iPhone views stay on the Home desk and in the Time Grid. They are not lanes on Current moment.

Clicking a lane opens **Update state**. **Now** and **Recent sequence** are milled keys with the same padding family as the other popup keys. The current value opens a searchable list of every pen on that view, portaled onto the dialog so the list sits above the grid. A new name uses `ensureScopePen` / `addPen`. When the chosen value matches the last known one, **Add for now** paints a separate block at this minute and **Update** extends one continuous block from the last known moment through now. A different value keeps a single **Add for now**. Both write through `applyScopeNowUpdate` (`minute` or `open`). **Recent sequence** lists the latest blocks on that view and can still save an exact or estimated sequence (`paintScopeSequence`). The Exact control is a compact key: the box hugs the checkbox and the word.

Day notes stay on the Tracking pane. The day plan log stays on the Plan pane. Plan versus reality stays on Analytics.

## Files

| File | Purpose |
|------|---------|
| `header-tracking-popup.tsx` | Current moment, then the Tracking / Plan switch. Panes load when the dialog opens. |
| `current-moment.tsx` | Shared Current moment: four lanes, the Metrics key, Working on, Events, Thought process, Update state. |
| `update-state.tsx` | Update state. Now stamp, recent sequence, exact or estimated clocks. |
| `tracking-pane.tsx` | Day Time Grid and day notes. |
| `plan-pane.tsx` | Short sequence, plan agenda, and the day plan log. |
| `now-log-lists.tsx` | Events and Thought process lists, written through `submitTrackingLog`. |
| `pen-search-select.tsx` | Searchable pen list. A new name uses `ensureScopePen`. |
| `est-mark.tsx` | `~` and the dashed `.trk-est` treatment, plus the compact Exact key. |
| `header-tracking.css` | Popup layout. The lane color swatch corner is `--r-1`. Does not restyle the Home desk. |

## Writes

Tracking paint goes through `lib/tracking-presence.ts` (`applyScopeNowUpdate`, `paintScopeSequence`) into `useTimeTrackingStore`. A new value is a pen on that view. `open` fills the stretch from the previous log through now, so a matching pen becomes one block (**Update**). `minute` paints only this minute and keeps a seam, so a matching pen stays a second block (**Add for now** when the value is unchanged).

Events and Thought process use `submitTrackingLog` (`components/Home/Tracking/tracking-log-model.ts`), the same writer as the Home Tracking log. The lists reuse that log’s scroll well. Day notes use `TrackingDayNotes` (`appendDayNote`). The popup opens that well for today, the same day the Time Grid opens on, without changing the desk’s Expand preference or the desk’s selected day.

Plans go through `lib/header-tracking-plan.ts`: a Task (`Item.title`, `scheduledDate`, `estimatedDuration`), a planned-action placement, and a day-plan log line. The day plan composer on this pane is `PlanTextLog` (`appendPlanEntry`), the same log as Home → Plan.

`WorkingNowStrip` lives inside Current moment, on both panes, and uses the same work-session store as the desk. Cmd/Ctrl-Z while the dialog is open still uses `useTrackingUndoHotkey`.

## Later

A stack of Current moment cards may show the tracked past and the planned future as rows of stacked colored cards. That is not built.
